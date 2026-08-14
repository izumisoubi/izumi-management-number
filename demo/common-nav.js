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
  const menuPage = 'index.html';
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
    if (target === page || (!page && target === menuPage)) {
      link.classList.add('current');
      link.setAttribute('aria-current', 'page');
    }
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

/*
 * Every ordinary single-choice list gets the same searchable picker.
 * The original <select> remains the source of truth, so existing input/change
 * handlers, saved values and form submission continue to work unchanged.
 */
(() => {
  const STYLE_ID = 'izumi_sales_demo_mirror_-searchable-select-style';
  const PICKER_ID = 'izumi_sales_demo_mirror_-searchable-select-picker';
  const MAX_VISIBLE_OPTIONS = 500;
  const normalize = value => String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('ja-JP')
    .replace(/[\s\u3000]+/g, '');

  const eligible = select => {
    if (!(select instanceof HTMLSelectElement)) return false;
    if (select.disabled || select.multiple || Number(select.size || 0) > 1) return false;
    if (select.dataset.searchableSelect === 'off' || select.hasAttribute('data-native-select')) return false;
    if (select.getAttribute('aria-hidden') === 'true' || select.hidden) return false;
    return select.options.length > 1 && select.getClientRects().length > 0;
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PICKER_ID}{position:fixed;z-index:2147483000;display:flex;flex-direction:column;min-width:260px;max-width:min(520px,calc(100vw - 16px));max-height:min(480px,calc(100vh - 16px));overflow:hidden;border:1px solid #8ca8d0;border-radius:14px;background:#fff;color:#10284b;box-shadow:0 18px 48px rgba(11,35,68,.26);font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif}
      #${PICKER_ID}[hidden]{display:none!important}
      #${PICKER_ID} .iss-search-wrap{position:sticky;top:0;z-index:2;padding:10px;background:#f4f8ff;border-bottom:1px solid #d8e3f2}
      #${PICKER_ID} .iss-search{box-sizing:border-box;width:100%;height:42px;padding:0 38px 0 13px;border:2px solid #2b70d9;border-radius:10px;background:#fff;color:#10284b;font-family:inherit;font-size:15px;font-weight:700;line-height:1.2;outline:none;box-shadow:0 0 0 3px rgba(43,112,217,.10)}
      #${PICKER_ID} .iss-search-icon{position:absolute;right:23px;top:22px;color:#56708f;font-size:16px;pointer-events:none}
      #${PICKER_ID} .iss-list{overflow:auto;overscroll-behavior:contain;padding:6px;scrollbar-gutter:stable}
      #${PICKER_ID} .iss-option{box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;min-height:40px;padding:9px 11px;border:0;border-radius:8px;background:transparent;color:#17345f;text-align:left;font-family:inherit;font-size:14px;font-weight:700;line-height:1.35;cursor:pointer}
      #${PICKER_ID} .iss-option:hover,#${PICKER_ID} .iss-option.is-active{background:#e8f1ff;color:#0c55bd;outline:none}
      #${PICKER_ID} .iss-option.is-selected{background:#dceaff;color:#0b4d9e}
      #${PICKER_ID} .iss-option-mark{min-width:18px;color:#1768d3;font-size:14px;text-align:center}
      #${PICKER_ID} .iss-group{padding:8px 11px 4px;color:#6a7f9c;font-size:11px;font-weight:800;letter-spacing:.06em}
      #${PICKER_ID} .iss-empty,#${PICKER_ID} .iss-more{padding:16px 12px;color:#6a7f9c;font-size:13px;font-weight:700;text-align:center}
      @media(max-width:640px){#${PICKER_ID}{min-width:0;border-radius:12px}#${PICKER_ID} .iss-option{min-height:44px;font-size:15px}}
      @media print{#${PICKER_ID}{display:none!important}}
    `;
    document.head.append(style);
  }

  const picker = document.createElement('div');
  picker.id = PICKER_ID;
  picker.hidden = true;
  picker.setAttribute('role', 'dialog');
  picker.setAttribute('aria-label', '候補を検索して選択');
  picker.innerHTML = `
    <div class="iss-search-wrap">
      <input class="iss-search" type="search" autocomplete="off" spellcheck="false" aria-label="候補を検索">
      <span class="iss-search-icon" aria-hidden="true">⌕</span>
    </div>
    <div class="iss-list" role="listbox"></div>
  `;
  document.body.append(picker);
  const search = picker.querySelector('.iss-search');
  const list = picker.querySelector('.iss-list');
  let state = null;

  const fieldLabel = select => {
    const labelledBy = select.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
      if (text) return text;
    }
    if (select.id) {
      const label = document.querySelector(`label[for="${CSS.escape(select.id)}"]`);
      if (label?.textContent.trim()) return label.textContent.trim();
    }
    const parentLabel = select.closest('label');
    if (parentLabel?.textContent.trim()) return parentLabel.textContent.trim();
    return select.getAttribute('aria-label') || select.title || '候補';
  };

  const optionItems = select => [...select.options].map((option, index) => ({
    option,
    index,
    label: option.textContent.trim() || (option.value ? option.value : '（未選択）'),
    group: option.parentElement instanceof HTMLOptGroupElement ? option.parentElement.label : '',
    key: normalize(`${option.textContent} ${option.value} ${option.parentElement instanceof HTMLOptGroupElement ? option.parentElement.label : ''}`)
  }));

  const positionPicker = () => {
    if (!state || picker.hidden || !state.select.isConnected) return;
    const rect = state.select.getBoundingClientRect();
    const gap = 6;
    const viewportGap = 8;
    const width = Math.min(Math.max(rect.width, 280), Math.min(520, innerWidth - viewportGap * 2));
    const left = Math.min(Math.max(viewportGap, rect.left), Math.max(viewportGap, innerWidth - width - viewportGap));
    const below = innerHeight - rect.bottom - gap - viewportGap;
    const above = rect.top - gap - viewportGap;
    const openAbove = below < 250 && above > below;
    picker.style.width = `${width}px`;
    picker.style.left = `${left}px`;
    picker.style.maxHeight = `${Math.max(160, Math.min(480, openAbove ? above : below))}px`;
    if (openAbove) {
      picker.style.top = 'auto';
      picker.style.bottom = `${Math.max(viewportGap, innerHeight - rect.top + gap)}px`;
    } else {
      picker.style.bottom = 'auto';
      picker.style.top = `${Math.max(viewportGap, rect.bottom + gap)}px`;
    }
  };

  const render = () => {
    if (!state) return;
    const query = normalize(search.value);
    const matches = state.items.filter(item => !query || item.key.includes(query));
    const visible = matches.slice(0, MAX_VISIBLE_OPTIONS);
    state.visible = visible;
    if (!visible.length) state.active = -1;
    else if (state.active < 0 || state.active >= visible.length) {
      const selectedAt = visible.findIndex(item => item.index === state.select.selectedIndex);
      state.active = selectedAt >= 0 ? selectedAt : 0;
    }
    list.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'iss-empty';
      empty.textContent = '一致する候補がありません';
      list.append(empty);
      return;
    }
    let previousGroup = null;
    visible.forEach((item, visibleIndex) => {
      if (item.group && item.group !== previousGroup) {
        const group = document.createElement('div');
        group.className = 'iss-group';
        group.textContent = item.group;
        list.append(group);
      }
      previousGroup = item.group;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'iss-option';
      if (item.index === state.select.selectedIndex) button.classList.add('is-selected');
      if (visibleIndex === state.active) button.classList.add('is-active');
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(item.index === state.select.selectedIndex));
      button.dataset.visibleIndex = String(visibleIndex);
      button.disabled = item.option.disabled;
      const text = document.createElement('span');
      text.textContent = item.label;
      const mark = document.createElement('span');
      mark.className = 'iss-option-mark';
      mark.textContent = item.index === state.select.selectedIndex ? '✓' : '';
      button.append(text, mark);
      list.append(button);
    });
    if (matches.length > visible.length) {
      const more = document.createElement('div');
      more.className = 'iss-more';
      more.textContent = `ほか ${matches.length - visible.length} 件 — 文字を入力して絞り込めます`;
      list.append(more);
    }
    requestAnimationFrame(() => list.querySelector('.iss-option.is-active')?.scrollIntoView({block: 'nearest'}));
  };

  const closePicker = ({restoreFocus = false} = {}) => {
    const select = state?.select;
    state = null;
    picker.hidden = true;
    search.value = '';
    list.replaceChildren();
    if (restoreFocus && select?.isConnected) select.focus({preventScroll: true});
  };

  const openPicker = (select, initialQuery = '') => {
    if (!eligible(select)) return;
    if (state?.select === select && !picker.hidden) {
      if (initialQuery) { search.value = initialQuery; state.active = -1; render(); }
      search.focus({preventScroll: true});
      return;
    }
    state = {select, items: optionItems(select), visible: [], active: -1};
    search.placeholder = `${fieldLabel(select).replace(/\s+/g, ' ').slice(0, 30)}を入力して絞り込み`;
    search.value = initialQuery;
    picker.hidden = false;
    positionPicker();
    render();
    search.focus({preventScroll: true});
    search.select();
  };

  const choose = visibleIndex => {
    if (!state) return;
    const item = state.visible[visibleIndex];
    if (!item || item.option.disabled) return;
    const select = state.select;
    select.selectedIndex = item.index;
    select.dispatchEvent(new Event('input', {bubbles: true}));
    select.dispatchEvent(new Event('change', {bubbles: true}));
    closePicker({restoreFocus: true});
  };

  search.addEventListener('input', event => {
    if (event.isComposing || !state) return;
    state.active = -1;
    render();
  });
  search.addEventListener('compositionend', () => {
    if (!state) return;
    state.active = -1;
    render();
  });
  search.addEventListener('keydown', event => {
    if (!state) return;
    if (event.key === 'Escape') { event.preventDefault(); closePicker({restoreFocus: true}); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!state.visible.length) return;
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      state.active = (state.active + direction + state.visible.length) % state.visible.length;
      render();
      return;
    }
    if (event.key === 'Enter' && state.active >= 0) { event.preventDefault(); choose(state.active); }
  });
  list.addEventListener('pointermove', event => {
    const option = event.target.closest('.iss-option');
    if (!option || !state) return;
    const next = Number(option.dataset.visibleIndex);
    if (state.active === next) return;
    state.active = next;
    list.querySelectorAll('.iss-option.is-active').forEach(node => node.classList.remove('is-active'));
    option.classList.add('is-active');
  });
  list.addEventListener('click', event => {
    const option = event.target.closest('.iss-option');
    if (!option) return;
    choose(Number(option.dataset.visibleIndex));
  });

  document.addEventListener('pointerdown', event => {
    const select = event.target.closest?.('select');
    if (select && eligible(select)) {
      event.preventDefault();
      openPicker(select);
      return;
    }
    if (!picker.hidden && !picker.contains(event.target)) closePicker();
  }, true);
  document.addEventListener('click', event => {
    const select = event.target.closest?.('select');
    if (!select || !eligible(select)) return;
    event.preventDefault();
    openPicker(select);
  }, true);
  document.addEventListener('keydown', event => {
    const select = event.target;
    if (!eligible(select) || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openPicker(select);
      return;
    }
    if (event.key.length === 1 && !event.isComposing) {
      event.preventDefault();
      openPicker(select, event.key);
    }
  }, true);
  addEventListener('resize', positionPicker, {passive: true});
  addEventListener('scroll', positionPicker, {passive: true, capture: true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) closePicker(); });
})();
