import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const headerScript=read('本日日付共通.js');
const css=read('固定ヘッダー共通.css');
const menu=read('index.html');
const root=fileURLToPath(new URL('../',import.meta.url));
const headerPages=readdirSync(root)
  .filter(file=>file.endsWith('.html'))
  .filter(file=>/<header\b|class="tabbar"/.test(read(file)));

test('全画面のヘッダーを上段と薄グレーの下段に統一する',()=>{
  assert.equal(headerPages.length,28,'ヘッダー画面の増減を確認してください');
  for(const page of headerPages){
    const html=read(page);
    assert.match(html,/本日日付共通\.js\?v=20260814-TODAY2/);
    assert.match(html,/固定ヘッダー共通\.css\?v=20260814-HEADER9/);
  }
  assert.match(headerScript,/function normalizeHeaderLayout\(\)/);
  assert.match(headerScript,/izumi-ledger-primary/);
  assert.match(headerScript,/izumi-ledger-secondary/);
  assert.match(headerScript,/旧レイアウトのラッパー/);
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
