/* =========================================================
   DEV HUB · Permissões granulares
   ---------------------------------------------------------
   Uso:
     await Perms.load();            // 1x por página
     Perms.has('sales.edit')        // true/false
     Perms.can('stock.view')        // mesmo que has
     Perms.gate(elem, 'customers.delete')  // esconde se não pode
     Perms.gateAll('products.create')      // aplica em [data-perm]
   ---------------------------------------------------------
   CORREÇÕES APLICADAS:
   1. `load()` não marca `loaded = true` quando não há contexto.
   2. `perms:ready` disparado ao final de `load()`.
   3. `gateAll(root)` inclui o próprio root.
   4. `gate()` remove `data-perm-hidden` ao reexibir.
   5. Lock para evitar cargas paralelas.
   6. `Perms.reset()` e `Perms.isLoaded()` expostos.
   7. [NOVO] `readCtx()` lê localStorage E sessionStorage.
   8. [NOVO] Capabilities canônicas expandidas (purchases/finance/stock).
   ========================================================= */

(function () {
  'use strict';

  /* Lista canônica de capabilities — expandida para casar com nav/config.js */
  const CAPABILITIES = [
    'dashboard.view',

    'sales.view', 'sales.create', 'sales.edit', 'sales.delete',
    'notes.view', 'notes.create', 'notes.print',
    'invoices.view', 'invoices.create', 'invoices.cancel', 'invoices.delete',

    'customers.view', 'customers.create', 'customers.edit', 'customers.delete',

    'products.view', 'products.create', 'products.edit', 'products.delete',

    'stock.view', 'stock.receive', 'stock.movement', 'stock.movements',
    'stock.audit', 'stock.report',

    'purchases.view', 'purchases.create', 'purchases.approve', 'purchases.cancel',
    'purchases.receive', 'purchases.dispute', 'purchases.return', 'purchases.reject',

    'finance.view', 'finance.create', 'finance.pay', 'finance.edit',
    'finance.settle', 'finance.reverse', 'finance.transfer', 'finance.reconcile', 'finance.cancel',

    'reports.view', 'reports.export',

    'management.view', 'management.roles', 'management.users',

    'platform'
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
      'purchases.view',
      'finance.view',
      'reports.view'
    ],
    gestor: [
      'dashboard.view',
      'sales.view', 'sales.create', 'sales.edit', 'sales.delete',
      'notes.view', 'notes.print', 'notes.create',
      'invoices.view', 'invoices.create', 'invoices.cancel', 'invoices.delete',
      'customers.view', 'customers.create', 'customers.edit', 'customers.delete',
      'products.view', 'products.create', 'products.edit',
      'stock.view', 'stock.receive', 'stock.movement', 'stock.movements',
      'stock.audit', 'stock.report',
      'purchases.view', 'purchases.create', 'purchases.approve',
      'purchases.receive', 'purchases.dispute', 'purchases.return',
      'finance.view', 'finance.create', 'finance.pay', 'finance.edit',
      'finance.settle', 'finance.reverse', 'finance.transfer',
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

  let loadPromise = null;

  /* FIX #7: lê localStorage E sessionStorage */
  function readCtx() {
    try {
      const raw =
        localStorage.getItem('devhub_user') ||
        sessionStorage.getItem('devhub_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* =========================================================
     Resolve o contexto por 3 caminhos, em ordem:
       1. storage (rápido)
       2. Auth.getStoredUser() (já lê ambos)
       3. Auth.getSession() + Auth.getProfile()
     ========================================================= */
  async function resolveContext() {
    let ctx = readCtx();
    if (ctx) return ctx;

    if (window.Auth && typeof window.Auth.getStoredUser === 'function') {
      ctx = window.Auth.getStoredUser();
      if (ctx) return ctx;
    }

    if (window.Auth && typeof window.Auth.getSession === 'function') {
      try {
        const session = await window.Auth.getSession();
        if (
          session && session.user &&
          typeof window.Auth.getProfile === 'function'
        ) {
          ctx = await window.Auth.getProfile(session.user.id);
        }
      } catch (e) {
        console.warn('[DEV HUB] Perms: falha ao resolver contexto via Auth.', e);
      }
    }

    return ctx || null;
  }

  function load() {
    if (state.loaded) return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise = doLoad();
    return loadPromise;
  }

  async function doLoad() {
    const ctx = await resolveContext();

    if (!ctx) {
      loadPromise = null;
      console.warn('[DEV HUB] Perms.load: contexto ainda indisponível — não marcado como carregado.');
      return;
    }

    const base = String(ctx.role || 'user').toLowerCase();
    const slug = String(ctx.role_slug || '').toLowerCase();
    state.roleSlug = slug;

    const next = {};
    const baseDefaults = DEFAULTS[base] || DEFAULTS.user;
    baseDefaults.forEach(function (cap) {
      next[cap] = true;
    });

    /* Overlay do banco (role_permissions) */
    try {
      if (window.db && typeof window.db.rpc === 'function') {
        const { data, error } = await window.db.rpc('my_capabilities');
        if (!error && Array.isArray(data)) {
          data.forEach(function (row) {
            next[row.capability] = row.allowed === true;
          });
        } else if (error) {
          console.warn('[DEV HUB] Perms: falha ao ler do banco, mantendo defaults.', error);
        }
      }
    } catch (e) {
      console.warn('[DEV HUB] Perms: erro inesperado no overlay do banco.', e);
    }

    state.capabilities = next;
    state.loaded = true;

    try {
      document.dispatchEvent(new CustomEvent('perms:ready', {
        detail: {
          capabilities: Object.assign({}, next),
          roleSlug: slug
        }
      }));
    } catch (e) { /* ignora */ }
  }

  function reset() {
    state.loaded = false;
    state.capabilities = {};
    state.roleSlug = '';
    loadPromise = null;
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

  function gate(el, cap) {
    if (!el) return;
    const ok = has(cap);
    el.hidden = !ok;
    if (ok) {
      el.removeAttribute('data-perm-hidden');
    } else {
      el.setAttribute('data-perm-hidden', '1');
    }
  }

  function gateAll(root) {
    const scope = root || document;

    if (
      scope.nodeType === 1 &&
      typeof scope.hasAttribute === 'function' &&
      scope.hasAttribute('data-perm')
    ) {
      gate(scope, scope.getAttribute('data-perm'));
    }

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
      reset: reset,
      isLoaded: function () { return state.loaded === true; },

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