#!/usr/bin/env bash
set -euo pipefail

required_commands=(pg_dump pg_restore psql rclone aws tar node)
for command_name in "${required_commands[@]}"; do
  command -v "$command_name" >/dev/null 2>&1 || { echo "必要なコマンドがありません: $command_name" >&2; exit 1; }
done

required_variables=(
  SUPABASE_DB_URL
  SUPABASE_S3_ENDPOINT
  SUPABASE_S3_ACCESS_KEY_ID
  SUPABASE_S3_SECRET_ACCESS_KEY
  SUPABASE_STORAGE_BUCKETS
  BACKUP_S3_ENDPOINT
  BACKUP_S3_BUCKET
  BACKUP_S3_ACCESS_KEY_ID
  BACKUP_S3_SECRET_ACCESS_KEY
)
missing_variables=()
for variable_name in "${required_variables[@]}"; do
  [[ -n "${!variable_name:-}" ]] || missing_variables+=("$variable_name")
done
if ((${#missing_variables[@]})); then
  printf '必要な環境変数がありません: %s\n' "${missing_variables[*]}" >&2
  exit 1
fi

backup_prefix="${BACKUP_S3_PREFIX:-izumi-management-number}"
backup_region="${BACKUP_S3_REGION:-auto}"
supabase_region="${SUPABASE_S3_REGION:-auto}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_date="${timestamp:0:8}"
working_directory="$(mktemp -d)"
payload_directory="$working_directory/payload"
package_path="$working_directory/izumi-portability-$timestamp.tar.gz"
cleanup(){ rm -rf "$working_directory"; }
trap cleanup EXIT
mkdir -p "$payload_directory/database" "$payload_directory/storage"

echo "PostgreSQL full dumpを作成します。"
pg_dump "$SUPABASE_DB_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file "$payload_directory/database/database.dump"

pg_dump "$SUPABASE_DB_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --file "$payload_directory/database/schema.sql"

pg_dump "$SUPABASE_DB_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  --file "$payload_directory/database/data.sql"

export RCLONE_CONFIG_SUPABASE_TYPE=s3
export RCLONE_CONFIG_SUPABASE_PROVIDER=Other
export RCLONE_CONFIG_SUPABASE_ACCESS_KEY_ID="$SUPABASE_S3_ACCESS_KEY_ID"
export RCLONE_CONFIG_SUPABASE_SECRET_ACCESS_KEY="$SUPABASE_S3_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_SUPABASE_ENDPOINT="$SUPABASE_S3_ENDPOINT"
export RCLONE_CONFIG_SUPABASE_REGION="$supabase_region"

IFS=',' read -r -a storage_buckets <<< "$SUPABASE_STORAGE_BUCKETS"
for raw_bucket in "${storage_buckets[@]}"; do
  bucket="${raw_bucket//[[:space:]]/}"
  [[ -n "$bucket" ]] || continue
  echo "Storage bucketを複製します: $bucket"
  mkdir -p "$payload_directory/storage/$bucket"
  rclone copy "supabase:$bucket" "$payload_directory/storage/$bucket" \
    --checksum \
    --fast-list \
    --transfers 4 \
    --checkers 8
done

(cd "$payload_directory" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS)

BACKUP_TIMESTAMP="$timestamp" BACKUP_PAYLOAD="$payload_directory" node <<'NODE'
const fs=require('fs');
const path=require('path');
const root=process.env.BACKUP_PAYLOAD;
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const full=path.join(dir,entry.name);
  return entry.isDirectory()?walk(full):[full];
});
const files=walk(root).filter(file=>!file.endsWith('manifest.json')).map(file=>({
  path:path.relative(root,file),
  bytes:fs.statSync(file).size
}));
const storage=files.filter(file=>file.path.startsWith('storage/'));
const manifest={
  format:'izumi-portability-backup-v1',
  created_at:process.env.BACKUP_TIMESTAMP,
  database:{format:'pg_dump-custom',file:'database/database.dump'},
  storage:{buckets:[...new Set(storage.map(file=>file.path.split('/')[1]).filter(Boolean))],files:storage.length,bytes:storage.reduce((sum,file)=>sum+file.bytes,0)},
  files
};
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
NODE

tar -C "$payload_directory" -czf "$package_path" .
package_checksum="$(shasum -a 256 "$package_path" | awk '{print $1}')"
printf '%s  %s\n' "$package_checksum" "$(basename "$package_path")" > "$package_path.sha256"
latest_checksum_path="$working_directory/izumi-portability-latest.tar.gz.sha256"
printf '%s  %s\n' "$package_checksum" 'izumi-portability-latest.tar.gz' > "$latest_checksum_path"

export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$backup_region"
destination="s3://$BACKUP_S3_BUCKET/$backup_prefix/daily/$backup_date/$(basename "$package_path")"
latest_destination="s3://$BACKUP_S3_BUCKET/$backup_prefix/latest/izumi-portability-latest.tar.gz"

echo "外部保存先へアップロードします。"
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "$package_path" "$destination" --only-show-errors
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "$package_path.sha256" "$destination.sha256" --only-show-errors
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "$package_path" "$latest_destination" --only-show-errors
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "$latest_checksum_path" "$latest_destination.sha256" --only-show-errors

echo "バックアップ完了: $destination"
