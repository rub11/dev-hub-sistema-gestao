(function () {
  'use strict';
  const RH = window.RH;
  const state = RH.state;

  function setup() {
    const salesBtn = document.getElementById('export-sales-btn');
    const productsBtn = document.getElementById('export-products-btn');
    if (salesBtn) salesBtn.addEventListener('click', exportSalesCSV);
    if (productsBtn) productsBtn.addEventListener('click', exportProductsCSV);
  }

  function setButtonsEnabled(enabled) {
    const salesBtn = document.getElementById('export-sales-btn');
    const productsBtn = document.getElementById('export-products-btn');
    const canExport = state.perms.export === true;
    if (salesBtn) {
      salesBtn.hidden = !canExport;
      salesBtn.disabled = !enabled || !canExport;
    }
    if (productsBtn) {
      productsBtn.hidden = !canExport;
      productsBtn.disabled = !enabled || !canExport;
    }
  }

  function exportSalesCSV() {
    if (!state.perms.export) {
      RH.toast('Você não tem permissão para exportar relatórios.', 'error'); return;
    }
    const valid = RH.utils.getValidSales();
    if (valid.length === 0) {
      RH.toast('Nenhuma venda para exportar no período selecionado.', 'error'); return;
    }
    const headers = ['Nº', 'Data', 'Cliente', 'Subtotal', 'Desconto', 'Total', 'Pagamento', 'Status'];
    const rows = valid.map(s => [
      s.sale_number != null ? s.sale_number : '',
      RH.utils.formatDateTimeCSV(s.created_at),
      RH.utils.customerNameForCSV(s.customer_id),
      RH.utils.toCSVNumber(s.subtotal),
      RH.utils.toCSVNumber(s.discount),
      RH.utils.toCSVNumber(s.total),
      RH.utils.labelForPayment(s.payment_method),
      s.status || ''
    ]);
    downloadCSV('vendas_' + RH.utils.fileStamp() + '.csv', headers, rows);
    RH.toast('Exportação de vendas concluída.', 'success');
  }

  function exportProductsCSV() {
    if (!state.perms.export) {
      RH.toast('Você não tem permissão para exportar relatórios.', 'error'); return;
    }
    const filtered = RH.filters.applyPriceFilterToProducts();
    if (filtered.length === 0) {
      RH.toast('Nenhum produto para exportar.', 'error'); return;
    }
    const headers = ['Produto', 'Código', 'Estoque', 'Estoque mínimo', 'Situação', 'Preço', 'Ativo'];
    const rows = filtered.map(p => {
      const stock = RH.utils.toInteger(p.stock, 0);
      const min = RH.utils.toInteger(p.minimum_stock, 0);
      return [
        p.name || '', p.code || '',
        stock, min,
        RH.utils.stockInfo(stock, min).label,
        RH.utils.toCSVNumber(p.price),
        p.active === false ? 'Não' : 'Sim'
      ];
    });
    downloadCSV('produtos_' + RH.utils.fileStamp() + '.csv', headers, rows);
    RH.toast('Exportação de produtos concluída.', 'success');
  }

  function downloadCSV(filename, headers, rows) {
    const SEP = ';';
    const BOM = '\uFEFF';
    function esc(value) {
      const s = value === null || value === undefined ? '' : String(value);
      if (s.indexOf(SEP) !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }
    const lines = [headers.map(esc).join(SEP)];
    rows.forEach(r => lines.push(r.map(esc).join(SEP)));
    const csv = BOM + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  RH.exportCSV = { setup, setButtonsEnabled };
})();