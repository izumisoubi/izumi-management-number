/* Shared navigation: one clear return path and consistent labels. */
(() => {
  const page = decodeURIComponent(location.pathname.split('/').pop() || '');
  const menuPage = '工事リスト.html';
  const labels = new Map([
    ['index.html', '管理番号取得'], ['calendar.html', 'カレンダー'],
    ['estimate.html', '見積・発注'], ['管理番号台帳.html', '台帳'],
    ['工事リスト・原価.html', '原価'], ['工事リスト・未発注.html', '未発注'], ['請求.html', '請求']
  ]);
  const headerLinks = [...document.querySelectorAll('header a[href]')];
  let menuLink = null;
  let calendarLink = null;
  headerLinks.forEach(link => {
    const target = decodeURIComponent((link.getAttribute('href') || '').split('?')[0].split('#')[0]);
    if (target === menuPage) { link.textContent = '一覧メニュー'; menuLink = link; return; }
    if (target === 'calendar.html') calendarLink = link;
    if (labels.has(target)) link.textContent = labels.get(target);
  });
  if (menuLink && calendarLink) calendarLink.parentNode.insertBefore(menuLink, calendarLink);
  if (page === menuPage || document.getElementById('menuShortcut')) return;
  const style = document.createElement('style');
  style.textContent = `
    #menuShortcut{position:fixed;z-index:9500;right:16px;top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;min-width:46px;height:34px;padding:0 11px;border:1px solid #9ab0ce;border-radius:999px;background:#fff;color:#17345f;text-decoration:none;font:800 11px/1 -apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif;box-shadow:0 7px 18px rgba(23,52,95,.18);letter-spacing:.04em;transition:transform .15s,background .15s,color .15s}
    #menuShortcut:hover,#menuShortcut:focus{background:#17345f;color:#fff;transform:translateY(-50%) translateX(-2px);outline:none}
    @media(max-width:700px){#menuShortcut{right:10px;top:auto;bottom:16px;transform:none}#menuShortcut:hover,#menuShortcut:focus{transform:translateX(-2px)}}
    @media print{#menuShortcut{display:none!important}}
  `;
  document.head.append(style);
  const shortcut = document.createElement('a');
  shortcut.id = 'menuShortcut'; shortcut.href = menuPage; shortcut.textContent = '一覧';
  shortcut.title = '一覧メニューへ戻る'; shortcut.setAttribute('aria-label', '一覧メニューへ戻る');
  document.body.append(shortcut);
})();
