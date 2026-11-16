(function () {
  'use strict';

  function initChartIA() {
    const ctx = document.getElementById('chart-ia');
    if (!ctx) return;

    // Simulação de dados de previsão (Azul = Histórico, Roxo = Projeção IA)
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5 (IA)', 'Sem 6 (IA)'],
        datasets: [
          {
            label: 'Saldo Real',
            data: [5000, 7000, 4500, 8000, null, null],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 2,
            pointRadius: 3
          },
          {
            label: 'Projeção IA',
            data: [null, null, null, 8000, 10500, 12000],
            borderColor: '#8b5cf6',
            borderDash: [5, 5],
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  function initSimulator() {
    const btn = document.getElementById('sim-calcular');
    const res = document.getElementById('sim-valor-parcela');
    if (!btn || !res) return;

    btn.addEventListener('click', () => {
      const valStr = document.getElementById('sim-val').value.replace(/\./g, '').replace(',', '.');
      const val = parseFloat(valStr) || 0;
      const parcelas = parseInt(document.getElementById('sim-parcelas').value) || 1;
      const juros = parseFloat(document.getElementById('sim-juros').value) / 100 || 0;

      // Cálculo Price (Tabela Price)
      const parcela = (val * juros) / (1 - Math.pow(1 + juros, -parcelas));
      
      const formatted = parcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      res.textContent = isFinite(parcela) ? formatted : 'R$ 0,00';
      
      // Efeito visual
      res.style.transform = 'scale(1.1)';
      setTimeout(() => res.style.transform = 'scale(1)', 150);
    });
  }

  function init() {
    // Espera o DOM estar pronto
    setTimeout(() => {
      initChartIA();
      initSimulator();
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();