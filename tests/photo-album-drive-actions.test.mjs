import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlPath = new URL('../photo-album.html', import.meta.url);

test('写真帳はJSON保存をDriveを開くより先に表示する', async () => {
  const html = await readFile(htmlPath, 'utf8');
  const saveButton = '<button type="button" class="json-folder-btn save" onclick="saveProject()">💾 JSONを保存</button>';
  const driveLink = '>Driveを開く</a>';
  const saveIndex = html.indexOf(saveButton);
  const driveIndex = html.indexOf(driveLink);

  assert.notEqual(saveIndex, -1, '既存のJSON保存処理を呼ぶボタンが必要です');
  assert.notEqual(driveIndex, -1, '指定Driveフォルダを開くリンクが必要です');
  assert.ok(saveIndex < driveIndex, 'JSON保存ボタンは「Driveを開く」より先に配置します');
});
