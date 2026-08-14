/* Shared navigation: one clear return path and consistent labels. */
(() => {
  const mobileStyles = document.createElement('link');
  mobileStyles.rel = 'stylesheet';
  mobileStyles.href = 'mobile-ui.css?v=20260801-MOBILE3';
  mobileStyles.media = 'all';
  document.head.append(mobileStyles);
  const mobileScript = document.createElement('script');
  mobileScript.src = 'mobile-ui.js?v=20260801-MOBILE3';
  mobileScript.defer = true;
  document.head.append(mobileScript);
  const page = decodeURIComponent(location.pathname.split('/').pop() || '');
  const menuPage = 'イズミ装美社内システム.html';
  const labels = new Map([
    ['管理番号取得.html', '管理番号取得'], ['calendar.html', 'カレンダー'],
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
    #menuShortcut{position:fixed;z-index:9500;display:inline-flex;align-items:center;justify-content:center;min-width:46px;height:34px;padding:0 11px;border:1px solid #9ab0ce;border-radius:999px;background:#fff;color:#17345f;text-decoration:none;font:800 11px/1 -apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif;box-shadow:0 7px 18px rgba(23,52,95,.18);letter-spacing:.04em;cursor:grab;user-select:none;touch-action:none;transition:background .15s,color .15s,box-shadow .15s}
    #menuShortcut:hover,#menuShortcut:focus{background:#17345f;color:#fff;box-shadow:0 9px 22px rgba(23,52,95,.26);outline:none}
    #menuShortcut.is-dragging{cursor:grabbing;transition:none;opacity:.92}
    @media print{#menuShortcut{display:none!important}}
  `;
  document.head.append(style);
  const shortcut = document.createElement('a');
  shortcut.id = 'menuShortcut'; shortcut.href = menuPage; shortcut.textContent = '一覧';
  shortcut.title = '一覧メニューへ戻る（ドラッグで位置を記憶）'; shortcut.setAttribute('aria-label', '一覧メニューへ戻る');
  document.body.append(shortcut);
  const positionKey = 'izumi_sales_demo_mirror__menu_shortcut_position_v1';
  const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
  const applyPosition = (x,y) => {
    const rect = shortcut.getBoundingClientRect();
    shortcut.style.left = `${clamp(x,8,Math.max(8,innerWidth-rect.width-8))}px`;
    shortcut.style.top = `${clamp(y,8,Math.max(8,innerHeight-rect.height-8))}px`;
  };
  const savedPosition = () => {
    try { const saved = JSON.parse(localStorage.getItem(positionKey)||'null'); return saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : null; } catch (_error) { return null; }
  };
  const placeShortcut = () => {
    const saved = savedPosition();
    if (saved) return applyPosition(saved.x * innerWidth, saved.y * innerHeight);
    const frame = document.querySelector('main .screen:not(.hidden),main .panel,main') || document.body;
    const rect = frame.getBoundingClientRect();
    applyPosition(Math.min(innerWidth-54,Math.max(8,rect.right+10)),clamp(rect.top+52,96,innerHeight-48));
  };
  requestAnimationFrame(placeShortcut);
  addEventListener('resize',placeShortcut);
  let dragStart = null;
  let suppressNextClick = false;
  shortcut.addEventListener('pointerdown',event => {
    if (event.button !== undefined && event.button !== 0) return;
    const rect = shortcut.getBoundingClientRect();
    dragStart = {x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,moved:false};
    shortcut.setPointerCapture?.(event.pointerId);
  });
  shortcut.addEventListener('pointermove',event => {
    if (!dragStart) return;
    const x = dragStart.left + event.clientX - dragStart.x;
    const y = dragStart.top + event.clientY - dragStart.y;
    if (Math.abs(event.clientX-dragStart.x)+Math.abs(event.clientY-dragStart.y)>4) dragStart.moved = true;
    if (dragStart.moved) { shortcut.classList.add('is-dragging'); applyPosition(x,y); }
  });
  const endDrag = event => {
    if (!dragStart) return;
    if (dragStart.moved) {
      const rect = shortcut.getBoundingClientRect();
      try { localStorage.setItem(positionKey,JSON.stringify({x:rect.left/innerWidth,y:rect.top/innerHeight})); } catch (_error) {}
      suppressNextClick = true;
      setTimeout(()=>{ suppressNextClick = false; },0);
      event.preventDefault();
    }
    shortcut.classList.remove('is-dragging');
    dragStart = null;
  };
  shortcut.addEventListener('pointerup',endDrag);
  shortcut.addEventListener('pointercancel',endDrag);
  shortcut.addEventListener('click',event => { if (suppressNextClick) event.preventDefault(); });
})();
