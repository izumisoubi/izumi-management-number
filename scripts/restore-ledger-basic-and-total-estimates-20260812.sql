-- 台帳に基本情報・見積合計だけが残っている案件をオンライン見積へ復元する。
-- 既存の estimate_projects は一切上書きしない。
-- 元明細が無い場合は、存在しない内訳を推測せず、見積合計を1式として復元する。

begin;

create table if not exists public.safety_restore_ledger_basic_total_20260812 (
  management_number text primary key,
  project_id uuid not null,
  payload jsonb not null,
  restored_at timestamptz not null default now()
);

with source_projects as (
  select
    m.*,
    round(coalesce(m.sales_estimate_ex_tax,0)) as target_sales,
    coalesce(
      nullif(m.customer_name,''),
      nullif(m.client_name,''),
      nullif(m.billing_client_name,''),
      ''
    ) as resolved_client,
    coalesce(nullif(m.customer_contact_name,''),nullif(m.invoice_contact_name,''),'') as resolved_contact,
    coalesce(nullif(m.work_name,''),nullif(m.work_summary,''),'工事一式') as resolved_work,
    coalesce(
      nullif(m.project_name,''),
      nullif(concat_ws(' ',nullif(m.property_name,''),nullif(m.room_number,''),nullif(m.work_name,'')),''),
      nullif(m.work_name,''),
      '工事一式'
    ) as resolved_project_name
  from public.management_numbers m
  where m.deleted_at is null
    and not exists (
      select 1 from public.estimate_projects ep
      where ep.management_number=m.management_number
    )
), payloads as (
  select
    management_number,
    id as project_id,
    jsonb_build_object(
      'v',21,
      'estimateLayout','landscape',
      'rate','25',
      'rows',case when target_sales<>0 then jsonb_build_array(jsonb_build_object(
        'id',1,
        'type','item',
        'name',resolved_work,
        'spec','',
        'qty',1,
        'unit','式',
        'cost','',
        'orderCost','',
        'sellOverride',target_sales,
        'note','',
        'vendor','',
        'category',coalesce(nullif(category,''),'外注費'),
        '_ledgerTotalFallback',true
      )) else '[]'::jsonb end,
      'rowId',case when target_sales<>0 then 1 else 0 end,
      'ordRows','[]'::jsonb,
      'ordRowId',0,
      'invRows','[]'::jsonb,
      'invRowId',0,
      'basic',jsonb_build_object(
        'kanri',management_number,
        'staff',coalesce(staff_name,''),
        'uketsuke',coalesce(reception_date::text,''),
        'status',coalesce(nullif(status,''),nullif(project_status,''),'見積中'),
        'category',coalesce(nullif(category,''),'外注費'),
        'keijo',coalesce(accounting_month,''),
        'kanko_date',coalesce(scheduled_completion_date::text,''),
        'completedOn',coalesce(completed_on::text,''),
        'client',resolved_client,
        'clientContact',resolved_contact,
        'honorific','御中',
        'kojiname',resolved_project_name,
        'property',coalesce(property_name,''),
        'room',coalesce(room_number,''),
        'postal',coalesce(property_postal_code,''),
        'place',coalesce(property_address,''),
        'summary',resolved_work,
        'duration',coalesce(work_duration,''),
        'payment',coalesce(nullif(payment_terms,''),'完工金100%'),
        'paymentSel',coalesce(nullif(payment_terms,''),'完工金100%'),
        'expire',coalesce(estimate_expiry,''),
        'cond',coalesce(estimate_conditions,''),
        'date',coalesce(estimate_date::text,''),
        'invClient',coalesce(nullif(billing_client_name,''),resolved_client),
        'invDept',coalesce(invoice_department,''),
        'invAddr',coalesce(invoice_address,''),
        'invTanto',coalesce(nullif(invoice_contact_name,''),resolved_contact),
        'invDue',coalesce(invoice_due,''),
        'invNote',coalesce(notes,'')
      ),
      'invOv',jsonb_build_object(
        'client',coalesce(nullif(billing_client_name,''),resolved_client),
        'dept',coalesce(invoice_department,''),
        'addr',coalesce(invoice_address,''),
        'date',coalesce(invoice_date::text,''),
        'due',coalesce(invoice_due,''),
        'staff',coalesce(invoice_staff,'')
      ),
      'ledger',jsonb_build_object(
        'customerName',resolved_client,
        'customerContactName',resolved_contact,
        'scheduledCompletionDate',coalesce(scheduled_completion_date::text,''),
        'completedOn',coalesce(completed_on::text,''),
        'salesEstimateExTax',target_sales,
        'landlordBurdenExTax',coalesce(landlord_burden_ex_tax,0),
        'tenantBurdenExTax',coalesce(tenant_burden_ex_tax,0),
        'invoiceDate',coalesce(invoice_date::text,''),
        'invoiceExTax',coalesce(invoice_subtotal_ex_tax,sales_invoice_ex_tax,0),
        'invoiceTaxIn',coalesce(sales_invoice_tax_in,0),
        'accountingYear',coalesce(accounting_year,fiscal_year)
      ),
      'ledgerEstimateRestore',jsonb_build_object(
        'source','management_numbers',
        'restoredAt','2026-08-12',
        'mode',case when target_sales<>0 then 'ledger_sales_total_fallback' else 'basic_information_only' end
      )
    ) as payload
  from source_projects
)
insert into public.safety_restore_ledger_basic_total_20260812(management_number,project_id,payload)
select management_number,project_id,payload from payloads
on conflict(management_number) do nothing;

insert into public.estimate_projects(management_number,project_id,payload,revision,created_at,updated_at)
select b.management_number,b.project_id,b.payload,0,now(),now()
from public.safety_restore_ledger_basic_total_20260812 b
where not exists (
  select 1 from public.estimate_projects ep
  where ep.management_number=b.management_number
);

commit;
