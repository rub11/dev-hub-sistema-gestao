/* =========================================================
   DEV HUB · DRE · main
   ========================================================= */
(function () {
  'use strict';
  const DRE = window.DRE;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      if (!window.db || window.DEV_HUB_CONFIGURED !== true) {
        DRE.showGlobalAlert('Não foi possível conectar ao Supabase.', 'error');
        return;
      }

      DRE.setupUserMenu();
      DRE.setupLogout();
      DRE.setupPeriod();
      DRE.setupFilters();
      DRE.setupExport();
      DRE.setupChartTheme();

      const result = await window.db.auth.getUser();
      const user = result && result.data ? result.data.user : null;
      if (!user) { window.location.replace('index.html'); return; }

      const profile = window.Auth ? await window.Auth.getProfile(user.id) : null;
      DRE.renderUser(user, profile);
      DRE.watchAuthChanges();

      if (window.Perms && typeof window.Perms.load === 'function') {
        try { await window.Perms.load(); } catch (e) {}
      }

      const canView = window.Perms && typeof window.Perms.has === 'function'
        ? window.Perms.has('reports.view')
        : true;

      if (!canView) { window.location.replace('dashboard.html'); return; }

      await DRE.loadCostCenters();
      DRE.setMonth(DRE.startOfMonth(new Date()));
      await DRE.load();
    } catch (err) {
      console.error('[DRE] init erro:', err);
      DRE.showGlobalAlert('Erro ao inicializar a DRE: ' + (err.message || err), 'error');
      DRE.showLoading(false);
    }
  }
})();