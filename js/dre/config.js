/* =========================================================
   DEV HUB · DRE · config
   ========================================================= */
(function () {
  'use strict';
  const DRE = window.DRE = window.DRE || {};

  DRE.CURRENCY = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  DRE.NUMBER   = new Intl.NumberFormat('pt-BR');

  DRE.MONTH_NAMES = [
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
  ];

  DRE.LINES = [
    { key: 'receita_bruta',          label: 'RECEITA BRUTA',            style: 'normal' },
    { key: 'devolucoes',             label: 'Devoluções',               style: 'deducao', prefix: '(-)' },
    { key: 'descontos',              label: 'Descontos',                style: 'deducao', prefix: '(-)' },
    { key: 'impostos_venda',         label: 'Impostos sobre Vendas',    style: 'deducao', prefix: '(-)' },
    { key: 'receita_liquida',        label: 'RECEITA LÍQUIDA',          style: 'subtotal', prefix: '=' },
    { key: 'cmv',                    label: 'CMV',                      style: 'deducao', prefix: '(-)' },
    { key: 'lucro_bruto',            label: 'LUCRO BRUTO',              style: 'subtotal', prefix: '=' },
    { key: 'despesas_op',            label: 'Despesas Operacionais',    style: 'deducao', prefix: '(-)' },
    { key: 'resultado_operacional',  label: 'RESULTADO OPERACIONAL',    style: 'subtotal', prefix: '=' },
    { key: 'resultado_financeiro',   label: 'Resultado Financeiro',     style: 'normal',   prefix: '(±)' },
    { key: 'resultado_antes_tributos', label: 'RESULTADO ANTES DOS TRIBUTOS', style: 'subtotal', prefix: '=' },
    { key: 'tributos_lucro',         label: 'Tributos sobre o Lucro',   style: 'deducao', prefix: '(-)' },
    { key: 'lucro_liquido',          label: 'LUCRO LÍQUIDO',            style: 'final',   prefix: '=' }
  ];

  DRE.formatMonth = function (d) {
    if (!d) return '—';
    return DRE.MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
  };

  DRE.formatMonthShort = function (d) {
    if (!d) return '—';
    return DRE.MONTH_NAMES[d.getMonth()].slice(0, 3) + '/' + d.getFullYear();
  };

  DRE.formatMoney = function (v) {
    const n = Number(v);
    return DRE.CURRENCY.format(Number.isFinite(n) ? n : 0);
  };

  DRE.startOfMonth = function (d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  };

  DRE.addMonths = function (d, delta) {
    return new Date(d.getFullYear(), d.getMonth() + delta, 1);
  };

  DRE.toISODate = function (d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  };
})();