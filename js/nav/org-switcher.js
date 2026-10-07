/* =========================================================
   DEV HUB · Navegação · seletor de empresa
   v7: hint de gestão usa só ícone (não vaza da largura)
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV;
  if (!NAV) return;

  /* Página que abre quando clica na empresa ativa */
  const GESTAO_URL = 'gestao.html';

  const state = {
    orgs: [],
    current: null,
    loaded: false,
    menuEl: null,
    initialized: false,
    mountedIn: null
  };

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    const userMenuSlot = document.getElementById('user-menu-org-slot');
    const topbarSlot   = document.getElementById('org-switcher-slot');

    if (userMenuSlot) {
      state.mountedIn = 'user-menu';

      if (topbarSlot && topbarSlot.parentNode) {
        topbarSlot.parentNode.removeChild(topbarSlot);
      }
      document.querySelectorAll('#org-switcher-slot').forEach(el => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });

      if (userMenuSlot.querySelector('.org-switcher')) return;
      buildUI(userMenuSlot, true);
    } else if (topbarSlot) {
      state.mountedIn = 'topbar';
      if (topbarSlot.querySelector('.org-switcher')) return;
      buildUI(topbarSlot, false);
    } else {
      return;
    }

    if (!state.initialized) {
      state.initialized = true;
      bindGlobalClose();
      loadData()
        .then(() => render())
        .catch(e => console.warn('[org-switcher] init:', e));
    } else {
      render();
    }
  }

  async function loadData() {
    if (!window.db) return;

    let currentId = null;
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (raw) {
        const ctx = JSON.parse(raw);
        currentId = ctx.organization_id || null;
      }
    } catch (e) {}

    try {
      const { data: { user } } = await window.db.auth.getUser();
      if (user) {
        const { data: prof } = await window.db
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();
        if (prof && prof.organization_id) currentId = prof.organization_id;
      }
    } catch (e) {}

    try {
      const { data, error } = await window.db.rpc('list_user_organizations');
      if (error) throw error;
      state.orgs = data || [];
    } catch (e) {
      try {
        const { data: { user } } = await window.db.auth.getUser();
        const { data } = await window.db
          .from('organization_members')
          .select('organization_id, role, active, organizations:organization_id (id, name)')
          .eq('user_id', user.id)
          .eq('active', true);

        state.orgs = (data || []).map(m => ({
          id:     m.organization_id,
          name:   m.organizations && m.organizations.name ? m.organizations.name : '(sem nome)',
          role:   m.role,
          active: m.active
        }));
      } catch (err) {
        state.orgs = [];
      }
    }

    state.current = state.orgs.find(o => o.id === currentId) || state.orgs[0] || null;
    state.loaded = true;
  }

  /* =========================================================
     UI
     ========================================================= */
  function buildUI(slot, inMenu) {
    slot.innerHTML = `
      <button type="button"
              class="org-switcher${inMenu ? ' org-switcher--in-menu' : ''}"
              id="org-switcher-btn"
              aria-haspopup="menu" aria-expanded="false"
              title="Trocar de empresa">
        <span class="org-switcher__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 21h18"/>
            <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/>
            <path d="M15 21V9h4a2 2 0 0 1 2 2v10"/>
            <path d="M9 7h2M9 11h2M9 15h2"/>
          </svg>
        </span>
        <span class="org-switcher__name" id="org-switcher-name">Carregando…</span>
        <span class="org-switcher__chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </span>
      </button>
    `;

    if (inMenu) ensureMenuStyles();

    const btn = document.getElementById('org-switcher-btn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu(btn);
      });
    }
  }

  function ensureMenuStyles() {
    if (document.getElementById('org-switcher-menu-styles')) return;

    const style = document.createElement('style');
    style.id = 'org-switcher-menu-styles';
    style.textContent = `
      .user-menu__org-slot {
        padding: 6px 6px 8px;
        margin: 0 0 4px;
        border-bottom: 1px solid rgba(255,255,255,.08);
      }
      .org-switcher--in-menu {
        display: flex; align-items: center; gap: 10px;
        width: 100%; padding: 10px 12px;
        border-radius: 8px; background: transparent;
        border: 0; color: inherit; font: inherit;
        cursor: pointer; text-align: left;
        transition: background 120ms ease;
      }
      .org-switcher--in-menu:hover,
      .org-switcher--in-menu:focus-visible {
        background: rgba(255,255,255,.05); outline: 0;
      }
      .org-switcher--in-menu .org-switcher__icon {
        flex-shrink: 0; display: inline-flex;
        align-items: center; justify-content: center;
        width: 22px; height: 22px; color: #8b95a7;
      }
      .org-switcher--in-menu .org-switcher__icon svg { width: 18px; height: 18px; }
      .org-switcher--in-menu .org-switcher__name {
        flex: 1; min-width: 0; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap;
        font-size: 13.5px; font-weight: 500; color: #e6eaf2;
      }
      .org-switcher--in-menu .org-switcher__chevron {
        flex-shrink: 0; display: inline-flex;
        align-items: center; color: #8b95a7;
        transition: transform 160ms ease;
      }
      .org-switcher--in-menu .org-switcher__chevron svg { width: 14px; height: 14px; }
      .org-switcher--in-menu.is-open .org-switcher__chevron { transform: rotate(180deg); }

      .org-switcher__menu--inline {
        position: static !important;
        margin: 6px 0 4px 0; padding: 6px;
        width: 100%; max-width: none; box-sizing: border-box;
        border-radius: 10px;
        background: rgba(255,255,255,.025);
        border: 1px solid rgba(255,255,255,.06);
        box-shadow: none;
        opacity: 0; transform: translateY(-4px);
        transition: opacity 160ms ease, transform 160ms ease;
      }
      .org-switcher__menu--inline.is-open { opacity: 1; transform: translateY(0); }
      .org-switcher__menu--inline .org-switcher__menu-head {
        padding: 6px 8px 8px; font-size: 11px; letter-spacing: .04em;
      }
      .org-switcher__menu--inline .org-switcher__item {
        padding: 8px 8px; border-radius: 8px;
      }

      /* Ícone de "abrir gestão" no hover da org ativa */
      .org-switcher__item.is-active .org-switcher__action-hint {
        display: none;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        color: #7aa2ff;
      }
      .org-switcher__item.is-active:hover .org-switcher__check { display: none; }
      .org-switcher__item.is-active:hover .org-switcher__action-hint {
        display: inline-flex;
      }
      .org-switcher__item.is-active:hover .org-switcher__action-hint svg {
        width: 14px;
        height: 14px;
      }

      .org-switcher__menu:not(.org-switcher__menu--inline) {
        position: fixed; z-index: 9999;
      }
    `;
    document.head.appendChild(style);
  }

  function render() {
    const nameEl = document.getElementById('org-switcher-name');
    if (!nameEl) return;
    if (!state.loaded) return;
    if (!state.current) {
      nameEl.textContent = 'Sem empresa';
      return;
    }
    nameEl.textContent = state.current.name || '(sem nome)';
  }

  /* =========================================================
     MENU
     ========================================================= */
  function toggleMenu(anchor) {
    if (state.menuEl && !state.menuEl.hidden) {
      closeMenu();
      return;
    }
    openMenu(anchor);
  }

  function openMenu(anchor) {
    closeMenu();

    const isInline = state.mountedIn === 'user-menu';

    const menu = document.createElement('div');
    menu.className = 'org-switcher__menu' +
                     (isInline ? ' org-switcher__menu--inline' : '');
    menu.setAttribute('role', 'menu');

    const head = document.createElement('div');
    head.className = 'org-switcher__menu-head';
    head.innerHTML = '<span>Suas empresas</span><span>' + state.orgs.length + '</span>';
    menu.appendChild(head);

    if (state.orgs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'org-switcher__empty';
      empty.textContent = 'Nenhuma empresa vinculada.';
      menu.appendChild(empty);
    } else {
      state.orgs.forEach(o => {
        const isActive = state.current && o.id === state.current.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'org-switcher__item';
        if (isActive) btn.classList.add('is-active');
        btn.title = isActive ? 'Gerenciar empresa' : 'Trocar para ' + (o.name || '');

        const initial = (o.name || '?').trim().charAt(0).toUpperCase();
        btn.innerHTML = `
          <span class="org-switcher__avatar" aria-hidden="true">${escapeHTML(initial)}</span>
          <span class="org-switcher__item-body">
            <span class="org-switcher__item-name">${escapeHTML(o.name || '(sem nome)')}</span>
            <span class="org-switcher__item-role">${escapeHTML(labelRole(o.role))}</span>
          </span>
          ${isActive
            ? `<span class="org-switcher__check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
               <span class="org-switcher__action-hint" aria-hidden="true" title="Gerenciar empresa">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
               </span>`
            : ''}
        `;

        btn.addEventListener('click', () => onOrgClick(o, isActive));
        menu.appendChild(btn);
      });
    }

    if (isInline) {
      anchor.insertAdjacentElement('afterend', menu);
    } else {
      document.body.appendChild(menu);
      const rect = anchor.getBoundingClientRect();
      const mRect = menu.getBoundingClientRect();
      let left = rect.left;
      if (left + mRect.width > window.innerWidth - 12) {
        left = window.innerWidth - mRect.width - 12;
      }
      if (left < 12) left = 12;
      menu.style.top = (rect.bottom + 6) + 'px';
      menu.style.left = left + 'px';
    }

    state.menuEl = menu;
    anchor.classList.add('is-open');
    anchor.setAttribute('aria-expanded', 'true');

    requestAnimationFrame(() => menu.classList.add('is-open'));
  }

  function closeMenu() {
    if (state.menuEl) {
      state.menuEl.classList.remove('is-open');
      const el = state.menuEl;
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 160);
    }
    state.menuEl = null;

    const btn = document.getElementById('org-switcher-btn');
    if (btn) {
      btn.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  function bindGlobalClose() {
    document.addEventListener('click', (e) => {
      if (!state.menuEl) return;
      if (state.menuEl.contains(e.target)) return;
      const btn = document.getElementById('org-switcher-btn');
      if (btn && btn.contains(e.target)) return;
      closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
    window.addEventListener('resize', () => {
      if (state.mountedIn !== 'user-menu') closeMenu();
    });
    window.addEventListener('scroll', () => {
      if (state.mountedIn !== 'user-menu') closeMenu();
    }, true);
  }

  /* =========================================================
     CLIQUE NA EMPRESA
     ========================================================= */
  function onOrgClick(org, isActive) {
    if (!org || !org.id) return;

    if (isActive) {
      closeMenu();
      try {
        const userMenu = document.getElementById('app-tabs-user-menu');
        if (userMenu) userMenu.hidden = true;
      } catch (e) {}
      window.location.href = GESTAO_URL;
      return;
    }

    switchOrg(org);
  }

  /* =========================================================
     TROCA DE ORG
     ========================================================= */
  async function switchOrg(org) {
    if (!org || !org.id) return;

    closeMenu();
    showLoading(true);

    try {
      const { error } = await window.db.rpc('switch_organization', { p_org_id: org.id });
      if (error) throw error;

      const raw = sessionStorage.getItem('devhub_user');
      const ctx = raw ? JSON.parse(raw) : {};
      ctx.organization_id   = org.id;
      ctx.organization_name = org.name;
      sessionStorage.setItem('devhub_user', JSON.stringify(ctx));

      state.current = org;
      render();

      location.reload();
    } catch (e) {
      console.error('[org-switcher] switchOrg:', e);
      showLoading(false);
      alert('Não foi possível trocar de empresa: ' + (e.message || 'erro desconhecido'));
    }
  }

  /* =========================================================
     HELPERS
     ========================================================= */
  function showLoading(b) {
    const btn = document.getElementById('org-switcher-btn');
    if (btn) btn.classList.toggle('is-loading', b);
  }

  function labelRole(role) {
    const r = String(role || '').toLowerCase();
    if (r === 'platform_admin') return 'Admin. Plataforma';
    if (r === 'admin' || r === 'administrador') return 'Administrador';
    if (r === 'gestor' || r === 'manager') return 'Gestor';
    if (r === 'user' || r === 'usuario' || r === 'usuário') return 'Funcionário';
    return role || '—';
  }

  function escapeHTML(s) {
    return String(s || '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  /* =========================================================
     AUTO-REPARO
     ========================================================= */
  function watchSlot() {
    const obs = new MutationObserver(() => {
      const userSlot = document.getElementById('user-menu-org-slot');

      if (userSlot) {
        document.querySelectorAll('#org-switcher-slot').forEach(el => {
          if (el.parentNode) el.parentNode.removeChild(el);
        });
      }

      if (userSlot && !userSlot.querySelector('.org-switcher')) {
        init();
        return;
      }

      const topbarSlot = document.getElementById('org-switcher-slot');
      if (!userSlot && topbarSlot && !topbarSlot.querySelector('.org-switcher')) {
        init();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function boot() {
    init();
    watchSlot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 200));
  } else {
    setTimeout(boot, 200);
  }

  NAV.orgSwitcher = { init, closeMenu, switchOrg };
})();