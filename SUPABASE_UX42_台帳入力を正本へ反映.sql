-- UX42: 台帳を簡易入力窓として使い、許可された直接入力だけを見積の正本へ書き戻す。
-- 自動連携・計算項目は対象にしない。UX16〜UX40を適用済みの本番／ステージングで実行すること。
begin;

drop function if exists public.sync_ledger_inputs_to_estimate(uuid,text,text,jsonb);

create or replace function public.sync_ledger_inputs_to_estimate(
  p_project_id uuid,
  p_view_key text,
  p_vendor_name text default '',
  p_category text default '',
  p_changes jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  project_row public.management_numbers%rowtype;
  estimate_row public.estimate_projects%rowtype;
  merged_payload jsonb;
  basic jsonb;
  invoice jsonb;
  ord_rows jsonb;
  updated_rows jsonb;
  writeback_meta jsonb;
  field_key text;
  requested text;
  editor_name text;
  applied text[]:=array[]::text[];
begin
  if not public.is_current_app_user_enabled() then
    raise exception '有効な社員ログインが必要です';
  end if;
  select * into project_row from public.management_numbers
   where id=p_project_id and deleted_at is null for update;
  if project_row.id is null then raise exception '案件が見つかりません'; end if;
  select * into estimate_row from public.estimate_projects
   where management_number=project_row.management_number and deleted_at is null for update;
  if estimate_row.project_id is null then
    return jsonb_build_object('applied','[]'::jsonb,'revision',null);
  end if;
  select profile.display_name into editor_name
    from public.app_user_profiles profile
    join auth.users account on lower(account.email::text)=profile.email
   where account.id=auth.uid();

  merged_payload:=coalesce(estimate_row.payload,'{}'::jsonb);
  writeback_meta:=coalesce(merged_payload->'ledgerWriteback','{}'::jsonb);
  basic:=coalesce(merged_payload->'basic','{}'::jsonb);
  invoice:=coalesce(merged_payload->'invOv','{}'::jsonb);

  -- 管理番号台帳: 基本情報で直接入力できる項目だけを正本へ反映する。
  if p_view_key='management' then
    for field_key in select jsonb_object_keys(coalesce(p_changes,'{}'::jsonb)) loop
      requested:=nullif(trim(p_changes->field_key->>'requested'),'');
      if requested is null then continue; end if;
      if field_key in ('reception_date','input_date') then
        basic:=jsonb_set(basic,'{uketsuke}',to_jsonb(requested),true);
      elsif field_key='staff_name' then
        basic:=jsonb_set(basic,'{staff}',to_jsonb(requested),true);
      elsif field_key='work_name' then
        basic:=jsonb_set(basic,'{summary}',to_jsonb(requested),true);
      elsif field_key='scheduled_completion_date' then
        basic:=jsonb_set(basic,'{kanko_date}',to_jsonb(requested),true);
      elsif field_key='completed_on' then
        basic:=jsonb_set(basic,'{completedOn}',to_jsonb(requested),true);
      elsif field_key='accounting_month' then
        basic:=jsonb_set(basic,'{keijo}',to_jsonb(requested),true);
      elsif field_key='customer_name' then
        basic:=jsonb_set(basic,'{client}',to_jsonb(requested),true);
      elsif field_key='customer_contact_name' then
        basic:=jsonb_set(basic,'{clientContact}',to_jsonb(requested),true);
      elsif field_key='notes' then
        basic:=jsonb_set(basic,'{invNote}',to_jsonb(requested),true);
      else
        continue;
      end if;
      applied:=array_append(applied,field_key);
    end loop;
    merged_payload:=jsonb_set(merged_payload,'{basic}',basic,true);
  end if;

  -- 請求台帳: 請求日・計上月は請求／基本情報の画面へ戻す。
  if p_view_key='billing' then
    if nullif(trim(p_changes->'invoice_date'->>'requested'),'') is not null then
      invoice:=jsonb_set(invoice,'{date}',to_jsonb(p_changes->'invoice_date'->>'requested'),true);
      applied:=array_append(applied,'invoice_date');
    end if;
    if nullif(trim(p_changes->'accounting_month'->>'requested'),'') is not null then
      basic:=jsonb_set(basic,'{keijo}',to_jsonb(p_changes->'accounting_month'->>'requested'),true);
      applied:=array_append(applied,'accounting_month');
    end if;
    merged_payload:=jsonb_set(jsonb_set(merged_payload,'{basic}',basic,true),'{invOv}',invoice,true);
  end if;

  -- 原価台帳: 同じ業者の発注明細へ外注請求・支払・要確認を戻す。
  if p_view_key in ('cost','unordered') and nullif(trim(p_vendor_name),'') is not null then
    if p_changes ?| array['invoice_amount_ex_tax','invoice_from_vendor_date','payment_date','reminder_required'] then
      select coalesce(jsonb_agg(
        case when coalesce(item->>'vendor','')=p_vendor_name
                    -- 旧発注明細にはカテゴリを保存していないため、その場合は案件カテゴリとして扱う。
                    and (nullif(trim(p_category),'') is null or coalesce(nullif(item->>'category',''),p_category)=p_category) then
          jsonb_strip_nulls(
            item
            || case when p_changes ? 'invoice_amount_ex_tax' then jsonb_build_object('supplierInvoiceAmount',p_changes->'invoice_amount_ex_tax'->>'requested') else '{}'::jsonb end
            || case when p_changes ? 'invoice_from_vendor_date' then jsonb_build_object('supplierInvoiceDate',p_changes->'invoice_from_vendor_date'->>'requested') else '{}'::jsonb end
            || case when p_changes ? 'payment_date' then jsonb_build_object('supplierPaymentDate',p_changes->'payment_date'->>'requested','supplierPaid',(nullif(trim(p_changes->'payment_date'->>'requested'),'') is not null)) else '{}'::jsonb end
            || case when p_changes ? 'reminder_required' then jsonb_build_object('reminderRequired',coalesce((p_changes->'reminder_required'->>'requested')::boolean,false)) else '{}'::jsonb end
          )
        else item end
      ),'[]'::jsonb) into updated_rows
      from jsonb_array_elements(coalesce(merged_payload->'ordRows','[]'::jsonb)) as item;
      merged_payload:=jsonb_set(merged_payload,'{ordRows}',updated_rows,true);
      foreach field_key in array array['invoice_amount_ex_tax','invoice_from_vendor_date','payment_date','reminder_required'] loop
        if p_changes ? field_key then applied:=array_append(applied,field_key); end if;
      end loop;
    end if;
  end if;

  if coalesce(array_length(applied,1),0)=0 then
    return jsonb_build_object('applied','[]'::jsonb,'revision',estimate_row.revision);
  end if;

  foreach field_key in array applied loop
    writeback_meta:=jsonb_set(writeback_meta,array[p_view_key||'.'||field_key],
      jsonb_build_object('at',now(),'label','台帳から修正','by',coalesce(editor_name,'')),true);
  end loop;
  merged_payload:=jsonb_set(merged_payload,'{ledgerWriteback}',writeback_meta,true);

  update public.estimate_projects set payload=merged_payload,revision=estimate_row.revision+1,
    updated_by=auth.uid(),updated_at=now()
   where project_id=estimate_row.project_id;
  -- project_data と台帳表示用の正本列を同じ更新で揃える。
  -- ここを更新しないと、次回台帳を開いた時に旧値が再表示されてしまう。
  update public.management_numbers set project_data=merged_payload,
    reception_date=coalesce(nullif(basic->>'uketsuke','')::date,reception_date),
    staff_name=coalesce(nullif(trim(basic->>'staff'),''),staff_name),
    work_name=coalesce(nullif(trim(basic->>'summary'),''),work_name),
    client_name=coalesce(nullif(trim(basic->>'client'),''),client_name),
    customer_name=coalesce(nullif(trim(basic->>'client'),''),customer_name),
    customer_contact_name=coalesce(nullif(trim(basic->>'clientContact'),''),customer_contact_name),
    scheduled_completion_date=coalesce(nullif(basic->>'kanko_date','')::date,scheduled_completion_date),
    completed_on=coalesce(nullif(basic->>'completedOn','')::date,completed_on),
    accounting_month=coalesce(nullif(trim(basic->>'keijo'),''),accounting_month),
    notes=coalesce(nullif(trim(basic->>'invNote'),''),notes),
    revision=project_row.revision+1,synced_at=now(),synced_by=auth.uid(),updated_by=auth.uid(),updated_at=now()
   where id=project_row.id;
  insert into public.project_audit_log(project_id,management_number,action,source,before_data,after_data,changed_by)
  values(project_row.id,project_row.management_number,'台帳入力を見積正本へ反映',p_view_key,
    jsonb_build_object('estimate_revision',estimate_row.revision),
    jsonb_build_object('estimate_revision',estimate_row.revision+1,'applied_fields',to_jsonb(applied)),auth.uid());
  return jsonb_build_object('applied',to_jsonb(applied),'revision',estimate_row.revision+1);
end;
$$;

revoke all on function public.sync_ledger_inputs_to_estimate(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.sync_ledger_inputs_to_estimate(uuid,text,text,text,jsonb) to authenticated;
commit;
