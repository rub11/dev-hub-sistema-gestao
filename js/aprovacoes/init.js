/* =========================================================
   DEV HUB · Aprovacoes · init
   ---------------------------------------------------------
   Bootstrap da página de Aprovações.
   ---------------------------------------------------------
   Depende de: state.js, api.js, render.js, modals.js
   Publica em: window.Appr (reload, state)
   ========================================================= */

(function () {
  'use strict';

  const { $, escapeHTML, state } = window.Appr;

  /* =========================================================
     CARREGAR TUDO (chamado pela init e pelo botão Atualizar)
     ========================================================= */
  async function loadPending() {
    const tbody = $('#appr-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7"><div class="appr-loading">Carregando...</div></td></tr>`;

    try {
      const data = await window.Appr.loadPending();
      state.all = data;
      window.Appr.renderKpis();
      window.Appr.renderTable();
    } catch (e) {
      console.error('[aprovacoes] loadPending:', e);
      tbody.innerHTML = `
        <tr><td colspan="7" style="padding:0;border:0">
          <div class="appr-empty">
            <div class="appr-empty__icon" style="background:var(--danger-soft);color:var(--danger)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
            </div>
            <h3 class="appr-empty__title">Erro ao carregar</h3>
            <p class="appr-empty__text">${escapeHTML(e.message)}</p>
          </div>
        </td></tr>`;
    }
  }

  /* =========================================================
     BOOTSTRAP
     ========================================================= */
  document.addEventListener('DOMContentLoaded', async () => {
    if (document.body.dataset.page !== 'aprovacoes') return;

    const refresh = $('#appr-refresh');
    if (refresh) refresh.addEventListener('click', loadPending);

    await window.Appr.loadCurrentUser();
    await loadPending();
  });

  /* =========================================================
     API GLOBAL
     ========================================================= */
  Object.assign(window.Appr, {
    reload: loadPending
  });

})();