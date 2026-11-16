

(function () {
  'use strict';

  const { state, escapeHTML, fmtBRL, fmtDate } = window.Fin;

  let currentData = [];
  let currentTitle = 'Relatório';
  let orientation = 'p';

  /* =========================================================
     ABRIR MODAL
     ========================================================= */
  function openExportCenter(data, title) {
    currentData = data || [];
    currentTitle = title || 'Relatório';
    
    // Se não vier dados, tenta pegar dos selecionados ou de todos
    if (currentData.length === 0) {
      if (state.selected.size > 0) {
        currentData = state.entries.filter(e => state.selected.has(e.id));
        currentTitle = 'Títulos Selecionados';
      } else {
        currentData = state.entries;
        currentTitle = 'Todos os Títulos';
      }
    }

    renderModal();
  }

  /* =========================================================
     RENDER MODAL
     ========================================================= */
  function renderModal() {
    document.querySelectorAll('.fin-export-modal').forEach(el => el.remove());

    const modal = document.createElement('div');
    modal.className = 'fin-export-modal';
    modal.innerHTML = `
      <div class="fin-export-modal__dialog" role="dialog" aria-modal="true">
        
        <header class="fin-export-modal__head">
          <h2 class="fin-export-modal__title">Central de Exportação</h2>
          <button class="fin-export-modal__close" data-close>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>

        <div class="fin-export-modal__body">
          
          <!-- Sidebar de Colunas -->
          <aside class="fin-export-sidebar">
            <h3>Colunas</h3>
            <label class="fin-export-option"><input type="checkbox" checked data-col="title_code"> Título</label>
            <label class="fin-export-option"><input type="checkbox" checked data-col="due_date"> Vencimento</label>
            <label class="fin-export-option"><input type="checkbox" checked data-col="status"> Status</label>
            <label class="fin-export-option"><input type="checkbox" checked data-col="partner_name"> Parceiro</label>
            <label class="fin-export-option"><input type="checkbox" checked data-col="doc_number"> Documento</label>
            <label class="fin-export-option"><input type="checkbox" checked data-col="amount_cents"> Valor (R$)</label>
            <label class="fin-export-option"><input type="checkbox" checked data-col="paid_cents"> Pago (R$)</label>
            <label class="fin-export-option"><input type="checkbox" checked data-col="current_balance_cents"> Saldo (R$)</label>
            <label class="fin-export-option"><input type="checkbox" checked data-col="notes"> Histórico</label>
          </aside>

          <!-- Formatos -->
          <div class="fin-export-main">
            <h3>Formatos Disponíveis</h3>
            <div class="fin-export-grid">
              <button class="fin-export-btn" data-format="pdf">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6"/><path d="M9 11h6"/></svg>
                PDF
              </button>
              <button class="fin-export-btn" data-format="xlsx">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m8 13 8 8"/><path d="m16 13-8 8"/></svg>
                XLSX
              </button>
              <button class="fin-export-btn" data-format="csv">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8"/></svg>
                CSV
              </button>
              <button class="fin-export-btn" data-format="docx">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>
                DOCX
              </button>
              <button class="fin-export-btn" data-format="json">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M10 20H6a2 2 0 0 1-2-2v-4a2 2 0 0 0-2-2 2 2 0 0 0 2-2V6a2 2 0 0 1 2-2h4"/><path d="M14 20h4a2 2 0 0 0 2-2v-4a2 2 0 0 1 2-2 2 2 0 0 1-2-2V6a2 2 0 0 0-2-2h-4"/></svg>
                JSON
              </button>
              <button class="fin-export-btn" data-format="xml">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                XML
              </button>
              <button class="fin-export-btn" data-format="html">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                HTML
              </button>
              <button class="fin-export-btn" data-format="txt">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8"/></svg>
                TXT
              </button>
              <button class="fin-export-btn fin-export-btn--highlight" data-format="zip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>
                ZIP (Tudo)
              </button>
            </div>
          </div>
        </div>

        <footer class="fin-export-modal__foot">
          <div class="fin-export-advanced">
            <span style="font-size:12px; color:var(--text-muted);">Orientação PDF:</span>
            <div class="fin-export-orientation">
              <button data-orient="p" class="is-active">Retrato</button>
              <button data-orient="l">Paisagem</button>
            </div>
          </div>
          <button class="fin-btn fin-btn--ghost" data-close>Fechar</button>
        </footer>
      </div>
    `;

    document.body.appendChild(modal);

    // Eventos
    modal.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => modal.remove());
    });

    modal.querySelectorAll('.fin-export-orientation button').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.fin-export-orientation button').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        orientation = btn.dataset.orient;
      });
    });

    modal.querySelectorAll('.fin-export-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const format = btn.dataset.format;
        executeExport(format, modal);
      });
    });
  }

  /* =========================================================
     COLETA E PREPARAÇÃO DE DADOS
     ========================================================= */
  function getSelectedColumns(modal) {
    const cols = [];
    modal.querySelectorAll('.fin-export-option input:checked').forEach(input => {
      cols.push(input.dataset.col);
    });
    return cols;
  }

  function getPreparedData(modal) {
    const cols = getSelectedColumns(modal);
    const isFullExport = cols.length === 8; // Se todas estiverem marcadas

    return currentData.map(entry => {
      const row = {};
      cols.forEach(col => {
        if (col === 'amount_cents' || col === 'paid_cents' || col === 'current_balance_cents') {
          const val = col === 'amount_cents' ? entry.amount_cents : (col === 'paid_cents' ? entry.paid_cents : (entry.current_balance_cents || (entry.amount_cents - (entry.paid_cents || 0))));
          row[col] = fmtBRL(val);
        } else if (col === 'due_date' || col === 'issue_date') {
          row[col] = fmtDate(entry[col]);
        } else {
          row[col] = entry[col] || '';
        }
      });
      return row;
    });
  }

  function getColumnLabel(col) {
    const labels = {
      title_code: 'Título',
      due_date: 'Vencimento',
      status: 'Status',
      partner_name: 'Parceiro',
      doc_number: 'Documento',
      amount_cents: 'Valor',
      paid_cents: 'Pago',
      current_balance_cents: 'Saldo',
      notes: 'Histórico'
    };
    return labels[col] || col;
  }

  function generateFileName(ext) {
    const date = new Date().toISOString().slice(0, 10);
    const time = new Date().toTimeString().slice(0, 5).replace(':', '');
    const safeTitle = currentTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return `${safeTitle}_${date}_${time}.${ext}`;
  }

  /* =========================================================
     LÓGICA DE EXPORTAÇÃO
     ========================================================= */
  async function executeExport(format, modal) {
    const data = getPreparedData(modal);
    const cols = getSelectedColumns(modal);

    if (data.length === 0) {
      window.Fin.toast?.('Nenhum dado para exportar.', 'error');
      return;
    }

    const headers = cols.map(getColumnLabel);
    const keys = cols;

    try {
      if (format === 'csv' || format === 'txt' || format === 'tsv') {
        exportText(data, keys, headers, format);
      } else if (format === 'json') {
        exportJSON(data);
      } else if (format === 'xml') {
        exportXML(data, keys, headers);
      } else if (format === 'html') {
        exportHTML(data, keys, headers);
      } else if (format === 'xlsx' || format === 'xls' || format === 'ods') {
        exportExcel(data, keys, headers);
      } else if (format === 'pdf') {
        exportPDF(data, keys, headers);
      } else if (format === 'docx') {
        exportDOCX(data, keys, headers);
      } else if (format === 'zip') {
        await exportZIP(data, keys, headers, modal);
      }
    } catch (e) {
      console.error('[export] Erro:', e);
      window.Fin.toast?.('Erro ao gerar arquivo: ' + e.message, 'error');
    }
  }

  /* --- 1. Texto Puro (CSV, TXT, TSV) --- */
  function exportText(data, keys, headers, type) {
    const sep = type === 'tsv' ? '\t' : ';';
    const bom = '\uFEFF';
    
    let content = headers.join(sep) + '\r\n';
    data.forEach(row => {
      const line = keys.map(k => {
        let val = row[k] === null || row[k] === undefined ? '' : String(row[k]);
        if (val.includes(sep) || val.includes('"') || val.includes('\n')) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(sep);
      content += line + '\r\n';
    });

    const blob = new Blob([bom + content], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, generateFileName(type));
    window.Fin.toast?.(`Arquivo ${type.toUpperCase()} gerado!`, 'success');
  }

  /* --- 2. JSON --- */
  function exportJSON(data) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    saveAs(blob, generateFileName('json'));
    window.Fin.toast?.('Arquivo JSON gerado!', 'success');
  }

  /* --- 3. XML --- */
  function exportXML(data, keys, headers) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<relatorio>\n';
    data.forEach(row => {
      xml += '  <item>\n';
      keys.forEach((k, i) => {
        const tag = k.replace(/_/g, '-');
        const val = String(row[k] || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        xml += `    <${tag}>${val}</${tag}>\n`;
      });
      xml += '  </item>\n';
    });
    xml += '</relatorio>';
    const blob = new Blob([xml], { type: 'application/xml' });
    saveAs(blob, generateFileName('xml'));
    window.Fin.toast?.('Arquivo XML gerado!', 'success');
  }

  /* --- 4. HTML --- */
  function exportHTML(data, keys, headers) {
    let html = `<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;font-size:12px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ccc;padding:8px;text-align:left;} th{background:#f4f4f4;}</style></head><body>`;
    html += `<h2>${currentTitle}</h2>`;
    html += `<table><thead><tr>`;
    headers.forEach(h => { html += `<th>${h}</th>`; });
    html += `</tr></thead><tbody>`;
    data.forEach(row => {
      html += `<tr>`;
      keys.forEach(k => { html += `<td>${row[k] || ''}</td>`; });
      html += `</tr>`;
    });
    html += `</tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    saveAs(blob, generateFileName('html'));
    window.Fin.toast?.('Arquivo HTML gerado!', 'success');
  }

  /* --- 5. Excel (XLSX, XLS, ODS) --- */
  function exportExcel(data, keys, headers) {
    const wsData = [headers];
    data.forEach(row => {
      wsData.push(keys.map(k => row[k]));
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    
    // Garante compatibilidade com XLSX e ODS
    XLSX.writeFile(wb, generateFileName('xlsx'));
    window.Fin.toast?.('Planilha Excel gerada!', 'success');
  }

  /* --- 6. PDF (jsPDF + AutoTable) --- */
  function exportPDF(data, keys, headers) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: orientation, unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(currentTitle, 40, 40);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Gerado em: ' + new Date().toLocaleString('pt-BR'), 40, 60);

    // Tabela
    doc.autoTable({
      head: [headers],
      body: data.map(row => keys.map(k => row[k])),
      startY: 80,
      margin: { left: 40, right: 40 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [249, 115, 22] }, // Laranja DEV HUB
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    // Paginação
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${totalPages}`, pageW - 100, doc.internal.pageSize.getHeight() - 20);
    }

    doc.save(generateFileName('pdf'));
    window.Fin.toast?.('PDF gerado!', 'success');
  }

  /* --- 7. DOCX (docx) --- */
  function exportDOCX(data, keys, headers) {
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun } = window.docx;

    const rows = data.map(row => new TableRow({
      children: keys.map(k => new TableCell({
        children: [new Paragraph(String(row[k] || ''))]
      }))
    }));

    const headerRow = new TableRow({
      children: headers.map(h => new TableCell({
        children: [new Paragraph({ text: h, bold: true })],
        shading: { fill: "F97316" }
      }))
    });

    const table = new Table({ rows: [headerRow, ...rows] });

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ text: currentTitle, heading: "Heading1" }),
          new Paragraph({ text: "Gerado em: " + new Date().toLocaleString('pt-BR') }),
          new Paragraph({ text: "" }), // Spacer
          table
        ]
      }]
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, generateFileName('docx'));
      window.Fin.toast?.('Documento Word gerado!', 'success');
    });
  }

  /* --- 8. ZIP com Tudo --- */
  async function exportZIP(data, keys, headers, modal) {
    const zip = new JSZip();
    const date = new Date().toLocaleString('pt-BR');
    
    // Gerar HTML interno
    let html = `<html><body><h2>${currentTitle}</h2><table border="1"><tr>`;
    headers.forEach(h => html += `<th>${h}</th>`);
    html += `</tr>`;
    data.forEach(row => {
      html += `<tr>`;
      keys.forEach(k => html += `<td>${row[k]}</td>`);
      html += `</tr>`;
    });
    html += `</table></body></html>`;

    // Gerar CSV interno
    let csv = '\uFEFF' + headers.join(';') + '\n';
    data.forEach(row => {
      csv += keys.map(k => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(';') + '\n';
    });

    // Adicionar arquivos ao ZIP
    zip.file('dados.csv', csv);
    zip.file('relatorio.html', html);
    zip.file('dados.json', JSON.stringify(data, null, 2));

    // Gerar o ZIP
    zip.generateAsync({ type: 'blob' }).then(blob => {
      saveAs(blob, generateFileName('zip'));
      window.Fin.toast?.('Arquivo ZIP com múltiplos formatos gerado!', 'success');
    });
  }

  // Expõe globalmente
  window.Fin.openExportCenter = openExportCenter;

})();