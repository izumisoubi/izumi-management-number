import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlPath = new URL('../photo-album.html', import.meta.url);

test('写真帳はDrive保存と保存先確認を別の操作として表示する', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const saveButton = '<button type="button" class="json-folder-btn save" onclick="saveProjectFromSetup()">💾 DriveへJSON保存</button>';
  const driveLink = '>保存先を確認</a>';
  const saveIndex = html.indexOf(saveButton);
  const driveIndex = html.indexOf(driveLink);

  assert.notEqual(saveIndex, -1, '既存のJSON保存処理を呼ぶボタンが必要です');
  assert.notEqual(driveIndex, -1, '保存後に指定Driveフォルダを確認するリンクが必要です');
  assert.ok(saveIndex < driveIndex, 'Drive保存ボタンは保存先確認より先に配置します');
});

test('Drive保存先は会社指定フォルダに固定しGoogle APIへ直接送信する', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /var GOOGLE_DRIVE_FOLDER_ID='1ppBAKpPg3K6Sx1Rm8t5-veca3bgjE4Ve'/);
  assert.match(html, /accounts\.google\.com\/gsi\/client/);
  assert.match(html, /google\.accounts\.oauth2\.initTokenClient/);
  assert.match(html, /www\.googleapis\.com\/upload\/drive\/v3\/files/);
  assert.doesNotMatch(html, /showDirectoryPicker/);
  assert.doesNotMatch(html, /保存先を設定/);
});

test('Drive読込は会社指定フォルダだけを検索する', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /GOOGLE_DRIVE_FOLDER_ID\+"' in parents/);
  assert.match(html, /alt=media&supportsAllDrives=true/);
});

test('保存ダイアログの操作ボタンは3列で横並びにする', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /\.save-modal-actions\{display:grid;grid-template-columns:1fr 1fr 1\.25fr/);
  assert.match(html, /<div class="save-modal-actions">/);
  assert.match(html, />キャンセル<\/button>[\s\S]*>PCへ保存<\/button>[\s\S]*>Driveへ保存<\/button>/);
});

test('写真帳の各操作段は超横長画面でも左から詰めて配置する', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /<body class="photo-album-system">/);
  assert.match(html, /\.photo-album-system\.ledger-system>header\.system-tabbar>\.izumi-ledger-secondary\{justify-content:flex-start!important\}/);
  assert.match(html, /\.toolbar\{display:flex;/);
  assert.match(html, /\.tbar-r\{display:flex;[^}]*justify-content:flex-start/);
});

test('JSON名は帳票タイトルから管理番号まで判別しやすい順で作る', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /var _details=\[_c\.title,_c\.room,_c\.workContent,_c\.managementNumber\]/);
  assert.match(html, /var _fname='【'\+_docTitle\+'】'\+_details\.join\(' '\)/);
});

test('工事内容は元の施工会社欄に入り、施工会社は作成開始の直前へ移動する', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const workField = '<div class="fg"><label class="fl">工事内容</label><input class="fi" id="fi-work-content"';
  const companyBlock = '<div class="company-setting">';
  const startButton = '<button class="go-btn" id="go-btn" onclick="startApp()">作成開始 →</button>';
  const workIndex = html.indexOf(workField);
  const companyIndex = html.indexOf(companyBlock);
  const startIndex = html.indexOf(startButton);

  assert.notEqual(workIndex, -1);
  assert.notEqual(companyIndex, -1);
  assert.ok(workIndex < companyIndex && companyIndex < startIndex);
  assert.match(html, /setProjectField\('fi-work-content',b\.summary\|\|b\.kojiname\)/);
  assert.match(html, /id="chk-company" checked/);
});
