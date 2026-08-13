(() => {
  'use strict';

  if (window.__izumiTodayDateDisplayLoaded) return;
  window.__izumiTodayDateDisplayLoaded = true;

  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const styleId = 'todayDateDisplayStyle';
  const displayId = 'todayDateDisplay';

  function dateLabels(date = new Date()) {
    return {
      full: `本日　${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${weekdays[date.getDay()]}）`,
      short: `本日 ${date.getMonth() + 1}/${date.getDate()}（${weekdays[date.getDay()]}）`
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
      #${displayId}.today-date-in-header{margin-left:8px}
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
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
    window.setTimeout(() => {
      updateDisplay(display);
      scheduleNextDay(display);
    }, Math.max(1000, next.getTime() - now.getTime()));
  }

  function mount() {
    if (document.getElementById(displayId)) return;
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
      if (placement.actionGroup) placement.target.prepend(display);
      else placement.target.append(display);
    } else {
      display.classList.add('today-date-floating');
      document.body.appendChild(display);
    }
    scheduleNextDay(display);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
