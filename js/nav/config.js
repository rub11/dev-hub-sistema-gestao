/* =========================================================
   DEV HUB · Navegação · config
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV = window.NAV || {};

  NAV.BRAND_IMAGE = 'img/logo.png';
  NAV.HOME_URL = 'welcome.html';
  NAV.DASHBOARD_URL = 'dashboard.html';
  NAV.TABS_KEY = 'devhub_tabs';
  NAV.MAX_TABS = 12;

  NAV.CAPABILITIES = {
    platform_admin: ['platform'],
    admin: ['operations', 'management', 'admin_settings'],
    administrador: ['operations', 'management', 'admin_settings'],
    gestor: ['operations', 'management'],
    manager: ['operations', 'management'],
    user: ['operations'],
    usuario: ['operations'],
    'usuário': ['operations']
  };

  NAV.BASE_CAPS = {
    admin: [
      'dashboard.view',
      'sales.view', 'sales.create', 'sales.edit', 'sales.delete',
      'notes.view', 'notes.create', 'invoices.view',
      'customers.view', 'customers.create', 'customers.edit',
      'products.view', 'products.create', 'products.edit', 'products.delete',
      'stock.view', 'stock.receive', 'stock.movements',
      'reports.view', 'management.view',
      'purchases.view', 'purchases.create', 'purchases.approve', 'purchases.cancel',
      'purchases.receive', 'purchases.dispute', 'purchases.return', 'purchases.reject',
      'finance.view', 'finance.create', 'finance.pay', 'finance.edit',
      'finance.settle', 'finance.reverse', 'finance.transfer', 'finance.reconcile', 'finance.cancel',
      'platform'
    ],
    administrador: [
      'dashboard.view',
      'sales.view', 'sales.create', 'sales.edit', 'sales.delete',
      'notes.view', 'notes.create', 'invoices.view',
      'customers.view', 'customers.create', 'customers.edit',
      'products.view', 'products.create', 'products.edit', 'products.delete',
      'stock.view', 'stock.receive', 'stock.movements',
      'reports.view', 'management.view',
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

  NAV.ROLE_LABELS = {
    platform_admin: 'Administrador da Plataforma',
    admin: 'Administrador',
    administrador: 'Administrador',
    gestor: 'Gestor',
    manager: 'Gestor',
    user: 'Funcionário',
    usuario: 'Funcionário',
    'usuário': 'Funcionário'
  };

  NAV.ITEM_PERM = {
    administracao:       'management.view',
    gestao:              'management.view',
    permissoes:          'management.roles',
    dashboard:           'dashboard.view',
    vendas:              'sales.view',
    notas:               'notes.view',
    'notas-fiscal':      'invoices.view',
    parceiros:           'customers.view',
    clientes:            'customers.view',
    produtos:            'products.view',
    estoque:             'stock.view',
    relatorios:          'reports.view',
    dre:                 'reports.view',
    aprovacoes:          'purchases.approve',
    financeiro:          'finance.view',
    plataforma:          'platform',
    empresas:            'platform',
    'plat-usuarios':     'platform',
    'plat-config':       'platform',
    compras:             'purchases.view',
    'compras-receber':   'stock.receive',
    fornecedores:        'purchases.view',
    'config-pagamentos':   'management.view',
    'config-parcelamento': 'management.view'
  };

  /* ---------- Estrutura do menu ----------
     Gestão NÃO aparece no menu lateral — ela é acessada
     via card dentro de administracao.html.
     O mapeamento de URL continua, pra que a aba "Gestão"
     apareça quando você abrir gestao.html.
  ------------------------------------------ */
  NAV.TOPNAV = [
    { id: 'administracao', label: 'Administração', href: 'administracao.html', icon: 'lock', group: 'Administração', capability: 'management.view' },

    { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: 'dashboard', group: null },
    { id: 'vendas',        label: 'Vendas',        href: 'vendas.html',       icon: 'vendas',       group: 'Comercial' },
    { id: 'notas',         label: 'Notas',         href: 'notas.html',        icon: 'notas',        group: 'Comercial' },
    { id: 'parceiros',     label: 'Parceiros',     href: 'parceiros.html',    icon: 'clientes',     group: 'Comercial' },
    { id: 'produtos',      label: 'Produtos',      href: 'produtos.html',     icon: 'produtos',     group: 'Catálogo' },
    { id: 'estoque',       label: 'Estoque',       href: 'estoque.html',      icon: 'estoque',      group: 'Catálogo' },
    { id: 'compras',         label: 'Compras',         href: 'compras.html',         icon: 'vendas',   group: 'Suprimentos', capability: 'purchases.view' },
    { id: 'compras-receber', label: 'Receber compras', href: 'compras-receber.html', icon: 'estoque',  group: 'Suprimentos', capability: 'stock.receive' },
    { id: 'financeiro',    label: 'Financeiro',    href: 'financeiro.html',   icon: 'finance',      group: 'Financeiro', capability: 'finance.view' },
    { id: 'relatorios',    label: 'Relatórios',    href: 'relatorios.html',   icon: 'relatorios',   group: 'Análise' },
    { id: 'dre',           label: 'DRE',           href: 'relatorios-dre.html', icon: 'dre',        group: 'Análise' },
    { id: 'plataforma',    label: 'Dashboard da plataforma',     href: 'plataforma.html',               icon: 'dashboard',      group: 'Plataforma', capability: 'platform' },
    { id: 'empresas',      label: 'Empresas',                    href: 'plataforma.html#empresas',      icon: 'empresas',       group: 'Plataforma', capability: 'platform' },
    { id: 'plat-usuarios', label: 'Usuários da plataforma',      href: 'plataforma-usuarios.html',      icon: 'usuarios',       group: 'Plataforma', capability: 'platform' },
    { id: 'plat-config',   label: 'Configurações da plataforma', href: 'plataforma-configuracoes.html', icon: 'configuracoes',  group: 'Plataforma', capability: 'platform' }
  ];

  NAV.GROUP_ORDER = ['Comercial', 'Catálogo', 'Suprimentos', 'Financeiro', 'Análise', 'Administração', 'Plataforma'];

  NAV.PAGE_MAP = {
    administracao: 'administracao',
    adm: 'administracao',

    gestao: 'gestao',
    funcionarios: 'gestao',
    aprovacoes: 'aprovacoes',
    permissoes: 'permissoes',
    dashboard: 'dashboard', vendas: 'vendas', notas: 'notas',
    'notas-fiscal': 'notas-fiscal', clientes: 'parceiros',
    parceiros: 'parceiros',
    produtos: 'produtos', estoque: 'estoque', relatorios: 'relatorios',
    'relatorios-dre': 'dre',
    financeiro: 'financeiro', financeiro_novo: 'financeiro',
    'contas-bancarias': 'contas-bancarias',
    configuracoes: 'configuracoes',

    'configuracoes-pagamentos':   'config-pagamentos',
    'configuracoes-parcelamento': 'config-parcelamento',

    'plataforma-configuracoes': 'plat-config',
    'plataforma-usuarios': 'plat-usuarios',
    compras: 'compras',
    'compras-nova': 'compras',
    'compras-receber': 'compras-receber',
    fornecedores: 'fornecedores'
  };

  NAV.ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" /></svg>',
    vendas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2.5 3.5h2.3l2.3 11.6a1.8 1.8 0 0 0 1.8 1.4h8.8a1.8 1.8 0 0 0 1.8-1.4L21 7.5H6" /></svg>',
    notas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z" /><path d="M14 2.5v5h5" /><path d="M9 13h6M9 17h4" /></svg>',
    'notas-fiscal': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z" /><path d="M14 2.5v5h5" /><path d="M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" /></svg>',
    clientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7.5" r="3.5" /><path d="M22 20v-1.5a4 4 0 0 0-3-3.87" /><path d="M16.5 4.13a4 4 0 0 1 0 7.75" /></svg>',
    produtos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 8-9-5-9 5v8l9 5 9-5z" /><path d="m3 8 9 5 9-5" /><path d="M12 21v-8" /></svg>',
    estoque: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 2.5 9 5-9 5-9-5z" /><path d="m3 12.5 9 5 9-5" /><path d="m3 17.5 9 5 9-5" /></svg>',
    relatorios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m7 15 3.5-4 3 2.5L20 7" /></svg>',
    dre: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16V10"/><path d="M12 16V6"/><path d="M16 16v-4"/></svg>',
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
    finance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M2.5 10h19"/><circle cx="17" cy="14" r="1"/></svg>',
    payment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>'
  };

  NAV.findItemById = function (id) {
    for (let i = 0; i < NAV.TOPNAV.length; i += 1) {
      if (NAV.TOPNAV[i].id === id) return NAV.TOPNAV[i];
    }
    return null;
  };

  NAV.currentPageId = function () {
    const path = (window.location.pathname || '').split('/').pop() || 'index.html';
    const file = path.replace(/\.html?$/i, '').toLowerCase();
    const hash = String(window.location.hash || '').toLowerCase();

    if (file === 'plataforma') return hash === '#empresas' ? 'empresas' : 'plataforma';

    return NAV.PAGE_MAP[file] || file;
  };
})();