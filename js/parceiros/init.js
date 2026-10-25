/* =========================================================
   DEV HUB · Parceiros · init (Blindado)
   ========================================================= */

(function () {
  'use strict';

  const { showToast, state } = window.Parn;

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

  async function loadAll() {
    window.Parn.showLoading(true);
    console.log('[Parceiros] Iniciando carregamento de dados...');

    try {
      const data = await window.Parn.loadPartners();
      state.all = data || [];
      window.Parn.applyFilter();
      console.log('[Parceiros] Dados carregados com sucesso:', state.all.length);
    } catch (error) {
      console.error('[Parceiros] ERRO AO CARREGAR:', error);
      state.all = [];
      state.filtered = [];
      window.Parn.showEmptyState(
        'Não foi possível carregar os parceiros.',
        error.message || 'Tente novamente em alguns instantes.',
        false
      );
      window.Parn.updateCountLabel();
      showToast('Não foi possível carregar os parceiros. Verifique o console.', 'error');
    } finally {
      console.log('[Parceiros] Ocultando loading.');
      window.Parn.showLoading(false);
    }
  }

  function hasPerm(cap, fallback) {
    const fallbackValue = fallback !== false;
    if (window.Perms && typeof window.Perms.has === 'function' && typeof window.Perms.isLoaded === 'function' && window.Perms.isLoaded()) {
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

  async function boot() {
    try {
      console.log('[Parceiros] Iniciando boot...');
      const Auth = window.Auth;
      
      if (!Auth || !Auth.isConfigured() || !window.db) {
        console.error('[Parceiros] Auth ou Supabase não configurado.');
        window.Parn.showGlobalAlert('Não foi possível conectar ao Supabase.', 'error');
        window.Parn.showLoading(false);
        return;
      }

      if (window.Perms && typeof window.Perms.load === 'function') {
        try { 
          await Promise.race([
            window.Perms.load(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout nas permissões')), 5000))
          ]); 
        } catch (e) { 
          console.warn('[Parceiros] Permissões demoraram ou falharam:', e); 
        }
      }

      state.perms.view   = hasPerm('customers.view',   true);
      state.perms.create = hasPerm('customers.create', true);
      state.perms.edit   = hasPerm('customers.edit',   true);
      state.perms.remove = hasPerm('customers.delete', true);

      if (!state.perms.view && window.Perms && typeof window.Perms.isLoaded === 'function' && window.Perms.isLoaded()) {
        console.warn('[Parceiros] Sem permissão customers.view — redirecionando.');
        window.location.replace('dashboard.html');
        return;
      }

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

      console.log('[Parceiros] Verificando sessão...');
      const session = await Promise.race([
        Auth.requireSession(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao verificar sessão')), 8000))
      ]);

      if (!session) {
        console.warn('[Parceiros] Sem sessão ativa. Abortando e ocultando spinner.');
        window.Parn.showLoading(false);
        return;
      }

      await loadAll();

    } catch (fatalError) {
      console.error('[Parceiros] ERRO FATAL NO BOOT:', fatalError);
      window.Parn.showLoading(false);
      if (window.Parn.showGlobalAlert) {
        window.Parn.showGlobalAlert('Ocorreu um erro ao inicializar a tela. Verifique o console.', 'error');
      }
    }
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