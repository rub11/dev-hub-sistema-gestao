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
   1. `load()` não marca mais `loaded = true` quando não há
      contexto (sessionStorage vazio). Antes, abrir em nova
      aba deixava o usuário sem permissão para sempre.
   2. `perms:ready` agora é disparado ao final de `load()`,
      como o nav.js espera.
   3. `gateAll(root)` inclui o próprio root se ele tiver
      `data-perm`.
   4. `gate()` remove `data-perm-hidden` ao reexibir.
   5. Lock para evitar cargas paralelas (duas chamadas de
      `load()` não disparam duas RPCs).
   6. `Perms.reset()` e `Perms.isLoaded()` expostos.
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

  /* Lock contra chamadas paralelas de load() */
  let loadPromise = null;

  function readCtx() {
    try {
      const raw = sessionStorage.getItem('devhub_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* =========================================================
     Resolve o contexto do usuário por 3 caminhos, em ordem:
       1. sessionStorage (rápido)
       2. Auth.getStoredUser() (que já faz o mesmo parse)
       3. Auth.getSession() + Auth.getProfile() (lento, mas
          garante que funciona em nova aba sem sessionStorage)
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

  /* =========================================================
     load() — protegido contra chamadas paralelas
     ========================================================= */
  function load() {
    if (state.loaded) return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise = doLoad();
    return loadPromise;
  }

  async function doLoad() {
    const ctx = await resolveContext();

    if (!ctx) {
      /* CORREÇÃO #1: não marca como loaded. Assim, se o
         contexto ainda não chegou (sessão em resolução,
         nova aba), uma chamada futura pode tentar de novo. */
      loadPromise = null;
      console.warn('[DEV HUB] Perms.load: contexto ainda indisponível — não marcado como carregado.');
      return;
    }

    const base = String(ctx.role || 'user').toLowerCase();
    const slug = String(ctx.role_slug || '').toLowerCase();
    state.roleSlug = slug;

    /* 1) Começa com defaults do base */
    const next = {};
    const baseDefaults = DEFAULTS[base] || DEFAULTS.user;
    baseDefaults.forEach(function (cap) {
      next[cap] = true;
    });

    /* 2) Overlay do banco (role_permissions) */
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

    /* CORREÇÃO #2: dispara perms:ready — nav.js e quem
       mais escutar recebe as capacidades já resolvidas. */
    try {
      document.dispatchEvent(new CustomEvent('perms:ready', {
        detail: {
          capabilities: Object.assign({}, next),
          roleSlug: slug
        }
      }));
    } catch (e) {
      /* CustomEvent indisponível — ignora */
    }
  }

  /* =========================================================
     reset() — limpa o estado para recarregar do zero
     Útil em logout ou troca de organização.
     ========================================================= */
  function reset() {
    state.loaded = false;
    state.capabilities = {};
    state.roleSlug = '';
    loadPromise = null;
  }

  /* =========================================================
     Consultas
     ========================================================= */
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

  /* =========================================================
     Gate
     ========================================================= */
  /** Esconde um elemento se o usuário não tem a capability. */
  function gate(el, cap) {
    if (!el) return;
    const ok = has(cap);
    el.hidden = !ok;
    /* CORREÇÃO #4: remove o resíduo ao reexibir */
    if (ok) {
      el.removeAttribute('data-perm-hidden');
    } else {
      el.setAttribute('data-perm-hidden', '1');
    }
  }

  /** Aplica em todos os elementos com data-perm="<cap>" */
  function gateAll(root) {
    const scope = root || document;

    /* CORREÇÃO #3: inclui o próprio root se ele tiver o atributo */
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

  /* =========================================================
     API pública
     ========================================================= */
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