/* =========================================================
   DEV HUB · Cadastros · config
   ========================================================= */
(function () {
  'use strict';
  const CAD = window.CAD = window.CAD || {};

  /* ---------- Naturezas ---------- */
  CAD.KIND_LABELS = {
    receita:    'Receita',
    despesa:    'Despesa',
    custo:      'Custo',
    imposto:    'Imposto',
    financeiro: 'Financeiro'
  };

  CAD.DRE_GROUP_LABELS = {
    receita_bruta:       'Receita Bruta',
    devolucoes:          'Devoluções',
    descontos:           'Descontos',
    impostos_venda:      'Impostos sobre Vendas',
    cmv:                 'CMV',
    despesa_operacional: 'Despesa Operacional',
    receita_financeira:  'Receita Financeira',
    despesa_financeira:  'Despesa Financeira',
    tributos_lucro:      'Tributos sobre o Lucro',
    nao_dre:             'Não afeta DRE'
  };

  CAD.DRE_GROUP_ORDER = [
    'receita_bruta', 'devolucoes', 'descontos', 'impostos_venda',
    'cmv', 'despesa_operacional',
    'receita_financeira', 'despesa_financeira',
    'tributos_lucro', 'nao_dre'
  ];

  /* ---------- Plano de Contas ---------- */
  CAD.COA_TYPE_LABELS = {
    ativo:      'Ativo',
    passivo:    'Passivo',
    patrimonio: 'Patrimônio Líquido',
    receita:    'Receita',
    despesa:    'Despesa',
    custo:      'Custo'
  };

  /* DRE line mapeia pro grupo DRE (mesma estrutura de naturezas) */
  CAD.COA_DRE_LINE_ORDER = CAD.DRE_GROUP_ORDER;

  /* ---------- Períodos Fiscais ---------- */
  CAD.MONTH_NAMES = [
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
  ];

  CAD.MONTH_SHORT = [
    'Jan','Fev','Mar','Abr','Mai','Jun',
    'Jul','Ago','Set','Out','Nov','Dez'
  ];

  CAD.fpStatusInfo = function (status) {
    const s = String(status || '').toLowerCase();
    if (s === 'fechado') return { label: 'Fechado', modifier: 'badge--danger' };
    return { label: 'Aberto', modifier: 'badge--success' };
  };

  /* ---------- Ícones ---------- */
  CAD.ICONS = {
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
    toggleOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="7" width="19" height="10" rx="5"/><circle cx="16" cy="12" r="3" fill="currentColor"/></svg>',
    toggleOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="7" width="19" height="10" rx="5"/><circle cx="8" cy="12" r="3" fill="currentColor"/></svg>',
    indent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M9 12h12"/><path d="M9 18h12"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>',
    unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 7.5-2"/></svg>'
  };

  CAD.formatKindBadge = function (kind) {
    const k = String(kind || '').toLowerCase();
    const label = CAD.KIND_LABELS[k] || kind || '—';
    return { label, modifier: 'badge--' + (k || 'neutral') };
  };

  CAD.formatCoaTypeBadge = function (type) {
    const t = String(type || '').toLowerCase();
    const label = CAD.COA_TYPE_LABELS[t] || type || '—';
    /* Reutiliza as cores do kind quando bate; senão neutro */
    const colorMap = {
      receita: 'receita',
      despesa: 'despesa',
      custo: 'custo',
      ativo: 'financeiro',
      passivo: 'imposto',
      patrimonio: 'neutral'
    };
    return { label, modifier: 'badge--' + (colorMap[t] || 'neutral') };
  };
})();