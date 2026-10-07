/* =========================================================
   DEV HUB · Navegação · seletor de empresa
   v2: auto-reparo quando o slot é recriado
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV;
  if (!NAV) return;

  const state = {
    orgs: [],
    current: null,
    loaded: false,
    menuEl: null,
    initialized: false
  };

  /* =========================================================
     INIT (idempotente)
     ========================================================= */
  function init() {
    const slot = document.getElementById('org-switcher-slot');
    if (!slot) return;

    /* Se já tem botão no slot, não refaz */
    if (slot.querySelector('.org-switcher')) return;

    buildUI(slot);

    /* Só carrega os dados uma vez */
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
  function buildUI(slot) {
    slot.innerHTML = `
      <button type="button" class="org-switcher" id="org-switcher-btn"
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

    const btn = document.getElementById('org-switcher-btn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu(btn);
      });
    }
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

    const menu = document.createElement('div');
    menu.className = 'org-switcher__menu';
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
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'org-switcher__item';
        if (state.current && o.id === state.current.id) {
          btn.classList.add('is-active');
        }

        const initial = (o.name || '?').trim().charAt(0).toUpperCase();
        btn.innerHTML = `
          <span class="org-switcher__avatar" aria-hidden="true">${escapeHTML(initial)}</span>
          <span class="org-switcher__item-body">
            <span class="org-switcher__item-name">${escapeHTML(o.name || '(sem nome)')}</span>
            <span class="org-switcher__item-role">${escapeHTML(labelRole(o.role))}</span>
          </span>
          ${state.current && o.id === state.current.id
            ? '<span class="org-switcher__check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>'
            : ''}
        `;

        btn.addEventListener('click', () => switchOrg(o));
        menu.appendChild(btn);
      });
    }

    document.body.appendChild(menu);
    state.menuEl = menu;

    const rect = anchor.getBoundingClientRect();
    const mRect = menu.getBoundingClientRect();
    let left = rect.left;
    if (left + mRect.width > window.innerWidth - 12) {
      left = window.innerWidth - mRect.width - 12;
    }
    if (left < 12) left = 12;
    menu.style.top = (rect.bottom + 6) + 'px';
    menu.style.left = left + 'px';

    requestAnimationFrame(() => menu.classList.add('is-open'));
    anchor.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    if (state.menuEl) {
      state.menuEl.classList.remove('is-open');
      const el = state.menuEl;
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 140);
    }
    state.menuEl = null;
    const btn = document.getElementById('org-switcher-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
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
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
  }

  /* =========================================================
     TROCA DE ORG
     ========================================================= */
  async function switchOrg(org) {
    if (!org || !org.id) return;
    if (state.current && org.id === state.current.id) {
      closeMenu();
      return;
    }

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
     AUTO-REPARO · se o slot for recriado, reinicializa
     ========================================================= */
  function watchSlot() {
    const obs = new MutationObserver(() => {
      const slot = document.getElementById('org-switcher-slot');
      if (slot && !slot.querySelector('.org-switcher')) {
        init();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  /* =========================================================
     AUTO-INIT
     ========================================================= */
  function boot() {
    init();
    watchSlot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 200));
  } else {
    setTimeout(boot, 200);
  }

  NAV.orgSwitcher = { init, closeMenu };
})();