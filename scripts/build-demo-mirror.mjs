#!/usr/bin/env node
import {copyFileSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const root=new URL('..',import.meta.url).pathname.replace(/\/$/,'');
const demo=join(root,'demo');
const extensions=new Set(['.html','.js','.css']);
const suffix=file=>file.slice(file.lastIndexOf('.'));
const sources=readdirSync(root).filter(file=>extensions.has(suffix(file)));

for(const file of sources){
  if(file==='estimate.html')continue;
  copyFileSync(join(root,file),join(demo,file));
}
// 単体見積デモも、本番と同じ表計算・自社原価ロジックを使う。
// ここを別コピーのままにすると、本番で直したIME・全角数字・数式対応が
// 販売デモだけ古い挙動へ戻るため、生成のたびに共通ファイルを同期する。
for(const file of ['表入力共通.js','見積計算共通.js','自社原価共通.js','年度共通.js','本日日付共通.js']){
  copyFileSync(join(root,file),join(demo,'estimate',file));
}
copyFileSync(join(root,'kanribangou.html'),join(demo,'管理番号取得.html'));
copyFileSync(join(root,'index.html'),join(demo,'index.html'));

const runtimeTags='<script src="demo-data.js?v=4"></script><script src="demo-runtime.js?v=3"></script>';
const realSupabase='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const realProject='https://jjowjnrsknmakcunblzq.supabase.co';
const realProjectRef='jjowjnrsknmakcunblzq';
const realKey=/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

function sanitize(text,file){
  let value=text
    .replaceAll(`<script src="${realSupabase}"></script>`,runtimeTags)
    .replaceAll(realProject,'https://demo.invalid')
    .replaceAll(realProjectRef,'demo-project')
    .replace(realKey,'demo-anon-key')
    .replaceAll('T7011601015057','T1234567890123')
    .replaceAll('東京都中央区日本橋浜町2-16-5 東味ビルディング5F','東京都千代田区丸の内1-1-1 サンプルビル5F')
    .replaceAll('株式会社イズミ装美','株式会社サンプル装美')
    .replaceAll('イズミ装美','サンプル装美')
    .replace(/[A-Za-z0-9._%+-]+@izumisoubi\.co\.jp/g,'demo@sample-system.jp')
    .replaceAll('正式版','販売デモ')
    .replaceAll('kanribangou.html','管理番号取得.html')
    .replaceAll('href="assets/icons/','href="../assets/icons/')
    .replaceAll('href="site.webmanifest"','href="../site.webmanifest"')
    .replaceAll('href="favicon.ico"','href="../favicon.ico"');
  if(file.endsWith('.html')&&!value.includes('demo-runtime.js'))value=value.replace('</head>',`${runtimeTags}</head>`);
  if(file.endsWith('.js')||file.endsWith('.html')){
    value=value
      .replace(/(['"])izumi(?!_sales_demo_)/g,'$1izumi_sales_demo_mirror_')
      .replace(/(['"])meeting(Sales|Margin)Target/g,'$1izumi_sales_demo_mirror_meeting$2Target')
      .replace(/(['"])ledgerSourceGuide/g,'$1izumi_sales_demo_mirror_ledgerSourceGuide')
      .replace(/(['"])lastExternalBackupAt/g,'$1izumi_sales_demo_mirror_lastExternalBackupAt');
  }
  return value;
}

function sanitizeIdentity(text){
  return text
    .replaceAll(realProject,'https://demo.invalid')
    .replaceAll(realProjectRef,'demo-project')
    .replace(realKey,'demo-anon-key')
    .replaceAll('T7011601015057','T1234567890123')
    .replaceAll('東京都中央区日本橋浜町2-16-5 東味ビルディング5F','東京都千代田区丸の内1-1-1 サンプルビル5F')
    .replaceAll('株式会社イズミ装美','株式会社サンプル装美')
    .replaceAll('イズミ装美','サンプル装美')
    .replace(/[A-Za-z0-9._%+-]+@izumisoubi\.co\.jp/g,'demo@sample-system.jp');
}

for(const file of readdirSync(demo).filter(file=>extensions.has(suffix(file))&&!file.startsWith('demo-'))){
  const path=join(demo,file);
  writeFileSync(path,sanitize(readFileSync(path,'utf8'),file));
}

for(const file of ['index.html','standalone.js','demo-integration.js']){
  const path=join(demo,'estimate',file);
  writeFileSync(path,sanitizeIdentity(readFileSync(path,'utf8')));
}

const redirect=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>見積システムを開いています</title><link rel="icon" href="../favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="../assets/icons/favicon-32.png"><meta name="theme-color" content="#006699"></head><body><script src="本日日付共通.js?v=20260808-TODAY1"></script><script>
const source=new URL(location.href);const target=new URL('estimate/',location.href);source.searchParams.forEach((value,key)=>target.searchParams.set(key==='management_number'?'managementNo':key,value));location.replace(target.href+source.hash);
</script></body></html>`;
writeFileSync(join(demo,'estimate.html'),redirect);

console.log(`現行画面 ${sources.length}ファイルを販売デモへ複製しました。`);
