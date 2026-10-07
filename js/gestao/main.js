/* =========================================================
   DEV HUB · Gestão · init
   ========================================================= */
(function () {
  'use strict';
  const Gestao = window.Gestao;
  const state = Gestao.state;
  const { bloquearAcesso } = Gestao.guard;
  const { hasPerm, applyPermissionsToUI, watchAuthChanges, renderUser, resolveOrgId } = Gestao.session;
  const { setupSidebar, setupUserMenu, setupLogout } = Gestao.nav;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const Auth = window.Auth;

    /* GUARD 1: Supabase configurado */
    if (!Auth || !Auth.isConfigured() || !window.db) {
      bloquearAcesso('config');
      return;
    }

    setupSidebar();
    setupUserMenu();
    setupLogout();
    Gestao.userModal.setup();
    Gestao.roleTypes.setup();
    Gestao.confirmModal.setup();

    /* GUARD 2: sessão válida */
    const session = await Auth.requireSession();
    if (!session) return;

    state.currentUserId = session.user.id;
    state.currentUserEmail = String(session.user.email || '').toLowerCase();

    const profile = await Auth.getProfile(session.user.id);
    renderUser(session.user, profile);

    state.currentRole = String((profile && profile.role) || '').toLowerCase();
    state.currentOrgId = resolveOrgId(profile);

    if (window.Perms && typeof window.Perms.load === 'function') {
      try { await window.Perms.load(); } catch (e) {}
    }

    state.perms.view  = hasPerm('management.view',  true);
    state.perms.roles = hasPerm('management.roles', true);
    state.perms.users = hasPerm('management.users', true);

    const hasBase = window.DHRoles && typeof window.DHRoles.canAccessManagement === 'function'
      ? window.DHRoles.canAccessManagement(state.currentRole)
      : Gestao.ROLE_ADMIN.indexOf(state.currentRole) !== -1;

    const canManage = state.perms.view || hasBase;

    /* GUARD 3: acesso negado */
    if (!canManage) {
      bloquearAcesso('denied');
      return;
    }

    /* Autorizado: libera a cortina do guard */
    if (window.__gestaoGuardTimeout) {
      clearTimeout(window.__gestaoGuardTimeout);
    }
    document.documentElement.classList.remove('guard-locked');

    applyPermissionsToUI();
    watchAuthChanges();

    await Promise.all([
      Gestao.members.load(),
      Gestao.roleTypes.load()
    ]);
  }
})();