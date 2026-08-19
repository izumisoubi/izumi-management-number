begin;

-- SECURITY DEFINER functions run with the function owner's privileges. Remove
-- PostgreSQL's default PUBLIC execute grant, then restore only the entrypoints
-- that the browser application actually uses.
do $security$
declare
  fn record;
  authenticated_entrypoints constant text[] := array[
    'admin_list_app_users',
    'admin_set_app_user_enabled',
    'admin_upsert_app_user',
    'apply_ledger_blank_fields_to_estimate',
    'can_view_meeting',
    'confirm_bank_payment_allocations',
    'create_change_order_access_token',
    'create_payment_notice_draft',
    'create_purchase_order',
    'create_staff_change_order',
    'create_system_backup',
    'deactivate_vendor_business_master',
    'deactivate_work_item',
    'decide_change_order',
    'delete_shared_master_record',
    'find_bank_payment_candidates',
    'get_calendar_editor_directory',
    'get_my_app_profile',
    'get_project_audit_log',
    'get_purchase_order_for_change_token',
    'get_system_backup_payload',
    'import_bank_statement',
    'import_legacy_batch',
    'is_current_app_user_enabled',
    'is_invited_email',
    'is_management_admin',
    'issue_management_number_v2',
    'list_employee_stamps',
    'list_shared_master_records',
    'list_system_backups',
    'register_current_user_profile',
    'request_project_change',
    'save_billing_ledger_row',
    'save_client_unit_price',
    'save_cost_ledger_row',
    'save_estimate_draft',
    'save_payment_notice_draft',
    'save_project_bundle',
    'save_project_manual_override',
    'save_purchase_order_draft',
    'save_shared_master_record',
    'save_vendor_unit_price',
    'save_work_item',
    'seed_shared_master_records',
    'set_employee_stamp',
    'soft_delete_project',
    'soft_delete_project_lines',
    'sync_calendar_event_to_project',
    'sync_ledger_inputs_to_estimate',
    'sync_vendor_business_master',
    'transition_payment_notice',
    'update_my_display_name',
    'void_bank_payment_match'
  ];
  anonymous_entrypoints constant text[] := array[
    'get_purchase_order_for_change_token',
    'is_invited_email'
  ];
begin
  for fn in
    select
      p.proname,
      format(
        '%I.%I(%s)',
        n.nspname,
        p.proname,
        pg_get_function_identity_arguments(p.oid)
      ) as identity
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'revoke all privileges on function %s from public, anon, authenticated',
      fn.identity
    );
    execute format('grant execute on function %s to service_role', fn.identity);

    if fn.proname = any(authenticated_entrypoints) then
      execute format('grant execute on function %s to authenticated', fn.identity);
    end if;

    if fn.proname = any(anonymous_entrypoints) then
      execute format('grant execute on function %s to anon', fn.identity);
    end if;
  end loop;
end
$security$;

-- Replace literal TRUE write policies with server-side employee/admin checks.
alter policy "calendar_events_update_authenticated"
  on public.calendar_events
  using (public.is_current_app_user_enabled())
  with check (public.is_current_app_user_enabled());

alter policy "all authenticated users can insert employee master"
  on public.employee_master
  with check (public.is_management_admin());

alter policy "all authenticated users can update employee master"
  on public.employee_master
  using (public.is_management_admin())
  with check (public.is_management_admin());

alter policy "authenticated users can insert estimate projects"
  on public.estimate_projects
  with check (public.is_current_app_user_enabled());

alter policy "authenticated users can update estimate projects"
  on public.estimate_projects
  using (public.is_current_app_user_enabled())
  with check (public.is_current_app_user_enabled());

-- These two policies were equivalent. Keep one hardened policy.
drop policy if exists "authenticated users can update management numbers"
  on public.management_numbers;

alter policy "all authenticated users can update management numbers"
  on public.management_numbers
  using (public.is_current_app_user_enabled())
  with check (public.is_current_app_user_enabled());

alter policy "all authenticated users can insert project line items"
  on public.project_line_items
  with check (public.is_current_app_user_enabled());

alter policy "all authenticated users can update project line items"
  on public.project_line_items
  using (public.is_current_app_user_enabled())
  with check (public.is_current_app_user_enabled());

alter policy "all authenticated users can delete project overrides"
  on public.project_manual_overrides
  using (public.is_current_app_user_enabled());

alter policy "all authenticated users can insert project overrides"
  on public.project_manual_overrides
  with check (public.is_current_app_user_enabled());

alter policy "all authenticated users can update project overrides"
  on public.project_manual_overrides
  using (public.is_current_app_user_enabled())
  with check (public.is_current_app_user_enabled());

-- Pin function lookup paths to prevent object-shadowing attacks.
alter function public.set_calendar_event_updated_at()
  set search_path = public, pg_temp;

alter function public.normalize_bank_party(text)
  set search_path = public, pg_temp;

commit;
