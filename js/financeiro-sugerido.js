(function () {
  'use strict';

  function renderChart() {
    const canvas = document.getElementById('chart-sugerido');
    if (!canvas) return;

    // Cores idênticas ao mockup
    const colorGreen = '#10b981'; // Receitas
    const colorRed = '#ef4444';   // Despesas
    const colorPurple = '#8b5cf6'; // Resultado

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
        datasets: [
          {
            label: 'Receitas',
            data: [4000, 5500, 7000, 6500],
            backgroundColor: colorGreen,
            borderRadius: 4,
            barPercentage: 0.6,
            categoryPercentage: 0.8
          },
          {
            label: 'Despesas',
            data: [2500, 4500, 6000, 4000],
            backgroundColor: colorRed,
            borderRadius: 4,
            barPercentage: 0.6,
            categoryPercentage: 0.8
          },
          {
            label: 'Resultado',
            data: [1500, 1000, 1000, 2500],
            backgroundColor: colorPurple,
            borderRadius: 4,
            barPercentage: 0.6,
            categoryPercentage: 0.8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false // O mockup não mostra legenda
          },
          tooltip: {
            backgroundColor: '#1e1e21',
            titleColor: '#fff',
            bodyColor: '#a0a0a5',
            borderColor: '#2a2a2e',
            borderWidth: 1,
            padding: 10
          }
        },
        scales: {
          x: {
            grid: {
              display: false,
              drawBorder: false
            },
            ticks: {
              color: '#666',
              font: { family: 'Inter', size: 10 }
            }
          },
          y: {
            display: false, // O mockup esconde o eixo Y
            beginAtZero: true
          }
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderChart);
  } else {
    renderChart();
  }
})();