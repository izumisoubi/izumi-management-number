# Supabase セキュリティ設計

## 基本方針

- ブラウザから接続する `anon` は、ログイン前に不可欠な関数だけ実行できる。
- `authenticated` は、現在の業務画面が使用する関数だけ実行できる。
- トリガー、監査、バックアップ内部処理などはブラウザから直接実行させない。
- `SECURITY DEFINER` 関数には PostgreSQL の既定 `PUBLIC EXECUTE` を残さない。
- 書込RLSは `true` を使わず、在籍中社員または管理者をサーバー側で確認する。

## ログイン前に公開する例外

| 関数 | 理由 |
| --- | --- |
| `is_invited_email` | ログイン・初回登録前の招待確認 |
| `get_purchase_order_for_change_token` | 業者へ送付した期限付きトークンによる発注内容確認 |

この2関数はSupabase Security Advisor上で警告が残る場合があるが、用途を確認した意図的な例外とする。追加の公開関数は、トークン検証・有効期限・返却情報をレビューしてから追加する。

## 定期確認

1. Supabase Security Advisorを再実行する。
2. `anon` に新しい `SECURITY DEFINER` 関数が付与されていないことを確認する。
3. 業務画面から呼ぶRPC一覧と `authenticated_entrypoints` を照合する。
4. 管理番号取得、予定保存、見積保存、バックアップ、管理者画面を動作確認する。
5. 警告を例外扱いにする場合は、理由をこの文書へ追記する。

## パスワード

Supabase Authの漏洩パスワード保護を有効にし、既知の漏洩パスワードを新規設定できないようにする。これはSQLマイグレーションではなく、Supabase Auth設定として管理する。
