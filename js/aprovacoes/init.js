/* =========================================================
   DEV HUB · Aprovacoes · init
   ---------------------------------------------------------
   Bootstrap da página de Aprovações.
   Carrega compras + vendas, monta KPIs e tabelas.
   ---------------------------------------------------------
   Depende de: state.js, api.js, render.js, modals.js
   Publica em: window.Appr (reload)
   ========================================================= */

(function () {
  'use strict';

  const { $, escapeHTML, state } = window.Appr;

  async function loadAll() {
    const tbody  = $('#appr-tbody');
    const stbody = $('#appr-sales-tbody');
    if (!tbody || !stbody) return;

    tbody.innerHTML  = `<tr><td colspan="7"><div class="appr-loading">Carregando...</div></td></tr>`;
    stbody.innerHTML = `<tr><td colspan="7"><div class="appr-loading">Carregando...</div></td></tr>`;

    /* Compras */
    try {
      const data = await window.Appr.loadPending();
      state.all = data;
    } catch (e) {
      console.error('[aprovacoes] loadPending:', e);
      state.all = [];
      tbody.innerHTML = `
        <tr><td colspan="7" style="padding:0;border:0">
          <div class="appr-panel__empty">
            <div class="appr-panel__empty-title">Erro ao carregar compras</div>
            <p class="appr-panel__empty-text">${escapeHTML(e.message)}</p>
          </div>
        </td></tr>`;
    }

    /* Vendas */
    try {
      const data = await window.Appr.loadPendingSales();
      state.sales = data;
    } catch (e) {
      console.error('[aprovacoes] loadPendingSales:', e);
      state.sales = [];
      stbody.innerHTML = `
        <tr><td colspan="7" style="padding:0;border:0">
          <div class="appr-panel__empty">
            <div class="appr-panel__empty-title">Erro ao carregar vendas</div>
            <p class="appr-panel__empty-text">${escapeHTML(e.message)}</p>
          </div>
        </td></tr>`;
    }

    window.Appr.renderKpis();
    window.Appr.renderTable();
    window.Appr.renderSalesTable();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (document.body.dataset.page !== 'aprovacoes') return;

    const refresh = $('#appr-refresh');
    if (refresh) refresh.addEventListener('click', loadAll);

    await window.Appr.loadCurrentUser();
    await loadAll();
  });

  Object.assign(window.Appr, {
    reload: loadAll
  });

})();