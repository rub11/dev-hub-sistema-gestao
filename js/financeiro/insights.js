(function () {
  'use strict';

  const { state, fmtBRL, escapeHTML } = window.Fin;

  function generateInsight() {
    // Proteção caso não haja dados carregados ainda
    if (!state.entries || state.entries.length === 0) {
      return "Comece a cadastrar suas contas para que a Inteligência Artificial possa analisar a saúde da sua empresa.";
    }

    const despesas = state.entries.filter(e => e.kind === 'despesa');
    const maiorDespesa = despesas.length > 0 ? despesas.reduce((max, e) => (Number(e.amount_cents) > Number(max.amount_cents) ? e : max), despesas[0]) : null;

    const hoje = new Date().toISOString().slice(0, 10);
    const vencidas = state.entries.filter(e => e.status === 'pendente' && e.due_date && e.due_date < hoje);

    const currentMonthPrefix = hoje.slice(0, 7);
    const receitasMes = state.entries.filter(e => e.kind === 'receita' && e.settlement_date && e.settlement_date.startsWith(currentMonthPrefix)).reduce((s, e) => s + Number(e.paid_cents || e.amount_cents), 0);
    const despesasMes = state.entries.filter(e => e.kind === 'despesa' && e.settlement_date && e.settlement_date.startsWith(currentMonthPrefix)).reduce((s, e) => s + Number(e.paid_cents || e.amount_cents), 0);

    if (vencidas.length > 0) {
      const totalVencido = vencidas.reduce((s, e) => s + Number(e.current_balance_cents || e.amount_cents), 0);
      return `Atenção: Existem ${vencidas.length} títulos em atraso totalizando ${fmtBRL(totalVencido)}. Recomenda-se priorizar a régua de cobrança ou renegociação para melhorar o fluxo de caixa.`;
    }

    if (maiorDespesa && maiorDespesa.partner_name && Number(maiorDespesa.amount_cents) > 0) {
      return `Sua empresa possui despesas concentradas em poucos fornecedores. O maior gasto registrado é com "${escapeHTML(maiorDespesa.partner_name)}" no valor de ${fmtBRL(maiorDespesa.amount_cents)}. Analise a possibilidade de renegociar contratos para reduzir custos.`;
    }

    if (receitasMes > despesasMes && receitasMes > 0) {
      const lucro = receitasMes - despesasMes;
      return `Excelente! Sua empresa fechou o mês com um resultado líquido positivo de ${fmtBRL(lucro)}. Considere direcionar parte deste lucro para a sua reserva de emergência.`;
    }

    if (despesasMes > receitasMes && despesasMes > 0) {
      return `Alerta de saúde financeira: As despesas deste mês superaram as receitas em ${fmtBRL(despesasMes - receitasMes)}. Sugerimos revisar os gastos variáveis e postergar investimentos não essenciais.`;
    }

    return "Sua saúde financeira está estável. Continue monitorando os vencimentos diários para manter o equilíbrio do fluxo de caixa.";
  }

  function renderInsights() {
    const quoteEl = document.getElementById('insights-quote');
    if (!quoteEl) return;

    // Limpa o texto "Analisando seus dados..." do HTML antes de começar
    quoteEl.textContent = '';
    
    const insightText = generateInsight();
    let i = 0;
    const speed = 20; // Velocidade da digitação (ms)
    
    function typeWriter() {
      if (i < insightText.length) {
        quoteEl.textContent += insightText.charAt(i);
        i++;
        setTimeout(typeWriter, speed);
      }
    }
    
    // Inicia o efeito de digitação após um pequeno delay
    setTimeout(typeWriter, 300);
  }

  // Expõe a função para ser chamada no init.js
  window.Fin.renderInsights = renderInsights;

})();