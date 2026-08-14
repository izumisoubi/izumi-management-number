import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const nav=read('common-nav.js');
const css=read('固定ヘッダー共通.css');
const menu=read('index.html');
const ledgerPages=[
  'calendar.html','管理番号台帳.html','工事リスト・原価.html','工事リスト・未発注.html','請求.html','会議用案件一覧.html'
];

test('管理台帳系のヘッダーを上段と薄グレーの下段に統一する',()=>{
  for(const page of ledgerPages){
    assert.match(nav,new RegExp(page.replace('.','\\.')));
    const html=read(page);
    assert.match(html,/common-nav\.js\?v=20260814-HEADER4/);
    assert.match(html,/固定ヘッダー共通\.css\?v=20260814-HEADER8/);
  }
  assert.match(nav,/izumi-ledger-primary/);
  assert.match(nav,/izumi-ledger-secondary/);
  assert.match(nav,/container\.childElementCount === 0/);
  assert.match(css,/body\.ledger-system>header:first-of-type::before\{[\s\S]*left:0;[\s\S]*right:0;[\s\S]*background:#eef2f6/);
  assert.match(css,/body\.ledger-system>header:first-of-type\{[\s\S]*gap:0!important/);
  assert.match(css,/\.izumi-ledger-primary\{justify-content:space-between!important\}/);
  assert.match(css,/\.izumi-ledger-secondary\{justify-content:flex-end!important/);
  assert.match(css,/#todayDateDisplay\{color:#fff!important/);
});

test('ログアウトはヘッダーから隠し一覧メニュー最下部に一度だけ配置する',()=>{
  assert.match(css,/body>header:first-of-type #logoutButton,[\s\S]*display:none!important/);
  assert.equal((menu.match(/id="menuLogout"/g)||[]).length,1);
  assert.match(menu,/<div class="footer">[\s\S]*id="menuLogout"[\s\S]*<\/div>\s*<\/main>/);
  assert.match(menu,/async function signOutFromMenu\(\)[\s\S]*db\.auth\.signOut/);
  assert.match(menu,/menuLogout'\)\.classList\.toggle\('hidden',!email\)/);
  assert.match(menu,/@media\(max-width:720px\)[\s\S]*\.menu-logout\{width:100%;margin-left:0\}/);
});
