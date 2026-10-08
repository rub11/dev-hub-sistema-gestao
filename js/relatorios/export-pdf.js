/* =========================================================
   DEV HUB · Relatórios · export-pdf.js
   Gera PDF executivo com KPIs + rankings + movimentações.
   Usa jsPDF + autoTable + Chart.js (screenshot).
   ========================================================= */
(function () {
  'use strict';
  const RH = window.RH;
  const state = RH.state;

  function setup() {
    const btn = document.getElementById('export-pdf-btn');
    if (!btn) return;
    btn.addEventListener('click', generatePDF);
  }

  function setButtonEnabled(enabled) {
    const btn = document.getElementById('export-pdf-btn');
    if (!btn) return;
    const can = state.perms.export === true;
    btn.hidden = !can;
    btn.disabled = !enabled || !can;
  }

  async function generatePDF() {
    if (!state.perms.export) {
      RH.toast('Você não tem permissão para exportar relatórios.', 'error');
      return;
    }

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      RH.toast('Biblioteca de PDF não carregou.', 'error');
      return;
    }

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 40;

      let y = margin;

      /* ---------- HEADER ---------- */
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(30, 30, 40);
      doc.text('Relatório Executivo', margin, y);
      y += 22;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 130);
      const periodLabel = (document.getElementById('period-range') || {}).textContent || '—';
      doc.text('DEV HUB · ' + periodLabel.replace(/^Período:\s*/, ''), margin, y);
      y += 14;
      doc.text('Gerado em ' + new Date().toLocaleString('pt-BR'), margin, y);
      y += 24;

      /* ---------- KPIs ---------- */
      y = sectionTitle(doc, 'Resumo de vendas', margin, y);

      const kpis = [
        ['Total de vendas', document.getElementById('kpi-sales-count')],
        ['Faturamento', document.getElementById('kpi-revenue')],
        ['Ticket médio', document.getElementById('kpi-ticket')],
        ['Descontos', document.getElementById('kpi-discounts')]
      ];

      const cardW = (pageW - margin * 2 - 18) / 2;
      const cardH = 48;
      let cx = margin;

      kpis.forEach((k, i) => {
        const cy = y + Math.floor(i / 2) * (cardH + 8);

        doc.setDrawColor(220, 220, 226);
        doc.setFillColor(248, 249, 252);
        doc.roundedRect(cx, cy, cardW, cardH, 6, 6, 'FD');

        doc.setFontSize(9);
        doc.setTextColor(120, 120, 130);
        doc.setFont('helvetica', 'normal');
        doc.text(k[0].toUpperCase(), cx + 12, cy + 16);

        doc.setFontSize(15);
        doc.setTextColor(30, 30, 40);
        doc.setFont('helvetica', 'bold');
        const val = k[1] ? (k[1].textContent || '—') : '—';
        doc.text(val, cx + 12, cy + 36);

        cx = (i % 2 === 0) ? margin + cardW + 18 : margin;
      });

      y += 2 * (cardH + 8) + 10;

      /* ---------- GRÁFICO ---------- */
      const canvas = document.getElementById('chart-evolution');
      if (canvas && canvas.style.display !== 'none') {
        y = sectionTitle(doc, 'Evolução das vendas', margin, y);
        try {
          const img = canvas.toDataURL('image/png', 1.0);
          const imgW = pageW - margin * 2;
          const imgH = imgW * 0.42;
          if (y + imgH > pageH - margin) { doc.addPage(); y = margin; }
          doc.addImage(img, 'PNG', margin, y, imgW, imgH);
          y += imgH + 16;
        } catch (e) {
          console.warn('[pdf] falha ao capturar gráfico:', e);
        }
      }

      /* ---------- TOP PRODUTOS ---------- */
      if (y > pageH - margin - 120) { doc.addPage(); y = margin; }
      y = sectionTitle(doc, 'Top produtos', margin, y);
      y = tableFromDOM(doc, 'top-products-body', margin, y, pageW);

      /* ---------- TOP CLIENTES ---------- */
      if (y > pageH - margin - 120) { doc.addPage(); y = margin; }
      y = sectionTitle(doc, 'Top clientes', margin, y);
      y = tableFromDOM(doc, 'top-customers-body', margin, y, pageW);

      /* ---------- MOVIMENTAÇÕES ---------- */
      if (y > pageH - margin - 120) { doc.addPage(); y = margin; }
      y = sectionTitle(doc, 'Movimentações de estoque', margin, y);
      y = tableFromDOM(doc, 'movements-body', margin, y, pageW);

      /* ---------- RODAPÉ ---------- */
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(160, 160, 170);
        doc.text('DEV HUB · Relatório gerado automaticamente', margin, pageH - 20);
        doc.text('Página ' + p + ' de ' + totalPages, pageW - margin - 60, pageH - 20);
      }

      const filename = 'relatorio_' + RH.utils.fileStamp() + '.pdf';
      doc.save(filename);
      RH.toast('PDF gerado com sucesso.', 'success');
    } catch (err) {
      console.error('[pdf] erro:', err);
      RH.toast('Não foi possível gerar o PDF: ' + (err.message || 'erro'), 'error');
    }
  }

  function sectionTitle(doc, title, x, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 40);
    doc.text(title, x, y);
    doc.setDrawColor(220, 220, 226);
    doc.line(x, y + 4, doc.internal.pageSize.getWidth() - x, y + 4);
    return y + 16;
  }

  function tableFromDOM(doc, tbodyId, x, y, pageW) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return y;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length === 0) return y + 6;

    const table = tbody.closest('table');
    const headers = table
      ? Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim())
      : [];

    const body = rows.map(tr =>
      Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
    );

    doc.autoTable({
      head: headers.length ? [headers] : undefined,
      body: body,
      startY: y,
      margin: { left: x, right: x },
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        cellPadding: 4,
        overflow: 'linebreak',
        textColor: [30, 30, 30],
        lineColor: [225, 225, 230],
        lineWidth: 0.3
      },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left'
      },
      alternateRowStyles: { fillColor: [249, 250, 251] }
    });

    return (doc.lastAutoTable && doc.lastAutoTable.finalY
      ? doc.lastAutoTable.finalY
      : y) + 14;
  }

  RH.exportPDF = { setup, setButtonEnabled };
})();