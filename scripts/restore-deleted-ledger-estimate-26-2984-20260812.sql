-- 26-2984 は、削除済みの古い見積が同じ管理番号を占有していたため、
-- 一括復元から安全に除外されていた。旧payloadを丸ごと退避し、
-- 現行台帳の基本情報・見積合計・原価行から再構成する。

begin;

create table if not exists public.safety_restore_deleted_estimate_26_2984_20260812 (
  management_number text primary key,
  old_project_id uuid,
  old_payload jsonb,
  old_revision bigint,
  old_deleted_at timestamptz,
  backed_up_at timestamptz not null default now()
);

insert into public.safety_restore_deleted_estimate_26_2984_20260812(
  management_number,old_project_id,old_payload,old_revision,old_deleted_at
)
select management_number,project_id,payload,revision,deleted_at
from public.estimate_projects
where management_number='26-2984'
on conflict(management_number) do nothing;

with source_lines as (
  select
    m.id as project_id,
    m.management_number,
    m.reception_date,
    m.staff_name,
    m.property_name,
    m.room_number,
    m.work_name,
    coalesce(nullif(m.customer_name,''),nullif(m.client_name,''),nullif(m.billing_client_name,''),'') as client_name,
    coalesce(nullif(m.customer_contact_name,''),nullif(m.invoice_contact_name,''),'') as client_contact_name,
    coalesce(m.category,'外注費') as project_category,
    coalesce(m.accounting_month,'') as accounting_month,
    m.scheduled_completion_date,
    m.completed_on,
    coalesce(m.property_postal_code,'') as property_postal_code,
    coalesce(m.property_address,'') as property_address,
    round(coalesce(m.sales_estimate_ex_tax,0)) as target_sales,
    li.line_index,
    li.source_row_key,
    coalesce(nullif(li.item_name,''),nullif(li.raw_data->>'work_name',''),nullif(li.category,''),'過去原価') as item_name,
    coalesce(li.vendor_name,li.raw_data->>'vendor_name','') as vendor_name,
    coalesce(li.category,li.raw_data->>'category','外注費') as line_category,
    coalesce(li.note,li.raw_data->>'notes','') as note,
    li.raw_data,
    round(coalesce(li.order_amount_ex_tax,li.cost_amount_ex_tax,(li.raw_data->>'estimate_amount_ex_tax')::numeric,0)) as line_cost
  from public.management_numbers m
  join public.project_line_items li using(management_number)
  where m.management_number='26-2984'
    and m.deleted_at is null
    and li.deleted_at is null
    and li.document_type='order'
    and li.raw_data->>'sheet_name'='原価'
), weighted as (
  select *,
    sum(abs(line_cost)) over(partition by management_number) as total_weight,
    row_number() over(partition by management_number order by line_index,source_row_key) as row_no,
    count(*) over(partition by management_number) as row_count
  from source_lines
), provisional as (
  select *,case
    when target_sales<=0 then null
    when row_no=row_count then null
    when total_weight>0 then round(target_sales*abs(line_cost)/total_weight)
    when row_no=1 then target_sales
    else 0 end as provisional_sell
  from weighted
), allocated as (
  select *,case
    when target_sales<=0 then null
    when row_no=row_count then target_sales-coalesce(sum(provisional_sell) over(
      partition by management_number order by row_no rows between unbounded preceding and 1 preceding
    ),0)
    else provisional_sell end as sell_amount
  from provisional
), rebuilt as (
  select
    management_number,
    project_id,
    jsonb_build_object(
      'v',21,'estimateLayout','landscape','rate','25',
      'rows',jsonb_agg(jsonb_build_object(
        'id',row_no,'type','item','name',item_name,'spec','','qty',1,'unit','式',
        'cost',line_cost,'orderCost',line_cost,'sellOverride',sell_amount,'note',note,
        'vendor',vendor_name,'category',line_category,'_legacyImport',true,
        '_legacySourceKey',source_row_key,'_legacyLineIndex',line_index,'_legacyRawData',raw_data
      ) order by row_no),
      'rowId',max(row_no),'ordRows','[]'::jsonb,'ordRowId',0,'invRows','[]'::jsonb,'invRowId',0,
      'basic',jsonb_build_object(
        'kanri',management_number,'staff',max(staff_name),'uketsuke',max(reception_date),
        'category',max(project_category),'keijo',max(accounting_month),
        'kanko_date',max(scheduled_completion_date),'completedOn',max(completed_on),
        'client',max(client_name),'clientContact',max(client_contact_name),
        'honorific','御中','kojiname',concat_ws(' ',max(property_name),max(room_number),max(work_name)),
        'property',max(property_name),'room',max(room_number),'postal',max(property_postal_code),
        'place',max(property_address),'summary',max(work_name),'payment','完工金100%','paymentSel','完工金100%'
      ),
      'ledger',jsonb_build_object('salesEstimateExTax',max(target_sales)),
      'ledgerEstimateRestore',jsonb_build_object(
        'source','management_numbers + project_line_items:原価',
        'restoredAt','2026-08-12','mode','replaced_deleted_conflicting_estimate'
      )
    ) as payload
  from allocated
  group by management_number,project_id
)
update public.estimate_projects ep
set project_id=r.project_id,
    payload=r.payload,
    revision=coalesce(ep.revision,0)+1,
    deleted_at=null,
    deleted_by=null,
    updated_at=now()
from rebuilt r
where ep.management_number=r.management_number;

commit;
