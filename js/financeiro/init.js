/* =========================================================
   DEV HUB · Financeiro · init
   ---------------------------------------------------------
   Router:
     data-page="financeiro"          → HUB
     data-page="financeiro-titulos"  → tela de títulos
   ---------------------------------------------------------
   Modo "aba única":
     Se a URL tem ?tab=X, esconde a barra de abas (CSS) e
     mostra só o painel X + bloco "fin-single" (KPIs + toolbar).
     Sem ?tab=, mostra as 5 abas como antes.
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
    window.Fin.renderOverview();
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
    /* Seletor de mês */
    window.Fin.setupPeriodSelect?.();

    /* Botão Atualizar */
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

    /* ---- Lê ?tab= da URL ---- */
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

    /* ---- Marca aba ativa ---- */
    $$('.fin-tabs--main .fin-tab').forEach((b) => {
      const on = b.dataset.mainTab === state.tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
      b.setAttribute('tabindex', on ? '0' : '-1');
    });

    /* ---- Mostra o pane correto ---- */
    $$('.fin-main > .fin-tabpane').forEach((p) => {
      const on = p.dataset.mainPane === state.tab;
      p.classList.toggle('is-active', on);
      if (on) p.removeAttribute('hidden');
      else     p.setAttribute('hidden', '');
    });

    applyTabContext(state.tab, false);

    /* ---- Setup da UI ---- */
    setupViewToggles();
    setupDrawer();
    bindFilters();
    bindCustomFilter();
    bindShortcuts();

    /* Abas: só habilita clique quando NÃO veio por URL
       (no modo "aba única", a barra está escondida). */
    if (!hasUrlTab) {
      setupTabs();
    }

    /* ---- Modo aba única: mostra o bloco "fin-single" ---- */
    if (hasUrlTab && (state.tab === 'pagar' || state.tab === 'receber')) {
      const single = document.getElementById('fin-single');
      if (single) single.hidden = false;

      window.Fin.setupPeriodSelect?.();

      /* Header específico por aba */
      const titleEl = document.getElementById('fin-single-title');
      const subEl   = document.getElementById('fin-single-sub');
      const isReceber = state.tab === 'receber';

      if (titleEl) titleEl.textContent = isReceber ? 'Contas a Receber' : 'Contas a Pagar';
      if (subEl)   subEl.textContent   = isReceber
        ? 'Acompanhe seus recebimentos, vencimentos e baixas.'
        : 'Gerencie seus compromissos financeiros, vencimentos e baixas.';

      /* Botão Atualizar */
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

    /* Esconde o KPI block quando NÃO é pagar/receber */
    if (hasUrlTab && state.tab !== 'pagar' && state.tab !== 'receber') {
      const ov = document.getElementById('fin-overview');
      if (ov) ov.innerHTML = '';
    }

    /* ---- Carga ---- */
    await window.Fin.loadUser();
    await loadTitulos();

    /* Renderiza KPIs no modo single */
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

})();