/* =========================================================
   DEV HUB · DRE · render
   Tabela DRE + gráfico de evolução.
   ========================================================= */
(function () {
  'use strict';
  const DRE = window.DRE;
  const state = DRE.state;

  function pickValue(row, key) {
    if (!row) return 0;
    const v = row[key];
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  }

  function formatCents(cents) {
    return DRE.formatMoney((cents || 0) / 100);
  }

  function calcDelta(cur, prev) {
    if (prev === 0 && cur === 0) return { text: '—', cls: 'flat' };
    if (prev === 0)              return { text: 'novo', cls: 'flat' };
    const pct = ((cur - prev) / Math.abs(prev)) * 100;
    const sign = pct >= 0 ? '+' : '';
    const cls = pct > 0.05 ? 'pos' : pct < -0.05 ? 'neg' : 'flat';
    return { text: sign + pct.toFixed(1).replace('.', ',') + '%', cls };
  }

  function formatValue(line, value) {
    const prefix = line.prefix ? line.prefix + ' ' : '';
    const abs = Math.abs(value);
    const str = formatCents(abs);
    if (line.style === 'deducao') return prefix + str;
    if (value < 0) return prefix + '- ' + str;
    return prefix + str;
  }

  function isNegative(line, value) {
    if (line.style === 'deducao') return true;
    return value < 0;
  }

  DRE.renderTable = function () {
    const tbody = document.getElementById('dre-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    const frag = document.createDocumentFragment();

    DRE.LINES.forEach(line => {
      const curVal  = pickValue(state.current,  line.key);
      const prevVal = pickValue(state.previous, line.key);
      const ytdVal  = pickValue(state.ytd,      line.key);

      const tr = document.createElement('tr');
      tr.className = 'dre-row dre-row--' + line.style;

      const tdL = document.createElement('td');
      tdL.className = 'dre-row__label';
      tdL.textContent = (line.prefix ? line.prefix + ' ' : '') + line.label;
      tr.appendChild(tdL);

      [curVal, prevVal, ytdVal].forEach((val, idx) => {
        const td = document.createElement('td');
        td.className = 'dre-row__value' + (idx === 2 ? ' dre-row__value--ytd' : '');
        if (isNegative(line, val) && val !== 0) td.classList.add('dre-row__value--neg');
        td.textContent = formatValue(line, val);
        tr.appendChild(td);
      });

      const tdD = document.createElement('td');
      tdD.className = 'dre-row__delta';
      const d = calcDelta(curVal, prevVal);
      tdD.classList.add('dre-row__delta--' + d.cls);
      tdD.textContent = d.text;
      tr.appendChild(tdD);

      frag.appendChild(tr);
    });

    tbody.appendChild(frag);
  };

  DRE.renderChart = function () {
    const canvas = document.getElementById('dre-chart');
    const empty  = document.getElementById('dre-chart-empty');
    if (!canvas || !empty) return;

    if (typeof window.Chart === 'undefined') {
      canvas.style.display = 'none';
      empty.hidden = false;
      empty.querySelector('p').textContent = 'Biblioteca de gráficos não carregada.';
      return;
    }

    const rows = state.evolution || [];
    if (rows.length === 0) {
      canvas.style.display = 'none';
      empty.hidden = false;
      empty.querySelector('p').textContent = 'Sem dados suficientes para o gráfico.';
      if (state.chart) { state.chart.destroy(); state.chart = null; }
      return;
    }

    empty.hidden = true;
    canvas.style.display = '';

    const labels = rows.map(r => {
      const d = new Date(r.period + 'T00:00:00');
      return DRE.formatMonthShort(d);
    });

    const receita  = rows.map(r => (Number(r.receita_bruta) || 0) / 100);
    const lucroBr  = rows.map(r => (Number(r.lucro_bruto)   || 0) / 100);
    const lucroLiq = rows.map(r => (Number(r.lucro_liquido) || 0) / 100);

    if (state.chart) { state.chart.destroy(); state.chart = null; }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const t = {
      tick:   isDark ? '#94a3b8' : '#9ca3af',
      grid:   isDark ? 'rgba(148,163,184,.10)' : '#f3f4f6',
      legend: isDark ? '#cbd5e1' : '#4b5563',
      tBg:    isDark ? '#0f172a' : '#111827',
      tText:  '#e5e7eb'
    };

    state.chart = new window.Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Receita Bruta', data: receita,  borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.10)',  tension: .32, borderWidth: 2,   pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: '#6366f1', fill: false },
          { label: 'Lucro Bruto',   data: lucroBr,  borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,.10)',  tension: .32, borderWidth: 2,   pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: '#0ea5e9', fill: false },
          { label: 'Lucro Líquido', data: lucroLiq, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,.14)',   tension: .32, borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: '#059669', fill: true  }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
            backgroundColor: t.tBg, titleColor: '#fff', bodyColor: t.tText, padding: 10,
            titleFont: { family: 'Inter', size: 12, weight: '600' },
            bodyFont: { family: 'Inter', size: 12 },
            callbacks: {
              label: ctx => (ctx.dataset.label || '') + ': ' + DRE.formatMoney(ctx.parsed.y)
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: t.tick, font: { family: 'Inter', size: 11 }, maxRotation: 0, autoSkipPadding: 12 }
          },
          y: {
            beginAtZero: true,
            grid: { color: t.grid },
            ticks: {
              color: t.tick, font: { family: 'Inter', size: 11 },
              callback: v => 'R$ ' + DRE.NUMBER.format(v)
            }
          }
        }
      }
    });
  };

  DRE.setupChartTheme = function () {
    document.addEventListener('theme:changed', () => {
      if (state.chart) DRE.renderChart();
    });
  };
})();