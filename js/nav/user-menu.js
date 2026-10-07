/* =========================================================
   DEV HUB · Navegação · user menu + avatar + logout
   v4: applyTopbarAvatar sempre busca do banco (sem travar)
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV;
  const state = NAV.state;

  /* =========================================================
     Slot do org switcher dentro do dropdown
     ========================================================= */
  function ensureOrgSlot(menu) {
    if (!menu) return null;
    let slot = menu.querySelector('#user-menu-org-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'user-menu-org-slot';
      slot.className = 'user-menu__org-slot';
      menu.insertBefore(slot, menu.firstChild);
    }
    return slot;
  }

  /* =========================================================
     Gestão no dropdown (só pra gestor/admin)
     ========================================================= */
  function usuarioPodeGerenciar() {
    try {
      if (NAV.roles && typeof NAV.roles.readContext === 'function') {
        const ctx = NAV.roles.readContext() || {};
        if (ctx.isPlatform) return true;
        const r = String(ctx.role || '').toLowerCase();
        if (['admin', 'administrador', 'gestor', 'manager'].indexOf(r) !== -1) return true;
        const caps = ctx.caps || {};
        if (caps['management.view'] === true) return true;
      }
    } catch (e) {}

    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (raw) {
        const ctx = JSON.parse(raw);
        const r = String(ctx.role || '').toLowerCase();
        if (['admin', 'administrador', 'gestor', 'manager', 'platform_admin'].indexOf(r) !== -1) return true;
      }
    } catch (e) {}

    try {
      if (window.Perms && typeof window.Perms.has === 'function') {
        return window.Perms.has('management.view') === true;
      }
    } catch (e) {}

    return false;
  }

  function injetarItemGestao(menu) {
    if (!menu) return;
    if (menu.querySelector('[data-user-menu-gestao]')) return;
    if (!usuarioPodeGerenciar()) return;

    const todosItens = menu.querySelectorAll('.app-tabs__user-item, .menu-item, a, button');
    let ancora = null;
    for (const el of todosItens) {
      if (el.closest('#user-menu-org-slot')) continue;
      if (el.hasAttribute('data-user-menu-gestao')) continue;
      const txt = (el.textContent || '').trim().toLowerCase();
      if (txt.startsWith('minha conta') || txt.includes('perfil') || txt.includes('configura')) {
        ancora = el;
        break;
      }
    }
    if (!ancora) {
      for (const el of todosItens) {
        if (el.closest('#user-menu-org-slot')) continue;
        ancora = el;
        break;
      }
    }

    const classeBase = ancora ? ancora.className : 'menu-item';

    const link = document.createElement('a');
    link.href = 'gestao.html';
    link.className = classeBase;
    link.setAttribute('role', 'menuitem');
    link.setAttribute('data-user-menu-gestao', '1');
    link.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' +
      'style="width:16px;height:16px;margin-right:8px;vertical-align:-3px">' +
        '<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/>' +
        '<circle cx="9" cy="7.5" r="3.5"/>' +
        '<path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/>' +
        '<path d="M16.5 4.13a4 4 0 0 1 0 7.75"/>' +
      '</svg>' +
      '<span>Gestão de usuários</span>';

    if (ancora && ancora.parentNode) {
      ancora.parentNode.insertBefore(link, ancora);
    } else {
      menu.appendChild(link);
    }
  }

  /* =========================================================
     Setup do dropdown
     ========================================================= */
  function setupUserDropdown() {
    const btn  = document.getElementById('app-tabs-user-btn');
    const menu = document.getElementById('app-tabs-user-menu');
    if (!btn || !menu) return;

    ensureOrgSlot(menu);

    if (NAV.orgSwitcher && typeof NAV.orgSwitcher.init === 'function') {
      try { NAV.orgSwitcher.init(); } catch (e) {}
    }

    injetarItemGestao(menu);

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
      injetarItemGestao(menu);
      position();
      btn.setAttribute('aria-expanded', 'true');
      const first = menu.querySelector('.app-tabs__user-item, .menu-item, a, button');
      if (first) first.focus();
    }
    function close() {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (NAV.orgSwitcher && typeof NAV.orgSwitcher.closeMenu === 'function') {
        try { NAV.orgSwitcher.closeMenu(); } catch (e) {}
      }
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.hidden ? open() : close();
    });

    document.addEventListener('click', function (e) {
      if (menu.hidden) return;
      if (menu.contains(e.target) || btn.contains(e.target)) return;
      const t = e.target;
      if (t && t.closest && (
        t.closest('.org-switcher__menu') ||
        t.closest('#org-switcher-btn') ||
        t.closest('#user-menu-org-slot')
      )) return;
      close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { close(); btn.focus(); }
    });

    window.addEventListener('resize', function () { if (!menu.hidden) position(); });
    window.addEventListener('scroll', function () { if (!menu.hidden) position(); }, true);
  }

  /* =========================================================
     Avatar — leitura
     ========================================================= */
  function readCachedAvatar() {
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (!raw) return null;
      const ctx = JSON.parse(raw);
      return ctx && ctx.avatar_url ? ctx.avatar_url : null;
    } catch (e) { return null; }
  }

  function writeCachedAvatar(url) {
    try {
      let raw = sessionStorage.getItem('devhub_user');
      let ctx = {};
      if (raw) {
        try { ctx = JSON.parse(raw) || {}; } catch (e) { ctx = {}; }
      }
      if (typeof ctx !== 'object' || ctx === null) ctx = {};

      if (url) ctx.avatar_url = url;
      else delete ctx.avatar_url;

      sessionStorage.setItem('devhub_user', JSON.stringify(ctx));
    } catch (e) {
      console.warn('[DEV HUB] Falha ao gravar avatar no sessionStorage:', e);
    }
  }

  async function fetchAvatarFromDb() {
    if (!window.db) return null;
    try {
      const { data: sess } = await window.db.auth.getSession();
      const uid = sess && sess.session && sess.session.user && sess.session.user.id;
      if (!uid) return null;

      const { data, error } = await window.db
        .from('profiles')
        .select('avatar_url')
        .eq('id', uid)
        .maybeSingle();
      if (error) {
        console.warn('[user-menu] fetchAvatar:', error);
        return null;
      }
      return data && data.avatar_url ? data.avatar_url : null;
    } catch (e) {
      console.warn('[user-menu] fetchAvatar exceção:', e);
      return null;
    }
  }

  /* =========================================================
     Avatar — aplicação no topbar
     ---------------------------------------------------------
     CORREÇÃO: não trava mais com promise cacheada.
     Fluxo:
       1. Aplica cache imediatamente (evita flash)
       2. SEMPRE busca do banco
       3. Se diferente, atualiza + reescreve cache
     ========================================================= */
  async function applyTopbarAvatar() {
    const el = document.getElementById('user-avatar');
    if (!el) return;

    // 1) Cache imediato
    const cached = readCachedAvatar();
    if (cached) renderTopbarAvatar(cached);

    // 2) Busca do banco sempre
    const url = await fetchAvatarFromDb();

    // 3) Aplica se for diferente
    if (url !== cached) {
      renderTopbarAvatar(url);
      writeCachedAvatar(url);
    }
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

  /* =========================================================
     Logout
     ========================================================= */
  function bindLogout(scope) {
    scope.querySelectorAll('[data-action="logout"]').forEach(function (btn) {
      if (btn.dataset.logoutBound === '1') return;
      btn.dataset.logoutBound = '1';

      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        try { sessionStorage.removeItem(NAV.TABS_KEY); } catch (e) {}

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
    applyBarAvatar,
    ensureOrgSlot,
    injetarItemGestao,
    readCachedAvatar,
    writeCachedAvatar
  };
})();