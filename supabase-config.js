/*
 * Public Supabase connection settings for the browser application.
 *
 * The anon key is intentionally public and is protected by RLS. Never place a
 * service_role key, database password or backup-storage secret in this file.
 * To move to another Supabase/PostgreSQL environment, change this file only.
 */
(() => {
  const config = Object.freeze({
    url: 'https://jjowjnrsknmakcunblzq.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impqb3dqbnJza25tYWtjdW5ibHpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNzY4MjUsImV4cCI6MjA5OTg1MjgyNX0.XYPEt90GQlzJMTe67f9O7WExNYrJhfQ_HC20kkCWgGs',
    projectRef: 'jjowjnrsknmakcunblzq'
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
