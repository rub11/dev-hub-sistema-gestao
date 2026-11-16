/* =========================================================
   DEV HUB · Financeiro · charts
   ========================================================= */

(function () {
  'use strict';

  const { state } = window.Fin;

  // Objeto global para armazenar as instâncias e permitir a destruição (refresh)
  const chartInstances = {};

  // Cores base do Tema
  const COLORS = {
    receita: '#10b981',
    despesa: '#ef4444',
    resultado: '#8b5cf6',
    neutro: '#64748b',
    bgNeutro: 'rgba(100, 116, 139, 0.15)',
    fontColor: '#94a3b8',
    gridColor: 'rgba(255, 255, 255, 0.05)'
  };

  // Configurações globais padrão do Chart.js para dark mode
  Chart.defaults.color = COLORS.fontColor;
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 6;

  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  function destroyChart(id) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  }

  function renderCharts() {
    if (!window.Chart) return; // Se o Chart.js não carregou

    const entries = state.entries || [];

    // =======================================================
    // 1. Evolução Financeira (Últimos 12 Meses)
    // =======================================================
    (function buildEvolucao() {
      destroyChart('evolucao');
      const ctx = document.getElementById('chart-evolucao');
      if (!ctx) return;

      const labels = [];
      const dataReceitas = [];
      const dataDespesas = [];
      const dataResultado = [];
      
      const today = new Date();
      
      // Gera os últimos 12 meses
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        const yearStr = d.getFullYear();
        const prefix = `${yearStr}-${monthStr}`;
        
        // Nome do mês abreviado
        const monthName = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
        labels.push(`${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${yearStr.toString().slice(2)}`);

        // Filtra entradas do mês
        const mesEntries = entries.filter(e => 
          (e.settlement_date && e.settlement_date.startsWith(prefix)) || 
          (!e.settlement_date && e.due_date && e.due_date.startsWith(prefix))
        );

        const rec = mesEntries.filter(e => e.kind === 'receita').reduce((s, e) => s + Number(e.paid_cents || e.amount_cents || 0), 0);
        const desp = mesEntries.filter(e => e.kind === 'despesa').reduce((s, e) => s + Number(e.paid_cents || e.amount_cents || 0), 0);

        dataReceitas.push(rec / 100);
        dataDespesas.push(desp / 100);
        dataResultado.push((rec - desp) / 100);
      }

      chartInstances['evolucao'] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Receitas',
              data: dataReceitas,
              borderColor: COLORS.receita,
              backgroundColor: COLORS.receita,
              tension: 0.3,
              borderWidth: 2,
              pointRadius: 3
            },
            {
              label: 'Despesas',
              data: dataDespesas,
              borderColor: COLORS.despesa,
              backgroundColor: COLORS.despesa,
              tension: 0.3,
              borderWidth: 2,
              pointRadius: 3
            },
            {
              label: 'Resultado Líquido',
              data: dataResultado,
              borderColor: COLORS.resultado,
              backgroundColor: COLORS.resultado,
              tension: 0.3,
              borderWidth: 2,
              pointRadius: 3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            tooltip: {
              callbacks: {
                label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`
              }
            }
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              grid: { color: COLORS.gridColor },
              ticks: {
                callback: (value) => new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(value)
              }
            }
          }
        }
      });
    })();

    // =======================================================
    // 2. Despesas por Categoria (Doughnut)
    // =======================================================
    (function buildCategorias() {
      destroyChart('categorias');
      const ctx = document.getElementById('chart-categorias');
      if (!ctx) return;

      const despesas = entries.filter(e => e.kind === 'despesa');
      const agrupado = {};

      despesas.forEach(e => {
        const cat = e.nature_name || e.company_name || 'Não categorizado';
        agrupado[cat] = (agrupado[cat] || 0) + Number(e.amount_cents || 0);
      });

      // Ordena as maiores categorias
      const sorted = Object.entries(agrupado).sort((a, b) => b[1] - a[1]);
      
      // Pega as top 5 e agrupa o resto em "Outros"
      let labels = [];
      let data = [];
      let outros = 0;

      sorted.forEach(([name, val], index) => {
        if (index < 5) {
          labels.push(name);
          data.push(val / 100);
        } else {
          outros += val;
        }
      });

      if (outros > 0) {
        labels.push('Outros');
        data.push(outros / 100);
      }

      const bgColors = ['#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#334155'];

      chartInstances['categorias'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: bgColors,
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: { position: 'right' },
            tooltip: {
              callbacks: {
                label: (context) => ` ${context.label}: ${formatCurrency(context.raw)}`
              }
            }
          }
        }
      });
    })();

    // =======================================================
    // 3. Contas a Pagar x Receber (Barra)
    // =======================================================
    (function buildPagarReceber() {
      destroyChart('pagar-receber');
      const ctx = document.getElementById('chart-pagar-receber');
      if (!ctx) return;

      let totalPagar = 0;
      let totalReceber = 0;
      let pendentePagar = 0;
      let pendenteReceber = 0;

      entries.forEach(e => {
        const val = Number(e.current_balance_cents || e.amount_cents || 0);
        if (e.kind === 'despesa') {
          totalPagar += Number(e.amount_cents || 0);
          if (e.status === 'pendente') pendentePagar += val;
        } else {
          totalReceber += Number(e.amount_cents || 0);
          if (e.status === 'pendente') pendenteReceber += val;
        }
      });

      chartInstances['pagar-receber'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Total Geral', 'Em Aberto (Pendente)'],
          datasets: [
            {
              label: 'A Pagar',
              data: [totalPagar / 100, pendentePagar / 100],
              backgroundColor: COLORS.despesa,
              borderRadius: 4
            },
            {
              label: 'A Receber',
              data: [totalReceber / 100, pendenteReceber / 100],
              backgroundColor: COLORS.receita,
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`
              }
            }
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              grid: { color: COLORS.gridColor },
              ticks: {
                callback: (value) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(value)
              }
            }
          }
        }
      });
    })();

    // =======================================================
    // 4. Fluxo de Caixa Projetado (7, 15, 30, 90 dias)
    // =======================================================
    (function buildFluxo() {
      destroyChart('fluxo');
      const ctx = document.getElementById('chart-fluxo');
      if (!ctx) return;

      const today = new Date();
      today.setHours(0,0,0,0);
      
      const prazos = [7, 15, 30, 90];
      const labels = prazos.map(d => `Próx. ${d} dias`);
      
      const entradas = [0, 0, 0, 0];
      const saidas = [0, 0, 0, 0];

      entries.filter(e => e.status === 'pendente' && e.due_date).forEach(e => {
        const due = new Date(e.due_date + 'T00:00:00');
        const diffDays = Math.round((due - today) / 86400000);
        
        if (diffDays >= 0) {
          const val = Number(e.current_balance_cents || e.amount_cents || 0) / 100;
          
          prazos.forEach((limite, index) => {
            if (diffDays <= limite) {
              if (e.kind === 'receita') entradas[index] += val;
              else saidas[index] += val;
            }
          });
        }
      });

      chartInstances['fluxo'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Entradas (Receitas)',
              data: entradas,
              backgroundColor: COLORS.receita,
              borderRadius: 4
            },
            {
              label: 'Saídas (Despesas)',
              data: saidas,
              backgroundColor: COLORS.despesa,
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`
              }
            }
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              grid: { color: COLORS.gridColor },
              ticks: {
                callback: (value) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(value)
              }
            }
          }
        }
      });
    })();

    // =======================================================
    // 5. Comparativo entre Meses (Atual vs Anterior)
    // =======================================================
    (function buildComparativo() {
      destroyChart('comparativo');
      const ctx = document.getElementById('chart-comparativo');
      if (!ctx) return;

      const today = new Date();
      
      const getPrefix = (monthOffset) => {
        const d = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      };

      const currentPrefix = getPrefix(0);
      const lastPrefix = getPrefix(1);

      let recAtual = 0, despAtual = 0;
      let recLast = 0, despLast = 0;

      entries.forEach(e => {
        const val = Number(e.paid_cents || e.amount_cents || 0);
        const dateStr = e.settlement_date || e.due_date || '';

        if (dateStr.startsWith(currentPrefix)) {
          if (e.kind === 'receita') recAtual += val;
          else despAtual += val;
        } else if (dateStr.startsWith(lastPrefix)) {
          if (e.kind === 'receita') recLast += val;
          else despLast += val;
        }
      });

      const mesAtualNome = today.toLocaleString('pt-BR', { month: 'long' });
      const dataMesAnterior = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const mesAnteriorNome = dataMesAnterior.toLocaleString('pt-BR', { month: 'long' });

      chartInstances['comparativo'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Receitas', 'Despesas'],
          datasets: [
            {
              label: `Mês Atual (${mesAtualNome})`,
              data: [recAtual / 100, despAtual / 100],
              backgroundColor: '#f59e0b', // Laranja
              borderRadius: 4
            },
            {
              label: `Mês Anterior (${mesAnteriorNome})`,
              data: [recLast / 100, despLast / 100],
              backgroundColor: COLORS.neutro,
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`
              }
            }
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              grid: { color: COLORS.gridColor },
              ticks: {
                callback: (value) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(value)
              }
            }
          }
        }
      });
    })();
  }

  // Publica no namespace global
  Object.assign(window.Fin, {
    renderCharts
  });

})();