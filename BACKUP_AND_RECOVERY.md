# イズミ装美システム バックアップ・復旧手順

## 毎週行うこと

1. `バックアップ管理.html` を開く。
2. 最新の週次バックアップが作成されていることを確認する。
3. 「復旧用JSONを保存」を押し、会社管理の共有フォルダにも複製する。
4. 外部バックアップも使う場合は `backup-templates/weekly-supabase-backup.yml.example` を `.github/workflows/weekly-supabase-backup.yml` として登録し、GitHub Actions の成功を確認する。

## Supabaseに障害が起きた場合

1. 新しいSupabaseプロジェクトを作る。
2. 外部バックアップを設定済みなら、GitHub Actionsの成果物にある `.dump` を `pg_restore` で復元する。
3. GitHub Pages側のSupabase URLとanon keyを新プロジェクトへ差し替える。
4. `.dump` がない場合は `SUPABASE_UX16_統合更新.sql` から番号順にUX33までテーブルを再作成し、外部保存した復旧用JSONから業務データを戻す。

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
