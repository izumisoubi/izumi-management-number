# イズミ装美システム バックアップ・復旧手順

設計の最上位方針は `SUPABASE_EXIT_STRATEGY.md` を参照してください。Supabase Cloudは通常運用の正本ですが、単一障害点・永久利用前提にはしません。

自動処理は `.github/workflows/daily-portability-backup.yml` と `scripts/portability/` に実装しています。GitHub Secrets・Variablesの登録と初回成功確認が終わるまで、実運用開始済みとは扱いません。認証移行は `AUTH_MIGRATION_RUNBOOK.md` を参照してください。

## 毎日、自動で行うこと

1. `pg_dump`または`supabase db dump`でPostgreSQLのfull dumpを作成する。
2. dumpをSupabaseとは別会社のS3・Cloudflare R2等へ暗号化して保存する。
3. Storageを使用している場合は、S3互換APIまたは`rclone`等で実ファイルも外部保存先へ複製する。
4. dumpとStorageコピーの実行時刻、件数、容量、成否を記録する。
5. 失敗時は管理者へ通知し、成功するまで放置しない。

## 毎週行うこと

1. `バックアップ管理.html` を開く。
2. 最新の週次バックアップが作成されていることを確認する。
3. 「復旧用JSONを保存」を押し、会社管理の共有フォルダにも複製する。
4. 外部日次バックアップの直近7日分が揃っていることを確認する。
5. DB dumpとは別に、Storage実ファイルの外部コピーが作成されていることを確認する。

## Supabaseに障害が起きた場合

1. 新しいSupabaseプロジェクトを作る。
2. 外部保存先の最新正常 `.dump` を `pg_restore` で復元する。
3. Storageを使用している場合は、同じ基準時刻の外部コピーから実ファイルも復元する。
4. GitHub Pages側の共通接続設定にあるSupabase URLとanon keyを新プロジェクトへ差し替える。
5. `.dump` がない場合はGit管理されたSQLマイグレーションからテーブル、RLS、関数を再作成し、外部保存した復旧用JSONから業務データを戻す。
6. ログイン、一覧、管理番号、見積、台帳、請求、帳票、Storage参照を確認する。

## 四半期に行うこと

1. 本番とは分離した検証環境を用意する。
2. 外部保存先のDB dumpとStorageコピーを復元する。
3. 主要案件の件数、金額、発注書番号、改訂番号、帳票を照合する。
4. 接続先の切替に必要だった変更箇所と所要時間を記録する。
5. 認証を移行できない場合の社員パスワード再設定手順を確認する。

## 発注書・支払通知書を導入した後

- `SUPABASE_UX33_バックアップ対象拡張.sql` を適用し、復旧用JSONの形式が `izumi-system-backup-v2` であることを確認する。
- 件数欄で `purchase_orders`、`purchase_order_lines`、`change_orders`、`payment_notices` が含まれることを確認する。
- 発注書の競合時に端末へ退避されたデータは、ブラウザの保存領域にも残る。競合解消前に「PCへバックアップ」を実行する。
- 四半期に1回、ステージング環境へ `.dump` を復元し、発注書番号、改訂番号、支払通知書の版とSHA-256が一致することを確認する。

## GitHub Pagesに障害が起きた場合

1. GitHubリポジトリをZIPでダウンロードして保管する。
2. 同じファイルを別のGitHub Pages、Cloudflare Pages、Netlify等へ公開する。
3. Supabaseは別サービスなので、画面公開先を変えてもデータは残る。

## パスワードについて

- パスワードそのものはバックアップJSONに含めない。
- 忘れた場合は `auth.html` の「パスワードを忘れた」から本人が再設定する。
- 退職者は `システム管理.html` で停止し、Supabase Authenticationでも確認する。
