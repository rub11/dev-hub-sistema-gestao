/* =========================================================
   DEV HUB · Navegação · main (bootstrap)
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV;
  const state = NAV.state;

  (function applyEarlyTopnavLayout() {
    try {
      if (/[?&]blocked=1/.test(location.search)) return;
      NAV.styles.inject();
      document.documentElement.classList.add('layout-topnav');
    } catch (e) { /* ignora */ }
  })();

  function renderOnce(force) {
    if (state.rendered && !force) return;
    state.rendered = true;
    NAV.bar.render();
  }

  function bootstrap() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('blocked')) return;

    NAV.styles.inject();
    NAV.permissionModal.inject();
    NAV.tabs.sync();

    if (window.Perms && typeof window.Perms.load === 'function') {
      window.Perms.load().catch(function () { renderOnce(); });
      setTimeout(function () { renderOnce(); }, 1500);
    } else {
      renderOnce();
    }

    NAV.userMenu.scheduleAvatarRefresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  window.addEventListener('load', NAV.userMenu.scheduleAvatarRefresh);

  document.addEventListener('perms:ready', function () {
    renderOnce(true);
  });

  if (window.db && window.db.auth && window.db.auth.onAuthStateChange) {
    window.db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        NAV.userMenu.scheduleAvatarRefresh();
      }
    });
  }

  document.addEventListener('click', function (e) {
    if (state.menuEl && !state.menuEl.hidden) {
      if (state.menuEl.contains(e.target)) return;
      if (e.target.closest('#app-tabs-new')) return;

      NAV.moduleMenu.close();
      const plusBtn = document.getElementById('app-tabs-new');
      if (plusBtn) plusBtn.setAttribute('aria-expanded', 'false');
    }

    if (!state.search.wrap) return;
    if (state.search.wrap.contains(e.target)) return;
    NAV.search.closeResults();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    NAV.moduleMenu.close();
    NAV.search.closeResults();
  });

  document.addEventListener('keydown', function (e) {
    const isK = String(e.key || '').toLowerCase() === 'k';
    if (!isK) return;
    if (!(e.ctrlKey || e.metaKey)) return;

    const input = document.getElementById('tnav-search-input');
    if (!input) return;

    e.preventDefault();
    input.focus();
    input.select();
  });

  window.addEventListener('scroll', function (e) {
    if (!state.menuEl || state.menuEl.hidden) return;
    if (e.target === state.menuEl || (e.target && state.menuEl.contains(e.target))) return;
    if (state.menuHovered) return;

    const plusBtn = document.getElementById('app-tabs-new');
    if (plusBtn) NAV.moduleMenu.position(state.menuEl, plusBtn);
  }, true);

  window.addEventListener('resize', function () {
    if (!state.menuEl || state.menuEl.hidden) return;
    const plusBtn = document.getElementById('app-tabs-new');
    if (plusBtn) NAV.moduleMenu.position(state.menuEl, plusBtn);
  });

  window.DHTabs = {
    open: NAV.tabs.open,
    close: NAV.tabs.close,
    list: NAV.tabs.read,
    clear: NAV.tabs.clearAll,
    sync: NAV.tabs.sync
  };

  window.DHModules = NAV.TOPNAV;
  window.DHItemPerm = NAV.ITEM_PERM;
  window.DHHomeUrl = NAV.HOME_URL;
})();