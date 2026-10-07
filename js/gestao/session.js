/* =========================================================
   DEV HUB · Gestão · sessão, permissões e role helpers
   ========================================================= */
(function () {
  'use strict';
  const Gestao = window.Gestao;
  const state = Gestao.state;
  const { setText, roleLabel } = Gestao.utils;

  function resolveOrgId(profile) {
    if (profile && profile.organization_id) return profile.organization_id;
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (raw) {
        const ctx = JSON.parse(raw);
        if (ctx && ctx.organization_id) return ctx.organization_id;
      }
    } catch (e) {}
    return null;
  }

  function hasPerm(cap, fallback) {
    if (window.Perms && typeof window.Perms.has === 'function') {
      return window.Perms.has(cap);
    }
    return fallback !== false;
  }

  function applyPermissionsToUI() {
    const roleTypesBtn = document.getElementById('role-types-open-btn');
    const newUserBtn   = document.getElementById('new-user-btn');
    if (roleTypesBtn && !state.perms.roles) roleTypesBtn.hidden = true;
    if (newUserBtn   && !state.perms.users) newUserBtn.hidden   = true;
  }

  function callerIsAdmin() {
    return Gestao.ROLE_ADMIN.indexOf(state.currentRole) !== -1;
  }

  function visibleRoleTypes() {
    if (callerIsAdmin()) return state.roleTypes.slice();
    return state.roleTypes.filter(function (rt) {
      return String(rt.base_role || '').toLowerCase() === 'user';
    });
  }

  function canEditMember(member) {
    if (!state.perms.users) return false;
    if (member.user_id === state.currentUserId) return false;

    const baseRole = String(member.role || '').toLowerCase();
    const memberSlug = String(member.role_slug || '').toLowerCase();
    const memberType = memberSlug
      ? state.roleTypes.find(function (r) { return r.slug === memberSlug; })
      : null;
    const effectiveBase = memberType ? String(memberType.base_role || 'user') : baseRole;

    if (callerIsAdmin()) return true;
    return effectiveBase === 'user';
  }

  function canManageMember(member) {
    if (!state.perms.users) return false;
    return canEditMember(member);
  }

  function watchAuthChanges() {
    window.db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT' && !window.Auth.isSigningOut()) {
        window.location.replace('index.html?expired=1');
      }
    });
  }

  function renderUser(user, profile) {
    const meta = user.user_metadata || {};
    const fullName =
      (profile && profile.name) ||
      meta.name || meta.full_name ||
      (user.email ? user.email.split('@')[0] : '') ||
      'Usuário';

    const roleText = window.DHRoles
      ? window.DHRoles.label((profile && profile.role) || meta.role || '')
      : window.Auth.roleLabel((profile && profile.role) || meta.role || '');

    const firstName = String(fullName).trim().split(/\s+/)[0] || 'Usuário';
    const initial = firstName.charAt(0).toUpperCase() || '?';

    setText('user-avatar', initial);
    setText('user-name', fullName);
    setText('user-role', roleText || user.email || '');
    setText('greeting-name', 'Olá, ' + firstName);

    const roleBadge = document.getElementById('greeting-role');
    if (roleBadge) {
      if (roleText) {
        roleBadge.textContent = roleText;
        roleBadge.hidden = false;
      } else {
        roleBadge.hidden = true;
      }
    }
  }

  Gestao.session = {
    resolveOrgId, hasPerm, applyPermissionsToUI,
    callerIsAdmin, visibleRoleTypes,
    canEditMember, canManageMember,
    watchAuthChanges, renderUser
  };
})();