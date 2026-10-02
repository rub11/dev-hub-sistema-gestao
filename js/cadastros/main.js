/* =========================================================
   DEV HUB · Cadastros · main
   ========================================================= */
(function () {
  'use strict';
  const CAD = window.CAD;
  const state = CAD.state;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      if (!window.db || window.DEV_HUB_CONFIGURED !== true) {
        CAD.showGlobalAlert('Não foi possível conectar ao Supabase.', 'error');
        return;
      }

      // Bindings
      CAD.setupUserMenu();
      CAD.setupLogout();
      CAD.modal.setup();
      CAD.natures.setup();
      CAD.costCenters.setup();
      CAD.chartOfAccounts.setup();
      CAD.financialCategories.setup();
      CAD.fiscalPeriods.setup();
      setupTabs();

      // Sessão
      const result = await window.db.auth.getUser();
      const user = result && result.data ? result.data.user : null;
      if (!user) { window.location.replace('index.html'); return; }

      const profile = window.Auth ? await window.Auth.getProfile(user.id) : null;
      CAD.renderUser(user, profile);
      watchAuthChanges();

      // Permissões
      if (window.Perms && typeof window.Perms.load === 'function') {
        try { await window.Perms.load(); } catch (e) {}
      }

      state.perms.view   = CAD.hasPerm('reports.view', true) || CAD.hasPerm('finance.view', true);
      state.perms.create = CAD.hasPerm('finance.edit',  true) || CAD.hasPerm('management.view', true);
      state.perms.edit   = state.perms.create;
      state.perms.remove = state.perms.create;

      if (!state.perms.view) {
        window.location.replace('dashboard.html');
        return;
      }

      applyPermissionsToUI();

      // Resolve a org ANTES de qualquer fetch
      state.orgId = await resolveOrgId();
      console.log('[CAD] Org resolvida:', state.orgId);

      // Carrega tudo em paralelo
      await Promise.all([
        CAD.natures.fetchAll(),
        CAD.costCenters.fetchAll(),
        CAD.chartOfAccounts.fetchAll(),
        CAD.financialCategories.fetchAll(),
        CAD.fiscalPeriods.fetchAll()
      ]);
    } catch (err) {
      console.error('[CAD] init erro:', err);
      CAD.showGlobalAlert('Erro ao inicializar: ' + (err.message || err), 'error');
    }
  }

  function applyPermissionsToUI() {
    if (!state.perms.create) {
      ['natures-new', 'cc-new', 'coa-new', 'fincat-new', 'fp-new'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
      });
    }
  }

  function setupTabs() {
    document.querySelectorAll('.cad-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
  }

  function switchTab(id) {
    state.activeTab = id;
    document.querySelectorAll('.cad-tab').forEach(t => {
      const active = t.dataset.tab === id;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.cad-panel').forEach(p => {
      p.hidden = p.id !== 'panel-' + id;
    });
  }

  async function resolveOrgId() {
    try {
      const { data } = await window.db.rpc('get_user_organization_id');
      if (data) {
        const { data: org } = await window.db
          .from('organizations').select('id, active').eq('id', data).maybeSingle();
        if (org && org.active) return org.id;
      }
    } catch (e) { /* segue */ }

    try {
      const { data: u } = await window.db.auth.getUser();
      const uid = u && u.user ? u.user.id : null;
      if (uid) {
        const { data: m } = await window.db
          .from('organization_members')
          .select('organization_id, organizations!inner(id, active, created_at)')
          .eq('user_id', uid).eq('active', true);

        const active = (m || [])
          .filter(x => x.organizations && x.organizations.active)
          .sort((a, b) => String(a.organizations.created_at).localeCompare(b.organizations.created_at));

        if (active.length) return active[0].organization_id;
      }
    } catch (e) { /* segue */ }

    try {
      const { data: orgs } = await window.db
        .from('organizations').select('id')
        .eq('active', true)
        .order('created_at', { ascending: true }).limit(1);
      if (orgs && orgs.length) return orgs[0].id;
    } catch (e) { /* segue */ }

    return null;
  }

  function watchAuthChanges() {
    window.db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT' && window.Auth && !window.Auth.isSigningOut()) {
        window.location.replace('index.html?expired=1');
      }
    });
  }

  window.CAD.setOrgId = function (id) { state.orgId = id; };
})();