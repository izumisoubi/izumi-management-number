import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

function japanDateValue(date){
  const parts={};
  new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Tokyo',
    year:'numeric',
    month:'2-digit',
    day:'2-digit'
  }).formatToParts(date).forEach(part=>{
    if(part.type!=='literal')parts[part.type]=part.value;
  });
  return `${parts.year}-${parts.month}-${parts.day}`;
}

test('日本時間の午前0時台は前日のUTC日付にならない',()=>{
  assert.equal(japanDateValue(new Date('2026-08-13T15:20:00Z')),'2026-08-14');
});

test('本日表示と主要入力画面は日本時間を明示する',()=>{
  for(const file of [
    '本日日付共通.js','estimate.html','index.html','支払通知書.html',
    'demo/本日日付共通.js','demo/estimate/本日日付共通.js',
    'demo/estimate/index.html','demo/支払通知書.html','demo/管理番号取得.html'
  ]){
    const source=readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
    assert.match(source,/Asia\/Tokyo/,`${file} に日本時間指定がありません`);
  }
});

test('日付だけの初期値にUTC日付の切り出しを使わない',()=>{
  for(const file of [
    'estimate.html','index.html','台帳共通.js','業務基盤.js',
    'demo/estimate/index.html','demo/台帳共通.js','demo/業務基盤.js',
    'demo/管理番号取得.html','demo/支払通知書.html'
  ]){
    const source=readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
    assert.doesNotMatch(source,/toISOString\(\)\.(?:slice\(0,\s*10\)|split\(['\"]T['\"]\)\[0\])/,
      `${file} にUTC由来の日付初期値が残っています`);
  }
});
