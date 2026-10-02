/* =========================================================
   DEV HUB · Navegação · roles + permissões
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV;

  /* ---------- Contexto do usuário ---------- */
  function readContext() {
    let role = '';
    let isPlatform = false;
    let roleSlug = '';
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (raw) {
        const data = JSON.parse(raw);
        role = String(data.role || '').toLowerCase();
        isPlatform = data.is_platform_admin === true;
        roleSlug = String(data.role_slug || '').toLowerCase();
      }
    } catch (e) { /* ignora */ }
    return { role, isPlatform, roleSlug };
  }

  function capsForRole(role, isPlatform) {
    const baseCaps = NAV.CAPABILITIES[String(role || '').toLowerCase()] || ['operations'];
    if (isPlatform && baseCaps.indexOf('platform') === -1) {
      return baseCaps.concat(['platform']);
    }
    return baseCaps;
  }

  function currentCapabilities() {
    const ctx = readContext();
    return capsForRole(ctx.role, ctx.isPlatform);
  }

  function baseCapsForRole() {
    const ctx = readContext();
    const r = String(ctx.role || '').toLowerCase();
    const caps = NAV.BASE_CAPS[r] || NAV.BASE_CAPS.user;
    if (ctx.isPlatform && caps.indexOf('platform') === -1) {
      return caps.concat(['platform']);
    }
    return caps;
  }

  /* ---------- DHRoles (API legado) ---------- */
  const DHRoles = {
    current() { return readContext().role; },
    currentSlug() { return readContext().roleSlug; },
    isPlatformAdmin() { return readContext().isPlatform; },
    isAdmin() { const r = readContext().role; return r === 'admin' || r === 'administrador'; },
    isGestor() { const r = readContext().role; return r === 'gestor' || r === 'manager'; },
    isUser() { const r = readContext().role; return r === 'user' || r === 'usuario' || r === 'usuário'; },
    hasCapability(cap, role) {
      const ctx = readContext();
      const caps = role
        ? capsForRole(role, false)
        : capsForRole(ctx.role, ctx.isPlatform);
      return caps.indexOf(String(cap || '').toLowerCase()) !== -1;
    },
    canAccessManagement(role) { return DHRoles.hasCapability('management', role); },
    canAccessAdminSettings(role) { return DHRoles.hasCapability('admin_settings', role); },
    canAccessPlatform(role) { return DHRoles.hasCapability('platform', role); },
    label(role) {
      const r = String(role || '').trim().toLowerCase();
      if (NAV.ROLE_LABELS[r]) return NAV.ROLE_LABELS[r];
      return r ? r.charAt(0).toUpperCase() + r.slice(1) : '';
    }
  };

  window.DHRoles = DHRoles;

  /* ---------- Verificação de capability ---------- */
  function hasCapability(cap) {
    if (!cap) return true;
    if (cap === 'platform') return readContext().isPlatform;

    const c = String(cap).toLowerCase();
    const baseCaps = baseCapsForRole();
    const inFallback = baseCaps.indexOf(c) !== -1;

    if (window.Perms && typeof window.Perms.has === 'function') {
      try {
        const list = (typeof window.Perms.list === 'function') ? window.Perms.list() : null;
        const listEmpty = !list || Object.keys(list).length === 0;

        if (!listEmpty) {
          const r = window.Perms.has(c);
          if (r === true)  return true;
          if (r === false) return inFallback;
        }
      } catch (e) {
        console.warn('[nav] Perms.has falhou para', c, e);
      }
    }

    const genericCaps = currentCapabilities();
    if (genericCaps.indexOf(c) !== -1) return true;
    return inFallback;
  }

  function hasPermission(cap) {
    return hasCapability(cap);
  }

  function visibleItems() {
    return NAV.TOPNAV.filter(function (it) {
      if (it.capability && !hasCapability(it.capability)) return false;
      if (!hasPermission(NAV.ITEM_PERM[it.id])) return false;
      return true;
    });
  }

  /* ---------- Exporta ---------- */
  NAV.roles = {
    readContext, capsForRole, currentCapabilities, baseCapsForRole,
    hasCapability, hasPermission, visibleItems
  };
})();