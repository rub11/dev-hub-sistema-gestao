(function () {
  'use strict';
  const RH = window.RH;
  const state = RH.state;

  function renderTopProducts() {
    const wrap = document.getElementById('top-products-wrap');
    const empty = document.getElementById('top-products-empty');
    const tbody = document.getElementById('top-products-body');
    if (!wrap || !empty || !tbody) return;

    const filteredIds = RH.filters.getFilteredProductIds();
    const filterActive = RH.filters.hasPriceFilterActive();

    const items = state.saleItems.filter(item => {
      if (!filterActive) return true;
      if (!item.product_id) return false;
      return filteredIds.has(item.product_id);
    });

    if (items.length === 0) {
      wrap.hidden = true; empty.hidden = false; tbody.innerHTML = '';
      return;
    }

    const map = new Map();
    items.forEach(item => {
      const key = item.product_id || ('name:' + (item.product_name || '—'));
      if (!map.has(key)) map.set(key, { name: item.product_name || '—', quantity: 0, revenue: 0 });
      const e = map.get(key);
      e.quantity += RH.utils.toInteger(item.quantity, 0);
      e.revenue += RH.utils.toNumber(item.subtotal, 0);
    });

    const rows = Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 10);

    if (rows.length === 0) {
      wrap.hidden = true; empty.hidden = false;
      return;
    }

    empty.hidden = true; wrap.hidden = false; tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    rows.forEach(row => {
      const tr = document.createElement('tr');
      tr.appendChild(RH.utils.createCell(row.name, 'cell-product'));
      tr.appendChild(RH.utils.createCell(RH.NUMBER.format(row.quantity), 'cell--num'));
      tr.appendChild(RH.utils.createCell(RH.utils.formatMoney(row.revenue), 'cell--num cell-price'));
      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
  }

  function renderTopCustomers() {
    const wrap = document.getElementById('top-customers-wrap');
    const empty = document.getElementById('top-customers-empty');
    const tbody = document.getElementById('top-customers-body');
    if (!wrap || !empty || !tbody) return;

    const valid = RH.utils.getValidSales();
    const map = new Map();
    valid.forEach(s => {
      if (!s.customer_id) return;
      if (!map.has(s.customer_id)) map.set(s.customer_id, { id: s.customer_id, count: 0, total: 0 });
      const e = map.get(s.customer_id);
      e.count += 1;
      e.total += RH.utils.toNumber(s.total, 0);
    });

    const rows = Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    if (rows.length === 0) {
      wrap.hidden = true; empty.hidden = false; tbody.innerHTML = '';
      return;
    }

    empty.hidden = true; wrap.hidden = false; tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    rows.forEach(row => {
      const tr = document.createElement('tr');
      tr.appendChild(RH.utils.createCell(
        state.customersById[row.id] || 'Cliente', 'cell-product'
      ));
      tr.appendChild(RH.utils.createCell(RH.NUMBER.format(row.count), 'cell--num'));
      tr.appendChild(RH.utils.createCell(RH.utils.formatMoney(row.total), 'cell--num cell-price'));
      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
  }

  RH.rankings = { renderTopProducts, renderTopCustomers };
})();