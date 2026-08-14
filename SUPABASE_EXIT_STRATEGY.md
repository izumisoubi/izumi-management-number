# Supabase離脱可能性・事業継続設計

- 決定日: 2026年8月14日
- 適用範囲: イズミ装美 業務管理システム
- 優先度: 最重要・恒久

## 結論

通常運用ではSupabase Cloudを使用します。ただし、Supabaseを永久に使えることを前提にせず、**DB・ファイル・設定・サーバー処理を外部へ復元または移行できる状態を維持します**。

今後の改修では、開発速度だけでなく「Supabaseが停止・終了・利用不能になった場合に、別環境で業務を再開できるか」を必ず判断基準に含めます。

## 絶対に守る原則

1. 業務データの中核は、可能な限り標準PostgreSQLで表現します。
2. テーブル定義、インデックス、ビュー、PostgreSQL関数、RLS、トリガー、マイグレーション、Edge FunctionsのソースをGitで管理します。
3. DBバックアップとStorageファイルのバックアップを別々に取得します。DBのdumpだけでStorageを保護した扱いにしません。
4. DBのdumpとStorage複製は、Supabaseとは別会社の保存先へ置きます。
5. Supabase URLと公開用anon keyは共通設定へ集約し、接続先変更を一か所で行える構成を目標とします。
6. `service_role`、DBパスワード、S3 secret等の秘密情報はGitHub Pages・公開JavaScript・Gitへ置きません。
7. 秘密情報を使うバックアップや管理処理は、GitHub Actions、管理サーバー、Edge Functions等のサーバー側だけで実行します。
8. バックアップ作成だけで合格にせず、定期的に別環境へ復元して業務画面から確認します。
9. Supabase固有機能を追加する場合は、代替先・エクスポート方法・復旧手順も同時に記録します。
10. 移行時に認証パスワードを引き継げない場合に備え、社員へのパスワード再設定手順を準備します。

## バックアップ基準

| 対象 | 頻度 | 外部保存 | 保持方針 | 確認 |
|---|---:|---|---|---|
| PostgreSQL full dump | 毎日 | Supabase以外のS3/R2等 | 日次30世代、月次12世代を目安 | 毎朝ジョブ結果を確認 |
| Storage実ファイル | 毎日 | Supabase以外のS3/R2等 | DB dumpと同等以上 | 件数・総容量・ハッシュを確認 |
| 復旧用業務JSON | 毎週および重要改修前 | 会社管理の共有先 | 直近4世代以上 | 画面の件数表示を確認 |
| Git管理対象 | 変更ごと | GitHub＋必要に応じ別clone | 履歴を保持 | mainへの反映を確認 |
| 復元試験 | 四半期ごと | 隔離した検証環境 | 実施記録を保存 | ログイン・主要案件・帳票まで確認 |

暫定目標は、日次バックアップを前提に最大24時間分のデータ損失以内、重大障害から1営業日以内の主要業務再開です。運用実績に応じて短縮します。

## 実装済みの離脱準備

2026年8月14日時点で、次をリポジトリへ実装しました。

- 公開用Supabase URL・anon keyを `supabase-config.js` へ集約し、利用ページを共通ファクトリへ接続しました。
- `scripts/portability/create-backup.sh` に、PostgreSQL dump、schema、data、Storage複製、ハッシュ、manifest、外部S3/R2アップロードを実装しました。
- `.github/workflows/daily-portability-backup.yml` に日次実行を定義しました。
- `scripts/portability/verify-backup.sh` と `restore-backup.sh` に、改ざん・欠損検査と隔離環境への復元を実装しました。
- `.github/workflows/quarterly-restore-drill.yml` に四半期復元試験を定義しました。
- `restore-tests/` に復元結果の記録様式を追加しました。
- `AUTH_MIGRATION_RUNBOOK.md` に、社員本人によるパスワード再設定を含む認証移行手順を追加しました。
- `scripts/portability/check-readiness.mjs` に、接続設定の再分散や必須ファイル欠落を検出する静的検査を追加しました。

## 稼働開始前の未完了事項

次は外部サービスの認証情報と本番DBへの権限が必要なため、コードだけでは完了できません。**すべて完了するまで「離脱準備完了」と扱いません。**

- GitHub Actions Secrets・Variablesへ、本番DB、Supabase Storage S3、外部S3/R2、隔離復元先の値を登録する。
- 本番DBから完全なschema-only dumpを取得し、内容を確認してGit管理の基準スキーマへ追加する。
- 日次ワークフローを初回成功させ、外部保存先にDBとStorageの実物があることを確認する。
- 四半期復元ワークフローを初回成功させ、ログイン・主要案件・台帳金額・帳票を確認して記録する。
- 現在の公開anon keyが有効であることをSupabase側で確認し、無効なら再発行して `supabase-config.js` を更新する。

## 実装順序

### 第1段階: 接続設定の一元化（コード実装済み）

- 公開用のSupabase URL・anon keyを一つの共通設定ファイルから読むようにします。
- 各ページの直書きを段階的に削除します。
- `service_role`等の秘密情報は共通設定ファイルへも入れません。
- 接続先を検証用PostgreSQL/Supabaseへ切り替える試験を行います。

### 第2段階: 外部日次バックアップ（コード実装済み・Secrets登録後に稼働）

- `pg_dump`または`supabase db dump`を毎日実行します。
- dumpをSupabase以外のS3/R2等へ暗号化して保存します。
- Storage利用時はS3互換APIまたは`rclone`等で実ファイルを別保存先へ複製します。
- 成功・失敗、容量、対象時刻、世代を管理者が確認できるようにします。

### 第3段階: 復元と切替試験（コード実装済み・初回実施待ち）

- 新規Supabase、セルフホストSupabase、または別PostgreSQLへ復元します。
- 一覧、管理番号、見積、台帳、請求、認証、Storage参照を確認します。
- 接続先設定を変更するだけで画面が新環境へ向くことを確認します。
- 手順、所要時間、失敗点、改善内容を記録します。

## 避難先の優先順

1. 別のSupabase Cloudプロジェクト
2. セルフホストSupabase
3. Neon、AWS RDS、Google Cloud SQL等のPostgreSQL
4. 要件を満たすその他のPostgreSQL基盤

PostgreSQL以外へ移る場合は、SQL、RLS、Realtime、Auth、Storage、Functionsの差分が大きくなるため、別計画として扱います。

## 完了条件

以下をすべて満たすまで、離脱準備は完了としてはいけません。

- 24時間以内のDB dumpが外部保存先に存在する。
- Storage利用時は同じ基準時刻に対応する外部コピーが存在する。
- Gitだけから空のDBへスキーマ・RLS・関数を再構築できる。
- dumpを隔離環境へ復元できる。
- 共通接続設定の変更だけで主要画面を復元先へ接続できる。
- 主要案件の件数・金額・帳票が元環境と一致する。
- 認証移行または社員パスワード再設定の手順が実行できる。
- 復元試験日、担当者、所要時間、結果が記録されている。

## 参考

- Supabase Architecture: https://supabase.com/docs/guides/getting-started/architecture
- Database Backups: https://supabase.com/docs/guides/platform/backups
- Storage S3 Compatibility: https://supabase.com/docs/guides/storage/s3/compatibility
- Self-Hosting: https://supabase.com/docs/guides/self-hosting
