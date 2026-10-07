/* =========================================================
   DEV HUB · Vendas · list.js
   Listagem, filtro, busca e renderização da tabela.
   ========================================================= */
(function () {
  'use strict';
  const DH = window.DH;
  const { state, utils, ui } = DH;

  async function fetchSalesWithJoin() {
    const { data, error } = await window.db
      .from('sales').select('*, customers(name)')
      .order('created_at', { ascending: false });
    if (error) { console.warn('[DEV HUB] Join falhou; fallback.', error); return null; }
    return data || [];
  }

  async function fetchSalesWithoutJoin() {
    const { data, error } = await window.db
      .from('sales').select('*').order('created_at', { ascending: false });
    if (error) { console.error('[DEV HUB] Falha ao carregar vendas:', error); return null; }

    const sales = data || [];
    const ids = sales.map(s => s.customer_id).filter(Boolean);
    if (ids.length === 0) return sales;

    const { data: customers, error: custErr } = await window.db
      .from('customers').select('id, name').in('id', ids);
    if (custErr) return sales;

    const map = {};
    (customers || []).forEach(c => { map[c.id] = c.name; });
    return sales.map(s => {
      if (s.customer_id && map[s.customer_id]) {
        return Object.assign({}, s, { customers: { name: map[s.customer_id] } });
      }
      return s;
    });
  }

  function updateCountLabel() {
    const total = state.sales.length;
    const label = document.getElementById('sales-count');
    if (!label) return;
    if (total === 0) { label.textContent = 'Nenhuma venda registrada'; return; }
    label.textContent = total === 1 ? '1 venda registrada' : total + ' vendas registradas';
  }

  function applyFilter() {
    if (!state.search) {
      state.filtered = state.sales.slice();
    } else {
      const term = state.search;
      state.filtered = state.sales.filter(s =>
        utils.matches(utils.formatSaleNumberSearch(s), term) ||
        utils.matches(utils.customerNameOf(s), term) ||
        utils.matches(s.created_by_name || '', term) ||
        utils.matches(DH.PAYMENT_LABELS[s.payment_method || ''] || s.payment_method, term)
      );
    }
    renderSalesTable();
  }

  function createCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function buildStatusBadge(status) {
    const info = utils.statusInfo(status);
    const badge = document.createElement('span');
    badge.className = 'badge ' + info.modifier;
    badge.textContent = info.label;
    return badge;
  }

  /* =========================================================
     Badge de pagamento (não pago / parcial / pago + parcelas)
     ========================================================= */
  function buildPaymentBadge(sale) {
    const total   = utils.toNumber(sale.total, 0);
    const deposit = utils.toNumber(sale.deposit_amount, 0);
    const wrap = document.createElement('span');

    const instSuffix = (sale.installment_count && sale.installment_count > 1)
      ? ' · ' + sale.installment_count + 'x'
      : '';

    if (deposit <= 0) {
      wrap.className = 'badge badge--muted';
      wrap.textContent = 'Não pago' + instSuffix;
      return wrap;
    }
    if (deposit >= total) {
      wrap.className = 'badge badge--success';
      wrap.textContent = 'Pago' + instSuffix;
      return wrap;
    }
    wrap.className = 'badge badge--warning';
    wrap.textContent = 'Parcial ' + utils.formatMoney(deposit) + instSuffix;
    return wrap;
  }

  function buildActionsCell(sale) {
    const cell = document.createElement('td');
    cell.className = 'cell--num';
    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    /* 👁️ Ver detalhes */
    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'row-action';
    viewBtn.title = 'Ver detalhes';
    viewBtn.setAttribute('aria-label', 'Ver detalhes da venda ' + utils.formatSaleNumber(sale));
    viewBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/>' +
      '<circle cx="12" cy="12" r="3"/></svg>';
    viewBtn.addEventListener('click', () => DH.modalDetail.open(sale));
    wrap.appendChild(viewBtn);

    /* ✏️ Corrigir */
    const jaCorrigida = sale.status === 'corrected' ||
                        sale.status === 'replaced' ||
                        !!sale.corrected_at;

    if (state.perms.correct && !jaCorrigida) {
      const correctBtn = document.createElement('button');
      correctBtn.type = 'button';
      correctBtn.className = 'row-action';
      correctBtn.title = 'Corrigir venda';
      correctBtn.setAttribute('aria-label', 'Corrigir venda ' + utils.formatSaleNumber(sale));
      correctBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
        ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 20h9"/>' +
        '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>' +
        '<path d="M18 9v6"/><path d="M15 12h6"/></svg>';
      correctBtn.addEventListener('click', () => DH.form.openCorrectSale(sale));
      wrap.appendChild(correctBtn);
    }

    cell.appendChild(wrap);
    return cell;
  }

  function buildSaleRow(sale) {
    const row = document.createElement('tr');
    row.dataset.id = sale.id || '';
    row.appendChild(createCell(utils.formatSaleNumber(sale), 'sale-number'));
    row.appendChild(createCell(utils.customerNameOf(sale), 'cell--muted'));
    row.appendChild(createCell(utils.formatDateTime(sale.created_at), 'cell--muted'));
    row.appendChild(createCell(utils.formatMoney(sale.total), 'cell--num cell-price'));

    const paymentCell = document.createElement('td');
    paymentCell.appendChild(buildPaymentBadge(sale));
    row.appendChild(paymentCell);

    row.appendChild(createCell(utils.paymentLabel(sale.payment_method), 'cell--muted'));

    const statusCell = document.createElement('td');
    statusCell.appendChild(buildStatusBadge(sale.status));
    row.appendChild(statusCell);

    row.appendChild(createCell(sale.created_by_name || '—', 'cell--muted'));
    row.appendChild(buildActionsCell(sale));
    return row;
  }

  function renderSalesTable() {
    const tbody = document.getElementById('sales-body');
    const tableWrap = document.getElementById('sales-table-wrap');
    if (!tbody || !tableWrap) return;

    if (state.sales.length === 0) {
      tableWrap.hidden = true;
      ui.showEmptyState(
        'Nenhuma venda registrada ainda.',
        state.perms.create
          ? 'Comece registrando sua primeira venda.'
          : 'Assim que houver vendas, elas aparecerão aqui.',
        state.perms.create
      );
      return;
    }
    if (state.filtered.length === 0) {
      tableWrap.hidden = true;
      ui.showEmptyState('Nenhuma venda encontrada.',
                        'Ajuste a busca para encontrar a venda desejada.', false);
      return;
    }

    ui.hideEmptyState();
    tableWrap.hidden = false;
    tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    state.filtered.forEach(sale => fragment.appendChild(buildSaleRow(sale)));
    tbody.appendChild(fragment);
  }

  async function loadSales() {
    ui.showLoading(true);
    let rows = await fetchSalesWithJoin();
    if (rows === null) rows = await fetchSalesWithoutJoin();
    ui.showLoading(false);

    if (rows === null) {
      state.sales = []; state.filtered = [];
      ui.showEmptyState('Não foi possível carregar as vendas.',
                        'Tente novamente em alguns instantes.', false);
      updateCountLabel();
      DH.toast('Não foi possível carregar as vendas.', 'error');
      return;
    }
    state.sales = rows;
    applyFilter();
    updateCountLabel();
  }

  function setupSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    input.addEventListener('input', () => {
      state.search = input.value.trim().toLowerCase();
      applyFilter();
    });
  }

  function setupToolbar() {
    const newBtn = document.getElementById('new-sale-btn');
    const emptyNewBtn = document.getElementById('empty-new-btn');
    if (newBtn) {
      if (state.perms.create) newBtn.addEventListener('click', DH.form.openFormView);
      else newBtn.hidden = true;
    }
    if (emptyNewBtn) {
      if (state.perms.create) emptyNewBtn.addEventListener('click', DH.form.openFormView);
      else emptyNewBtn.hidden = true;
    }
  }

  DH.list = {
    loadSales, applyFilter, setupSearch, setupToolbar,
    updateCountLabel, renderSalesTable
  };
})();