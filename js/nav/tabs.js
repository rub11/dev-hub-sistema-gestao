/* =========================================================
   DEV HUB · Navegação · abas
   Persistência, render, abrir/fechar.
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV;

  /* ---------- Persistência ---------- */
  function readTabs() {
    try {
      const raw = sessionStorage.getItem(NAV.TABS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function writeTabs(tabs) {
    try {
      sessionStorage.setItem(NAV.TABS_KEY, JSON.stringify(tabs.slice(0, NAV.MAX_TABS)));
    } catch (e) { /* ignora */ }
  }

  function syncCurrentTab() {
    const id = NAV.currentPageId();
    const item = NAV.findItemById(id);
    if (!item) return;

    const tabs = readTabs();
    const exists = tabs.some(function (t) { return t.id === id; });
    if (exists) return;

    tabs.push({ id: item.id, label: item.label, href: item.href, icon: item.icon });
    writeTabs(tabs);
  }

  /* ---------- Render ---------- */
  function renderTabs() {
    const wrap = document.getElementById('app-tabs-scroll');
    if (!wrap) return;

    const tabs = readTabs();
    const activeId = NAV.currentPageId();

    wrap.innerHTML = '';

    if (tabs.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'app-tabs__empty';
      empty.textContent = 'Nenhuma aba aberta';
      wrap.appendChild(empty);
      return;
    }

    tabs.forEach(function (tab) {
      wrap.appendChild(buildTabEl(tab, tab.id === activeId));
    });
  }

  function buildTabEl(tab, isActive) {
    const el = document.createElement('div');
    el.className = 'app-tab' + (isActive ? ' is-active' : '');
    el.dataset.tabId = tab.id;
    el.setAttribute('role', 'tab');
    el.setAttribute('tabindex', isActive ? '0' : '-1');
    if (isActive) el.setAttribute('aria-current', 'page');

    const icon = document.createElement('span');
    icon.className = 'app-tab__icon';
    icon.innerHTML = NAV.ICONS[tab.icon] || '';
    icon.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'app-tab__label';
    label.textContent = tab.label;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'app-tab__close';
    close.setAttribute('aria-label', 'Fechar aba ' + tab.label);
    close.title = 'Fechar';
    close.innerHTML = NAV.ICONS.close;
    close.addEventListener('click', function (ev) {
      ev.stopPropagation();
      closeTab(tab.id);
    });

    el.appendChild(icon);
    el.appendChild(label);
    el.appendChild(close);

    el.addEventListener('click', function (ev) {
      if (ev.target.closest('.app-tab__close')) return;
      if (isActive) return;
      window.location.href = tab.href;
    });

    el.addEventListener('auxclick', function (ev) {
      if (ev.button === 1) closeTab(tab.id);
    });

    return el;
  }

  /* ---------- Abrir / fechar ---------- */
  function openItemAsTab(item) {
    if (!item) return;

    const cap = NAV.ITEM_PERM[item.id];
    if (cap && !NAV.roles.hasPermission(cap)) {
      NAV.permissionModal.show(item.label);
      return;
    }

    const tabs = readTabs();
    const exists = tabs.some(function (t) { return t.id === item.id; });
    if (!exists) {
      tabs.push({ id: item.id, label: item.label, href: item.href, icon: item.icon });
      writeTabs(tabs);
    }

    window.location.href = item.href;
  }

  function closeTab(id) {
    const tabs = readTabs();
    const idx = tabs.findIndex(function (t) { return t.id === id; });
    if (idx === -1) return;

    const isActive = id === NAV.currentPageId();
    tabs.splice(idx, 1);
    writeTabs(tabs);

    if (isActive) {
      const next = tabs[idx] || tabs[idx - 1] || tabs[tabs.length - 1];
      window.location.href = next ? next.href : NAV.HOME_URL;
      return;
    }

    renderTabs();
  }

  function clearAllTabs() {
    writeTabs([]);
    if (NAV.moduleMenu && NAV.moduleMenu.close) NAV.moduleMenu.close();
    window.location.href = NAV.HOME_URL;
  }

  NAV.tabs = {
    read: readTabs,
    write: writeTabs,
    sync: syncCurrentTab,
    render: renderTabs,
    open: openItemAsTab,
    close: closeTab,
    clearAll: clearAllTabs
  };
})();