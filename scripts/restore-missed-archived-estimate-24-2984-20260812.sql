-- 2026-08-07 の旧テスト案件 26-* → 24-* 退避で漏れた 24-2984 を、
-- 直近の週次バックアップから復元する。現行 26-2984 は更新しない。

begin;

create table if not exists public.safety_restore_archived_estimate_24_2984_20260812 (
  management_number text primary key,
  source_backup_id uuid not null,
  management_row jsonb not null,
  estimate_row jsonb not null,
  restored_at timestamptz not null default now()
);

with backup as (
  select id,payload
  from public.system_backups
  where id='69575930-fc9b-4da0-bd67-f4135fffe7e3'
), management_row as (
  select b.id backup_id,x row_data
  from backup b,lateral jsonb_array_elements(b.payload->'management_numbers') x
  where x->>'management_number'='26-2984'
), estimate_row as (
  select b.id backup_id,x row_data
  from backup b,lateral jsonb_array_elements(b.payload->'estimate_projects') x
  where x->>'management_number'='26-2984'
)
insert into public.safety_restore_archived_estimate_24_2984_20260812(
  management_number,source_backup_id,management_row,estimate_row
)
select '24-2984',m.backup_id,m.row_data,e.row_data
from management_row m join estimate_row e using(backup_id)
on conflict(management_number) do nothing;

with src as (
  select management_row row_data
  from public.safety_restore_archived_estimate_24_2984_20260812
  where management_number='24-2984'
)
insert into public.management_numbers(
  id,management_number,fiscal_year,sequence_no,reception_date,staff_name,
  property_name,room_number,work_name,client_name,status,created_by,created_at,
  updated_at,cost_sheet_submitted_on,scheduled_completion_date,completed_on,
  invoice_date,billing_client_name,customer_name,customer_contact_name,
  sales_estimate_ex_tax,landlord_burden_tax_in,tenant_burden_tax_in,
  sales_invoice_tax_in,fee_amount,parking_expense,accounting_month,
  payment_received_on,notes,accounting_year,project_name,work_summary,
  property_postal_code,property_address,work_duration,payment_terms,
  estimate_date,estimate_expiry,estimate_conditions,implementing_company_id,
  implementing_company_name,estimate_tax,estimate_total_tax_in,
  order_total_ex_tax,order_tax,order_total_tax_in,external_cost_ex_tax,
  self_labor_ex_tax,self_materials_ex_tax,total_cost_ex_tax,gross_profit_ex_tax,
  gross_profit_rate,invoice_subtotal_ex_tax,invoice_tax,invoice_department,
  invoice_address,invoice_contact_name,invoice_due,invoice_staff,order_start_date,
  order_end_date,key_return_date,construction_conditions,key_return_method,
  photo_instructions,order_notes,report_issue_date,report_completed_date,
  project_data,synced_at,synced_by,closing_sales_accounting_month,category,
  project_status,customer_payment_status,vendor_payment_status,sales_invoice_ex_tax,
  received_amount_ex_tax,revision,updated_by,landlord_burden_ex_tax,
  tenant_burden_ex_tax,bank_received_amount_tax_in,bank_received_amount_ex_tax
)
select
  gen_random_uuid(),'24-2984','24',2984,
  (row_data->>'reception_date')::date,row_data->>'staff_name',
  row_data->>'property_name',row_data->>'room_number',row_data->>'work_name',
  row_data->>'client_name',row_data->>'status',(row_data->>'created_by')::uuid,
  (row_data->>'created_at')::timestamptz,now(),
  (row_data->>'cost_sheet_submitted_on')::date,
  (row_data->>'scheduled_completion_date')::date,(row_data->>'completed_on')::date,
  (row_data->>'invoice_date')::date,row_data->>'billing_client_name',
  row_data->>'customer_name',row_data->>'customer_contact_name',
  (row_data->>'sales_estimate_ex_tax')::numeric,
  (row_data->>'landlord_burden_tax_in')::numeric,(row_data->>'tenant_burden_tax_in')::numeric,
  (row_data->>'sales_invoice_tax_in')::numeric,(row_data->>'fee_amount')::numeric,
  (row_data->>'parking_expense')::numeric,row_data->>'accounting_month',
  (row_data->>'payment_received_on')::date,row_data->>'notes','2024',
  row_data->>'project_name',row_data->>'work_summary',row_data->>'property_postal_code',
  row_data->>'property_address',row_data->>'work_duration',row_data->>'payment_terms',
  (row_data->>'estimate_date')::date,row_data->>'estimate_expiry',
  row_data->>'estimate_conditions',row_data->>'implementing_company_id',
  row_data->>'implementing_company_name',(row_data->>'estimate_tax')::numeric,
  (row_data->>'estimate_total_tax_in')::numeric,(row_data->>'order_total_ex_tax')::numeric,
  (row_data->>'order_tax')::numeric,(row_data->>'order_total_tax_in')::numeric,
  (row_data->>'external_cost_ex_tax')::numeric,(row_data->>'self_labor_ex_tax')::numeric,
  (row_data->>'self_materials_ex_tax')::numeric,(row_data->>'total_cost_ex_tax')::numeric,
  (row_data->>'gross_profit_ex_tax')::numeric,(row_data->>'gross_profit_rate')::numeric,
  (row_data->>'invoice_subtotal_ex_tax')::numeric,(row_data->>'invoice_tax')::numeric,
  row_data->>'invoice_department',row_data->>'invoice_address',
  row_data->>'invoice_contact_name',row_data->>'invoice_due',row_data->>'invoice_staff',
  (row_data->>'order_start_date')::date,(row_data->>'order_end_date')::date,
  (row_data->>'key_return_date')::date,row_data->>'construction_conditions',
  row_data->>'key_return_method',row_data->>'photo_instructions',row_data->>'order_notes',
  (row_data->>'report_issue_date')::date,(row_data->>'report_completed_date')::date,
  row_data->'project_data',(row_data->>'synced_at')::timestamptz,
  (row_data->>'synced_by')::uuid,row_data->>'closing_sales_accounting_month',
  row_data->>'category',row_data->>'project_status',row_data->>'customer_payment_status',
  row_data->>'vendor_payment_status',(row_data->>'sales_invoice_ex_tax')::numeric,
  (row_data->>'received_amount_ex_tax')::numeric,coalesce((row_data->>'revision')::int,0),
  (row_data->>'updated_by')::uuid,(row_data->>'landlord_burden_ex_tax')::numeric,
  (row_data->>'tenant_burden_ex_tax')::numeric,
  (row_data->>'bank_received_amount_tax_in')::numeric,
  (row_data->>'bank_received_amount_ex_tax')::numeric
from src
where not exists(select 1 from public.management_numbers where management_number='24-2984');

with src as (
  select estimate_row row_data
  from public.safety_restore_archived_estimate_24_2984_20260812
  where management_number='24-2984'
), target as (
  select id from public.management_numbers where management_number='24-2984'
)
insert into public.estimate_projects(
  management_number,project_id,payload,revision,created_at,updated_at
)
select
  '24-2984',target.id,
  jsonb_set(
    jsonb_set(src.row_data->'payload','{basic,kanri}',to_jsonb('24-2984'::text),true),
    '{ledger}',coalesce(src.row_data->'payload'->'ledger','{}'::jsonb) || jsonb_build_object('accountingYear','2024'),true
  ),
  (src.row_data->>'revision')::int,
  (src.row_data->>'created_at')::timestamptz,now()
from src,target
where not exists(select 1 from public.estimate_projects where management_number='24-2984');

commit;
