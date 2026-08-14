/* Phone-only interaction helpers. No business data is read or written here. */
(() => {
  'use strict';
  const query = matchMedia('(max-width: 767px)');
  if (!query.matches || window.__izumiMobileUiLoaded) return;
  window.__izumiMobileUiLoaded = true;
  document.documentElement.classList.add('mobile-ui');

  const page = decodeURIComponent(location.pathname.split('/').pop() || '');
  const cleanTarget = href => decodeURIComponent((href || '').split('?')[0].split('#')[0].split('/').pop());
  const links = [
    ['イズミ装美社内システム.html', '▦', '一覧'],
    ['calendar.html', '□', '予定'],
    ['管理番号取得.html', '＋', '番号'],
    ['estimate.html', '¥', '見積'],
    ['管理番号台帳.html', '≡', '台帳']
  ];

  function buildBottomNav() {
    if (document.querySelector('.mobile-bottom-nav')) return;
    const nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('aria-label', 'スマホ用主要メニュー');
    links.forEach(([href, icon, label]) => {
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.dataset.icon = icon;
      anchor.textContent = label;
      if (cleanTarget(href) === page) {
        anchor.classList.add('is-current');
        anchor.setAttribute('aria-current', 'page');
      }
      nav.append(anchor);
    });
    document.body.append(nav);
    const login = document.getElementById('loginCard');
    const update = () => { nav.hidden = Boolean(login && !login.classList.contains('hidden')); };
    update();
    if (login) new MutationObserver(update).observe(login, {attributes: true, attributeFilter: ['class']});
  }

  function addScrollHints() {
    ['ctbl', 'ordtbl', 'invCtbl'].forEach(id => {
      const table = document.getElementById(id);
      if (table?.parentElement) table.parentElement.setAttribute('data-mobile-scroll', '');
    });
    const selectors = ['.table-wrap', '.sheet-wrap', '.ctbl-wrap', '.cost-table-wrap', '.order-table-wrap', '.cost-panel'];
    const candidates = [...document.querySelectorAll(`${selectors.join(',')},[data-mobile-scroll]`)];
    candidates.forEach(container => {
      if (container.dataset.mobileHintReady) return;
      const show = () => {
        if (container.scrollWidth <= container.clientWidth + 18) return;
        container.dataset.mobileHintReady = '1';
        const hint = document.createElement('div');
        hint.className = 'mobile-scroll-hint';
        hint.textContent = '横にスワイプして続きを表示 →';
        container.prepend(hint);
        const dismiss = () => {
          if (container.scrollLeft > 12) {
            hint.classList.add('is-dismissed');
            setTimeout(() => hint.remove(), 260);
            container.removeEventListener('scroll', dismiss);
          }
        };
        container.addEventListener('scroll', dismiss, {passive: true});
        setTimeout(() => hint.classList.add('is-dismissed'), 4200);
        setTimeout(() => hint.remove(), 4500);
      };
      requestAnimationFrame(show);
    });
  }

  function addPreviewToggles() {
    const screens = [
      ['sc-estimate', '見積書'],
      ['sc-order', '注文確認書'],
      ['sc-invoice', '請求書'],
      ['sc-report', '完了報告書']
    ];
    screens.forEach(([id, name]) => {
      const screen = document.getElementById(id);
      if (!screen || screen.querySelector(':scope > .mobile-preview-toggle')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mobile-preview-toggle';
      button.textContent = `${name}をプレビュー`;
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', () => {
        const open = screen.classList.toggle('mobile-preview-open');
        button.textContent = open ? '入力画面に戻る' : `${name}をプレビュー`;
        button.setAttribute('aria-expanded', String(open));
        window.scrollTo({top: Math.max(0, screen.offsetTop - 104), behavior: 'smooth'});
      });
      screen.prepend(button);
    });
  }

  function improveCalendarFilter() {
    if (page !== 'calendar.html') return;
    const select = document.getElementById('staffFilter');
    if (!select) return;
    select.setAttribute('aria-label', '表示する社員を選択');
    const field = select.closest('.field');
    if (field) field.title = 'スマホでは一人に絞ると予定を確認しやすくなります';
  }

  function init() {
    buildBottomNav();
    addPreviewToggles();
    improveCalendarFilter();
    addScrollHints();
    const observer = new MutationObserver(() => {
      addPreviewToggles();
      addScrollHints();
    });
    observer.observe(document.body, {childList: true, subtree: true});
    setTimeout(() => observer.disconnect(), 12000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
