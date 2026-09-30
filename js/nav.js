/* =========================================================
   DEV HUB · Navegação em ABAS (estilo navegador)
   ---------------------------------------------------------
   CORREÇÕES NESTA VERSÃO:
   1. Dropdown do usuário: position fixed + movido pro <body>.
   2. Reposicionamento automático em scroll/resize.
   3. Menu de módulos NÃO fecha ao rolar dentro dele.
   4. Logo substituída por imagem (img/logo.png) clicável.
   5. Clicar na marca → HOME_URL.
   6. Ícone "Fechar todas as abas" no tamanho correto.
   7. Módulo Compras adicionado (grupo Suprimentos).
   8. hasCapability fail-open: só bloqueia se o fallback
      por role TAMBÉM negar.
   9. ** NOVO ** Fallback generoso por role: quando o Perms
      não carrega (ex: esqueceu o <script src="js/auth.js">),
      o nav ainda libera as capabilities padrão do role.
      Isso evita o menu aparecer só com PLATAFORMA.
   ========================================================= */

(function () {
  'use strict';

  /* =========================================================
     CONFIGURAÇÃO DA MARCA
     ========================================================= */
  const BRAND_IMAGE = 'img/logo.png';

  /* =========================================================
     ANTI-FLASH
     ========================================================= */
  (function applyEarlyTopnavLayout() {
    try {
      if (/[?&]blocked=1/.test(location.search)) return;
      injectStyles();
      document.documentElement.classList.add('layout-topnav');
    } catch (e) { /* nunca deixa isso quebrar a página */ }
  })();

  /* =========================================================
     Fallback por role
     ---------------------------------------------------------
     CAPABILITIES  → tags genéricas (usadas para management,
                     platform, etc)
     BASE_CAPS     → capabilities reais (.view, .create, etc)
                     quando o Perms não carrega
     ========================================================= */
  const CAPABILITIES = {
    platform_admin: ['platform'],
    admin: ['operations', 'management', 'admin_settings'],
    administrador: ['operations', 'management', 'admin_settings'],
    gestor: ['operations', 'management'],
    manager: ['operations', 'management'],
    user: ['operations'],
    usuario: ['operations'],
    'usuário': ['operations']
  };

  /* Capabilities reais esperadas por role — usadas quando
     window.Perms NÃO está carregado na página. */
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
      'finance.pay',
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
      'finance.pay',
      'platform'
    ],
    gestor: [
      'dashboard.view',
      'sales.view', 'sales.create', 'sales.edit',
      'notes.view',
      'invoices.view',
      'customers.view', 'customers.create', 'customers.edit',
      'products.view', 'products.create', 'products.edit',
      'stock.view', 'stock.receive', 'stock.movements',
      'reports.view',
      'management.view',
      'purchases.view', 'purchases.create', 'purchases.approve',
      'finance.pay'
    ],
    manager: [
      'dashboard.view',
      'sales.view', 'sales.create', 'sales.edit',
      'notes.view',
      'invoices.view',
      'customers.view', 'customers.create', 'customers.edit',
      'products.view', 'products.create', 'products.edit',
      'stock.view', 'stock.receive', 'stock.movements',
      'reports.view',
      'management.view',
      'purchases.view', 'purchases.create', 'purchases.approve',
      'finance.pay'
    ],
    user: [
      'dashboard.view',
      'sales.view',
      'notes.view',
      'customers.view',
      'products.view',
      'stock.view',
      'purchases.view'
    ],
    usuario: [
      'dashboard.view',
      'sales.view',
      'notes.view',
      'customers.view',
      'products.view',
      'stock.view',
      'purchases.view'
    ],
    'usuário': [
      'dashboard.view',
      'sales.view',
      'notes.view',
      'customers.view',
      'products.view',
      'stock.view',
      'purchases.view'
    ]
  };

  const ROLE_LABELS = {
    platform_admin: 'Administrador da Plataforma',
    admin: 'Administrador',
    administrador: 'Administrador',
    gestor: 'Gestor',
    manager: 'Gestor',
    user: 'Funcionário',
    usuario: 'Funcionário',
    'usuário': 'Funcionário'
  };

  const ITEM_PERM = {
    dashboard:        'dashboard.view',
    vendas:           'sales.view',
    notas:            'notes.view',
    'notas-fiscal':   'invoices.view',
    clientes:         'customers.view',
    produtos:         'products.view',
    estoque:          'stock.view',
    relatorios:       'reports.view',
    gestao:           'management.view',
    plataforma:       'platform',
    empresas:         'platform',
    'plat-usuarios':  'platform',
    'plat-config':    'platform',
    compras:          'purchases.view',
    'compras-receber':'stock.receive',
    fornecedores:     'purchases.view'
  };

  const TABS_KEY = 'devhub_tabs';
  const MAX_TABS = 12;

  const HOME_URL = 'welcome.html';
  const DASHBOARD_URL = 'dashboard.html';

  /* =========================================================
     Contexto
     ========================================================= */
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
    const baseCaps = CAPABILITIES[String(role || '').toLowerCase()] || ['operations'];
    if (isPlatform && baseCaps.indexOf('platform') === -1) {
      return baseCaps.concat(['platform']);
    }
    return baseCaps;
  }

  function currentCapabilities() {
    const ctx = readContext();
    return capsForRole(ctx.role, ctx.isPlatform);
  }

  /* Retorna as caps BASE do role (reais: .view, .create...) */
  function baseCapsForRole() {
    const ctx = readContext();
    const r = String(ctx.role || '').toLowerCase();
    const caps = BASE_CAPS[r] || BASE_CAPS.user;
    if (ctx.isPlatform && caps.indexOf('platform') === -1) {
      return caps.concat(['platform']);
    }
    return caps;
  }

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
      if (ROLE_LABELS[r]) return ROLE_LABELS[r];
      return r ? r.charAt(0).toUpperCase() + r.slice(1) : '';
    }
  };

  window.DHRoles = DHRoles;

  /* =========================================================
     Permissões
     ---------------------------------------------------------
     Ordem de decisão:
       1. 'platform' → só platform_admin
       2. Se window.Perms tem dados:
          - Perms.has(cap) === true  → libera
          - Perms.has(cap) === false → cai no próximo passo
       3. Fallback de role (BASE_CAPS): se a cap está lá, libera
       4. Caso contrário, bloqueia
     ========================================================= */
  function hasCapability(cap) {
    if (!cap) return true;
    if (cap === 'platform') return readContext().isPlatform;

    const c = String(cap).toLowerCase();

    /* Camada 1: tenta Perms (banco) */
    if (window.Perms && typeof window.Perms.has === 'function') {
      try {
        const list = (typeof window.Perms.list === 'function') ? window.Perms.list() : null;
        const listEmpty = !list || Object.keys(list).length === 0;

        if (!listEmpty) {
          const r = window.Perms.has(c);
          if (r === true)  return true;
          /* Se r === false, cai no fallback */
        }
      } catch (e) {
        console.warn('[nav] Perms.has falhou para', c, e);
      }
    }

    /* Camada 2: fallback generoso por role */
    const baseCaps = baseCapsForRole();
    if (baseCaps.indexOf(c) !== -1) return true;

    /* Camada 3: caps genéricas (management, operations, etc.) */
    const genericCaps = currentCapabilities();
    if (genericCaps.indexOf(c) !== -1) return true;

    /* Camada 4: nega */
    return false;
  }

  function hasPermission(cap) {
    return hasCapability(cap);
  }

  /* =========================================================
     Ícones
     ========================================================= */
  const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" /></svg>',
    vendas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2.5 3.5h2.3l2.3 11.6a1.8 1.8 0 0 0 1.8 1.4h8.8a1.8 1.8 0 0 0 1.8-1.4L21 7.5H6" /></svg>',
    notas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z" /><path d="M14 2.5v5h5" /><path d="M9 13h6M9 17h4" /></svg>',
    'notas-fiscal': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z" /><path d="M14 2.5v5h5" /><path d="M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" /></svg>',
    clientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7.5" r="3.5" /><path d="M22 20v-1.5a4 4 0 0 0-3-3.87" /><path d="M16.5 4.13a4 4 0 0 1 0 7.75" /></svg>',
    produtos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 8-9-5-9 5v8l9 5 9-5z" /><path d="m3 8 9 5 9-5" /><path d="M12 21v-8" /></svg>',
    estoque: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 2.5 9 5-9 5-9-5z" /><path d="m3 12.5 9 5 9-5" /><path d="m3 17.5 9 5 9-5" /></svg>',
    relatorios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m7 15 3.5-4 3 2.5L20 7" /></svg>',
    gestao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7.5" r="3.5" /><path d="M22 20v-1.5a4 4 0 0 0-3-3.87" /><path d="M16.5 4.13a4 4 0 0 1 0 7.75" /></svg>',
    configuracoes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></svg>',
    empresas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18" /><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" /><path d="M15 21V9h4a2 2 0 0 1 2 2v10" /><path d="M9 7h2M9 11h2M9 15h2" /></svg>',
    usuarios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7.5" r="3.5" /><path d="M22 20v-1.5a4 4 0 0 0-3-3.87" /></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>'
  };

  /* =========================================================
     Estrutura de módulos
     ========================================================= */
  const TOPNAV = [
    { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: 'dashboard', group: null },
    { id: 'vendas',        label: 'Vendas',        href: 'vendas.html',       icon: 'vendas',       group: 'Comercial' },
    { id: 'notas',         label: 'Notas',         href: 'notas.html',        icon: 'notas',        group: 'Comercial' },
    { id: 'notas-fiscal',  label: 'Notas fiscais', href: 'notas-fiscal.html', icon: 'notas-fiscal', group: 'Comercial' },
    { id: 'clientes',      label: 'Clientes',      href: 'clientes.html',     icon: 'clientes',     group: 'Comercial' },
    { id: 'produtos',      label: 'Produtos',      href: 'produtos.html',     icon: 'produtos',     group: 'Catálogo' },
    { id: 'estoque',       label: 'Estoque',       href: 'estoque.html',      icon: 'estoque',      group: 'Catálogo' },

    /* ---------- Suprimentos ---------- */
    { id: 'compras',         label: 'Compras',         href: 'compras.html',         icon: 'vendas',   group: 'Suprimentos', capability: 'purchases.view' },
    { id: 'compras-receber', label: 'Receber compras', href: 'compras-receber.html', icon: 'estoque',  group: 'Suprimentos', capability: 'stock.receive' },
    { id: 'fornecedores',    label: 'Fornecedores',    href: 'fornecedores.html',    icon: 'empresas', group: 'Suprimentos', capability: 'purchases.view' },

    { id: 'relatorios',    label: 'Relatórios',    href: 'relatorios.html',   icon: 'relatorios',   group: 'Análise' },
    { id: 'gestao',        label: 'Gestão de usuários', href: 'gestao.html',  icon: 'gestao',       group: 'Administração', capability: 'management' },
    { id: 'plataforma',    label: 'Dashboard da plataforma',     href: 'plataforma.html',               icon: 'dashboard',      group: 'Plataforma', capability: 'platform' },
    { id: 'empresas',      label: 'Empresas',                    href: 'plataforma.html#empresas',      icon: 'empresas',       group: 'Plataforma', capability: 'platform' },
    { id: 'plat-usuarios', label: 'Usuários da plataforma',      href: 'plataforma-usuarios.html',      icon: 'usuarios',       group: 'Plataforma', capability: 'platform' },
    { id: 'plat-config',   label: 'Configurações da plataforma', href: 'plataforma-configuracoes.html', icon: 'configuracoes',  group: 'Plataforma', capability: 'platform' }
  ];

  const GROUP_ORDER = ['Comercial', 'Catálogo', 'Suprimentos', 'Análise', 'Administração', 'Plataforma'];

  function findItemById(id) {
    for (let i = 0; i < TOPNAV.length; i += 1) {
      if (TOPNAV[i].id === id) return TOPNAV[i];
    }
    return null;
  }

  function visibleItems() {
    return TOPNAV.filter(function (it) {
      if (it.capability && !hasCapability(it.capability)) return false;
      if (!hasPermission(ITEM_PERM[it.id])) return false;
      return true;
    });
  }

  /* =========================================================
     Página atual
     ========================================================= */
  function currentPageId() {
    const path = (window.location.pathname || '').split('/').pop() || 'index.html';
    const file = path.replace(/\.html?$/i, '').toLowerCase();
    const hash = String(window.location.hash || '').toLowerCase();

    if (file === 'plataforma') return hash === '#empresas' ? 'empresas' : 'plataforma';

    const MAP = {
      dashboard: 'dashboard', vendas: 'vendas', notas: 'notas',
      'notas-fiscal': 'notas-fiscal', clientes: 'clientes',
      produtos: 'produtos', estoque: 'estoque', relatorios: 'relatorios',
      gestao: 'gestao', funcionarios: 'gestao',
      configuracoes: 'configuracoes',
      'plataforma-configuracoes': 'plat-config',
      'plataforma-usuarios': 'plat-usuarios',
      compras: 'compras',
      'compras-nova': 'compras',
      'compras-receber': 'compras-receber',
      fornecedores: 'fornecedores'
    };
    return MAP[file] || file;
  }

  /* =========================================================
     Abas · persistência
     ========================================================= */
  function readTabs() {
    try {
      const raw = sessionStorage.getItem(TABS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function writeTabs(tabs) {
    try {
      sessionStorage.setItem(TABS_KEY, JSON.stringify(tabs.slice(0, MAX_TABS)));
    } catch (e) { /* ignora */ }
  }

  function syncCurrentTab() {
    const id = currentPageId();
    const item = findItemById(id);
    if (!item) return;

    const tabs = readTabs();
    const exists = tabs.some(function (t) { return t.id === id; });
    if (exists) return;

    tabs.push({
      id: item.id,
      label: item.label,
      href: item.href,
      icon: item.icon
    });
    writeTabs(tabs);
  }

  /* =========================================================
     Abas · render
     ========================================================= */
  function renderTabs() {
    const wrap = document.getElementById('app-tabs-scroll');
    if (!wrap) return;

    const tabs = readTabs();
    const activeId = currentPageId();

    wrap.innerHTML = '';

    if (tabs.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'app-tabs__empty';
      empty.textContent = 'Nenhuma aba aberta';
      wrap.appendChild(empty);
      return;
    }

    tabs.forEach(function (tab) {
      wrap.appendChild(buildTabEl(tab, tab.id === activeId));
    });
  }

  function buildTabEl(tab, isActive) {
    const el = document.createElement('div');
    el.className = 'app-tab' + (isActive ? ' is-active' : '');
    el.dataset.tabId = tab.id;
    el.setAttribute('role', 'tab');
    el.setAttribute('tabindex', isActive ? '0' : '-1');
    if (isActive) el.setAttribute('aria-current', 'page');

    const icon = document.createElement('span');
    icon.className = 'app-tab__icon';
    icon.innerHTML = ICONS[tab.icon] || '';
    icon.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'app-tab__label';
    label.textContent = tab.label;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'app-tab__close';
    close.setAttribute('aria-label', 'Fechar aba ' + tab.label);
    close.title = 'Fechar';
    close.innerHTML = ICONS.close;
    close.addEventListener('click', function (ev) {
      ev.stopPropagation();
      closeTab(tab.id);
    });

    el.appendChild(icon);
    el.appendChild(label);
    el.appendChild(close);

    el.addEventListener('click', function (ev) {
      if (ev.target.closest('.app-tab__close')) return;
      if (isActive) return;
      window.location.href = tab.href;
    });

    el.addEventListener('auxclick', function (ev) {
      if (ev.button === 1) closeTab(tab.id);
    });

    return el;
  }

  /* =========================================================
     Abrir / fechar abas
     ========================================================= */
  function openItemAsTab(item) {
    if (!item) return;

    const cap = ITEM_PERM[item.id];
    if (cap && !hasPermission(cap)) {
      showPermissionDenied(item.label);
      return;
    }

    const tabs = readTabs();
    const exists = tabs.some(function (t) { return t.id === item.id; });
    if (!exists) {
      tabs.push({
        id: item.id,
        label: item.label,
        href: item.href,
        icon: item.icon
      });
      writeTabs(tabs);
    }

    window.location.href = item.href;
  }

  function closeTab(id) {
    const tabs = readTabs();
    const idx = tabs.findIndex(function (t) { return t.id === id; });
    if (idx === -1) return;

    const isActive = id === currentPageId();
    tabs.splice(idx, 1);
    writeTabs(tabs);

    if (isActive) {
      const next = tabs[idx] || tabs[idx - 1] || tabs[tabs.length - 1];
      window.location.href = next ? next.href : HOME_URL;
      return;
    }

    renderTabs();
  }

  /* =========================================================
     Dropdown de módulos (botão "+")
     ========================================================= */
  let menuEl = null;
  let menuHovered = false;

  function openModuleMenu() {
    if (menuEl && !menuEl.hidden) {
      closeModuleMenu();
      return;
    }

    const plusBtn = document.getElementById('app-tabs-new');
    if (!plusBtn) return;

    if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
    menuEl = buildModuleMenu();
    document.body.appendChild(menuEl);
    wireMenuPointerGuards(menuEl);

    menuEl.hidden = false;
    positionMenu(menuEl, plusBtn);

    requestAnimationFrame(function () {
      if (menuEl && !menuEl.hidden) positionMenu(menuEl, plusBtn);
    });
  }

  function closeModuleMenu() {
    if (menuEl) menuEl.hidden = true;
  }

  function wireMenuPointerGuards(menu) {
    menu.addEventListener('mouseenter', function () { menuHovered = true; });
    menu.addEventListener('mouseleave', function () { menuHovered = false; });

    menu.addEventListener('scroll', function (e) {
      e.stopPropagation();
    }, true);

    menu.addEventListener('mousedown', function (e) {
      e.stopPropagation();
    });
    menu.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  function buildModuleMenu() {
    const el = document.createElement('div');
    el.className = 'tnav-menu';
    el.setAttribute('role', 'menu');
    el.hidden = true;

    const items = visibleItems();
    const activeId = currentPageId();
    const openTabs = {};
    readTabs().forEach(function (t) { openTabs[t.id] = true; });

    const dashItem = items.find(function (i) { return i.id === 'dashboard'; });
    if (dashItem) {
      el.appendChild(buildMenuItem(dashItem, activeId, openTabs, false));
      el.appendChild(makeSep());
    }

    GROUP_ORDER.forEach(function (groupName) {
      const groupItems = items.filter(function (i) {
        return i.group === groupName;
      });
      if (groupItems.length === 0) return;

      const label = document.createElement('div');
      label.className = 'tnav-menu__group';
      label.textContent = groupName;
      el.appendChild(label);

      groupItems.forEach(function (it) {
        el.appendChild(buildMenuItem(it, activeId, openTabs, true));
      });
    });

    el.appendChild(makeSep());

    const closeAll = document.createElement('button');
    closeAll.type = 'button';
    closeAll.className = 'tnav-menu__item tnav-menu__item--danger';
    closeAll.setAttribute('role', 'menuitem');
    closeAll.innerHTML =
      '<span class="tnav-menu__icon">' + ICONS.close + '</span>' +
      '<span class="tnav-menu__label">Fechar todas as abas</span>';
    closeAll.addEventListener('click', function () {
      closeModuleMenu();
      clearAllTabs();
    });
    el.appendChild(closeAll);

    return el;
  }

  function buildMenuItem(item, activeId, openTabs, indent) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tnav-menu__item';
    if (indent) btn.classList.add('tnav-menu__item--indent');
    if (item.id === activeId) btn.classList.add('is-active');
    if (openTabs[item.id]) btn.classList.add('is-open');
    btn.setAttribute('role', 'menuitem');

    const icon = document.createElement('span');
    icon.className = 'tnav-menu__icon';
    icon.innerHTML = ICONS[item.icon] || '';

    const label = document.createElement('span');
    label.className = 'tnav-menu__label';
    label.textContent = item.label;

    btn.appendChild(icon);
    btn.appendChild(label);

    if (openTabs[item.id] && item.id !== activeId) {
      const dot = document.createElement('span');
      dot.className = 'tnav-menu__dot';
      dot.title = 'Aba aberta';
      btn.appendChild(dot);
    }

    btn.addEventListener('click', function () {
      closeModuleMenu();
      openItemAsTab(item);
    });

    return btn;
  }

  function makeSep() {
    const sep = document.createElement('div');
    sep.className = 'tnav-menu__sep';
    sep.setAttribute('role', 'separator');
    return sep;
  }

  function clearAllTabs() {
    writeTabs([]);
    closeModuleMenu();
    window.location.href = HOME_URL;
  }

  function positionMenu(menu, anchor) {
    if (!menu || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const margin = 8;

    let top = rect.bottom + 6;
    let left = rect.left;

    const mRect = menu.getBoundingClientRect();

    if (left + mRect.width > window.innerWidth - margin) {
      left = window.innerWidth - mRect.width - margin;
    }
    if (left < margin) left = margin;

    if (top + mRect.height > window.innerHeight - margin) {
      const above = rect.top - 6 - mRect.height;
      if (above >= margin) {
        top = above;
      } else {
        top = Math.max(margin, window.innerHeight - mRect.height - margin);
      }
    }

    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
  }

  /* =========================================================
     Dropdown do usuário
     ========================================================= */
  function setupUserDropdown() {
    const btn  = document.getElementById('app-tabs-user-btn');
    const menu = document.getElementById('app-tabs-user-menu');
    if (!btn || !menu) return;

    function position() {
      const rect = btn.getBoundingClientRect();
      const margin = 8;
      const gap = 6;

      let top = rect.bottom + gap;
      let left = rect.right - menu.offsetWidth;

      if (left < margin) left = rect.left;
      if (left < margin) left = margin;

      const menuW = menu.offsetWidth || 0;
      if (left + menuW > window.innerWidth - margin) {
        left = window.innerWidth - menuW - margin;
      }

      const menuH = menu.offsetHeight || 0;
      if (menuH && top + menuH > window.innerHeight - margin) {
        const above = rect.top - gap - menuH;
        if (above >= margin) top = above;
      }

      menu.style.top = top + 'px';
      menu.style.left = left + 'px';
    }

    function open() {
      menu.hidden = false;
      position();
      btn.setAttribute('aria-expanded', 'true');
      const first = menu.querySelector('.app-tabs__user-item');
      if (first) first.focus();
    }
    function close() {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.hidden ? open() : close();
    });

    document.addEventListener('click', function (e) {
      if (menu.hidden) return;
      if (menu.contains(e.target) || btn.contains(e.target)) return;
      close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) {
        close();
        btn.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (!menu.hidden) position();
    });
    window.addEventListener('scroll', function () {
      if (!menu.hidden) position();
    }, true);
  }

  /* =========================================================
     Sincroniza avatar + nome + role
     ========================================================= */
  function syncBarUserInfo() {
    applyBarAvatar();

    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (!raw) return;
      const ctx = JSON.parse(raw);

      const fullName = ctx.name || '';
      const first = String(fullName).trim().split(/\s+/)[0] || '';
      const initial = first.charAt(0).toUpperCase() || '?';

      const nameEl = document.getElementById('user-name-bar');
      const roleEl = document.getElementById('user-role-bar');
      const avatarEl = document.getElementById('user-avatar-bar');

      if (nameEl) nameEl.textContent = fullName || 'Usuário';

      if (roleEl) {
        const roleText = window.Auth && window.Auth.roleLabel
          ? window.Auth.roleLabel(ctx.role || '')
          : (ctx.role || '');
        roleEl.textContent = roleText;
      }

      if (avatarEl && !avatarEl.dataset.avatarUrl) {
        avatarEl.textContent = initial;
      }
    } catch (e) { /* ignora */ }
  }

  function applyBarAvatar() {
    const el = document.getElementById('user-avatar-bar');
    if (!el) return;
    if (el.dataset.avatarUrl) return;

    const cached = readCachedAvatar();
    if (cached) {
      el.style.background = 'none';
      el.innerHTML = '';
      const img = document.createElement('img');
      img.src = cached;
      img.alt = '';
      el.dataset.avatarUrl = cached;
      el.appendChild(img);
    }
  }

  /* =========================================================
     Modal · Acesso negado
     ========================================================= */
  function injectPermissionModal() {
    if (document.getElementById('perm-denied-modal')) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'perm-denied-modal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="modal__backdrop" data-close-perm></div>' +
      '<div class="modal__dialog modal__dialog--sm" role="alertdialog" ' +
           'aria-modal="true" aria-labelledby="perm-denied-title">' +
        '<header class="modal__head">' +
          '<h2 class="modal__title" id="perm-denied-title">Acesso negado</h2>' +
          '<button type="button" class="icon-btn modal__close" ' +
                  'aria-label="Fechar" data-close-perm>' + ICONS.close + '</button>' +
        '</header>' +
        '<div class="modal__body">' +
          '<div class="perm-denied__icon" aria-hidden="true">' + ICONS.lock + '</div>' +
          '<p class="perm-denied__text">' +
            'Você não tem permissão para acessar a tela ' +
            '<strong data-perm-label>—</strong>.' +
          '</p>' +
          '<p class="perm-denied__hint">' +
            'Solicite acesso ao gestor ou administrador da plataforma.' +
          '</p>' +
        '</div>' +
        '<footer class="modal__foot">' +
          '<button type="button" class="btn btn--primary" data-close-perm>Entendi</button>' +
        '</footer>' +
      '</div>';

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-close-perm]').forEach(function (el) {
      el.addEventListener('click', closePermissionModal);
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !modal.hidden) closePermissionModal();
    });
  }

  function showPermissionDenied(label) {
    const modal = document.getElementById('perm-denied-modal');
    if (!modal) return;

    const labelEl = modal.querySelector('[data-perm-label]');
    if (labelEl) labelEl.textContent = '“' + (label || 'essa tela') + '”';

    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    const btn = modal.querySelector('.btn');
    if (btn) btn.focus();
  }

  function closePermissionModal() {
    const modal = document.getElementById('perm-denied-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  /* =========================================================
     Estilos
     ========================================================= */
  function injectStyles() {
    if (document.getElementById('devhub-topnav-styles')) return;

    const css = `
      html.layout-topnav .sidebar,
      html.layout-topnav .sidebar-overlay,
      html.layout-topnav .menu-toggle,
      html.layout-topnav .topbar,
      body.layout-topnav .sidebar,
      body.layout-topnav .sidebar-overlay,
      body.layout-topnav .menu-toggle,
      body.layout-topnav .topbar { display: none !important; }
      html.layout-topnav .app__body,
      body.layout-topnav .app__body { margin-left: 0 !important; }

      .app-tabs {
        display: flex; align-items: stretch;
        height: 56px; min-height: 56px;
        padding: 0 16px;
        background: var(--surface-2);
        border-bottom: 1px solid var(--border);
        position: sticky; top: 0; z-index: 40;
        overflow: hidden;
      }

      .app-tabs__brand {
        display: flex; align-items: center; gap: 10px;
        flex: none; padding-right: 18px; margin-right: 6px;
        border-right: 1px solid var(--border);
        height: 32px; align-self: center;
        user-select: none; text-decoration: none; color: inherit;
        cursor: pointer; transition: opacity var(--transition);
      }
      .app-tabs__brand:hover { opacity: 0.85; }
      .app-tabs__brand:focus-visible {
        outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 8px;
      }
      .app-tabs__brand-mark {
        display: grid; place-items: center;
        width: 32px; height: 32px; border-radius: 9px;
        background: transparent; overflow: hidden; flex: none;
      }
      .app-tabs__brand-mark img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .app-tabs__brand-text {
        font-size: 13px; font-weight: 800; letter-spacing: 0.1em;
        color: var(--text); white-space: nowrap;
      }

      .app-tabs__scroll {
        display: flex; align-items: center; gap: 2px;
        flex: 1 1 auto; min-width: 0;
        overflow-x: auto; overflow-y: hidden;
        scrollbar-width: none; padding: 8px 0;
      }
      .app-tabs__scroll::-webkit-scrollbar { display: none; }

      .app-tabs__empty {
        padding: 0 10px; font-size: 12.5px;
        color: var(--text-muted); font-style: italic;
      }

      .app-tab {
        flex: 0 0 auto;
        display: inline-flex; align-items: center; gap: 8px;
        height: 36px; padding: 0 6px 0 12px;
        border: 1px solid transparent; border-radius: 8px;
        background: transparent; color: var(--text-soft);
        font-size: 12.5px; font-weight: 500;
        cursor: pointer; max-width: 220px; min-width: 0;
        transition: background-color var(--transition), color var(--transition),
                    border-color var(--transition);
        position: relative;
      }
      .app-tab:hover {
        background: var(--surface); color: var(--text); border-color: var(--border);
      }
      .app-tab.is-active {
        background: var(--surface); color: var(--text); border-color: var(--border);
        box-shadow: 0 -2px 0 0 var(--accent) inset;
      }
      .app-tab__icon {
        display: inline-flex; flex: none; width: 14px; height: 14px;
        color: var(--text-muted);
      }
      .app-tab__icon svg { width: 14px; height: 14px; }
      .app-tab.is-active .app-tab__icon { color: var(--accent); }
      .app-tab__label {
        flex: 1 1 auto; min-width: 0;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .app-tab__close {
        flex: none; display: grid; place-items: center;
        width: 20px; height: 20px;
        border: 0; border-radius: 5px;
        background: transparent; color: var(--text-muted);
        cursor: pointer; opacity: 0.55;
        transition: opacity var(--transition), background-color var(--transition),
                    color var(--transition);
      }
      .app-tab__close svg { width: 11px; height: 11px; }
      .app-tab__close:hover {
        opacity: 1; background: var(--danger-soft); color: var(--danger);
      }
      .app-tab.is-active .app-tab__close { opacity: 0.75; }

      .app-tabs__new {
        flex: none; display: grid; place-items: center; align-self: center;
        width: 34px; height: 34px; margin: 0 6px 0 6px;
        border: 1px solid transparent; border-radius: 8px;
        background: transparent; color: var(--text-muted);
        cursor: pointer;
        transition: background-color var(--transition), color var(--transition),
                    border-color var(--transition);
      }
      .app-tabs__new svg { width: 15px; height: 15px; }
      .app-tabs__new:hover,
      .app-tabs__new[aria-expanded="true"] {
        background: var(--surface); border-color: var(--border); color: var(--text);
      }
      .app-tabs__new:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

      .app-tabs__spacer { flex: 0 0 12px; }

      .app-tabs__search {
        position: relative; flex: 0 0 260px;
        display: flex; align-items: center; align-self: center;
        height: 36px; margin: 0 8px;
        background: var(--surface); border: 1px solid var(--border);
        border-radius: 8px;
        transition: border-color var(--transition), box-shadow var(--transition);
      }
      .app-tabs__search:focus-within {
        border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring);
      }
      .app-tabs__search .tnav-search__icon {
        position: absolute; left: 10px;
        display: grid; place-items: center; width: 14px; height: 14px;
        color: var(--text-muted); pointer-events: none;
      }
      .app-tabs__search .tnav-search__icon svg { width: 14px; height: 14px; }
      .app-tabs__search .tnav-search__input {
        width: 100%; height: 100%;
        padding: 0 28px 0 32px;
        border: 0; background: transparent;
        font-size: 12.5px; color: var(--text); outline: none;
        border-radius: 8px;
      }
      .app-tabs__search .tnav-search__input::placeholder { color: var(--text-muted); }
      .app-tabs__search .tnav-search__clear {
        position: absolute; right: 4px;
        display: none; place-items: center;
        width: 22px; height: 22px;
        border: 0; border-radius: 5px;
        background: transparent; color: var(--text-muted);
        cursor: pointer;
      }
      .app-tabs__search .tnav-search__clear:hover {
        background: var(--surface-2); color: var(--text);
      }
      .app-tabs__search .tnav-search__clear svg { width: 12px; height: 12px; }
      .app-tabs__search.has-value .tnav-search__clear { display: grid; }

      .tnav-search__results {
        position: absolute; top: calc(100% + 6px); right: 0;
        min-width: 320px; max-height: 400px; overflow-y: auto;
        padding: 6px;
        border: 1px solid var(--border); border-radius: 10px;
        background: var(--surface);
        box-shadow: 0 10px 30px -8px rgba(16, 24, 40, 0.18);
        z-index: 1000;
      }
      .tnav-search__results[hidden] { display: none !important; }
      .tnav-search__empty {
        padding: 18px 12px; text-align: center;
        font-size: 13px; color: var(--text-muted);
      }
      .tnav-search__item {
        display: flex; align-items: center; gap: 10px;
        padding: 9px 12px; border-radius: 7px;
        color: var(--text); font-size: 13.5px; font-weight: 500;
        text-decoration: none; cursor: pointer;
        transition: background-color var(--transition), color var(--transition);
      }
      .tnav-search__item svg {
        width: 16px; height: 16px; flex: none; color: var(--text-muted);
      }
      .tnav-search__item:hover,
      .tnav-search__item.is-selected {
        background: var(--accent-soft); color: var(--accent-hover);
      }
      .tnav-search__item:hover svg,
      .tnav-search__item.is-selected svg { color: var(--accent); }
      .tnav-search__module {
        margin-left: auto; padding: 2px 8px;
        border-radius: 999px; background: var(--surface-2);
        color: var(--text-muted); font-size: 11px; font-weight: 600;
        letter-spacing: 0.02em; white-space: nowrap;
      }

      .app-tabs__user {
        position: relative; flex: none; align-self: center; margin-left: 8px;
      }
      .app-tabs__user-btn {
        display: inline-flex; align-items: center; gap: 10px;
        height: 42px; padding: 0 12px 0 4px;
        border: 1px solid transparent; border-radius: 10px;
        background: transparent; color: var(--text);
        cursor: pointer; font-family: inherit;
        transition: background-color var(--transition), border-color var(--transition);
      }
      .app-tabs__user-btn:hover,
      .app-tabs__user-btn[aria-expanded="true"] {
        background: var(--surface); border-color: var(--border);
      }
      .app-tabs__user-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

      .app-tabs__user-avatar {
        display: grid; place-items: center;
        width: 32px; height: 32px; flex: none;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
        color: #ffffff; font-size: 12px; font-weight: 700;
        text-transform: uppercase; overflow: hidden;
      }
      .app-tabs__user-avatar img {
        width: 100%; height: 100%; object-fit: cover; display: block;
      }
      .app-tabs__user-info {
        display: flex; flex-direction: column; align-items: flex-start;
        line-height: 1.15; max-width: 140px; min-width: 0;
      }
      .app-tabs__user-name {
        font-size: 12.5px; font-weight: 700; color: var(--text);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
      }
      .app-tabs__user-role {
        font-size: 10.5px; color: var(--text-muted);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
      }
      .app-tabs__user-chevron {
        display: inline-flex; flex: none; width: 14px; height: 14px;
        color: var(--text-muted);
        transition: transform var(--transition);
      }
      .app-tabs__user-chevron svg { width: 14px; height: 14px; }
      .app-tabs__user-btn[aria-expanded="true"] .app-tabs__user-chevron {
        transform: rotate(180deg);
      }

      .app-tabs__user-menu {
        position: fixed; top: 0; left: 0; z-index: 9999;
        min-width: 210px; padding: 6px;
        border: 1px solid var(--border); border-radius: 12px;
        background: var(--surface);
        box-shadow: 0 12px 32px -8px rgba(16, 24, 40, 0.24);
        animation: tnav-pop 140ms ease-out;
      }
      .app-tabs__user-menu[hidden] { display: none !important; }
      .app-tabs__user-item {
        display: flex; align-items: center; gap: 10px;
        width: 100%; padding: 9px 12px;
        border: 0; border-radius: 8px;
        background: transparent; color: var(--text);
        font-size: 13px; font-weight: 500;
        text-align: left; text-decoration: none; cursor: pointer;
        font-family: inherit;
        transition: background-color var(--transition), color var(--transition);
      }
      .app-tabs__user-item svg {
        width: 16px; height: 16px; flex: none; color: var(--text-muted);
      }
      .app-tabs__user-item:hover { background: var(--surface-2); }
      .app-tabs__user-item--danger { color: var(--danger); }
      .app-tabs__user-item--danger svg { color: var(--danger); }
      .app-tabs__user-item--danger:hover { background: var(--danger-soft); }
      .app-tabs__user-sep {
        height: 1px; margin: 4px 6px; background: var(--border);
      }

      .tnav-menu {
        position: fixed; top: 0; left: 0;
        min-width: 280px; max-height: 80vh; overflow-y: auto;
        overscroll-behavior: contain;
        padding: 6px;
        border: 1px solid var(--border); border-radius: 12px;
        background: var(--surface);
        box-shadow: 0 12px 32px -8px rgba(16, 24, 40, 0.24);
        z-index: 9999;
        animation: tnav-pop 140ms ease-out;
      }
      .tnav-menu[hidden] { display: none !important; }
      @keyframes tnav-pop {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .tnav-menu__group {
        padding: 10px 12px 4px;
        font-size: 10.5px; font-weight: 700;
        letter-spacing: 0.08em; text-transform: uppercase;
        color: var(--text-muted);
      }
      .tnav-menu__item {
        display: flex; align-items: center; gap: 10px;
        width: 100%; padding: 9px 12px;
        border: 0; border-radius: 8px;
        background: transparent; color: var(--text);
        font-size: 13.5px; font-weight: 500;
        text-align: left; cursor: pointer; white-space: nowrap;
        transition: background-color var(--transition), color var(--transition);
      }
      .tnav-menu__item--indent { padding-left: 14px; }
      .tnav-menu__item:hover { background: var(--surface-2); }
      .tnav-menu__item.is-active {
        background: var(--accent-soft); color: var(--accent-hover);
      }
      .tnav-menu__item > svg {
        width: 16px; height: 16px; flex: none; color: var(--text-muted);
      }
      .tnav-menu__icon {
        display: inline-flex; flex: none; width: 16px; height: 16px;
        color: var(--text-muted);
      }
      .tnav-menu__icon svg { width: 16px; height: 16px; }
      .tnav-menu__item.is-active .tnav-menu__icon { color: var(--accent); }
      .tnav-menu__label { flex: 1 1 auto; min-width: 0; }
      .tnav-menu__dot {
        flex: none; width: 6px; height: 6px; border-radius: 50%;
        background: var(--accent); opacity: 0.7;
      }
      .tnav-menu__sep {
        height: 1px; margin: 6px 8px; background: var(--border);
      }
      .tnav-menu__item--danger { color: var(--danger); }
      .tnav-menu__item--danger:hover { background: var(--danger-soft); }
      .tnav-menu__item--danger .tnav-menu__icon svg,
      .tnav-menu__item--danger svg { color: var(--danger); }

      .perm-denied__icon {
        display: grid; place-items: center;
        width: 48px; height: 48px; margin: 0 auto 6px;
        border-radius: 12px;
        background: var(--danger-soft); color: var(--danger);
      }
      .perm-denied__icon svg { width: 22px; height: 22px; }
      .perm-denied__text {
        margin: 0; text-align: center;
        font-size: 14.5px; color: var(--text); line-height: 1.55;
      }
      .perm-denied__text strong { color: var(--text); font-weight: 700; }
      .perm-denied__hint {
        margin: 6px 0 0; text-align: center;
        font-size: 13px; color: var(--text-soft); line-height: 1.5;
      }

      [data-theme="dark"] .app-tabs { background: rgba(0, 0, 0, 0.20); }
      [data-theme="dark"] .app-tabs__search { background: rgba(255, 255, 255, 0.03); }

      @media (max-width: 1024px) {
        .app-tabs__brand-text { display: none; }
        .app-tabs__brand { padding-right: 12px; margin-right: 4px; border-right: 0; }
      }
      @media (max-width: 900px) {
        .app-tabs__search { flex: 1 1 auto; min-width: 140px; }
        .app-tabs__user-info { display: none; }
        .app-tabs__user-chevron { display: none; }
        .app-tabs__user-btn { padding: 0 4px 0 2px; height: 38px; }
      }
      @media (max-width: 720px) {
        .app-tabs {
          height: 52px; min-height: 52px;
          padding: 0 8px; gap: 4px;
        }
        .app-tabs__brand { display: none; }
        .app-tab { max-width: 140px; font-size: 12px; height: 32px; }
        .app-tab__label { font-size: 11.5px; }
        .app-tabs__search { flex: 0 0 130px; }
        .app-tabs__new { width: 32px; height: 32px; margin: 0 2px; }
      }
    `;

    const style = document.createElement('style');
    style.id = 'devhub-topnav-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* =========================================================
     Render da barra
     ========================================================= */
  function renderBar() {
    const appBody = document.querySelector('.app__body');
    if (!appBody) return;

    const topbar = appBody.querySelector('.topbar');

    let bar = document.getElementById('app-tabs');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'app-tabs';
      bar.className = 'app-tabs';
      bar.setAttribute('role', 'tablist');
      bar.setAttribute('aria-label', 'Abas abertas');

      if (topbar && topbar.nextSibling) {
        appBody.insertBefore(bar, topbar.nextSibling);
      } else if (topbar) {
        appBody.appendChild(bar);
      } else {
        appBody.insertBefore(bar, appBody.firstChild);
      }
    }

    bar.innerHTML =
      '<a class="app-tabs__brand" href="' + HOME_URL + '" ' +
         'aria-label="Ir para a página inicial" title="Página inicial">' +
        '<span class="app-tabs__brand-mark" aria-hidden="true">' +
          '<img src="' + BRAND_IMAGE + '" alt="" />' +
        '</span>' +
        '<span class="app-tabs__brand-text">DEV HUB</span>' +
      '</a>' +
      '<div class="app-tabs__scroll" id="app-tabs-scroll"></div>' +
      '<button type="button" class="app-tabs__new" id="app-tabs-new" ' +
              'aria-label="Abrir nova aba" aria-expanded="false" title="Abrir nova aba">' +
        ICONS.plus +
      '</button>' +
      '<span class="app-tabs__spacer"></span>' +
      '<div class="app-tabs__search" id="tnav-search">' +
        '<span class="tnav-search__icon">' + ICONS.search + '</span>' +
        '<input type="search" class="tnav-search__input" id="tnav-search-input" ' +
               'placeholder="Buscar… (Ctrl+K)" ' +
               'autocomplete="off" spellcheck="false" ' +
               'aria-label="Buscar opção do menu" ' +
               'aria-autocomplete="list" aria-controls="tnav-search-results" ' +
               'aria-expanded="false" />' +
        '<button type="button" class="tnav-search__clear" id="tnav-search-clear" ' +
                'aria-label="Limpar busca">' + ICONS.close + '</button>' +
        '<div class="tnav-search__results" id="tnav-search-results" role="listbox" hidden></div>' +
      '</div>' +
      '<div class="app-tabs__user" id="app-tabs-user">' +
        '<button type="button" class="app-tabs__user-btn" id="app-tabs-user-btn" ' +
                'aria-haspopup="menu" aria-expanded="false" ' +
                'aria-label="Menu do usuário">' +
          '<span class="app-tabs__user-avatar" id="user-avatar-bar" aria-hidden="true">–</span>' +
          '<span class="app-tabs__user-info">' +
            '<span class="app-tabs__user-name" id="user-name-bar">Carregando…</span>' +
            '<span class="app-tabs__user-role" id="user-role-bar"></span>' +
          '</span>' +
          '<span class="app-tabs__user-chevron" aria-hidden="true">' + ICONS.chevron + '</span>' +
        '</button>' +
        '<div class="app-tabs__user-menu" id="app-tabs-user-menu" role="menu" hidden>' +
          '<a class="app-tabs__user-item" role="menuitem" href="configuracoes.html">' +
            ICONS.configuracoes +
            '<span>Minha Conta</span>' +
          '</a>' +
          '<div class="app-tabs__user-sep" role="separator"></div>' +
          '<button type="button" class="app-tabs__user-item app-tabs__user-item--danger" ' +
                  'role="menuitem" data-action="logout">' +
            ICONS.logout +
            '<span>Sair</span>' +
          '</button>' +
        '</div>' +
      '</div>';

    document.body.classList.add('layout-topnav');

    (function relocateUserMenu() {
      const menu = document.getElementById('app-tabs-user-menu');
      if (menu && menu.parentNode !== document.body) {
        document.body.appendChild(menu);
      }
    })();

    const plusBtn = document.getElementById('app-tabs-new');
    if (plusBtn) {
      plusBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const willOpen = !menuEl || menuEl.hidden;
        plusBtn.setAttribute('aria-expanded', String(willOpen));
        openModuleMenu();
      });
    }

    renderTabs();
    setupSearch();
    setupUserDropdown();
    bindLogout(bar);
    bindLogout(document.body);
    syncBarUserInfo();

    const ctx = readContext();
    document.documentElement.setAttribute(
      'data-role',
      ctx.isPlatform ? 'platform_admin' : (ctx.role || 'guest')
    );
  }

  /* =========================================================
     Busca (command palette)
     ========================================================= */
  const searchState = {
    input: null,
    results: null,
    clear: null,
    wrap: null,
    index: [],
    filtered: [],
    selectedIdx: -1
  };

  function setupSearch() {
    searchState.input = document.getElementById('tnav-search-input');
    searchState.results = document.getElementById('tnav-search-results');
    searchState.clear = document.getElementById('tnav-search-clear');
    searchState.wrap = document.getElementById('tnav-search');

    if (!searchState.input || !searchState.results) return;

    searchState.index = visibleItems().map(function (it) {
      return {
        id: it.id,
        label: it.label,
        href: it.href,
        icon: it.icon,
        module: it.group
      };
    });

    searchState.input.addEventListener('input', onSearchInput);
    searchState.input.addEventListener('focus', onSearchInput);
    searchState.input.addEventListener('keydown', onSearchKeydown);

    if (searchState.clear) {
      searchState.clear.addEventListener('click', function () {
        clearSearch();
        searchState.input.focus();
      });
    }
  }

  function onSearchInput() {
    const q = String(searchState.input.value || '').trim().toLowerCase();

    if (searchState.wrap) {
      searchState.wrap.classList.toggle('has-value', q.length > 0);
    }

    if (!q) { closeResults(); return; }

    const words = q.split(/\s+/).filter(Boolean);

    searchState.filtered = searchState.index.filter(function (item) {
      const haystack = (item.label + ' ' + (item.module || '')).toLowerCase();
      return words.every(function (w) { return haystack.indexOf(w) !== -1; });
    });

    searchState.selectedIdx = searchState.filtered.length > 0 ? 0 : -1;
    renderResults();
  }

  function renderResults() {
    const wrap = searchState.results;
    if (!wrap) return;

    if (searchState.filtered.length === 0) {
      wrap.innerHTML = '<div class="tnav-search__empty">Nenhum resultado encontrado.</div>';
      wrap.hidden = false;
      searchState.input.setAttribute('aria-expanded', 'true');
      return;
    }

    wrap.innerHTML = searchState.filtered.map(function (item, idx) {
      const sel = idx === searchState.selectedIdx ? ' is-selected' : '';
      return (
        '<a class="tnav-search__item' + sel + '" href="' + item.href + '" ' +
           'data-idx="' + idx + '" data-entry-id="' + item.id + '" role="option" ' +
           (sel ? 'aria-selected="true"' : '') + '>' +
          ICONS[item.icon] +
          '<span>' + item.label + '</span>' +
          (item.module ? '<span class="tnav-search__module">' + item.module + '</span>' : '') +
        '</a>'
      );
    }).join('');

    wrap.hidden = false;
    searchState.input.setAttribute('aria-expanded', 'true');

    wrap.querySelectorAll('.tnav-search__item').forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        searchState.selectedIdx = Number(el.dataset.idx);
        updateSelectedHighlight();
      });

      el.addEventListener('click', function (ev) {
        ev.preventDefault();
        const entryId = el.getAttribute('data-entry-id');
        const item = findItemById(entryId);
        if (!item) return;
        clearSearch();
        openItemAsTab(item);
      });
    });
  }

  function updateSelectedHighlight() {
    const wrap = searchState.results;
    if (!wrap) return;
    wrap.querySelectorAll('.tnav-search__item').forEach(function (el, idx) {
      el.classList.toggle('is-selected', idx === searchState.selectedIdx);
      if (idx === searchState.selectedIdx) el.setAttribute('aria-selected', 'true');
      else el.removeAttribute('aria-selected');
    });

    const current = wrap.querySelector('.tnav-search__item.is-selected');
    if (current && current.scrollIntoView) {
      current.scrollIntoView({ block: 'nearest' });
    }
  }

  function onSearchKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeResults();
      searchState.input.blur();
      return;
    }

    if (!searchState.results || searchState.results.hidden) return;

    const len = searchState.filtered.length;
    if (len === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      searchState.selectedIdx = (searchState.selectedIdx + 1) % len;
      updateSelectedHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      searchState.selectedIdx = (searchState.selectedIdx - 1 + len) % len;
      updateSelectedHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = searchState.filtered[searchState.selectedIdx];
      if (item) {
        const found = findItemById(item.id);
        if (found) {
          clearSearch();
          openItemAsTab(found);
        }
      }
    }
  }

  function closeResults() {
    if (searchState.results) searchState.results.hidden = true;
    if (searchState.input) searchState.input.setAttribute('aria-expanded', 'false');
  }

  function clearSearch() {
    if (searchState.input) searchState.input.value = '';
    if (searchState.wrap) searchState.wrap.classList.remove('has-value');
    closeResults();
  }

  /* =========================================================
     Logout
     ========================================================= */
  function bindLogout(scope) {
    scope.querySelectorAll('[data-action="logout"]').forEach(function (btn) {
      if (btn.dataset.logoutBound === '1') return;
      btn.dataset.logoutBound = '1';

      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');

        try { sessionStorage.removeItem(TABS_KEY); } catch (e) { /* ignora */ }

        if (window.Auth && typeof window.Auth.signOut === 'function') {
          window.Auth.signOut();
        } else {
          window.location.href = 'index.html';
        }
      });
    });
  }

  /* =========================================================
     Avatar · helper compartilhado
     ========================================================= */
  function readCachedAvatar() {
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (!raw) return null;
      const ctx = JSON.parse(raw);
      return ctx && ctx.avatar_url ? ctx.avatar_url : null;
    } catch (e) { return null; }
  }

  async function fetchAvatarFromDb() {
    if (!window.db) return null;
    try {
      const { data: sess } = await window.db.auth.getSession();
      const uid = sess && sess.session && sess.session.user && sess.session.user.id;
      if (!uid) return null;

      const { data, error } = await window.db
        .from('profiles').select('avatar_url').eq('id', uid).maybeSingle();
      if (error) return null;
      return data && data.avatar_url ? data.avatar_url : null;
    } catch (e) { return null; }
  }

  let avatarPromise = null;

  async function applyTopbarAvatar() {
    if (avatarPromise) return avatarPromise;

    avatarPromise = (async function () {
      const el = document.getElementById('user-avatar');
      if (!el) return;

      const cached = readCachedAvatar();
      if (cached) { renderTopbarAvatar(cached); return; }

      const url = await fetchAvatarFromDb();
      if (!url) return;

      renderTopbarAvatar(url);

      try {
        const raw = sessionStorage.getItem('devhub_user');
        const ctx = raw ? JSON.parse(raw) : {};
        ctx.avatar_url = url;
        sessionStorage.setItem('devhub_user', JSON.stringify(ctx));
      } catch (e) { /* ignora */ }
    })().catch(function () { return null; });

    return avatarPromise;
  }

  function renderTopbarAvatar(url) {
    const el = document.getElementById('user-avatar');
    if (!el) return;
    if (el.dataset.avatarUrl === (url || '')) return;

    el.innerHTML = '';
    el.dataset.avatarUrl = url || '';

    if (url) {
      el.style.background = 'none';
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.onerror = function () {
        el.innerHTML = '';
        el.style.background = '';
        el.dataset.avatarUrl = '';
      };
      el.appendChild(img);
    } else {
      el.style.background = '';
    }
  }

  function scheduleAvatarRefresh() {
    [0, 100, 300, 800, 1500].forEach(function (ms) {
      setTimeout(function () {
        applyTopbarAvatar();
        applyBarAvatar();
        syncBarUserInfo();
      }, ms);
    });
  }

  /* =========================================================
     Bootstrap
     ========================================================= */
  let rendered = false;

  function renderOnce(force) {
    if (rendered && !force) return;
    rendered = true;
    renderBar();
  }

  function bootstrap() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('blocked')) return;

    injectStyles();
    injectPermissionModal();
    syncCurrentTab();

    if (window.Perms && typeof window.Perms.load === 'function') {
      window.Perms.load().catch(function () { renderOnce(); });
      setTimeout(function () { renderOnce(); }, 1500);
    } else {
      renderOnce();
    }

    scheduleAvatarRefresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  window.addEventListener('load', scheduleAvatarRefresh);

  document.addEventListener('perms:ready', function () {
    renderOnce(true);
  });

  if (window.db && window.db.auth && window.db.auth.onAuthStateChange) {
    window.db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        scheduleAvatarRefresh();
      }
    });
  }

  /* =========================================================
     Listeners globais
     ========================================================= */
  document.addEventListener('click', function (e) {
    if (menuEl && !menuEl.hidden) {
      if (menuEl.contains(e.target)) return;
      if (e.target.closest('#app-tabs-new')) return;

      closeModuleMenu();
      const plusBtn = document.getElementById('app-tabs-new');
      if (plusBtn) plusBtn.setAttribute('aria-expanded', 'false');
    }

    if (!searchState.wrap) return;
    if (searchState.wrap.contains(e.target)) return;
    closeResults();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeModuleMenu();
    closeResults();
  });

  document.addEventListener('keydown', function (e) {
    const isK = String(e.key || '').toLowerCase() === 'k';
    if (!isK) return;
    if (!(e.ctrlKey || e.metaKey)) return;

    const input = document.getElementById('tnav-search-input');
    if (!input) return;

    e.preventDefault();
    input.focus();
    input.select();
  });

  window.addEventListener('scroll', function (e) {
    if (!menuEl || menuEl.hidden) return;
    if (e.target === menuEl || (e.target && menuEl.contains(e.target))) return;
    if (menuHovered) return;

    const plusBtn = document.getElementById('app-tabs-new');
    if (plusBtn) positionMenu(menuEl, plusBtn);
  }, true);

  window.addEventListener('resize', function () {
    if (!menuEl || menuEl.hidden) return;
    const plusBtn = document.getElementById('app-tabs-new');
    if (plusBtn) positionMenu(menuEl, plusBtn);
  });

  /* =========================================================
     API GLOBAL
     ========================================================= */
  window.DHTabs = {
    open: openItemAsTab,
    close: closeTab,
    list: readTabs,
    clear: clearAllTabs,
    sync: syncCurrentTab
  };

  window.DHModules = TOPNAV;
  window.DHItemPerm = ITEM_PERM;
  window.DHHomeUrl = HOME_URL;

})();