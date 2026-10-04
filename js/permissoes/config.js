/* =========================================================
   DEV HUB · Permissões · config
   Catálogos (telas, ações, defaults) + ícones
   Publica em: window.PRM
   ========================================================= */
(function () {
  'use strict';

  const PRM = window.PRM = window.PRM || {};

  /* ---------- Catálogo de telas ---------- */
  PRM.SCREENS = [
    { id: 'dashboard.view',    label: 'Dashboard',          desc: 'Visão geral com KPIs.',        icon: 'grid'   },
    { id: 'sales.view',        label: 'Vendas',             desc: 'Lista e acompanhamento.',      icon: 'chart'  },
    { id: 'notes.view',        label: 'Notas',              desc: 'Documentos internos.',         icon: 'doc'    },
    { id: 'invoices.view',     label: 'Notas fiscais',      desc: 'Emissão e consulta.',          icon: 'doc'    },
    { id: 'customers.view',    label: 'Parceiros',          desc: 'Clientes e fornecedores.',     icon: 'user'   },
    { id: 'products.view',     label: 'Produtos',           desc: 'Catálogo de produtos.',        icon: 'box'    },
    { id: 'stock.view',        label: 'Estoque',            desc: 'Saldos e movimentações.',      icon: 'layers' },
    { id: 'purchases.view',    label: 'Compras',            desc: 'Pedidos e fornecedores.',      icon: 'cart'   },
    { id: 'stock.receive',     label: 'Receber compras',    desc: 'Entrada no estoque.',          icon: 'check'  },
    { id: 'purchases.approve', label: 'Aprovações',         desc: 'Aprovar compras pendentes.',   icon: 'shield' },
    { id: 'finance.view',      label: 'Financeiro',         desc: 'Contas a pagar / receber.',    icon: 'dollar' },
    { id: 'reports.view',      label: 'Relatórios e DRE',   desc: 'Relatórios gerenciais.',       icon: 'chart'  },
    { id: 'management.view',   label: 'Gestão de usuários', desc: 'Criar e editar usuários.',     icon: 'user'   },
    { id: 'management.roles',  label: 'Permissões',         desc: 'Editor de permissões.',        icon: 'lock'   },
  ];

  /* ---------- Catálogo de ações ---------- */
  PRM.ACTIONS = [
    { group: 'Vendas', items: [
      { cap: 'sales.create', label: 'Criar venda' },
      { cap: 'sales.edit',   label: 'Editar venda' },
      { cap: 'sales.delete', label: 'Excluir venda' },
    ]},
    { group: 'Notas', items: [
      { cap: 'notes.print', label: 'Imprimir notas' },
    ]},
    { group: 'Notas fiscais', items: [
      { cap: 'invoices.create', label: 'Emitir NF' },
      { cap: 'invoices.cancel', label: 'Cancelar NF' },
      { cap: 'invoices.delete', label: 'Excluir NF' },
    ]},
    { group: 'Parceiros', items: [
      { cap: 'customers.create', label: 'Criar parceiro' },
      { cap: 'customers.edit',   label: 'Editar parceiro' },
      { cap: 'customers.delete', label: 'Excluir parceiro' },
    ]},
    { group: 'Produtos', items: [
      { cap: 'products.create', label: 'Criar produto' },
      { cap: 'products.edit',   label: 'Editar produto' },
      { cap: 'products.delete', label: 'Excluir produto' },
    ]},
    { group: 'Estoque', items: [
      { cap: 'stock.movement', label: 'Movimentar estoque' },
      { cap: 'stock.audit',    label: 'Auditoria de estoque' },
      { cap: 'stock.report',   label: 'Exportar relatório' },
    ]},
    { group: 'Compras', items: [
      { cap: 'purchases.create',  label: 'Criar compra' },
      { cap: 'purchases.cancel',  label: 'Cancelar compra' },
      { cap: 'purchases.dispute', label: 'Registrar divergência' },
      { cap: 'purchases.return',  label: 'Devolver compra' },
      { cap: 'purchases.reject',  label: 'Rejeitar recebimento' },
    ]},
    { group: 'Financeiro', items: [
      { cap: 'finance.create',    label: 'Criar título' },
      { cap: 'finance.edit',      label: 'Editar título' },
      { cap: 'finance.pay',       label: 'Baixar título' },
      { cap: 'finance.settle',    label: 'Confirmar baixa' },
      { cap: 'finance.reverse',   label: 'Estornar baixa' },
      { cap: 'finance.transfer',  label: 'Transferir saldo' },
      { cap: 'finance.reconcile', label: 'Conciliar extrato' },
      { cap: 'finance.cancel',    label: 'Cancelar título' },
    ]},
    { group: 'Relatórios', items: [
      { cap: 'reports.export', label: 'Exportar CSV' },
    ]},
    { group: 'Gestão', items: [
      { cap: 'management.users', label: 'Gerenciar usuários' },
    ]},
  ];

  PRM.ALL_ACTIONS = PRM.ACTIONS.flatMap((g) => g.items.map((i) => i.cap));
  PRM.ALL_CAPS    = [...PRM.SCREENS.map((s) => s.id), ...PRM.ALL_ACTIONS];

  /* ---------- Defaults por papel base ---------- */
  PRM.DEFAULTS = {
    user: [
      'dashboard.view', 'sales.view', 'sales.create',
      'notes.view', 'notes.print', 'invoices.view',
      'customers.view', 'customers.create', 'customers.edit',
      'products.view', 'stock.view', 'purchases.view',
      'finance.view', 'reports.view',
    ],
    gestor: [
      'dashboard.view',
      'sales.view', 'sales.create', 'sales.edit', 'sales.delete',
      'notes.view', 'notes.print',
      'invoices.view', 'invoices.create', 'invoices.cancel', 'invoices.delete',
      'customers.view', 'customers.create', 'customers.edit', 'customers.delete',
      'products.view', 'products.create', 'products.edit',
      'stock.view', 'stock.movement', 'stock.audit', 'stock.report', 'stock.receive',
      'purchases.view', 'purchases.create', 'purchases.approve',
      'purchases.dispute', 'purchases.return',
      'finance.view', 'finance.create', 'finance.pay', 'finance.edit',
      'finance.settle', 'finance.reverse', 'finance.transfer',
      'reports.view', 'reports.export',
      'management.view', 'management.users',
    ],
    admin: null, // preenchido abaixo
  };
  PRM.DEFAULTS.admin = PRM.ALL_CAPS.slice();

  /* ---------- Ícones SVG ---------- */
  PRM.ICONS = {
        edit:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
    grid:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    chart:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    doc:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/><path d="M14 2.5v5h5"/></svg>',
    user:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    box:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 8-9-5-9 5v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 21v-8"/></svg>',
    layers:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    cart:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h2.3l2.3 11.6a1.8 1.8 0 0 0 1.8 1.4h8.8a1.8 1.8 0 0 0 1.8-1.4L21 7.5H6"/></svg>',
    check:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    shield:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    dollar:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    lock:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    more:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    info:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>',
    chev:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    toastOk:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    toastErr:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>',
    toastInfo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>',
  };
})();