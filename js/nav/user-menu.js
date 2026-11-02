/* =========================================================
   DEV HUB · Navegação · user menu + avatar + logout
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV;
  if (!NAV) return;
  const state = NAV.state;

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

  function usuarioPodeGerenciar() {
    try {
      if (NAV.roles && typeof NAV.roles.readContext === 'function') {
        const ctx = NAV.roles.readContext() || {};
        if (ctx.isPlatform) return true;
        const r = String(ctx.role || '').toLowerCase();
        if (['admin', 'administrador', 'gestor', 'manager'].indexOf(r) !== -1) return true;
      }
    } catch (e) {}
    return false;
  }

  function makeSeparator() {
    const sep = document.createElement('div');
    sep.className = 'app-tabs__user-sep';
    sep.setAttribute('role', 'separator');
    return sep;
  }

  // ==========================================
  // INJETAR GESTÃO DE USUÁRIOS
  // ==========================================
  function injetarItemGestao(menu) {
    if (!menu || menu.querySelector('[data-user-menu-gestao]') || !usuarioPodeGerenciar()) return;

    const link = document.createElement('a');
    link.href = 'gestao.html';
    // Usamos APENAS a classe do topnav para herdar o alinhamento correto
    link.className = 'app-tabs__user-item'; 
    link.setAttribute('role', 'menuitem');
    link.setAttribute('data-user-menu-gestao', '1');
    link.innerHTML = 
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
        '<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/>' +
        '<circle cx="9" cy="7.5" r="3.5"/>' +
        '<path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/>' +
        '<path d="M16.5 4.13a4 4 0 0 1 0 7.75"/>' +
      '</svg>' +
      '<span>Gestão de usuários</span>';

    const ancora = menu.querySelector('[href="configuracoes.html"]');
    if (ancora && ancora.parentNode) {
      ancora.parentNode.insertBefore(link, ancora);
    } else {
      menu.appendChild(link);
    }
  }

  // ==========================================
  // INJETAR FAVORITOS E ALTERNAR TEMA
  // ==========================================
  function injetarItensMenu(menu) {
    if (!menu) return;

    // 1. Favoritos
    if (!menu.querySelector('[data-user-menu-fav]')) {
      const btnFav = document.createElement('button');
      btnFav.type = 'button';
      btnFav.className = 'app-tabs__user-item'; // Sem a classe menu-item conflitante
      btnFav.setAttribute('role', 'menuitem');
      btnFav.setAttribute('data-user-menu-fav', '1');
      btnFav.innerHTML = 
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
          '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
        '</svg>' +
        '<span>Favoritos</span>';
      
      btnFav.addEventListener('click', () => {
        if (window.DHFavoritesModal) window.DHFavoritesModal.open();
      });

      const ancora = menu.querySelector('[href="configuracoes.html"]');
      if (ancora && ancora.parentNode) {
        ancora.parentNode.insertBefore(btnFav, ancora);
      } else {
        menu.appendChild(btnFav);
      }
    }

    // 2. Alternar Tema
    if (!menu.querySelector('[data-user-menu-tema]')) {
      // Adiciona separador antes do tema se não existir
      const sairBtn = menu.querySelector('[data-action="logout"]');
      if (sairBtn && sairBtn.parentNode) {
        // Verifica se já tem um separador antes do "Sair"
        if (!sairBtn.previousElementSibling || !sairBtn.previousElementSibling.classList.contains('app-tabs__user-sep')) {
          sairBtn.parentNode.insertBefore(makeSeparator(), sairBtn);
        }
      }

      const btnTema = document.createElement('button');
      btnTema.type = 'button';
      btnTema.className = 'app-tabs__user-item'; // Sem a classe menu-item conflitante
      btnTema.setAttribute('role', 'menuitem');
      btnTema.setAttribute('data-user-menu-tema', '1');
      btnTema.innerHTML = 
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
          '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>' +
        '</svg>' +
        '<span>Alternar Tema</span>';
      
      btnTema.addEventListener('click', () => {
        if (window.Theme && typeof window.Theme.toggle === 'function') {
          window.Theme.toggle();
        } else {
          const html = document.documentElement;
          const newTheme = (html.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
          html.setAttribute('data-theme', newTheme);
          localStorage.setItem('devhub_theme', newTheme);
        }
      });

      if (sairBtn && sairBtn.parentNode) {
        sairBtn.parentNode.insertBefore(btnTema, sairBtn);
      } else {
        menu.appendChild(btnTema);
      }
    }
  }

  function setupUserDropdown() {
    const btn  = document.getElementById('app-tabs-user-btn');
    const menu = document.getElementById('app-tabs-user-menu');
    if (!btn || !menu) return;

    ensureOrgSlot(menu);
    injetarItemGestao(menu);
    injetarItensMenu(menu);

    function position() {
      const rect = btn.getBoundingClientRect();
      const margin = 8, gap = 6;
      let top = rect.bottom + gap;
      let left = rect.right - menu.offsetWidth;
      if (left < margin) left = rect.left;
      if (left < margin) left = margin;
      const menuW = menu.offsetWidth || 0;
      if (left + menuW > window.innerWidth - margin) left = window.innerWidth - menuW - margin;
      const menuH = menu.offsetHeight || 0;
      if (menuH && top + menuH > window.innerHeight - margin) {
        const above = rect.top - gap - menuH;
        if (above >= margin) top = above;
      }
      menu.style.top = top + 'px';
      menu.style.left = left + 'px';
    }

    function open() {
      document.querySelectorAll('.nav-fav-panel, .tnav-notif, .popover-menu').forEach(el => el.hidden = true);
      menu.hidden = false;
      injetarItemGestao(menu);
      injetarItensMenu(menu);
      position();
      btn.setAttribute('aria-expanded', 'true');
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

  // =========================================================
  // Avatar e Logout
  // =========================================================
  function readCachedAvatar() {
    try {
      const raw = sessionStorage.getItem('devhub_user') || localStorage.getItem('devhub_user');
      if (!raw) return null;
      const ctx = JSON.parse(raw);
      return ctx && ctx.avatar_url ? ctx.avatar_url : null;
    } catch (e) { return null; }
  }

  function writeCachedAvatar(url) {
    try {
      let raw = sessionStorage.getItem('devhub_user') || localStorage.getItem('devhub_user');
      let ctx = {};
      if (raw) {
        try { ctx = JSON.parse(raw) || {}; } catch (e) { ctx = {}; }
      }
      if (typeof ctx !== 'object' || ctx === null) ctx = {};
      if (url) ctx.avatar_url = url;
      else delete ctx.avatar_url;
      sessionStorage.setItem('devhub_user', JSON.stringify(ctx));
    } catch (e) {}
  }

  async function fetchAvatarFromDb() {
    if (!window.db) return null;
    try {
      const { data: sess } = await window.db.auth.getSession();
      const uid = sess && sess.session && sess.session.user && sess.session.user.id;
      if (!uid) return null;
      const { data, error } = await window.db.from('profiles').select('avatar_url').eq('id', uid).maybeSingle();
      if (error) return null;
      return data && data.avatar_url ? data.avatar_url : null;
    } catch (e) { return null; }
  }

  let avatarFetchPromise = null;
  function fetchAvatarOnce() {
    if (!avatarFetchPromise) avatarFetchPromise = fetchAvatarFromDb();
    return avatarFetchPromise;
  }

  async function applyTopbarAvatar() {
    const el = document.getElementById('user-avatar');
    if (!el) return;
    const cached = readCachedAvatar();
    if (cached) renderTopbarAvatar(cached);
    const url = await fetchAvatarOnce();
    if (url !== readCachedAvatar()) {
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
      const raw = sessionStorage.getItem('devhub_user') || localStorage.getItem('devhub_user');
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
        const roleText = window.Auth && window.Auth.roleLabel ? window.Auth.roleLabel(ctx.role || '') : (ctx.role || '');
        roleEl.textContent = roleText;
      }
      if (avatarEl && !avatarEl.dataset.avatarUrl) {
        avatarEl.textContent = initial;
      }
    } catch (e) { }
  }

  function scheduleAvatarRefresh() {
    [0, 300, 1200].forEach(function (ms) {
      setTimeout(function () {
        applyTopbarAvatar();
        applyBarAvatar();
        syncBarUserInfo();
      }, ms);
    });
  }

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
    injetarItensMenu,
    readCachedAvatar,
    writeCachedAvatar
  };
})();