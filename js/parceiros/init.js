/* =========================================================
   DEV HUB · Parceiros · init
   ---------------------------------------------------------
   Bootstrap.
   ---------------------------------------------------------
   CORREÇÕES APLICADAS:
   1. `hasPerm` respeita o fallback se Perms ainda não carregou.
   2. Não redireciona quando permissão é desconhecida (só se
      explicitamente negada).
   3. Boot loga erro se Auth não estiver configurado.
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
      state.search = '';
      const t = document.getElementById('filter-type');   if (t) t.value = '';
      const s = document.getElementById('filter-status'); if (s) s.value = '';
      const k = document.getElementById('filter-kind');   if (k) k.value = '';
      const inp = document.getElementById('parn-search-input');
      if (inp) inp.value = '';
      const clr = document.getElementById('parn-search-clear');
      if (clr) clr.hidden = true;
      document.querySelectorAll('.parn-chip').forEach((c) => {
        const on = c.dataset.kind === 'all';
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-selected', String(on));
      });
      window.Parn.applyFilter();
    });
  }

  /* =========================================================
     BUSCA
     ========================================================= */
  function setupSearch() {
    const input = document.getElementById('parn-search-input');
    if (!input) return;

    if (input.dataset.searchWired === '1') return;
    input.dataset.searchWired = '1';

    const clearBtn = document.getElementById('parn-search-clear');
    let debounceTimer = null;

    function updateClearBtn() {
      if (clearBtn) clearBtn.hidden = input.value.trim().length === 0;
    }

    function applyNow() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = null;
      state.search = input.value.trim().toLowerCase();
      window.Parn.applyFilter();
    }

    input.addEventListener('input', () => {
      updateClearBtn();
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyNow, 120);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyNow();
      } else if (e.key === 'Escape') {
        input.value = '';
        updateClearBtn();
        applyNow();
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        updateClearBtn();
        applyNow();
        input.focus();
      });
    }

    updateClearBtn();
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
  /**
   * FIX #1: respeita o fallback quando Perms ainda não carregou.
   * Só bloqueia se Perms carregou E retornou explicitamente false.
   */
  function hasPerm(cap, fallback) {
    const fallbackValue = fallback !== false;

    if (
      window.Perms &&
      typeof window.Perms.has === 'function' &&
      typeof window.Perms.isLoaded === 'function' &&
      window.Perms.isLoaded()
    ) {
      return window.Perms.has(cap);
    }

    return fallbackValue;
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
      console.error('[parceiros] Auth ou Supabase não configurado.');
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

    /* FIX #2: só redireciona se Perms foi carregado E negou explicitamente */
    if (
      !state.perms.view &&
      window.Perms &&
      typeof window.Perms.isLoaded === 'function' &&
      window.Perms.isLoaded()
    ) {
      console.warn('[parceiros] Sem permissão customers.view — redirecionando.');
      window.location.replace('dashboard.html');
      return;
    }

    /* Setup de UI */
    window.Parn.setupForm();
    window.Parn.setupConfirmModal();
    window.Parn.setupCtxMenu();
    window.Parn.setupExportButton();
    window.Parn.setupImport();
    setupToolbar();
    setupSearch();
    setupTopbar();
    setupFilters();
    setupKindChips();

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