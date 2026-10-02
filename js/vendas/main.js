(function () {
  'use strict';
  const DH = window.DH;
  const state = DH.state;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const Auth = window.Auth;
    if (!Auth || !Auth.isConfigured() || !window.db) {
      DH.ui.showGlobalAlert('Não foi possível conectar ao Supabase.', 'error');
      return;
    }

    // Bindings
    DH.session.setupUserMenu();
    DH.session.setupLogout();
    DH.list.setupSearch();
    DH.list.setupToolbar();
    DH.form.setupFormView();
    DH.form.setupSaleForm();
    DH.productSearch.setup();
    DH.stepper.setup();
    DH.modalDetail.setup();
    DH.modalAudit.setup();
    DH.modalPassword.setup();

    // Sessão
    const session = await Auth.requireSession();
    if (!session) return;
    DH.session.watchAuthChanges();

    const profile = await Auth.getProfile(session.user.id);
    DH.session.renderUser(session.user, profile);

    // Permissões
    if (window.Perms && typeof window.Perms.load === 'function') {
      try { await window.Perms.load(); } catch (e) {}
    }
    state.perms.view   = DH.perms.has('sales.view',   true);
    state.perms.create = DH.perms.has('sales.create', true);
    state.perms.edit   = DH.perms.has('sales.edit',   true);
    state.perms.remove = DH.perms.has('sales.delete', true);

    if (!state.perms.view) {
      window.location.replace('dashboard.html');
      return;
    }

    DH.perms.applyToUI();
    await DH.list.loadSales();
  }
})();