(function () {
  'use strict';
  const RH = window.RH;
  const state = RH.state;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      if (!window.db || window.DEV_HUB_CONFIGURED !== true) {
        RH.ui.showGlobalAlert(
          'Não foi possível conectar ao Supabase. Verifique as credenciais em js/supabase.js.',
          'error'
        );
        return;
      }

      /* =========================================================
         Setups base (todos os módulos da Fase 1)
         ========================================================= */
      RH.session.setupUserMenu();
      RH.session.setupLogout();
      RH.period.setup();
      RH.exportCSV.setup();
      RH.exportPDF && RH.exportPDF.setup && RH.exportPDF.setup();     /* NOVO */
      RH.importHub && RH.importHub.setup && RH.importHub.setup();     /* NOVO */
      RH.movements.setupFilter();
      RH.chart.setup();
      setupStatusFilter();                                            /* NOVO */

      /* =========================================================
         Sessão
         ========================================================= */
      try {
        const result = await window.db.auth.getUser();
        const user = result && result.data ? result.data.user : null;
        if (!user) { window.location.replace('index.html'); return; }
        const profile = window.Auth ? await window.Auth.getProfile(user.id) : null;
        RH.session.renderUser(user, profile);
      } catch (err) {
        console.error('[DEV HUB] Falha ao verificar sessão:', err);
        window.location.replace('index.html');
        return;
      }

      RH.session.watchAuthChanges();

      /* =========================================================
         Período custom — defaults
         ========================================================= */
      const today = new Date();
      state.customStart = RH.utils.toDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
      state.customEnd = RH.utils.toDateInput(today);
      RH.utils.setInputValue('period-start', state.customStart);
      RH.utils.setInputValue('period-end', state.customEnd);

      /* =========================================================
         Permissões
         ========================================================= */
      if (window.Perms && typeof window.Perms.load === 'function') {
        try { await window.Perms.load(); } catch (e) { /* fallback */ }
      }

      state.perms.view   = RH.perms.has('reports.view',   true);
      state.perms.export = RH.perms.has('reports.export', true);
      state.perms.import = RH.perms.has('reports.import', state.perms.export);

      if (!state.perms.view) {
        window.location.replace('dashboard.html');
        return;
      }

      /* =========================================================
         Load + render
         ========================================================= */
      RH.filters.applyDashboardFilters();
      await RH.data.refresh();
      RH.filters.scrollToFocusSection();
    } catch (err) {
      console.error('[DEV HUB] init relatórios ERRO:', err);
      RH.ui.showGlobalAlert('Erro ao inicializar: ' + (err.message || err), 'error');
      RH.ui.showLoading(false);
    }
  }

  /* =========================================================
     Filtro de status (topo da seção de vendas)
     ========================================================= */
  function setupStatusFilter() {
    const sel = document.getElementById('status-filter');
    if (!sel) return;
    sel.value = state.statusFilter;
    sel.addEventListener('change', function () {
      state.statusFilter = sel.value;
      RH.data.refresh();
    });
  }
})();