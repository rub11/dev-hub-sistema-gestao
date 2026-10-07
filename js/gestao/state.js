/* =========================================================
   DEV HUB · Gestão · estado compartilhado
   ========================================================= */
(function () {
  'use strict';

  window.Gestao = window.Gestao || {};

  Gestao.HIDDEN_SELF_EMAIL = 'juliodasilva0101@gmail.com';
  Gestao.ROLE_ADMIN   = ['admin', 'administrador'];
  Gestao.ROLE_MANAGER = ['gestor', 'manager'];

  Gestao.PERM_GROUPS = [
    { title: 'Geral', caps: [
      ['dashboard.view', 'Ver dashboard']
    ]},
    { title: 'Vendas', caps: [
      ['sales.view',   'Ver vendas'],
      ['sales.create', 'Criar venda'],
      ['sales.edit',   'Editar venda'],
      ['sales.delete', 'Excluir venda']
    ]},
    { title: 'Notas', caps: [
      ['notes.view',  'Ver notas'],
      ['notes.print', 'Imprimir notas']
    ]},
    { title: 'Notas fiscais', caps: [
      ['invoices.view',   'Ver notas fiscais'],
      ['invoices.create', 'Emitir nota fiscal'],
      ['invoices.cancel', 'Cancelar nota fiscal'],
      ['invoices.delete', 'Excluir nota fiscal']
    ]},
    { title: 'Clientes', caps: [
      ['customers.view',   'Ver clientes'],
      ['customers.create', 'Criar cliente'],
      ['customers.edit',   'Editar cliente'],
      ['customers.delete', 'Excluir cliente']
    ]},
    { title: 'Produtos', caps: [
      ['products.view',   'Ver produtos'],
      ['products.create', 'Criar produto'],
      ['products.edit',   'Editar produto'],
      ['products.delete', 'Excluir produto']
    ]},
    { title: 'Estoque', caps: [
      ['stock.view',     'Ver estoque'],
      ['stock.movement', 'Movimentar estoque'],
      ['stock.audit',    'Ver auditoria de estoque'],
      ['stock.report',   'Exportar relatório de estoque']
    ]},
    { title: 'Relatórios', caps: [
      ['reports.view',   'Ver relatórios'],
      ['reports.export', 'Exportar CSV']
    ]},
    { title: 'Gestão', caps: [
      ['management.view',  'Acessar Gestão'],
      ['management.roles', 'Gerenciar tipos de perfil'],
      ['management.users', 'Gerenciar usuários']
    ]}
  ];

  Gestao.state = {
    members: [],
    roleTypes: [],
    currentUserId: null,
    currentUserEmail: '',
    currentRole: '',
    currentOrgId: null,
    loading: false,
    creating: false,
    editingMember: null,
    action: null,
    acting: false,
    permsSlug: null,
    perms: { view: true, roles: true, users: true }
  };

  Gestao.permsGeneration = 0;
})();