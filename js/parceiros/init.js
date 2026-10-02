/* =========================================================
   DEV HUB · Parceiros · init
   ---------------------------------------------------------
   Bootstrap.
   ========================================================= */

(function () {
  'use strict';

  const {
    showToast,
    state
  } = window.Parn;

  /* =========================================================
     TOPBAR / FILTROS / BUSCA
     ========================================================= */
  function setupTopbar() {
    document.getElementById('tb-view')?.addEventListener('click', () => {
      const wrap = document.getElementById('partners-table-wrap');
      const empty = document.getElementById('partners-empty');
      if (wrap) wrap.hidden = !wrap.hidden;
      if (empty) empty.hidden = true;
    });

    document.getElementById('tb-filter')?.addEventListener('click', () => {
      const box = document.getElementById('parn-filters');
      if (box) box.hidden = !box.hidden;
    });

    document.getElementById('tb-help')?.addEventListener('click', () => {
      showToast('Em breve: ajuda contextual da tela de Parceiros.', 'info');
    });
  }

  function setupFilters() {
    document.getElementById('filter-type')?.addEventListener('change', (e) => {
      state.filterType = e.target.value;
      window.Parn.applyFilter();
    });
    document.getElementById('filter-status')?.addEventListener('change', (e) => {
      state.filterStatus = e.target.value;
      window.Parn.applyFilter();
    });
    document.getElementById('filter-kind')?.addEventListener('change', (e) => {
      state.filterKind = e.target.value;
      state.kind = e.target.value || 'all';
      document.querySelectorAll('.parn-chip').forEach((c) => {
        const on = c.dataset.kind === state.kind;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-selected', String(on));
      });
      window.Parn.applyFilter();
    });
    document.getElementById('filter-clear')?.addEventListener('click', () => {
      state.filterType = '';
      state.filterStatus = '';
      state.filterKind = '';
      state.kind = 'all';
      const t = document.getElementById('filter-type');   if (t) t.value = '';
      const s = document.getElementById('filter-status'); if (s) s.value = '';
      const k = document.getElementById('filter-kind');   if (k) k.value = '';
      document.querySelectorAll('.parn-chip').forEach((c) => {
        const on = c.dataset.kind === 'all';
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-selected', String(on));
      });
      window.Parn.applyFilter();
    });
  }

  function setupSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    input.addEventListener('input', () => {
      state.search = input.value.trim().toLowerCase();
      window.Parn.applyFilter();
    });
  }

  function setupKindChips() {
    document.querySelectorAll('.parn-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.parn-chip').forEach((c) => {
          c.classList.toggle('is-active', c === chip);
          c.setAttribute('aria-selected', String(c === chip));
        });
        state.kind = chip.dataset.kind || 'all';
        const kSel = document.getElementById('filter-kind');
        if (kSel) kSel.value = state.kind === 'all' ? '' : state.kind;
        window.Parn.applyFilter();
      });
    });
  }

  function setupToolbar() {
    const newBtn      = document.getElementById('tb-new');
    const emptyNewBtn = document.getElementById('empty-new-btn');

    if (newBtn && state.perms.create)      newBtn.addEventListener('click', () => window.Parn.openCreateModal());
    if (emptyNewBtn && state.perms.create) emptyNewBtn.addEventListener('click', () => window.Parn.openCreateModal());
  }

  /* =========================================================
     CARREGAR
     ========================================================= */
  async function loadAll() {
    window.Parn.showLoading(true);

    try {
      const data = await window.Parn.loadPartners();
      state.all = data;
      window.Parn.applyFilter();
    } catch (error) {
      console.error('[parceiros] loadAll:', error);
      state.all = [];
      state.filtered = [];
      window.Parn.showEmptyState(
        'Não foi possível carregar os parceiros.',
        'Tente novamente em alguns instantes.',
        false
      );
      window.Parn.updateCountLabel();
      showToast('Não foi possível carregar os parceiros.', 'error');
    } finally {
      window.Parn.showLoading(false);
    }
  }

  /* =========================================================
     PERMISSÕES
     ========================================================= */
  function hasPerm(cap, fallback) {
    if (window.Perms && typeof window.Perms.has === 'function') return window.Perms.has(cap);
    return fallback !== false;
  }

  function applyPermissions() {
    if (!state.perms.create) {
      const btn = document.getElementById('tb-new');
      if (btn) btn.hidden = true;
      const emptyBtn = document.getElementById('empty-new-btn');
      if (emptyBtn) emptyBtn.hidden = true;
    }
  }

  /* =========================================================
     BOOT
     ========================================================= */
  async function boot() {
    const Auth = window.Auth;
    if (!Auth || !Auth.isConfigured() || !window.db) {
      window.Parn.showGlobalAlert('Não foi possível conectar ao Supabase.', 'error');
      return;
    }

    /* Permissões */
    if (window.Perms && typeof window.Perms.load === 'function') {
      try { await window.Perms.load(); } catch (e) { /* fallback */ }
    }
    state.perms.view   = hasPerm('customers.view',   true);
    state.perms.create = hasPerm('customers.create', true);
    state.perms.edit   = hasPerm('customers.edit',   true);
    state.perms.remove = hasPerm('customers.delete', true);

    if (!state.perms.view) {
      window.location.replace('dashboard.html');
      return;
    }

    /* Setup de UI */
    window.Parn.setupForm();
    window.Parn.setupConfirmModal();
    window.Parn.setupCtxMenu();
    window.Parn.setupExportButton();
    setupToolbar();
    setupSearch();
    setupTopbar();
    setupFilters();
    setupKindChips();

    /* ?kind= na URL (link direto com filtro) */
    const urlKind = new URLSearchParams(location.search).get('kind');
    if (urlKind && ['all','customer','supplier','carrier'].includes(urlKind)) {
      state.kind = urlKind;
      document.querySelectorAll('.parn-chip').forEach((c) => {
        const on = c.dataset.kind === state.kind;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-selected', String(on));
      });
    }

    applyPermissions();

    /* Sessão */
    const session = await Auth.requireSession();
    if (!session) return;

    /* Carrega */
    await loadAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  Object.assign(window.Parn, {
    reload: loadAll,
    boot
  });

})();