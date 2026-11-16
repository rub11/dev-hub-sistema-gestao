/* =========================================================
   DEV HUB · Financeiro · init
   ========================================================= */

(function () {
  'use strict';

  const { $, $$, state, toast } = window.Fin;

  /* =========================================================
     CARREGAMENTO
     ========================================================= */
  async function loadHub() {
    await Promise.all([
      window.Fin.loadEntries(),
      window.Fin.loadAccounts()
    ]);
    
    // Renderiza os componentes após os dados carregarem
    window.Fin.renderOverview?.();
    window.Fin.renderCharts?.();
    window.Fin.renderInsights?.(); // <--- ESSENCIAL PARA O INSIGHTS FUNCIONAR
  }

  async function loadTitulos() {
    await Promise.all([
      window.Fin.loadEntries(),
      window.Fin.loadMovements(),
      window.Fin.loadTransfers(),
      window.Fin.loadAccounts()
    ]);
    window.Fin.loadFilterOptions();
    window.Fin.renderAll();
  }

  /* =========================================================
     BOOT · HUB
     ========================================================= */
  async function bootHub() {
    window.Fin.setupPeriodSelect?.();

    const btn = $('#fin-refresh');
    if (btn) {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await loadHub();
          toast('Resumo atualizado.', 'success');
        } catch (e) {
          console.error('[fin] refresh hub:', e);
          toast('Não foi possível atualizar.', 'error');
        } finally {
          btn.disabled = false;
        }
      });
    }

    try {
      await window.Fin.loadUser();
      await loadHub();
    } catch (e) {
      console.error('[fin] bootHub:', e);
      const wrap = document.getElementById('fin-overview');
      if (wrap) wrap.innerHTML = '<div class="fin-overview__loading">Não foi possível carregar o resumo.</div>';
    }
  }

  /* =========================================================
     BOOT · TÍTULOS
     ========================================================= */
  async function bootTitulos() {
    const {
      TAB_CONTEXT, applyTabContext, moveIndicator,
      setupViewToggles, setupTabs,
      setupDrawer, bindFilters, bindCustomFilter, bindShortcuts
    } = window.Fin;

    let urlTab = null;
    try {
      const url = new URL(window.location.href);
      urlTab = url.searchParams.get('tab');
    } catch (_) {}

    const hasUrlTab = !!(urlTab && TAB_CONTEXT[urlTab]);

    if (hasUrlTab) {
      state.tab = urlTab;
      document.body.classList.add('fin-single-tab');
    }

    $$('.fin-tabs--main .fin-tab').forEach((b) => {
      const on = b.dataset.mainTab === state.tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
      b.setAttribute('tabindex', on ? '0' : '-1');
    });

    $$('.fin-main > .fin-tabpane').forEach((p) => {
      const on = p.dataset.mainPane === state.tab;
      p.classList.toggle('is-active', on);
      if (on) p.removeAttribute('hidden');
      else     p.setAttribute('hidden', '');
    });

    applyTabContext(state.tab, false);

    setupViewToggles();
    setupDrawer();
    bindFilters();
    bindCustomFilter();
    bindShortcuts();

    if (!hasUrlTab) {
      setupTabs();
    }

    if (hasUrlTab && (state.tab === 'pagar' || state.tab === 'receber')) {
      const single = document.getElementById('fin-single');
      if (single) single.hidden = false;

      window.Fin.setupPeriodSelect?.();

      const titleEl = document.getElementById('fin-single-title');
      const subEl   = document.getElementById('fin-single-sub');
      const isReceber = state.tab === 'receber';

      if (titleEl) titleEl.textContent = isReceber ? 'Contas a Receber' : 'Contas a Pagar';
      if (subEl)   subEl.textContent   = isReceber
        ? 'Acompanhe seus recebimentos, vencimentos e baixas.'
        : 'Gerencie seus compromissos financeiros, vencimentos e baixas.';

      const btn = document.getElementById('fin-single-refresh');
      if (btn) {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await loadTitulos();
            window.Fin.renderOverview?.(state.tab);
            toast('Resumo atualizado.', 'success');
          } catch (e) {
            console.error('[fin] refresh single:', e);
            toast('Não foi possível atualizar.', 'error');
          } finally {
            btn.disabled = false;
          }
        });
      }
    }

    if (hasUrlTab && state.tab !== 'pagar' && state.tab !== 'receber') {
      const ov = document.getElementById('fin-overview');
      if (ov) ov.innerHTML = '';
    }

    await window.Fin.loadUser();
    await loadTitulos();

    if (hasUrlTab && (state.tab === 'pagar' || state.tab === 'receber')) {
      window.Fin.renderOverview?.(state.tab);
    }

    if (!hasUrlTab) {
      requestAnimationFrame(moveIndicator);
      window.addEventListener('load', moveIndicator, { once: true });
    }
  }

  /* =========================================================
     ROUTER
     ========================================================= */
  function router() {
    const page = document.body.dataset.page;
    if (page === 'financeiro')         return bootHub();
    if (page === 'financeiro-titulos') return bootTitulos();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', router, { once: true });
  } else {
    router();
  }

  /* =========================================================
     API GLOBAL
     ========================================================= */
  Object.assign(window.Fin, {
    loadHub,
    loadTitulos
  });

     /* =========================================================
     DESBLOQUEADOR DE SCROLL DEFINITIVO
     ========================================================= */
  function forceUnlockScroll() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.documentElement.style.overflow = '';
  }

  const scrollObserver = new MutationObserver(() => {
    const hasOpenModal = document.querySelector('.fin-modal');
    if (!hasOpenModal) forceUnlockScroll();
  });
  if (document.body) {
    scrollObserver.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('click', () => {
    setTimeout(forceUnlockScroll, 100);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') forceUnlockScroll();
  });

    /* =========================================================
     API GLOBAL
     ========================================================= */
  Object.assign(window.Fin, {
    loadHub,
    loadTitulos
  });

})();