/* =========================================================
   DEV HUB · Tela inicial (Launcher)
   ---------------------------------------------------------
   - Grid de módulos disponíveis para o usuário
   - Busca com filtro em tempo real
   - Atalhos de teclado 1-9 para abrir rapidamente
   - Enter abre o primeiro resultado
   ---------------------------------------------------------
   CORREÇÃO (v2):
   - `hasPerm` e `hasCapability` agora replicam o FALLBACK
     do nav.js (BASE_CAPS). Antes, capabilities como
     `purchases.view`, `finance.view`, `stock.receive` e
     `purchases.approve` não estavam em `Perms.DEFAULTS`
     (permissions.js) e por isso Compras, Fornecedores,
     Financeiro, Aprovações etc. eram filtrados fora do
     welcome — mesmo aparecendo no menu "+".
   ========================================================= */

(function () {
  'use strict';

  const els = {};

  let index = [];
  let filtered = [];
  let searchQuery = '';

  /* =========================================================
     FALLBACK DE CAPABILITIES (espelho do nav.js)
     ---------------------------------------------------------
     Estrutura idêntica ao nav.js para manter consistência
     entre a barra de abas (+ menu) e a tela inicial.
     ========================================================= */
  const CAPABILITIES = {
    platform_admin: ['platform'],
    admin:          ['operations', 'management', 'admin_settings'],
    administrador:  ['operations', 'management', 'admin_settings'],
    gestor:         ['operations', 'management'],
    manager:        ['operations', 'management'],
    user:           ['operations'],
    usuario:        ['operations'],
    'usuário':      ['operations']
  };

  const BASE_CAPS = {
    admin: [
      'dashboard.view',
      'sales.view', 'sales.create', 'sales.edit', 'sales.delete',
      'notes.view', 'notes.create',
      'invoices.view',
      'customers.view', 'customers.create', 'customers.edit',
      'products.view', 'products.create', 'products.edit', 'products.delete',
      'stock.view', 'stock.receive', 'stock.movements',
      'reports.view',
      'management.view',
      'purchases.view', 'purchases.create', 'purchases.approve', 'purchases.cancel',
      'purchases.receive', 'purchases.dispute', 'purchases.return', 'purchases.reject',
      'finance.view', 'finance.create', 'finance.pay', 'finance.edit',
      'finance.settle', 'finance.reverse', 'finance.transfer', 'finance.reconcile', 'finance.cancel',
      'platform'
    ],
    administrador: [
      'dashboard.view',
      'sales.view', 'sales.create', 'sales.edit', 'sales.delete',
      'notes.view', 'notes.create',
      'invoices.view',
      'customers.view', 'customers.create', 'customers.edit',
      'products.view', 'products.create', 'products.edit', 'products.delete',
      'stock.view', 'stock.receive', 'stock.movements',
      'reports.view',
      'management.view',
      'purchases.view', 'purchases.create', 'purchases.approve', 'purchases.cancel',
      'purchases.receive', 'purchases.dispute', 'purchases.return', 'purchases.reject',
      'finance.view', 'finance.create', 'finance.pay', 'finance.edit',
      'finance.settle', 'finance.reverse', 'finance.transfer', 'finance.reconcile', 'finance.cancel',
      'platform'
    ],
    gestor: [
      'dashboard.view',
      'sales.view', 'sales.create', 'sales.edit',
      'notes.view', 'invoices.view',
      'customers.view', 'customers.create', 'customers.edit',
      'products.view', 'products.create', 'products.edit',
      'stock.view', 'stock.receive', 'stock.movements',
      'reports.view', 'management.view',
      'purchases.view', 'purchases.create', 'purchases.approve',
      'purchases.receive', 'purchases.dispute', 'purchases.return',
      'finance.view', 'finance.create', 'finance.pay', 'finance.edit',
      'finance.settle', 'finance.reverse', 'finance.transfer'
    ],
    manager: [
      'dashboard.view',
      'sales.view', 'sales.create', 'sales.edit',
      'notes.view', 'invoices.view',
      'customers.view', 'customers.create', 'customers.edit',
      'products.view', 'products.create', 'products.edit',
      'stock.view', 'stock.receive', 'stock.movements',
      'reports.view', 'management.view',
      'purchases.view', 'purchases.create', 'purchases.approve',
      'purchases.receive', 'purchases.dispute', 'purchases.return',
      'finance.view', 'finance.create', 'finance.pay', 'finance.edit',
      'finance.settle', 'finance.reverse', 'finance.transfer'
    ],
    user: [
      'dashboard.view', 'sales.view', 'notes.view',
      'customers.view', 'products.view', 'stock.view',
      'purchases.view', 'finance.view'
    ],
    usuario: [
      'dashboard.view', 'sales.view', 'notes.view',
      'customers.view', 'products.view', 'stock.view',
      'purchases.view', 'finance.view'
    ],
    'usuário': [
      'dashboard.view', 'sales.view', 'notes.view',
      'customers.view', 'products.view', 'stock.view',
      'purchases.view', 'finance.view'
    ]
  };

  /* ---------- Contexto do usuário (sessionStorage) ---------- */
  function readContext() {
    let role = '';
    let isPlatform = false;
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (raw) {
        const data = JSON.parse(raw);
        role = String(data.role || '').toLowerCase();
        isPlatform = data.is_platform_admin === true;
      }
    } catch (e) { /* ignora */ }
    return { role, isPlatform };
  }

  function capsForRole(role, isPlatform) {
    const baseCaps = CAPABILITIES[String(role || '').toLowerCase()] || ['operations'];
    if (isPlatform && baseCaps.indexOf('platform') === -1) {
      return baseCaps.concat(['platform']);
    }
    return baseCaps;
  }

  function baseCapsForRole() {
    const ctx = readContext();
    const r = String(ctx.role || '').toLowerCase();
    const caps = BASE_CAPS[r] || BASE_CAPS.user;
    if (ctx.isPlatform && caps.indexOf('platform') === -1) {
      return caps.concat(['platform']);
    }
    return caps;
  }

  /**
   * Verificação de capability com fallback — MESMA lógica
   * do nav.js `hasCapability()`. Substitui o uso direto de
   * `Perms.has()`, que não conhecia `purchases.*`, `finance.*`
   * nem `stock.receive`.
   */
  function hasCapWithFallback(cap) {
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
        console.warn('[welcome] Perms.has falhou para', c, e);
      }
    }

    const genericCaps = capsForRole(readContext().role, readContext().isPlatform);
    if (genericCaps.indexOf(c) !== -1) return true;
    return inFallback;
  }

  /* =========================================================
     Init
     ========================================================= */
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const Auth = window.Auth;
    if (!Auth || !Auth.isConfigured() || !window.db) return;

    els.grid      = document.getElementById('welcome-grid');
    els.search    = document.getElementById('welcome-search');
    els.empty     = document.getElementById('welcome-no-results');
    els.title     = document.getElementById('welcome-title');

    if (!els.grid || !els.search) return;

    const session = await Auth.requireSession();
    if (!session) return;

    /* Nome no hero */
    try {
      const profile = await Auth.getProfile(session.user.id);
      const meta = session.user.user_metadata || {};
      const fullName =
        (profile && profile.name) ||
        meta.name || meta.full_name ||
        (session.user.email ? session.user.email.split('@')[0] : '') || '';

      const first = String(fullName).trim().split(/\s+/)[0] || '';
      const nameEl = els.title.querySelector('.welcome__name');
      if (nameEl) nameEl.textContent = first ? ' ' + first : '';
    } catch (e) { /* silencioso */ }

    if (window.Perms && typeof window.Perms.load === 'function') {
      try { await window.Perms.load(); } catch (e) { /* fallback */ }
    }

    buildIndex();
    renderGrid(index);

    els.search.addEventListener('input', onSearchInput);
    els.search.addEventListener('keydown', onSearchKeydown);

    /* Ctrl+K foca a busca */
    document.addEventListener('keydown', function (e) {
      const isK = String(e.key || '').toLowerCase() === 'k';
      if (!isK) return;
      if (!(e.ctrlKey || e.metaKey)) return;

      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

      e.preventDefault();
      els.search.focus();
      els.search.select();
    });

    /* Atalhos 1-9 abrem o item N visível */
    document.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const n = parseInt(e.key, 10);
      if (!Number.isInteger(n) || n < 1 || n > 9) return;

      const list = filtered.length > 0 ? filtered : index;
      const item = list[n - 1];
      if (!item) return;

      e.preventDefault();
      openModule(item);
    });
  }

  /* =========================================================
     Índice
     ========================================================= */
  function buildIndex() {
    const all = Array.isArray(window.DHModules) ? window.DHModules : [];
    const ITEM_PERM = window.DHItemPerm || {};

    index = all.filter(function (item) {
      /* Capability do próprio módulo (ex.: 'purchases.approve') */
      if (item.capability && !hasCapWithFallback(item.capability)) return false;

      /* Capability extra do map ITEM_PERM (ex.: 'finance.view') */
      const cap = ITEM_PERM[item.id];
      if (cap && !hasCapWithFallback(cap)) return false;

      return true;
    });

    filtered = index.slice();
  }

  /* =========================================================
     Grid
     ========================================================= */
  function renderGrid(items) {
    els.grid.innerHTML = '';

    if (items.length === 0) {
      els.empty.hidden = false;
      return;
    }
    els.empty.hidden = true;

    const order = ['Comercial', 'Catálogo', 'Suprimentos', 'Financeiro',
                   'Análise', 'Administração', 'Plataforma'];
    const dashboardItem = items.find(function (i) { return i.id === 'dashboard'; });
    const grouped = {};

    items.forEach(function (it) {
      if (it.id === 'dashboard') return;
      const g = it.group || 'Outros';
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(it);
    });

    const frag = document.createDocumentFragment();

    if (dashboardItem) {
      frag.appendChild(buildGroupTitle('Início'));
      frag.appendChild(buildCard(dashboardItem));
    }

    order.forEach(function (g) {
      if (!grouped[g] || grouped[g].length === 0) return;
      frag.appendChild(buildGroupTitle(g));
      grouped[g].forEach(function (it) { frag.appendChild(buildCard(it)); });
      delete grouped[g];
    });

    Object.keys(grouped).forEach(function (g) {
      frag.appendChild(buildGroupTitle(g));
      grouped[g].forEach(function (it) { frag.appendChild(buildCard(it)); });
    });

    els.grid.appendChild(frag);

    updateShortcuts();
  }

  function buildGroupTitle(label) {
    const el = document.createElement('p');
    el.className = 'welcome__group-title';
    el.textContent = label;
    return el;
  }

  function buildCard(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'welcome__card';
    btn.dataset.id = item.id;
    btn.dataset.group = item.group || '';

    const icon = document.createElement('span');
    icon.className = 'welcome__card-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = getIcon(item.icon);

    const body = document.createElement('span');
    body.className = 'welcome__card-body';

    const title = document.createElement('span');
    title.className = 'welcome__card-title';
    title.innerHTML = highlight(item.label, searchQuery);

    const meta = document.createElement('span');
    meta.className = 'welcome__card-meta';
    meta.textContent = item.group ? item.group : 'Página inicial';

    body.appendChild(title);
    body.appendChild(meta);

    const kbd = document.createElement('span');
    kbd.className = 'welcome__card-kbd';
    kbd.setAttribute('aria-hidden', 'true');
    kbd.textContent = '';

    btn.appendChild(icon);
    btn.appendChild(body);
    btn.appendChild(kbd);

    btn.addEventListener('click', function () { openModule(item); });

    return btn;
  }

  /* Numera os primeiros 9 cards visíveis */
  function updateShortcuts() {
    const cards = els.grid.querySelectorAll('.welcome__card');
    cards.forEach(function (card, i) {
      const kbd = card.querySelector('.welcome__card-kbd');
      if (!kbd) return;
      if (i < 9) {
        kbd.textContent = String(i + 1);
        kbd.hidden = false;
      } else {
        kbd.hidden = true;
      }
    });
  }

  /* =========================================================
     Abrir
     ========================================================= */
  function openModule(item) {
    if (window.DHTabs && typeof window.DHTabs.open === 'function') {
      window.DHTabs.open(item);
      return;
    }
    window.location.href = item.href;
  }

  /* =========================================================
     Busca
     ========================================================= */
  function onSearchInput() {
    searchQuery = String(els.search.value || '').trim();
    const q = normalize(searchQuery);

    if (!q) {
      filtered = index.slice();
    } else {
      const words = q.split(/\s+/).filter(Boolean);
      filtered = index.filter(function (item) {
        const haystack = normalize(item.label + ' ' + (item.group || ''));
        return words.every(function (w) { return haystack.indexOf(w) !== -1; });
      });
    }

    renderGrid(filtered);
  }

  function onSearchKeydown(e) {
    if (e.key === 'Escape') {
      if (els.search.value) {
        els.search.value = '';
        searchQuery = '';
        filtered = index.slice();
        renderGrid(filtered);
      } else {
        els.search.blur();
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0) {
        openModule(filtered[0]);
      }
    }
  }

  /* =========================================================
     Helpers
     ========================================================= */
  function normalize(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim();
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function highlight(text, query) {
    const safe = escapeHtml(text);
    if (!query) return safe;

    const hay = normalize(text);
    const needle = normalize(query);
    const i = hay.indexOf(needle);
    if (i === -1) return safe;

    const before = escapeHtml(text.slice(0, i));
    const match  = escapeHtml(text.slice(i, i + needle.length));
    const after  = escapeHtml(text.slice(i + needle.length));
    return before + '<mark>' + match + '</mark>' + after;
  }

  const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/></svg>',
    vendas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h2.3l2.3 11.6a1.8 1.8 0 0 0 1.8 1.4h8.8a1.8 1.8 0 0 0 1.8-1.4L21 7.5H6"/></svg>',
    notas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/><path d="M14 2.5v5h5"/><path d="M9 13h6M9 17h4"/></svg>',
    'notas-fiscal': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/><path d="M14 2.5v5h5"/><path d="M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01"/></svg>',
    clientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7.5" r="3.5"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/><path d="M16.5 4.13a4 4 0 0 1 0 7.75"/></svg>',
    produtos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m21 8-9-5-9 5v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 21v-8"/></svg>',
    estoque: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2.5 9 5-9 5-9-5z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 17.5 9 5 9-5"/></svg>',
    relatorios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m7 15 3.5-4 3 2.5L20 7"/></svg>',
    gestao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7.5" r="3.5"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/><path d="M16.5 4.13a4 4 0 0 1 0 7.75"/></svg>',
    configuracoes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>',
    empresas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M15 21V9h4a2 2 0 0 1 2 2v10"/><path d="M9 7h2M9 11h2M9 15h2"/></svg>',
    usuarios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7.5" r="3.5"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    finance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M2.5 10h19"/><circle cx="17" cy="14" r="1"/></svg>',
    default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>'
  };

  function getIcon(key) { return ICONS[key] || ICONS.default; }
})();