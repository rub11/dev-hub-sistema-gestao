/* =========================================================
   DEV HUB · DRE · export
   ========================================================= */
(function () {
  'use strict';
  const DRE = window.DRE;
  const state = DRE.state;

  DRE.setupExport = function () {
    const csvBtn = document.getElementById('dre-export-csv');
    const pdfBtn = document.getElementById('dre-export-pdf');
    if (csvBtn) csvBtn.addEventListener('click', exportCSV);
    if (pdfBtn) pdfBtn.addEventListener('click', exportPDF);
  };

  function exportCSV() {
    if (!state.current) {
      DRE.toast('Nada para exportar neste mês.', 'error');
      return;
    }

    const SEP = ';';
    const BOM = '\uFEFF';
    const monthLabel = DRE.formatMonth(state.currentMonth);

    function esc(v) {
      const s = v === null || v === undefined ? '' : String(v);
      if (s.indexOf(SEP) !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }

    function brl(cents) {
      return ((cents || 0) / 100).toFixed(2).replace('.', ',');
    }

    const lines = [];
    lines.push(['DRE Gerencial', monthLabel].map(esc).join(SEP));
    lines.push('');
    lines.push(['Descrição', monthLabel, 'Mês anterior', 'YTD', 'Δ%'].map(esc).join(SEP));

    DRE.LINES.forEach(line => {
      const cur  = Number(state.current?.[line.key]  || 0);
      const prev = Number(state.previous?.[line.key] || 0);
      const ytd  = Number(state.ytd?.[line.key]      || 0);
      const pct  = prev === 0
        ? '—'
        : (((cur - prev) / Math.abs(prev)) * 100).toFixed(1).replace('.', ',') + '%';

      lines.push([
        (line.prefix ? line.prefix + ' ' : '') + line.label,
        brl(cur), brl(prev), brl(ytd), pct
      ].map(esc).join(SEP));
    });

    const csv = BOM + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dre_' + DRE.toISODate(state.currentMonth) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    DRE.toast('CSV exportado.', 'success');
  }

  function exportPDF() {
    DRE.toast('Abrindo janela de impressão…', 'info');
    setTimeout(() => window.print(), 150);
  }
})();