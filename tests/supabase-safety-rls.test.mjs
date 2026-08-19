import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../supabase/migrations/20260819_lock_down_recovery_safety_tables.sql', import.meta.url);

const safetyTables = [
  'safety_restore_ledger_estimates_20260812',
  'safety_backup_estimate_repair_20260812',
  'safety_restore_ledger_basic_total_20260812',
  'safety_restore_deleted_estimate_26_2984_20260812',
  'safety_fix_estimate_basic_staff_20260812',
  'safety_restore_archived_estimate_24_2984_20260812',
  'safety_fix_archived_estimate_metadata_20260812',
];

test('復旧用退避テーブル7表はRLSと権限剥奪で非公開化する', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  for (const table of safetyTables) {
    assert.match(sql, new RegExp(`alter table if exists public\\.${table} enable row level security;`));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from anon, authenticated;`));
  }
  assert.doesNotMatch(sql, /create policy/i, '退避表にクライアント向けRLSポリシーは作成しません');
});
