#!/usr/bin/env bash
set -euo pipefail

package_path="${1:-}"
[[ -n "$package_path" && -f "$package_path" ]] || { echo "使用方法: TARGET_DB_URL=... $0 backup.tar.gz" >&2; exit 1; }
: "${TARGET_DB_URL:?TARGET_DB_URLを指定してください。}"

production_project_ref="${PRODUCTION_PROJECT_REF:-jjowjnrsknmakcunblzq}"
if [[ "$TARGET_DB_URL" == *"$production_project_ref"* && "${ALLOW_PRODUCTION_RESTORE:-}" != "YES_I_UNDERSTAND" ]]; then
  echo "本番環境への復元は拒否しました。隔離した検証環境を指定してください。" >&2
  exit 1
fi

script_directory="$(cd "$(dirname "$0")" && pwd)"
"$script_directory/verify-backup.sh" "$package_path"

working_directory="$(mktemp -d)"
cleanup(){ rm -rf "$working_directory"; }
trap cleanup EXIT
tar -C "$working_directory" -xzf "$package_path"

echo "検証用PostgreSQLへ復元します。"
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "$TARGET_DB_URL" \
  "$working_directory/database/database.dump"

if [[ "${RESTORE_STORAGE:-false}" == "true" ]]; then
  required_storage_variables=(TARGET_S3_ENDPOINT TARGET_S3_ACCESS_KEY_ID TARGET_S3_SECRET_ACCESS_KEY)
  for variable_name in "${required_storage_variables[@]}"; do
    [[ -n "${!variable_name:-}" ]] || { echo "Storage復元に必要です: $variable_name" >&2; exit 1; }
  done
  export RCLONE_CONFIG_TARGET_TYPE=s3
  export RCLONE_CONFIG_TARGET_PROVIDER=Other
  export RCLONE_CONFIG_TARGET_ACCESS_KEY_ID="$TARGET_S3_ACCESS_KEY_ID"
  export RCLONE_CONFIG_TARGET_SECRET_ACCESS_KEY="$TARGET_S3_SECRET_ACCESS_KEY"
  export RCLONE_CONFIG_TARGET_ENDPOINT="$TARGET_S3_ENDPOINT"
  export RCLONE_CONFIG_TARGET_REGION="${TARGET_S3_REGION:-auto}"
  if [[ -d "$working_directory/storage" ]]; then
    for bucket_directory in "$working_directory"/storage/*; do
      [[ -d "$bucket_directory" ]] || continue
      bucket="$(basename "$bucket_directory")"
      echo "Storage bucketを復元します: $bucket"
      rclone copy "$bucket_directory" "target:$bucket" --checksum --fast-list
    done
  fi
fi

psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -c "select current_database(), now();"
echo "復元完了。主要画面の業務確認を続けてください。"
