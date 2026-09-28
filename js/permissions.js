/* =========================================================
   DEV HUB · Permissões granulares
   ---------------------------------------------------------
   Uso:
     await Perms.load();            // 1x por página
     Perms.has('sales.edit')        // true/false
     Perms.can('stock.view')        // mesmo que has
     Perms.gate(elem, 'customers.delete')  // esconde se não pode
     Perms.gateAll('products.create')      // aplica em [data-perm]
   ========================================================= */

(function () {
  'use strict';

  /* Lista canônica de capabilities */
  const CAPABILITIES = [
    'dashboard.view',

    'sales.view', 'sales.create', 'sales.edit', 'sales.delete',
    'notes.view', 'notes.print',

    'invoices.view', 'invoices.create', 'invoices.cancel', 'invoices.delete',

    'customers.view', 'customers.create', 'customers.edit', 'customers.delete',

    'products.view', 'products.create', 'products.edit', 'products.delete',

    'stock.view', 'stock.movement', 'stock.audit', 'stock.report',

    'reports.view', 'reports.export',

    'management.view', 'management.roles', 'management.users'
  ];

  /* Permissões padrão por base_role (fallback quando não configurado) */
  const DEFAULTS = {
    user: [
      'dashboard.view',
      'sales.view', 'sales.create',
      'notes.view', 'notes.print',
      'invoices.view',
      'customers.view', 'customers.create', 'customers.edit',
      'products.view',
      'stock.view',
      'reports.view'
    ],
    gestor: [
      'dashboard.view',
      'sales.view', 'sales.create', 'sales.edit', 'sales.delete',
      'notes.view', 'notes.print',
      'invoices.view', 'invoices.create', 'invoices.cancel', 'invoices.delete',
      'customers.view', 'customers.create', 'customers.edit', 'customers.delete',
      'products.view', 'products.create', 'products.edit',
      'stock.view', 'stock.movement', 'stock.audit', 'stock.report',
      'reports.view', 'reports.export',
      'management.view', 'management.roles', 'management.users'
    ],
    admin: CAPABILITIES.slice()
  };

  const state = {
    loaded: false,
    capabilities: {},
    roleSlug: ''
  };

  function readCtx() {
    try {
      const raw = sessionStorage.getItem('devhub_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  async function load() {
    if (state.loaded) return;

    const ctx = readCtx();
    if (!ctx) { state.loaded = true; return; }

    const base = String(ctx.role || 'user').toLowerCase();
    const slug = String(ctx.role_slug || '').toLowerCase();
    state.roleSlug = slug;

    /* 1) Começa com defaults do base */
    const baseDefaults = DEFAULTS[base] || DEFAULTS.user;
    baseDefaults.forEach(function (cap) {
      state.capabilities[cap] = true;
    });

    /* 2) Overlay do banco (role_permissions) */
    try {
      if (window.db && typeof window.db.rpc === 'function') {
        const { data, error } = await window.db.rpc('my_capabilities');
        if (!error && Array.isArray(data)) {
          data.forEach(function (row) {
            state.capabilities[row.capability] = row.allowed === true;
          });
        }
      }
    } catch (e) {
      console.warn('[DEV HUB] Falha ao ler permissões do banco:', e);
    }

    state.loaded = true;
  }

  function has(cap) {
    if (!cap) return false;
    return state.capabilities[cap] === true;
  }

  function any(caps) {
    if (!Array.isArray(caps)) return has(caps);
    return caps.some(function (c) { return has(c); });
  }

  function all(caps) {
    if (!Array.isArray(caps)) return has(caps);
    return caps.every(function (c) { return has(c); });
  }

  /** Esconde um elemento se o usuário não tem a capability. */
  function gate(el, cap) {
    if (!el) return;
    const ok = has(cap);
    el.hidden = !ok;
    if (!ok) el.setAttribute('data-perm-hidden', '1');
  }

  /** Aplica em todos os elementos com data-perm="<cap>" */
  function gateAll(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-perm]').forEach(function (el) {
      const cap = el.getAttribute('data-perm');
      gate(el, cap);
    });
  }

  function expose() {
    window.Perms = {
      CAPABILITIES: CAPABILITIES,
      DEFAULTS: DEFAULTS,
      load: load,
      has: has,
      can: has,
      any: any,
      all: all,
      gate: gate,
      gateAll: gateAll,
      currentSlug: function () { return state.roleSlug; },
      list: function () { return Object.assign({}, state.capabilities); }
    };
  }

  expose();
})();