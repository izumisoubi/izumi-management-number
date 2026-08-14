import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const estimate=readFileSync(new URL('../estimate.html',import.meta.url),'utf8');
const headerCss=readFileSync(new URL('../固定ヘッダー共通.css',import.meta.url),'utf8');

test('見積ヘッダーは上段メニューと下段操作の2段に固定する',()=>{
  assert.match(estimate,/<div class="tabbar">\s*<div class="header-primary-row">/);
  assert.match(estimate,/header-master-group[\s\S]*header-actions[\s\S]*<\/div>\s*<\/div>\s*<div class="bar-r">/);
  assert.match(headerCss,/header-primary-row[\s\S]*flex-flow:row nowrap!important/);
  assert.match(headerCss,/header-primary-row[\s\S]*flex:1 0 100%!important/);
  assert.match(headerCss,/\.bar-r\{[\s\S]*flex:1 0 42px!important/);
  assert.match(headerCss,/body\.estimate-system>\.tabbar:first-of-type\{[\s\S]*height:84px!important/);
  assert.match(headerCss,/padding-right:14px!important/);
  assert.match(headerCss,/#todayDateDisplay\.today-date-in-header\{[\s\S]*color:#fff!important/);
  assert.match(headerCss,/\.tabbar:first-of-type::before\{[\s\S]*left:0;[\s\S]*right:0;[\s\S]*background:#eef2f6/);
  assert.match(headerCss,/\.bar-r\{[\s\S]*background:transparent!important/);
});
