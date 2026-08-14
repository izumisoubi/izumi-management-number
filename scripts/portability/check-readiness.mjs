#!/usr/bin/env node
import {existsSync,readFileSync,readdirSync} from 'node:fs';

const failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message)};
const requiredFiles=[
  'supabase-config.js',
  '.github/workflows/daily-portability-backup.yml',
  '.github/workflows/quarterly-restore-drill.yml',
  'scripts/portability/create-backup.sh',
  'scripts/portability/verify-backup.sh',
  'scripts/portability/restore-backup.sh',
  'supabase/migrations/manifest.txt',
  'supabase/functions/README.md',
  'restore-tests/README.md',
  'AUTH_MIGRATION_RUNBOOK.md',
  'SUPABASE_EXIT_STRATEGY.md'
];
requiredFiles.forEach(file=>expect(existsSync(file),`必須ファイルがありません: ${file}`));

const htmlFiles=readdirSync('.').filter(file=>file.endsWith('.html'));
const supabasePages=htmlFiles.filter(file=>readFileSync(file,'utf8').includes('@supabase/supabase-js@2'));
for(const file of supabasePages){
  const source=readFileSync(file,'utf8');
  expect(source.includes('supabase-config.js?v=20260814-PORTABLE1'),`${file} が共通Supabase設定を読み込んでいません`);
  expect(!source.includes('jjowjnrsknmakcunblzq.supabase.co'),`${file} にSupabase URLが直書きされています`);
  expect(!/createClient\(\s*['"]https:\/\//.test(source),`${file} にSupabase接続が直書きされています`);
}

for(const file of [...htmlFiles,...readdirSync('.').filter(file=>file.endsWith('.js')&&file!=='supabase-config.js')]){
  const source=readFileSync(file,'utf8');
  expect(!source.includes('jjowjnrsknmakcunblzq.supabase.co'),`${file} にSupabase URLが直書きされています`);
  expect(!/service[_-]?role/i.test(source),`${file} にservice roleへの参照があります`);
}

if(existsSync('supabase/migrations/manifest.txt')){
  const migrations=readFileSync('supabase/migrations/manifest.txt','utf8').split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#'));
  expect(migrations.length>0,'SQLマイグレーションmanifestが空です');
  migrations.forEach(file=>expect(existsSync(file),`manifest記載SQLがありません: ${file}`));
}

if(existsSync('.github/workflows/daily-portability-backup.yml')){
  const workflow=readFileSync('.github/workflows/daily-portability-backup.yml','utf8');
  ['schedule:','SUPABASE_DB_URL','SUPABASE_STORAGE_BUCKETS','BACKUP_S3_ENDPOINT','create-backup.sh'].forEach(text=>expect(workflow.includes(text),`日次バックアップ契約がありません: ${text}`));
}
if(existsSync('.github/workflows/quarterly-restore-drill.yml')){
  const workflow=readFileSync('.github/workflows/quarterly-restore-drill.yml','utf8');
  ['schedule:','RESTORE_TEST_DB_URL','restore-backup.sh','verify-backup.sh'].forEach(text=>expect(workflow.includes(text),`復元試験契約がありません: ${text}`));
}

if(failures.length){
  console.error('Supabase離脱準備の静的検査に失敗しました。');
  failures.forEach(failure=>console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Supabase離脱準備の静的検査に成功しました（共通設定ページ: ${supabasePages.length}）。`);
