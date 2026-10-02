/* =========================================================
   DEV HUB · Parceiros · export
   ---------------------------------------------------------
   Popover de exportação (PDF / XLS / XLSX / Cubo CSV).
   ========================================================= */

(function () {
  'use strict';

  const { escapeHtml, shortCode, typeLabel, showToast, state } = window.Parn;

  let exportMenuEl = null;

  /* ---------- Ícones ---------- */
  function iconPDF() {
    return `
      <svg viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 3h24l12 12v38a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"
              fill="#ffffff" stroke="#e53935" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M30 3v12h12" fill="none" stroke="#e53935" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="4" y="27" width="40" height="18" rx="2.5" fill="#e53935"/>
        <text x="24" y="40.5" text-anchor="middle"
              font-family="Inter, Arial, sans-serif" font-size="11.5"
              font-weight="800" fill="#ffffff" letter-spacing="0.5">PDF</text>
      </svg>`;
  }
  function iconXLS(color) {
    return `
      <svg viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 3h24l12 12v38a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"
              fill="#ffffff" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M30 3v12h12" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="4" y="27" width="40" height="18" rx="2.5" fill="${color}"/>
        <text x="24" y="40.5" text-anchor="middle"
              font-family="Inter, Arial, sans-serif" font-size="11.5"
              font-weight="800" fill="#ffffff" letter-spacing="0.5">XLS</text>
      </svg>`;
  }
  function iconCube() {
    return `
      <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M28 6 48 17v22L28 50 8 39V17z"
              fill="none" stroke="#8b95a3" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M8 17l20 11 20-11" fill="none" stroke="#8b95a3" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M28 28v22" fill="none" stroke="#8b95a3" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M28 6v22" fill="none" stroke="#8b95a3" stroke-width="2.2" stroke-linejoin="round"/>
      </svg>`;
  }

  function setupExportButton() {
    const btn = document.getElementById('tb-export');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openExportMenu(e.currentTarget);
    });

    document.addEventListener('click', (e) => {
      if (!exportMenuEl || exportMenuEl.hidden) return;
      if (exportMenuEl.contains(e.target)) return;
      if (e.target.closest('#tb-export')) return;
      closeExportMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && exportMenuEl && !exportMenuEl.hidden) closeExportMenu();
    });
    window.addEventListener('resize', closeExportMenu);
    window.addEventListener('scroll', closeExportMenu, true);
  }

  function buildExportMenu() {
    const menu = document.createElement('div');
    menu.className = 'parn-export';
    menu.hidden = true;
    menu.innerHTML = `
      <div class="parn-export__grid">
        <button type="button" class="parn-export__item" data-export="pdf">
          <span class="parn-export__icon">${iconPDF()}</span>
          <span class="parn-export__label">Exportar para PDF</span>
        </button>
        <button type="button" class="parn-export__item" data-export="xls">
          <span class="parn-export__icon">${iconXLS('#43a047')}</span>
          <span class="parn-export__label">Exportar para planilha (xls)</span>
        </button>
        <button type="button" class="parn-export__item" data-export="xlsx">
          <span class="parn-export__icon">${iconXLS('#1f3a5f')}</span>
          <span class="parn-export__label">Exportar para planilha (xlsx)</span>
        </button>
        <button type="button" class="parn-export__item" data-export="cube">
          <span class="parn-export__icon">${iconCube()}</span>
          <span class="parn-export__label">Exportar para cubo</span>
        </button>
      </div>`;

    document.body.appendChild(menu);

    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-export]');
      if (!btn) return;
      e.stopPropagation();
      const kind = btn.dataset.export;
      closeExportMenu();
      runExport(kind);
    });

    return menu;
  }

  function openExportMenu(anchor) {
    if (!exportMenuEl) exportMenuEl = buildExportMenu();
    exportMenuEl.hidden = false;

    const rect = anchor.getBoundingClientRect();
    const mRect = exportMenuEl.getBoundingClientRect();
    const margin = 8;

    let left = rect.left + rect.width / 2 - mRect.width / 2;
    let top = rect.bottom + 6;

    if (left < margin) left = margin;
    if (left + mRect.width > window.innerWidth - margin) left = window.innerWidth - mRect.width - margin;
    if (top + mRect.height > window.innerHeight - margin) top = Math.max(margin, rect.top - mRect.height - 6);

    exportMenuEl.style.left = left + 'px';
    exportMenuEl.style.top = top + 'px';
  }

  function closeExportMenu() {
    if (exportMenuEl) exportMenuEl.hidden = true;
  }

  function getExportRows() {
    return state.filtered.map((p) => {
      const addrList = p.customer_addresses || [];
      const a = addrList.find((x) => x.is_primary) || addrList[0] || {};
      const addr = [a.street, a.number].filter(Boolean).join(', ')
        + (a.city ? (a.street ? ' · ' : '') + a.city + (a.state ? '/' + a.state : '') : '');

      const phoneList = p.customer_phones || [];
      const ph = phoneList.find((x) => x.is_primary) || phoneList[0] || {};
      const emList = p.customer_emails || [];
      const em = emList.find((x) => x.is_primary) || emList[0] || {};

      return {
        'Código':           shortCode(p),
        'Nome Parceiro':    p.name || '',
        'Nome (Endereço)':  addr || '',
        'Razão social':     p.company_name || '',
        'Tipo':             typeLabel(p.type),
        'CNPJ/CPF':         p.cpf_cnpj || '',
        'Insc. Estadual':   p.state_registration || '',
        'Ativo':            (p.status !== 'inactive' && p.status !== 'blocked') ? 'Sim' : 'Não',
        'Cliente':          p.is_customer ? 'Sim' : 'Não',
        'Fornecedor':       p.is_supplier ? 'Sim' : 'Não',
        'Transportadora':   p.is_carrier ? 'Sim' : 'Não',
        'Simples Nacional': String(p.tax_regime || '').toLowerCase().includes('simples') ? 'Sim' : 'Não',
        'Telefone':         (ph && ph.phone) || p.phone || '',
        'E-mail':           (em && em.email) || p.email || '',
        'Cidade':           a.city || '',
        'UF':               a.state || ''
      };
    });
  }

  function getExportFileName(ext) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `parceiros_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`;
  }

  async function runExport(kind) {
    if (state.filtered.length === 0) { showToast('Nada para exportar. Ajuste os filtros.', 'error'); return; }
    try {
      switch (kind) {
        case 'pdf':  return exportPDF();
        case 'xls':  return exportXLS('xls');
        case 'xlsx': return exportXLS('xlsx');
        case 'cube': return exportCubeCSV();
      }
    } catch (e) {
      console.error('[parceiros] export erro:', e);
      showToast('Falha na exportação: ' + (e.message || 'erro desconhecido'), 'error');
    }
  }

  function exportPDF() {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { showToast('Biblioteca de PDF não carregada.', 'error'); return; }

    const rows = getExportRows();
    const headers = Object.keys(rows[0] || {});

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Parceiros — DEV HUB', 40, 40);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}  ·  ${rows.length} registro(s)`, 40, 56);
    doc.setTextColor(0);

    doc.autoTable({
      head: [headers],
      body: rows.map((r) => headers.map((h) => r[h])),
      startY: 72,
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, overflow: 'linebreak',
                textColor: [30, 30, 30], lineColor: [220, 220, 220], lineWidth: 0.4 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 8.5, halign: 'left' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 30, right: 30 },
      didDrawPage: () => {
        const total = doc.internal.getNumberOfPages();
        const page = doc.internal.getCurrentPageInfo().pageNumber;
        doc.setFontSize(8); doc.setTextColor(150);
        doc.text(`Página ${page} de ${total}`, doc.internal.pageSize.getWidth() - 60, doc.internal.pageSize.getHeight() - 20);
      }
    });

    doc.save(getExportFileName('pdf'));
    showToast(`Exportado: ${rows.length} parceiros em PDF.`, 'success');
  }

  function exportXLS(bookType) {
    if (!window.XLSX || !window.XLSX.utils) { showToast('Biblioteca de planilha não carregada.', 'error'); return; }
    const rows = getExportRows();
    const ws = window.XLSX.utils.json_to_sheet(rows);
    const headers = Object.keys(rows[0] || {});
    ws['!cols'] = headers.map((h) => {
      const max = rows.reduce((m, r) => Math.max(m, String(r[h] || '').length), h.length);
      return { wch: Math.min(Math.max(10, max + 2), 42) };
    });
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Parceiros');
    window.XLSX.writeFile(wb, getExportFileName(bookType), { bookType: bookType, compression: true });
    showToast(`Exportado: ${rows.length} parceiros em ${bookType.toUpperCase()}.`, 'success');
  }

  function exportCubeCSV() {
    const rows = getExportRows();
    if (rows.length === 0) { showToast('Nada para exportar.', 'error'); return; }

    const headers = Object.keys(rows[0]);
    const esc = (v) => {
      const s = String(v == null ? '' : v);
      return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    const lines = [headers.map(esc).join(';')];
    rows.forEach((r) => lines.push(headers.map((h) => esc(r[h])).join(';')));

    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExportFileName('csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Cubo exportado: ${rows.length} linhas em CSV.`, 'success');
  }

  Object.assign(window.Parn, {
    setupExportButton
  });

})();