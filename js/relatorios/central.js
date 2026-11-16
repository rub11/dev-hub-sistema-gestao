/* =========================================================
   DEV HUB · Relatórios · Central
   ========================================================= */
(function () {
  'use strict';

  // Pega as funções globais se existirem (para usar o Toast do sistema)
  const toast = window.RH?.toast || ((msg) => alert(msg));

  // Lista completa dos 30 relatórios
  const REPORTS = [
    { id: 1, title: 'Contas a Pagar', desc: 'Listagem detalhada de todas as obrigações.', cat: 'Contas' },
    { id: 2, title: 'Contas a Receber', desc: 'Listagem de todos os valores a receber.', cat: 'Contas' },
    { id: 3, title: 'Despesas', desc: 'Todas as saídas financeiras registradas.', cat: 'Contas' },
    { id: 4, title: 'Receitas', desc: 'Todas as entradas financeiras registradas.', cat: 'Contas' },
    { id: 5, title: 'Fluxo de Caixa', desc: 'Entradas, saídas e saldo consolidado.', cat: 'Análise' },
    { id: 6, title: 'Movimentações', desc: 'Extrato completo de transações.', cat: 'Movimentações' },
    { id: 7, title: 'Inadimplência', desc: 'Títulos em atraso e clientes devedores.', cat: 'Análise' },
    { id: 8, title: 'Fornecedores', desc: 'Histórico de compras e pagamentos por fornecedor.', cat: 'Parceiros' },
    { id: 9, title: 'Clientes', desc: 'Histórico de vendas e recebimentos por cliente.', cat: 'Parceiros' },
    { id: 10, title: 'Despesas por Categoria', desc: 'Distribuição de gastos por natureza.', cat: 'Análise' },
    { id: 11, title: 'Receitas por Categoria', desc: 'Distribuição de ganhos por natureza.', cat: 'Análise' },
    { id: 12, title: 'Despesas por Centro de Custo', desc: 'Gastos separados por departamento.', cat: 'Análise' },
    { id: 13, title: 'Pagamentos Realizados', desc: 'Histórico de baixas efetuadas.', cat: 'Contas' },
    { id: 14, title: 'Recebimentos Realizados', desc: 'Histórico de recebimentos efetuados.', cat: 'Contas' },
    { id: 15, title: 'Títulos Vencidos', desc: 'Lista de contas em atraso.', cat: 'Contas' },
    { id: 16, title: 'Títulos Pendentes', desc: 'Lista de contas em aberto.', cat: 'Contas' },
    { id: 17, title: 'Contas Recorrentes', desc: 'Assinaturas e despesas fixas.', cat: 'Contas' },
    { id: 18, title: 'Juros e Multas', desc: 'Valores pagos ou recebidos por atraso.', cat: 'Movimentações' },
    { id: 19, title: 'Descontos', desc: 'Descontos concedidos ou obtidos.', cat: 'Movimentações' },
    { id: 20, title: 'Conciliação Bancária', desc: 'Conferência de extratos.', cat: 'Movimentações' },
    { id: 21, title: 'DRE', desc: 'Demonstrativo de Resultados do Exercício.', cat: 'Gerencial' },
    { id: 22, title: 'Rentabilidade', desc: 'Margem de lucro por produto/serviço.', cat: 'Gerencial' },
    { id: 23, title: 'Orçamento', desc: 'Comparativo entre orçado e realizado.', cat: 'Gerencial' },
    { id: 24, title: 'Desempenho Mensal', desc: 'Resumo consolidado de desempenho no mês.', cat: 'Gerencial' },
    { id: 25, title: 'Comparativo Anual', desc: 'Evolução mês a mês do ano atual vs anterior.', cat: 'Gerencial' },
    { id: 26, title: 'Fechamento Financeiro', desc: 'Relatório de encerramento de período.', cat: 'Auditoria' },
    { id: 27, title: 'Movimentações por Usuário', desc: 'Auditoria de quem lançou cada título.', cat: 'Auditoria' },
    { id: 28, title: 'Auditoria', desc: 'Log completo de alterações no sistema.', cat: 'Auditoria' },
    { id: 29, title: 'Saldo por Conta Bancária', desc: 'Posição de saldo em todas as contas.', cat: 'Bancos' },
    { id: 30, title: 'Consolidado de Unidades', desc: 'Resultado somado de todas as filiais.', cat: 'Gerencial' }
  ];

  function renderReports(filterText = '') {
    const grid = document.getElementById('reports-grid');
    if (!grid) return;

    const term = filterText.toLowerCase();
    const filtered = REPORTS.filter(r => 
      r.title.toLowerCase().includes(term) || 
      r.desc.toLowerCase().includes(term) || 
      r.cat.toLowerCase().includes(term)
    );

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding: 40px; color: var(--text-muted);">
          Nenhum relatório encontrado para "<strong>${filterText}</strong>".
        </div>`;
      return;
    }

    grid.innerHTML = filtered.map(report => `
      <div class="report-card">
        <div class="report-card__header">
          <span class="report-card__cat">${report.cat}</span>
          <h3 class="report-card__title">${report.title}</h3>
          <p class="report-card__desc">${report.desc}</p>
        </div>
        <div class="report-card__actions">
          <button type="button" class="report-btn report-btn--pdf" onclick="window.GerarRelatorio('${report.title}', 'PDF')" title="Exportar PDF">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6"/><path d="M9 11h6"/></svg> PDF
          </button>
          <button type="button" class="report-btn report-btn--excel" onclick="window.GerarRelatorio('${report.title}', 'Excel')" title="Exportar Excel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m8 13 8 8"/><path d="m16 13-8 8"/></svg> Excel
          </button>
          <button type="button" class="report-btn report-btn--print" onclick="window.GerarRelatorio('${report.title}', 'Impressão')" title="Imprimir">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Imprimir
          </button>
        </div>
      </div>
    `).join('');
  }

  // Função Global chamada pelos botões
  window.GerarRelatorio = function(title, format) {
    if (format === 'Impressão') {
      toast(`Preparando impressão: "${title}"`, 'success');
      setTimeout(() => window.print(), 800);
    } else {
      toast(`Gerando arquivo ${format} do relatório: "${title}"...`, 'success');
      // Aqui você pode integrar o jsPDF ou SheetJS no futuro
    }
  };

  // Inicialização
  function init() {
    renderReports();

    const searchInput = document.getElementById('report-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        renderReports(e.target.value);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();