(function () {
  'use strict';

  // Mock de logs para mostrar na tela (Posteriormente, buscar do Supabase via tabela audit_logs)
  const MOCK_LOGS = [
    { date: '15/11/2026 14:32', user: 'Julio Silva', action: 'Baixa de Título', module: 'Financeiro', details: 'Título #TIT-2026-001 baixado no valor de R$ 1.500,00' },
    { date: '15/11/2026 11:20', user: 'Maria Souza', action: 'Novo Lançamento', module: 'Contas a Pagar', details: 'Criou a despesa "Aluguel Escritório" com vencimento em 05/12/2026' },
    { date: '14/11/2026 16:45', user: 'Admin', action: 'Alteração de Permissão', module: 'Segurança', details: 'Alterou o limite de aprovação do perfil Gerente para R$ 10.000,00' },
    { date: '14/11/2026 09:12', user: 'Julio Silva', action: 'Estorno', module: 'Financeiro', details: 'Estornou a baixa do título #TIT-2026-089. Motivo: Valor incorreto' },
    { date: '13/11/2026 18:00', user: 'Sistema', action: 'Fechamento de Caixa', module: 'Caixa', details: 'Fechamento automático diário. Saldo: R$ 4.320,00' }
  ];

  function renderLogs() {
    const tbody = document.getElementById('sec-logs-body');
    if (!tbody) return;

    tbody.innerHTML = MOCK_LOGS.map(log => `
      <tr>
        <td style="color: var(--text-muted); font-size: 13px;">${log.date}</td>
        <td><strong>${log.user}</strong></td>
        <td><span class="badge badge--info">${log.action}</span></td>
        <td>${log.module}</td>
        <td style="color: var(--text-muted); font-size: 13px;">${log.details}</td>
      </tr>
    `).join('');
  }

  function setupTabs() {
    const tabs = document.querySelectorAll('.fin-tab[data-sec-tab]');
    const panes = document.querySelectorAll('.fin-tabpane[data-sec-pane]');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Reset visual
        tabs.forEach(t => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
        panes.forEach(p => p.hidden = true);

        // Ativa clicada
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');
        
        const target = document.querySelector(`.fin-tabpane[data-sec-pane="${tab.dataset.secTab}"]`);
        if (target) target.hidden = false;

        // Move o indicador laranja
        if (window.Fin && window.Fin.moveIndicator) window.Fin.moveIndicator();
      });
    });
  }

  function init() {
    // Espera o nav carregar para pegar o evento do indicador
    setTimeout(() => {
      if (window.Fin && window.Fin.moveIndicator) window.Fin.moveIndicator();
    }, 100);

    setupTabs();
    renderLogs();
  }

  // Expõe utilitários
  window.Seguranca = {
    toast: function(msg, type) {
      if (window.RH && window.RH.toast) {
        window.RH.toast(msg, type);
      } else if (window.Fin && window.Fin.toast) {
        window.Fin.toast(msg, type);
      } else {
        alert(msg);
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();