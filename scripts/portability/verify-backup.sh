#!/usr/bin/env bash
set -euo pipefail

package_path="${1:-}"
[[ -n "$package_path" && -f "$package_path" ]] || { echo "使用方法: $0 backup.tar.gz" >&2; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { echo "pg_restoreが必要です。" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "nodeが必要です。" >&2; exit 1; }

working_directory="$(mktemp -d)"
cleanup(){ rm -rf "$working_directory"; }
trap cleanup EXIT
tar -C "$working_directory" -xzf "$package_path"

for required_file in manifest.json SHA256SUMS database/database.dump database/schema.sql database/data.sql; do
  [[ -s "$working_directory/$required_file" ]] || { echo "必須ファイルがありません: $required_file" >&2; exit 1; }
done

(cd "$working_directory" && shasum -a 256 -c SHA256SUMS)
pg_restore --list "$working_directory/database/database.dump" >/dev/null

BACKUP_PAYLOAD="$working_directory" node <<'NODE'
const fs=require('fs');const path=require('path');
const root=process.env.BACKUP_PAYLOAD;
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
if(manifest.format!=='izumi-portability-backup-v1')throw new Error(`未対応の形式です: ${manifest.format}`);
for(const file of manifest.files||[]){
  const target=path.join(root,file.path);
  if(!fs.existsSync(target))throw new Error(`manifest記載ファイルがありません: ${file.path}`);
  if(fs.statSync(target).size!==file.bytes)throw new Error(`サイズが一致しません: ${file.path}`);
}
console.log(JSON.stringify({created_at:manifest.created_at,files:manifest.files.length,storage:manifest.storage},null,2));
NODE

echo "バックアップ検証完了: $package_path"
