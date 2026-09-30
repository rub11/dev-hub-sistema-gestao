/* =========================================================
   DEV HUB · Navegação em ABAS (estilo navegador)
   ---------------------------------------------------------
   - UMA única barra: abas + botão "+" + busca + sino + usuário
   - Topbar antigo é ESCONDIDO (a barra de abas vira header)
   - Botão "+" abre dropdown com todos os módulos
   - Abas podem ser fechadas (× ou clique do meio)
   - Guard de permissão: modal "Acesso negado"
   - Ao fechar a última aba → welcome.html
   - Sino de notificações em tempo real
   ---------------------------------------------------------
   CORREÇÕES NESTA VERSÃO:
   1-14. (mesmas das versões anteriores)
   15. ** NOVO ** "Marcar todas como lidas" com verificação real:
       - Uso `.select('id')` no UPDATE para contar linhas afetadas
       - Detecta automaticamente o nome da coluna (read_at / is_read / lida)
       - Toast visual de sucesso/erro
       - Console mostra o erro cru para diagnóstico
   ========================================================= */

(function () {
  'use strict';

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
    dashboard:           'dashboard.view',
    vendas:              'sales.view',
    notas:               'notes.view',
    'notas-fiscal':      'invoices.view',
    parceiros:           'customers.view',
    clientes:            'customers.view',
    produtos:            'products.view',
    estoque:             'stock.view',
    relatorios:          'reports.view',
    gestao:              'management.view',
    aprovacoes:          'purchases.approve',
    financeiro:          'finance.view',
    'contas-bancarias':  'finance.view',
    plataforma:          'platform',
    empresas:            'platform',
    'plat-usuarios':     'platform',
    'plat-config':       'platform',
    compras:             'purchases.view',
    'compras-receber':   'stock.receive',
    fornecedores:        'purchases.view'
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
     ========================================================= */
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
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    configuracoes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></svg>',
    empresas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18" /><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" /><path d="M15 21V9h4a2 2 0 0 1 2 2v10" /><path d="M9 7h2M9 11h2M9 15h2" /></svg>',
    usuarios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7.5" r="3.5" /><path d="M22 20v-1.5a4 4 0 0 0-3-3.87" /></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    finance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M2.5 10h19"/><circle cx="17" cy="14" r="1"/></svg>'
  };

  /* =========================================================
     Estrutura de módulos
     ========================================================= */
  const TOPNAV = [
    { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: 'dashboard', group: null },
    { id: 'vendas',        label: 'Vendas',        href: 'vendas.html',       icon: 'vendas',       group: 'Comercial' },
    { id: 'notas',         label: 'Notas',         href: 'notas.html',        icon: 'notas',        group: 'Comercial' },
    { id: 'notas-fiscal',  label: 'Notas fiscais', href: 'notas-fiscal.html', icon: 'notas-fiscal', group: 'Comercial' },
    { id: 'parceiros',     label: 'Parceiros',     href: 'parceiros.html',    icon: 'clientes',     group: 'Comercial' },
    { id: 'produtos',      label: 'Produtos',      href: 'produtos.html',     icon: 'produtos',     group: 'Catálogo' },
    { id: 'estoque',       label: 'Estoque',       href: 'estoque.html',      icon: 'estoque',      group: 'Catálogo' },
    { id: 'compras',         label: 'Compras',         href: 'compras.html',         icon: 'vendas',   group: 'Suprimentos', capability: 'purchases.view' },
    { id: 'compras-receber', label: 'Receber compras', href: 'compras-receber.html', icon: 'estoque',  group: 'Suprimentos', capability: 'stock.receive' },
    { id: 'financeiro',       label: 'Movimentação financeira', href: 'financeiro.html',        icon: 'finance', group: 'Financeiro', capability: 'finance.view' },
    { id: 'contas-bancarias', label: 'Contas bancárias',        href: 'contas-bancarias.html',  icon: 'finance', group: 'Financeiro', capability: 'finance.view' },
    { id: 'relatorios',    label: 'Relatórios',    href: 'relatorios.html',   icon: 'relatorios',   group: 'Análise' },
    { id: 'aprovacoes',    label: 'Aprovações',    href: 'aprovacoes.html',   icon: 'check',        group: 'Administração', capability: 'purchases.approve' },
    { id: 'gestao',        label: 'Gestão de usuários', href: 'gestao.html',  icon: 'gestao',       group: 'Administração', capability: 'management' },
    { id: 'plataforma',    label: 'Dashboard da plataforma',     href: 'plataforma.html',               icon: 'dashboard',      group: 'Plataforma', capability: 'platform' },
    { id: 'empresas',      label: 'Empresas',                    href: 'plataforma.html#empresas',      icon: 'empresas',       group: 'Plataforma', capability: 'platform' },
    { id: 'plat-usuarios', label: 'Usuários da plataforma',      href: 'plataforma-usuarios.html',      icon: 'usuarios',       group: 'Plataforma', capability: 'platform' },
    { id: 'plat-config',   label: 'Configurações da plataforma', href: 'plataforma-configuracoes.html', icon: 'configuracoes',  group: 'Plataforma', capability: 'platform' }
  ];

  const GROUP_ORDER = ['Comercial', 'Catálogo', 'Suprimentos', 'Financeiro', 'Análise', 'Administração', 'Plataforma'];

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
      'notas-fiscal': 'notas-fiscal', clientes: 'parceiros',
      parceiros: 'parceiros',
      produtos: 'produtos', estoque: 'estoque', relatorios: 'relatorios',
      gestao: 'gestao', funcionarios: 'gestao', aprovacoes: 'aprovacoes',
      financeiro: 'financeiro', financeiro_novo: 'financeiro',
      'contas-bancarias': 'contas-bancarias',
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

    tabs.push({ id: item.id, label: item.label, href: item.href, icon: item.icon });
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
      tabs.push({ id: item.id, label: item.label, href: item.href, icon: item.icon });
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
    if (menuEl && !menuEl.hidden) { closeModuleMenu(); return; }

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

  function closeModuleMenu() { if (menuEl) menuEl.hidden = true; }

  function wireMenuPointerGuards(menu) {
    menu.addEventListener('mouseenter', function () { menuHovered = true; });
    menu.addEventListener('mouseleave', function () { menuHovered = false; });
    menu.addEventListener('scroll', function (e) { e.stopPropagation(); }, true);
    menu.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    menu.addEventListener('click', function (e) { e.stopPropagation(); });
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
      const groupItems = items.filter(function (i) { return i.group === groupName; });
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
      if (e.key === 'Escape' && !menu.hidden) { close(); btn.focus(); }
    });

    window.addEventListener('resize', function () { if (!menu.hidden) position(); });
    window.addEventListener('scroll', function () { if (!menu.hidden) position(); }, true);
  }

  /* =========================================================
     Sino de notificações (tempo real)
     ---------------------------------------------------------
     "Marcar todas como lidas" — versão robusta:
       1. RPC mark_all_notifications_read
       2. Fallback: UPDATE com .select('id') para contar linhas
       3. Se 0 linhas e houver pendentes → detecta RLS silencioso
       4. Detecta automaticamente o nome da coluna (read_at / is_read / lida)
       5. Toast visual + log no console
     ========================================================= */
  function setupNotifications() {
    const btn   = document.getElementById('app-tabs-bell');
    const badge = document.getElementById('app-tabs-bell-badge');
    if (!btn) return;

    let menu = null;
    let unread = 0;
    let readColumn = null; /* detectado dinamicamente */

    /* -------------------- Toast local -------------------- */
    function navToast(msg, kind) {
      try {
        if (window.Toast && typeof window.Toast.show === 'function') {
          return window.Toast.show(msg, kind);
        }
      } catch (_) { /* ignora */ }

      const el = document.createElement('div');
      const isErr = kind === 'error';
      el.style.cssText =
        'position:fixed;top:80px;right:20px;z-index:99999;max-width:360px;' +
        'padding:12px 16px;border-radius:10px;font-size:13.5px;font-family:inherit;' +
        'box-shadow:0 12px 32px -8px rgba(16,24,40,.24);' +
        'background:' + (isErr ? 'var(--danger-soft, #fef3f2)' : 'var(--accent-soft, #eef2ff)') + ';' +
        'color:' + (isErr ? 'var(--danger, #b42318)' : 'var(--accent-hover, #4338ca)') + ';' +
        'border:1px solid ' + (isErr ? 'var(--danger-border, #fecdca)' : 'transparent') + ';';
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4200);
    }

    /* -------------------- Badge -------------------- */
    function renderBadge() {
      if (!badge) return;
      if (unread > 0) {
        badge.hidden = false;
        badge.textContent = unread > 99 ? '99+' : String(unread);
      } else {
        badge.hidden = true;
      }
    }

    /* -------------------- Detecta coluna de status -------------------- */
    async function detectReadColumn() {
      if (readColumn) return readColumn;

      const candidates = ['read_at', 'is_read', 'lida', 'read', 'readed'];
      for (const col of candidates) {
        try {
          const { error } = await window.db
            .from('notifications')
            .select('id, ' + col)
            .limit(1);
          if (!error) {
            readColumn = col;
            console.log('[nav] Coluna de status detectada:', col);
            return col;
          }
        } catch (_) { /* tenta próximo */ }
      }

      /* Se nada funcionou, cai no default */
      readColumn = 'read_at';
      console.warn('[nav] Nenhuma coluna de status reconhecida. Usando "read_at" como padrão.');
      return readColumn;
    }

    /* -------------------- Contador -------------------- */
    async function loadCount() {
      if (!window.db) return;

      /* Tenta RPC primeiro */
      try {
        const { data, error } = await window.db.rpc('get_unread_notification_count');
        if (!error && typeof data === 'number') {
          unread = data;
          renderBadge();
          return;
        }
      } catch (_) { /* fallback */ }

      /* Fallback: count direto */
      try {
        const col = await detectReadColumn();
        const isBool = col === 'is_read' || col === 'lida' || col === 'read' || col === 'readed';

        const query = window.db
          .from('notifications')
          .select('id', { count: 'exact', head: true });

        const { count, error } = isBool
          ? await query.or(`${col}.is.null,${col}.eq.false`)
          : await query.is(col, null);

        if (!error) {
          unread = count || 0;
          renderBadge();
        }
      } catch (e) {
        console.warn('[nav] loadCount fallback falhou:', e);
      }
    }

    /* -------------------- Lista -------------------- */
    async function loadLatest() {
      if (!window.db) return [];
      try {
        const col = await detectReadColumn();
        const { data, error } = await window.db
          .from('notifications')
          .select('id, title, message, kind, entity_type, entity_id, link, ' + col + ', created_at')
          .order('created_at', { ascending: false })
          .limit(8);

        if (error) throw error;

        /* Normaliza: adiciona read_at virtual */
        return (data || []).map((n) => {
          const raw = n[col];
          const isRead = col === 'read_at'
            ? !!raw
            : (raw === true);
          return Object.assign({}, n, { __read: isRead });
        });
      } catch (e) {
        console.warn('[nav] loadLatest:', e);
        return [];
      }
    }

    function escapeHtml(s) {
      return String(s || '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[ch]));
    }

    function formatRelative(iso) {
      if (!iso) return '';
      const diff = (Date.now() - new Date(iso).getTime()) / 1000;
      if (diff < 60)     return 'agora';
      if (diff < 3600)   return Math.floor(diff / 60) + ' min';
      if (diff < 86400)  return Math.floor(diff / 3600) + ' h';
      if (diff < 604800) return Math.floor(diff / 86400) + ' d';
      return new Date(iso).toLocaleDateString('pt-BR');
    }

    function resolveNotifLink(n) {
      if (n.link && n.link !== '#') return n.link;

      const type = String(n.entity_type || '').toLowerCase();
      const id   = n.entity_id;

      switch (type) {
        case 'product':       return id ? ('produtos.html?id=' + encodeURIComponent(id)) : 'produtos.html';
        case 'stock_movement':return 'estoque.html';
        case 'purchase':
          if (String(n.title || '').toLowerCase().indexOf('aprov') !== -1) return 'aprovacoes.html';
          return id ? ('compras.html?id=' + encodeURIComponent(id)) : 'compras.html';
        case 'sale':          return id ? ('vendas.html?id=' + encodeURIComponent(id)) : 'vendas.html';
        case 'customer':      return id ? ('parceiros.html?id=' + encodeURIComponent(id)) : 'parceiros.html';
        case 'supplier':      return 'parceiros.html?kind=supplier';
        case 'financial_entry':
        case 'finance':
        case 'financial_movement':
        case 'financial_account':
        case 'financial_transfer':
          return 'financeiro.html';
        default: return '#';
      }
    }

    /* -------------------- MARK ALL — com verificação real -------------------- */
    async function markAllAsRead() {
      const now = new Date().toISOString();
      const col = await detectReadColumn();

      /* Passo 1: RPC (se existir) */
      try {
        const { error } = await window.db.rpc('mark_all_notifications_read');
        if (!error) {
          console.log('[nav] mark-all via RPC: OK');
          return { method: 'rpc' };
        }
        console.warn('[nav] RPC mark_all indisponível:', error.message);
      } catch (rpcErr) {
        console.warn('[nav] RPC mark_all indisponível:', rpcErr.message || rpcErr);
      }

      /* Passo 2: UPDATE direto com verificação de linhas afetadas */
      const isBool = col === 'is_read' || col === 'lida' || col === 'read' || col === 'readed';
      const patch = {};
      patch[col] = isBool ? true : now;

      const query = window.db.from('notifications').update(patch);

      const { data, error } = isBool
        ? await query.or(`${col}.is.null,${col}.eq.false`).select('id')
        : await query.is(col, null).select('id');

      if (error) {
        console.error('[nav] UPDATE falhou:', error);
        throw new Error('Falha no UPDATE: ' + error.message);
      }

      const updated = (data || []).length;
      console.log('[nav] mark-all via UPDATE —', updated, 'linhas afetadas (coluna:', col + ')');

      /* Passo 3: se 0 linhas foram afetadas, pode ser RLS silencioso */
      if (updated === 0) {
        /* Confere se realmente não havia nada para atualizar */
        const checkQuery = window.db
          .from('notifications')
          .select('id', { count: 'exact', head: true });

        const { count: pendingCount, error: checkErr } = isBool
          ? await checkQuery.or(`${col}.is.null,${col}.eq.false`)
          : await checkQuery.is(col, null);

        if (!checkErr && pendingCount > 0) {
          throw new Error(
            `RLS bloqueou o UPDATE. ${pendingCount} notificações pendentes no banco mas 0 foram atualizadas. ` +
            `Rode no Supabase: ALTER TABLE notifications ENABLE ROW LEVEL SECURITY; ` +
            `CREATE POLICY "update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);`
          );
        }
      }

      return { method: 'update', column: col, updated };
    }

    /* -------------------- Menu -------------------- */
    function buildMenu() {
      const el = document.createElement('div');
      el.className = 'tnav-notif';
      el.setAttribute('role', 'menu');
      el.hidden = true;

      el.innerHTML = `
        <header class="tnav-notif__head">
          <span>Notificações</span>
          <button type="button" class="tnav-notif__mark" data-action="mark-all">
            Marcar todas como lidas
          </button>
        </header>
        <div class="tnav-notif__list" id="tnav-notif-list">
          <div class="tnav-notif__loading">Carregando...</div>
        </div>
        <footer class="tnav-notif__foot">
          <a href="aprovacoes.html" class="tnav-notif__see-all">
            Ver aprovações pendentes
          </a>
        </footer>
      `;

      document.addEventListener('click', (e) => {
        if (el.hidden) return;
        if (el.contains(e.target) || btn.contains(e.target)) return;
        closeMenu();
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !el.hidden) closeMenu();
      });

      /* ---------- HANDLER: MARK ALL ---------- */
      el.addEventListener('click', async (e) => {
        const markAll = e.target.closest('[data-action="mark-all"]');
        if (!markAll) return;
        e.preventDefault();
        if (markAll.disabled) return;

        markAll.disabled = true;
        const originalLabel = markAll.textContent;
        markAll.textContent = 'Marcando…';

        try {
          const result = await markAllAsRead();

          /* Atualiza UI */
          unread = 0;
          renderBadge();

          const rows = await loadLatest();
          renderList(el, rows);
          await loadCount();

          if (result.method === 'rpc') {
            navToast('Notificações marcadas como lidas.', 'success');
          } else {
            navToast(
              `Notificações marcadas como lidas (${result.updated} atualizadas).`,
              'success'
            );
          }
        } catch (err) {
          console.error('[nav] mark-all falhou:', err);
          navToast('Não foi possível marcar como lidas: ' + (err.message || 'erro'), 'error');

          /* Reverte a UI para o estado real do banco */
          try {
            const rows = await loadLatest();
            renderList(el, rows);
            await loadCount();
          } catch (_) { /* ignora */ }
        } finally {
          markAll.disabled = false;
          markAll.textContent = originalLabel;
        }
      });

      return el;
    }

    function positionNotifMenu(m, anchor) {
      const rect = anchor.getBoundingClientRect();
      const margin = 8;
      const gap = 6;
      const w = Math.min(380, window.innerWidth - 16);

      let left = rect.right - w;
      if (left < margin) left = margin;

      let top = rect.bottom + gap;
      const h = m.offsetHeight || 400;
      if (top + h > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - h - margin);
      }

      m.style.top = top + 'px';
      m.style.left = left + 'px';
      m.style.width = w + 'px';
    }

    function renderList(m, rows) {
      const list = m.querySelector('#tnav-notif-list');
      if (!list) return;

      if (!rows || rows.length === 0) {
        list.innerHTML = `
          <div class="tnav-notif__empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>
            <span>Nenhuma notificação nova</span>
          </div>`;
        return;
      }

      list.innerHTML = rows.map((n) => {
        const href = resolveNotifLink(n);
        return `
          <a class="tnav-notif__item ${n.__read ? '' : 'is-unread'}"
             href="${href}"
             data-id="${n.id}">
            <span class="tnav-notif__dot" data-kind="${n.kind || 'info'}"></span>
            <span class="tnav-notif__body">
              <strong class="tnav-notif__title">${escapeHtml(n.title || 'Notificação')}</strong>
              ${n.message ? `<span class="tnav-notif__msg">${escapeHtml(n.message)}</span>` : ''}
              <span class="tnav-notif__time">${formatRelative(n.created_at)}</span>
            </span>
          </a>
        `;
      }).join('');

      list.querySelectorAll('.tnav-notif__item').forEach((item) => {
        item.addEventListener('click', async (e) => {
          const id = item.dataset.id;
          if (!id) return;

          if (item.classList.contains('is-unread')) {
            try {
              const col = await detectReadColumn();
              const isBool = col === 'is_read' || col === 'lida' || col === 'read' || col === 'readed';
              const patch = {};
              patch[col] = isBool ? true : new Date().toISOString();

              /* Tenta RPC primeiro */
              let ok = false;
              try {
                const { error } = await window.db.rpc('mark_notification_read', { p_id: id });
                if (!error) ok = true;
              } catch (_) { /* fallback */ }

              if (!ok) {
                await window.db.from('notifications').update(patch).eq('id', id);
              }

              item.classList.remove('is-unread');
              unread = Math.max(0, unread - 1);
              renderBadge();
            } catch (err) {
              console.warn('[nav] mark-notif:', err);
            }
          }

          if (item.getAttribute('href') === '#') {
            e.preventDefault();
            return;
          }

          setTimeout(closeMenu, 100);
        });
      });
    }

    async function openMenu() {
      if (!menu) {
        menu = buildMenu();
        document.body.appendChild(menu);
      }
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      positionNotifMenu(menu, btn);

      const rows = await loadLatest();
      renderList(menu, rows);
      positionNotifMenu(menu, btn);
    }

    function closeMenu() {
      if (menu) menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu && !menu.hidden ? closeMenu() : openMenu();
    });

    window.addEventListener('resize', () => {
      if (menu && !menu.hidden) positionNotifMenu(menu, btn);
    });
    window.addEventListener('scroll', () => {
      if (menu && !menu.hidden) positionNotifMenu(menu, btn);
    }, true);

    loadCount();

    /* Realtime */
    try {
      if (window.db && window.db.channel) {
        window.db
          .channel('notifications-nav')
          .on('postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'notifications' },
              () => {
                loadCount();
                if (menu && !menu.hidden) {
                  loadLatest().then((rows) => renderList(menu, rows));
                }
              })
          .on('postgres_changes',
              { event: 'UPDATE', schema: 'public', table: 'notifications' },
              () => { loadCount(); })
          .subscribe();
      }
    } catch (e) {
      console.warn('[nav] realtime indisponível:', e);
    }
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
     Estilos (mesmo do arquivo anterior — omitidos por brevidade,
     copie o bloco CSS completo do arquivo anterior)
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
      .app-tab:hover { background: var(--surface); color: var(--text); border-color: var(--border); }
      .app-tab.is-active {
        background: var(--surface); color: var(--text); border-color: var(--border);
        box-shadow: 0 -2px 0 0 var(--accent) inset;
      }
      .app-tab__icon { display: inline-flex; flex: none; width: 14px; height: 14px; color: var(--text-muted); }
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
        transition: opacity var(--transition), background-color var(--transition), color var(--transition);
      }
      .app-tab__close svg { width: 11px; height: 11px; }
      .app-tab__close:hover { opacity: 1; background: var(--danger-soft); color: var(--danger); }
      .app-tab.is-active .app-tab__close { opacity: 0.75; }

      .app-tabs__new {
        flex: none; display: grid; place-items: center; align-self: center;
        width: 34px; height: 34px; margin: 0 6px 0 6px;
        border: 1px solid transparent; border-radius: 8px;
        background: transparent; color: var(--text-muted);
        cursor: pointer;
        transition: background-color var(--transition), color var(--transition), border-color var(--transition);
      }
      .app-tabs__new svg { width: 15px; height: 15px; }
      .app-tabs__new:hover,
      .app-tabs__new[aria-expanded="true"] {
        background: var(--surface); border-color: var(--border); color: var(--text);
      }
      .app-tabs__new:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

      .app-tabs__spacer { flex: 0 0 12px; }

      .app-tabs__bell {
        position: relative; flex: none; align-self: center;
        display: grid; place-items: center;
        width: 36px; height: 36px; margin: 0 4px;
        border: 1px solid transparent; border-radius: 9px;
        background: transparent; color: var(--text-muted);
        cursor: pointer;
        transition: background-color var(--transition), color var(--transition), border-color var(--transition);
      }
      .app-tabs__bell:hover,
      .app-tabs__bell[aria-expanded="true"] {
        background: var(--surface); border-color: var(--border); color: var(--text);
      }
      .app-tabs__bell:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      .app-tabs__bell svg { width: 17px; height: 17px; }

      .app-tabs__bell-badge {
        position: absolute; top: -2px; right: -2px;
        min-width: 16px; height: 16px; padding: 0 4px;
        border-radius: 999px; background: var(--danger); color: #fff;
        font-size: 10px; font-weight: 700; line-height: 16px; text-align: center;
        box-shadow: 0 0 0 2px var(--surface-2);
      }

      .tnav-notif {
        position: fixed; top: 0; left: 0;
        max-height: 520px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 20px 40px -12px rgba(16, 24, 40, 0.24);
        z-index: 9999;
        overflow: hidden;
        display: flex; flex-direction: column;
        animation: tnav-pop 140ms ease-out;
      }
      .tnav-notif[hidden] { display: none !important; }

      .tnav-notif__head {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; padding: 12px 14px;
        border-bottom: 1px solid var(--border);
        font-size: 13px; font-weight: 700; color: var(--text);
      }
      .tnav-notif__mark {
        border: 0; background: transparent;
        color: var(--accent); font-family: inherit;
        font-size: 11.5px; font-weight: 600;
        cursor: pointer; padding: 4px 6px; border-radius: 6px;
      }
      .tnav-notif__mark:hover { background: var(--accent-soft); }
      .tnav-notif__mark:disabled { opacity: .6; cursor: progress; }

      .tnav-notif__list { flex: 1 1 auto; overflow-y: auto; max-height: 380px; }

      .tnav-notif__item {
        display: flex; gap: 10px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--border);
        text-decoration: none; color: inherit;
        transition: background-color 140ms ease;
      }
      .tnav-notif__item:hover { background: var(--surface-2); }
      .tnav-notif__item.is-unread { background: var(--accent-soft); }
      .tnav-notif__item:last-child { border-bottom: 0; }

      .tnav-notif__dot {
        flex: none; width: 8px; height: 8px; margin-top: 5px;
        border-radius: 50%; background: var(--text-muted);
      }
      .tnav-notif__dot[data-kind="success"] { background: #10b981; }
      .tnav-notif__dot[data-kind="warn"]    { background: #f59e0b; }
      .tnav-notif__dot[data-kind="danger"]  { background: #dc2626; }
      .tnav-notif__dot[data-kind="info"]    { background: var(--accent); }

      .tnav-notif__body {
        display: flex; flex-direction: column; gap: 3px;
        min-width: 0; flex: 1 1 auto;
      }
      .tnav-notif__title {
        font-size: 13px; font-weight: 600;
        color: var(--text); line-height: 1.35;
      }
      .tnav-notif__msg {
        font-size: 12.5px; color: var(--text-soft); line-height: 1.4;
        overflow: hidden; display: -webkit-box;
        -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      }
      .tnav-notif__time {
        font-size: 11px; color: var(--text-muted); margin-top: 2px;
      }

      .tnav-notif__empty {
        display: flex; flex-direction: column; align-items: center;
        gap: 8px; padding: 40px 20px;
        color: var(--text-muted); font-size: 13px;
      }
      .tnav-notif__empty svg { width: 28px; height: 28px; color: var(--border-strong); }

      .tnav-notif__loading {
        padding: 24px 14px; text-align: center;
        font-size: 13px; color: var(--text-muted);
      }

      .tnav-notif__foot {
        padding: 10px 14px;
        border-top: 1px solid var(--border);
        background: var(--surface-2);
        text-align: center;
      }
      .tnav-notif__see-all {
        font-size: 12.5px; font-weight: 600;
        color: var(--accent); text-decoration: none;
      }
      .tnav-notif__see-all:hover { text-decoration: underline; }

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

      .app-tabs__user { position: relative; flex: none; align-self: center; margin-left: 8px; }
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
      .app-tabs__user-sep { height: 1px; margin: 4px 6px; background: var(--border); }

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
      .tnav-menu__sep { height: 1px; margin: 6px 8px; background: var(--border); }
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
        .app-tabs { height: 52px; min-height: 52px; padding: 0 8px; gap: 4px; }
        .app-tabs__brand { display: none; }
        .app-tab { max-width: 140px; font-size: 12px; height: 32px; }
        .app-tab__label { font-size: 11.5px; }
        .app-tabs__search { flex: 0 0 130px; }
        .app-tabs__new { width: 32px; height: 32px; margin: 0 2px; }
        .app-tabs__bell { width: 32px; height: 32px; margin: 0 2px; }
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
      '<button type="button" class="app-tabs__bell" id="app-tabs-bell" ' +
              'aria-label="Notificações" aria-expanded="false">' +
        ICONS.bell +
        '<span class="app-tabs__bell-badge" id="app-tabs-bell-badge" hidden>0</span>' +
      '</button>' +
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
    setupNotifications();
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
    input: null, results: null, clear: null, wrap: null,
    index: [], filtered: [], selectedIdx: -1
  };

  function setupSearch() {
    searchState.input = document.getElementById('tnav-search-input');
    searchState.results = document.getElementById('tnav-search-results');
    searchState.clear = document.getElementById('tnav-search-clear');
    searchState.wrap = document.getElementById('tnav-search');

    if (!searchState.input || !searchState.results) return;

    searchState.index = visibleItems().map(function (it) {
      return {
        id: it.id, label: it.label, href: it.href, icon: it.icon, module: it.group
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

    if (searchState.wrap) searchState.wrap.classList.toggle('has-value', q.length > 0);

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
    if (current && current.scrollIntoView) current.scrollIntoView({ block: 'nearest' });
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
        if (found) { clearSearch(); openItemAsTab(found); }
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