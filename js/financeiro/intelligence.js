/* =========================================================
   DEV HUB · Financeiro · intelligence
   ========================================================= */

(function () {
  'use strict';

  const { state, fmtBRL } = window.Fin;

  function renderIntelligence() {
    const wrap = document.getElementById('fin-intel-list');
    if (!wrap) return;

    const entries = state.entries || [];
    const accounts = state.accounts || [];
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayStr = today.toISOString().slice(0, 10);
    const currentMonthPrefix = todayStr.slice(0, 7);
    
    // Mês anterior
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const alerts = [];

    // ----------------------------------------------------
    // 1. Vencimentos Próximos (Próximos 3 dias)
    // ----------------------------------------------------
    const next3Days = new Date(today);
    next3Days.setDate(next3Days.getDate() + 3);
    const next3DaysStr = next3Days.toISOString().slice(0, 10);

    const proximosVencimentos = entries.filter(e => 
      e.status === 'pendente' && 
      e.due_date >= todayStr && 
      e.due_date <= next3DaysStr
    );

    if (proximosVencimentos.length > 0) {
      alerts.push({
        type: 'warning', // Amarelo/Laranja
        icon: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
        title: 'Atenção: vencimentos próximos',
        desc: `Existem ${proximosVencimentos.length} contas com vencimento nos próximos 3 dias.`
      });
    }

    // ----------------------------------------------------
    // 2. Aumento nas despesas (Mês atual vs Mês anterior)
    // ----------------------------------------------------
    const getDespesasMes = (prefix) => entries.filter(e => 
      e.kind === 'despesa' && 
      (e.settlement_date && e.settlement_date.startsWith(prefix))
    ).reduce((sum, e) => sum + Number(e.paid_cents || e.amount_cents || 0), 0);

    const despesasAtual = getDespesasMes(currentMonthPrefix);
    const despesasAnterior = getDespesasMes(lastMonthPrefix);

    if (despesasAnterior > 0 && despesasAtual > despesasAnterior) {
      const aumento = ((despesasAtual - despesasAnterior) / despesasAnterior) * 100;
      if (aumento >= 5) { // Só avisa se o aumento for maior que 5%
        alerts.push({
          type: 'trend-up', // Verde ou Vermelho dependendo da lógica, mas mockup usa traço verde
          icon: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
          title: 'Aumento nas despesas',
          desc: `As despesas deste mês estão ${aumento.toFixed(1)}% acima do mês anterior.`
        });
      }
    }

    // ----------------------------------------------------
    // 3. Previsão de Caixa (Próximos 15 dias)
    // ----------------------------------------------------
    const saldoAtual = accounts.reduce((sum, acc) => sum + Number(acc.current_balance_cents || 0), 0);
    
    const next15Days = new Date(today);
    next15Days.setDate(next15Days.getDate() + 15);
    const next15DaysStr = next15Days.toISOString().slice(0, 10);

    const aReceber15 = entries.filter(e => 
      e.kind === 'receita' && e.status === 'pendente' && 
      e.due_date >= todayStr && e.due_date <= next15DaysStr
    ).reduce((s, e) => s + Number(e.current_balance_cents || e.amount_cents), 0);

    const aPagar15 = entries.filter(e => 
      e.kind === 'despesa' && e.status === 'pendente' && 
      e.due_date >= todayStr && e.due_date <= next15DaysStr
    ).reduce((s, e) => s + Number(e.current_balance_cents || e.amount_cents), 0);

    const saldoProjetado = saldoAtual + aReceber15 - aPagar15;

    if (saldoProjetado < 0) {
      alerts.push({
        type: 'forecast', // Azul/Roxo
        icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        title: 'Previsão de caixa',
        desc: `O saldo projetado poderá ficar negativo (${fmtBRL(saldoProjetado)}) nos próximos 15 dias.`
      });
    } else {
      // Se não for negativo, pode mostrar uma previsão positiva ou omitir. Vamos colocar um alerta positivo discreto.
      alerts.push({
        type: 'forecast', 
        icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        title: 'Previsão de caixa',
        desc: `Saldo projetado positivo de ${fmtBRL(saldoProjetado)} para os próximos 15 dias.`
      });
    }

    // ----------------------------------------------------
    // 4. Contas regularizadas (Baixadas no mês)
    // ----------------------------------------------------
    const baixadasMes = entries.filter(e => 
      e.status === 'baixado' && 
      e.settlement_date && e.settlement_date.startsWith(currentMonthPrefix)
    );

    if (baixadasMes.length > 0) {
      alerts.push({
        type: 'success', // Verde
        icon: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
        title: 'Contas regularizadas',
        desc: `${baixadasMes.length} títulos foram quitados neste período.`
      });
    }

    // ----------------------------------------------------
    // Render HTML
    // ----------------------------------------------------
    if (alerts.length === 0) {
      wrap.innerHTML = '<div class="fin-intel__empty">Nenhum alerta no momento. Sua saúde financeira está em dia!</div>';
      return;
    }

    wrap.innerHTML = alerts.map(a => `
      <div class="fin-intel__item fin-intel__item--${a.type}">
        <div class="fin-intel__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${a.icon}
          </svg>
        </div>
        <div class="fin-intel__content">
          <h4 class="fin-intel__item-title">${a.title}</h4>
          <p class="fin-intel__item-desc">${a.desc}</p>
        </div>
      </div>
    `).join('');
  }

  Object.assign(window.Fin, {
    renderIntelligence
  });

})();