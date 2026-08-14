/*
 * Public Supabase connection settings for the browser application.
 *
 * The anon key is intentionally public and is protected by RLS. Never place a
 * service_role key, database password or backup-storage secret in this file.
 * To move to another Supabase/PostgreSQL environment, change this file only.
 */
(() => {
  const config = Object.freeze({
    url: 'https://demo.invalid',
    anonKey: 'demo-anon-key',
    projectRef: 'demo-project'
  });

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url)) {
    throw new Error('Supabase URLの形式が正しくありません。');
  }
  if (!/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(config.anonKey)) {
    throw new Error('Supabase anon keyの形式が正しくありません。');
  }

  window.IZUMI_SUPABASE_CONFIG = config;
  window.createIzumiSupabaseClient = options => {
    if (!window.supabase?.createClient) throw new Error('Supabaseライブラリを読み込めませんでした。');
    return window.supabase.createClient(config.url, config.anonKey, options);
  };
})();
