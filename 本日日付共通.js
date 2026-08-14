(() => {
  'use strict';

  if (window.__izumiTodayDateDisplayLoaded) return;
  window.__izumiTodayDateDisplayLoaded = true;

  const styleId = 'todayDateDisplayStyle';
  const displayId = 'todayDateDisplay';

  function normalizeHeaderLayout() {
    // 見積画面は同じ2段構造をHTML側で持っているため、そのまま利用する。
    if (document.querySelector('body > .tabbar:first-of-type')) return;
    const header = document.querySelector('body > header:first-of-type');
    if (!header || header.querySelector(':scope > .izumi-ledger-primary')) return;

    const heading = header.querySelector('h1');
    const title = header.querySelector('.title');
    let titleBlock = heading ? (heading.parentElement === header ? heading : heading.parentElement) : null;
    if (!titleBlock && title) titleBlock = title.parentElement === header ? title : title.parentElement;
    if (!titleBlock) titleBlock = header.querySelector('.system-brand');
    if (!titleBlock) return;

    const primary = document.createElement('div');
    primary.className = 'izumi-ledger-primary';
    const dateSlot = document.createElement('div');
    dateSlot.className = 'header-actions izumi-ledger-date-slot';
    dateSlot.setAttribute('aria-label', '本日の日付');
    const secondary = document.createElement('div');
    secondary.className = 'izumi-ledger-secondary';

    const actionSelector = [
      '.header-content', '#userBox', '.header-actions', '.toolbar-actions',
      '.toolbar', '.links', '.user', '.auth-controls', 'nav', 'a.system-tab', ':scope > a'
    ].join(',');
    const candidates = [...header.querySelectorAll(actionSelector)]
      .filter(element => !titleBlock.contains(element))
      .filter(element => !element.parentElement?.closest(actionSelector));

    document.body.classList.add('ledger-system', 'unified-header-system');
    header.prepend(primary);
    primary.append(titleBlock, dateSlot);
    header.append(secondary);
    candidates.forEach(element => secondary.append(element));

    // 旧レイアウトのラッパーに残った要素も下段へ集約し、空ラッパーは残さない。
    [...header.children].forEach(child => {
      if (child === primary || child === secondary) return;
      if (child.textContent.trim() || child.childElementCount) secondary.append(child);
      else child.remove();
    });
  }

  function japanDateParts(date = new Date()) {
    const parts = {};
    new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short'
    }).formatToParts(date).forEach(part => {
      if (part.type !== 'literal') parts[part.type] = part.value;
    });
    return parts;
  }

  function dateLabels(date = new Date()) {
    const parts = japanDateParts(date);
    return {
      full: `本日　${parts.year}年${parts.month}月${parts.day}日（${parts.weekday}）`,
      short: `本日 ${parts.month}/${parts.day}（${parts.weekday}）`
    };
  }

  function installStyle() {
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      #${displayId}{
        display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;
        min-height:30px;padding:5px 10px;border:1px solid rgba(132,154,184,.58);
        border-radius:8px;background:rgba(255,255,255,.12);color:inherit;
        font:800 11px/1.2 -apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif;
        font-variant-numeric:tabular-nums;letter-spacing:.02em;white-space:nowrap;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.08)
      }
      #${displayId}.today-date-in-header{margin-left:8px;order:2147483647}
      #${displayId}.today-date-floating{
        position:fixed;top:10px;right:12px;z-index:9500;background:#fff;color:#17345f;
        border-color:#b9c8db;box-shadow:0 5px 18px rgba(23,52,95,.16)
      }
      #${displayId} .today-date-short{display:none}
      @media(max-width:720px){
        #${displayId}{min-height:28px;padding:5px 8px;font-size:10px}
        #${displayId} .today-date-full{display:none}
        #${displayId} .today-date-short{display:inline}
      }
      @media print{#${displayId}{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function findTarget() {
    const selectors = [
      '.tabbar .header-actions',
      '.tabbar .bar-r',
      'header .header-actions',
      'header .toolbar-actions',
      'header .links',
      'header nav',
      'header .user',
      'header > .toolbar',
      'header .header-inner',
      'header .head',
      'header'
    ];
    for (const selector of selectors) {
      const target = document.querySelector(selector);
      if (!target) continue;
      const visible = selector === 'header' || target.getClientRects().length > 0;
      if (visible) return { target, actionGroup: /bar-r|actions|links|nav|user|toolbar/.test(selector) };
    }
    return null;
  }

  function updateDisplay(display) {
    const labels = dateLabels();
    display.querySelector('.today-date-full').textContent = labels.full;
    display.querySelector('.today-date-short').textContent = labels.short;
    display.title = labels.full;
    display.setAttribute('aria-label', labels.full);
  }

  function scheduleNextDay(display) {
    window.setTimeout(() => {
      updateDisplay(display);
      scheduleNextDay(display);
    }, 60000);
  }

  function mount() {
    if (document.getElementById(displayId)) return;
    normalizeHeaderLayout();
    installStyle();
    const display = document.createElement('span');
    display.id = displayId;
    display.setAttribute('role', 'status');
    display.setAttribute('aria-live', 'off');
    display.innerHTML = '<span class="today-date-full"></span><span class="today-date-short"></span>';
    updateDisplay(display);

    const placement = findTarget();
    if (placement) {
      display.classList.add('today-date-in-header');
      // 日付は全画面共通で、ヘッダー内の操作ボタンより後ろ（最も右）に置く。
      placement.target.append(display);
    } else {
      display.classList.add('today-date-floating');
      document.body.appendChild(display);
    }
    scheduleNextDay(display);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
