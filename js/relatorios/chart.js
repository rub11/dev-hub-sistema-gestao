/* =========================================================
   DEV HUB · Relatórios · chart.js
   Gráfico de evolução das vendas (Chart.js).
   ========================================================= */
(function () {
  'use strict';
  const RH = window.RH;
  const state = RH.state;

  function readTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      tick:        isDark ? '#94a3b8' : '#9ca3af',
      grid:        isDark ? 'rgba(148,163,184,.10)' : '#f3f4f6',
      legend:      isDark ? '#cbd5e1' : '#4b5563',
      tooltipBg:   isDark ? '#0f172a' : '#111827',
      tooltipText: '#e5e7eb'
    };
  }

  function buildDayBuckets(sales, start, end) {
    const map = new Map();
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());

    while (cursor <= end) {
      const key = RH.utils.toDateKey(cursor);
      map.set(key, {
        key: key,
        label: RH.SHORT_DATE.format(cursor),
        count: 0,
        total: 0
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    sales.forEach(function (s) {
      const key = RH.utils.toDateKey(new Date(s.created_at));
      const bucket = map.get(key);
      if (bucket) {
        bucket.count += 1;
        bucket.total += RH.utils.toNumber(s.total, 0);
      }
    });

    return Array.from(map.values());
  }

  function render() {
    const canvas = document.getElementById('chart-evolution');
    const empty = document.getElementById('chart-empty');
    const wrap = document.getElementById('chart-wrap');
    if (!canvas || !wrap || !empty) return;

    const valid = RH.utils.getValidSales();

    if (typeof window.Chart === 'undefined') {
      canvas.style.display = 'none';
      empty.hidden = false;
      empty.querySelector('p').textContent = 'Não foi possível carregar a biblioteca de gráficos.';
      return;
    }

    if (valid.length === 0) {
      canvas.style.display = 'none';
      empty.hidden = false;
      empty.querySelector('p').textContent = 'Sem dados suficientes para exibir o gráfico no período.';
      if (state.chart) { state.chart.destroy(); state.chart = null; }
      return;
    }

    empty.hidden = true;
    canvas.style.display = '';

    const { start, end } = RH.period.getRange();
    const buckets = buildDayBuckets(valid, start, end);

    const labels = buckets.map(b => b.label);
    const counts = buckets.map(b => b.count);
    const totals = buckets.map(b => RH.utils.round2(b.total));

    if (state.chart) { state.chart.destroy(); state.chart = null; }

    const t = readTheme();
    state.chart = new window.Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Vendas (un.)',
            data: counts,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            tension: 0.32, borderWidth: 2,
            pointRadius: 0, pointHoverRadius: 5,
            pointHoverBackgroundColor: '#6366f1',
            pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
            yAxisID: 'yCount', fill: true
          },
          {
            label: 'Faturamento (R$)',
            data: totals,
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.10)',
            tension: 0.32, borderWidth: 2,
            pointRadius: 0, pointHoverRadius: 5,
            pointHoverBackgroundColor: '#059669',
            pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
            yAxisID: 'yRevenue', fill: true
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10, boxHeight: 10,
              usePointStyle: true, pointStyle: 'circle', padding: 14,
              font: { family: 'Inter', size: 12 }, color: t.legend
            }
          },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: '#fff', bodyColor: t.tooltipText, padding: 10,
            titleFont: { family: 'Inter', size: 12, weight: '600' },
            bodyFont: { family: 'Inter', size: 12 },
            callbacks: {
              label: function (context) {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                if (context.dataset.yAxisID === 'yRevenue') {
                  return label + ': ' + RH.CURRENCY.format(value);
                }
                return label + ': ' + RH.NUMBER.format(value);
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: t.tick, font: { family: 'Inter', size: 11 },
              maxRotation: 0, autoSkipPadding: 12
            }
          },
          yCount: {
            position: 'left', beginAtZero: true,
            grid: { color: t.grid },
            ticks: { color: t.tick, font: { family: 'Inter', size: 11 }, precision: 0 }
          },
          yRevenue: {
            position: 'right', beginAtZero: true,
            grid: { display: false },
            ticks: {
              color: t.tick, font: { family: 'Inter', size: 11 },
              callback: v => 'R$ ' + RH.NUMBER.format(v)
            }
          }
        }
      }
    });
  }

  function setup() {
    document.addEventListener('theme:changed', function () {
      if (state.chart) render();
    });
  }

  RH.chart = { render, setup };
})();