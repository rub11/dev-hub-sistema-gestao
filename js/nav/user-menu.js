/* =========================================================
   DEV HUB · Navegação · user menu + avatar + logout
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV;
  const state = NAV.state;

  /* ---------- Setup do dropdown ---------- */
  function setupUserDropdown() {
    const btn  = document.getElementById('app-tabs-user-btn');
    const menu = document.getElementById('app-tabs-user-menu');
    if (!btn || !menu) return;

    function position() {
      const rect = btn.getBoundingClientRect();
      const margin = 8, gap = 6;

      let top = rect.bottom + gap;
      let left = rect.right - menu.offsetWidth;

      if (left < margin) left = rect.left;
      if (left < margin) left = margin;

      const menuW = menu.offsetWidth || 0;
      if (left + menuW > window.innerWidth - margin) {
        left = window.innerWidth - menuW - margin;
      }

      const menuH = menu.offsetHeight || 0;
      if (menuH && top + menuH > window.innerHeight - margin) {
        const above = rect.top - gap - menuH;
        if (above >= margin) top = above;
      }

      menu.style.top = top + 'px';
      menu.style.left = left + 'px';
    }

    function open() {
      menu.hidden = false;
      position();
      btn.setAttribute('aria-expanded', 'true');
      const first = menu.querySelector('.app-tabs__user-item');
      if (first) first.focus();
    }
    function close() {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.hidden ? open() : close();
    });

    document.addEventListener('click', function (e) {
      if (menu.hidden) return;
      if (menu.contains(e.target) || btn.contains(e.target)) return;
      close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { close(); btn.focus(); }
    });

    window.addEventListener('resize', function () { if (!menu.hidden) position(); });
    window.addEventListener('scroll', function () { if (!menu.hidden) position(); }, true);
  }

  /* ---------- Avatar ---------- */
  function readCachedAvatar() {
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (!raw) return null;
      const ctx = JSON.parse(raw);
      return ctx && ctx.avatar_url ? ctx.avatar_url : null;
    } catch (e) { return null; }
  }

  async function fetchAvatarFromDb() {
    if (!window.db) return null;
    try {
      const { data: sess } = await window.db.auth.getSession();
      const uid = sess && sess.session && sess.session.user && sess.session.user.id;
      if (!uid) return null;

      const { data, error } = await window.db
        .from('profiles').select('avatar_url').eq('id', uid).maybeSingle();
      if (error) return null;
      return data && data.avatar_url ? data.avatar_url : null;
    } catch (e) { return null; }
  }

  async function applyTopbarAvatar() {
    if (state.avatarPromise) return state.avatarPromise;

    state.avatarPromise = (async function () {
      const el = document.getElementById('user-avatar');
      if (!el) return;

      const cached = readCachedAvatar();
      if (cached) { renderTopbarAvatar(cached); return; }

      const url = await fetchAvatarFromDb();
      if (!url) return;

      renderTopbarAvatar(url);

      try {
        const raw = sessionStorage.getItem('devhub_user');
        const ctx = raw ? JSON.parse(raw) : {};
        ctx.avatar_url = url;
        sessionStorage.setItem('devhub_user', JSON.stringify(ctx));
      } catch (e) { /* ignora */ }
    })().catch(function () { return null; });

    return state.avatarPromise;
  }

  function renderTopbarAvatar(url) {
    const el = document.getElementById('user-avatar');
    if (!el) return;
    if (el.dataset.avatarUrl === (url || '')) return;

    el.innerHTML = '';
    el.dataset.avatarUrl = url || '';

    if (url) {
      el.style.background = 'none';
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.onerror = function () {
        el.innerHTML = '';
        el.style.background = '';
        el.dataset.avatarUrl = '';
      };
      el.appendChild(img);
    } else {
      el.style.background = '';
    }
  }

  function applyBarAvatar() {
    const el = document.getElementById('user-avatar-bar');
    if (!el) return;
    if (el.dataset.avatarUrl) return;

    const cached = readCachedAvatar();
    if (cached) {
      el.style.background = 'none';
      el.innerHTML = '';
      const img = document.createElement('img');
      img.src = cached;
      img.alt = '';
      el.dataset.avatarUrl = cached;
      el.appendChild(img);
    }
  }

  function syncBarUserInfo() {
    applyBarAvatar();

    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (!raw) return;
      const ctx = JSON.parse(raw);

      const fullName = ctx.name || '';
      const first = String(fullName).trim().split(/\s+/)[0] || '';
      const initial = first.charAt(0).toUpperCase() || '?';

      const nameEl = document.getElementById('user-name-bar');
      const roleEl = document.getElementById('user-role-bar');
      const avatarEl = document.getElementById('user-avatar-bar');

      if (nameEl) nameEl.textContent = fullName || 'Usuário';

      if (roleEl) {
        const roleText = window.Auth && window.Auth.roleLabel
          ? window.Auth.roleLabel(ctx.role || '')
          : (ctx.role || '');
        roleEl.textContent = roleText;
      }

      if (avatarEl && !avatarEl.dataset.avatarUrl) {
        avatarEl.textContent = initial;
      }
    } catch (e) { /* ignora */ }
  }

  function scheduleAvatarRefresh() {
    [0, 100, 300, 800, 1500].forEach(function (ms) {
      setTimeout(function () {
        applyTopbarAvatar();
        applyBarAvatar();
        syncBarUserInfo();
      }, ms);
    });
  }

  /* ---------- Logout ---------- */
  function bindLogout(scope) {
    scope.querySelectorAll('[data-action="logout"]').forEach(function (btn) {
      if (btn.dataset.logoutBound === '1') return;
      btn.dataset.logoutBound = '1';

      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');

        try { sessionStorage.removeItem(NAV.TABS_KEY); } catch (e) { /* ignora */ }

        if (window.Auth && typeof window.Auth.signOut === 'function') {
          window.Auth.signOut();
        } else {
          window.location.href = 'index.html';
        }
      });
    });
  }

  NAV.userMenu = {
    setup: setupUserDropdown,
    bindLogout,
    syncBarUserInfo,
    scheduleAvatarRefresh,
    applyTopbarAvatar,
    applyBarAvatar
  };
})();