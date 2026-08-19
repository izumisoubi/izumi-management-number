-- 2026-08-12の復旧・補正作業で作成した退避テーブルを非公開化する。
-- これらはブラウザアプリから参照しない管理用データである。
-- RLSを有効化し、anon/authenticated向けポリシーを作らないことで
-- PostgREST経由の読取・追加・更新・削除をすべて拒否する。

begin;

alter table if exists public.safety_restore_ledger_estimates_20260812 enable row level security;
alter table if exists public.safety_backup_estimate_repair_20260812 enable row level security;
alter table if exists public.safety_restore_ledger_basic_total_20260812 enable row level security;
alter table if exists public.safety_restore_deleted_estimate_26_2984_20260812 enable row level security;
alter table if exists public.safety_fix_estimate_basic_staff_20260812 enable row level security;
alter table if exists public.safety_restore_archived_estimate_24_2984_20260812 enable row level security;
alter table if exists public.safety_fix_archived_estimate_metadata_20260812 enable row level security;

revoke all on table public.safety_restore_ledger_estimates_20260812 from anon, authenticated;
revoke all on table public.safety_backup_estimate_repair_20260812 from anon, authenticated;
revoke all on table public.safety_restore_ledger_basic_total_20260812 from anon, authenticated;
revoke all on table public.safety_restore_deleted_estimate_26_2984_20260812 from anon, authenticated;
revoke all on table public.safety_fix_estimate_basic_staff_20260812 from anon, authenticated;
revoke all on table public.safety_restore_archived_estimate_24_2984_20260812 from anon, authenticated;
revoke all on table public.safety_fix_archived_estimate_metadata_20260812 from anon, authenticated;

commit;
