import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260819_harden_function_access_and_rls.sql', import.meta.url),
  'utf8'
);

test('SECURITY DEFINER関数の既定公開権限を除去する', () => {
  assert.match(migration, /p\.prosecdef/);
  assert.match(migration, /revoke all privileges on function %s from public, anon, authenticated/);
  assert.match(migration, /grant execute on function %s to service_role/);
  const anonymousBlock = migration.match(
    /anonymous_entrypoints constant text\[\] := array\[([\s\S]*?)\n\s*\];/
  )?.[1] || '';
  assert.deepEqual(
    [...anonymousBlock.matchAll(/'([^']+)'/g)].map(([, name]) => name),
    ['get_purchase_order_for_change_token', 'is_invited_email']
  );
});

test('無条件の書込RLSを社員・管理者判定へ置き換える', () => {
  assert.doesNotMatch(migration, /using\s*\(true\)|with check\s*\(true\)/i);
  assert.match(migration, /public\.is_current_app_user_enabled\(\)/);
  assert.match(migration, /public\.is_management_admin\(\)/);
  assert.match(migration, /drop policy if exists "authenticated users can update management numbers"/);
});

test('警告対象2関数のsearch_pathを固定する', () => {
  assert.match(migration, /alter function public\.set_calendar_event_updated_at\(\)/);
  assert.match(migration, /alter function public\.normalize_bank_party\(text\)/);
  assert.equal((migration.match(/set search_path = public, pg_temp/g) || []).length, 2);
});
