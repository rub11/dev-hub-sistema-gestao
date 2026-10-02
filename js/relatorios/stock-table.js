(function () {
  'use strict';
  const RH = window.RH;

  function stockOrder(product) {
    const stock = RH.utils.toInteger(product.stock, 0);
    const min = RH.utils.toInteger(product.minimum_stock, 0);
    if (stock === 0) return 0;
    if (stock <= min) return 1;
    return 2;
  }

  function render() {
    const wrap = document.getElementById('stock-table-wrap');
    const empty = document.getElementById('stock-table-empty');
    const tbody = document.getElementById('stock-table-body');
    if (!wrap || !empty || !tbody) return;

    const filtered = RH.filters.applyPriceFilterToProducts();

    if (filtered.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      empty.querySelector('p').textContent = RH.filters.hasPriceFilterActive()
        ? 'Nenhum produto encontrado na faixa de preço selecionada.'
        : 'Nenhum produto cadastrado.';
      tbody.innerHTML = '';
      return;
    }

    empty.hidden = true;
    wrap.hidden = false;
    tbody.innerHTML = '';

    const sorted = filtered.slice().sort((a, b) => {
      const sa = stockOrder(a), sb = stockOrder(b);
      if (sa !== sb) return sa - sb;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    const fragment = document.createDocumentFragment();
    sorted.forEach(p => {
      const tr = document.createElement('tr');

      const nameCell = document.createElement('td');
      nameCell.className = 'cell-product';
      const name = document.createElement('span');
      name.textContent = p.name || '—';
      nameCell.appendChild(name);
      if (p.active === false) {
        const small = document.createElement('small');
        small.textContent = 'Inativo';
        nameCell.appendChild(small);
      }
      tr.appendChild(nameCell);

      tr.appendChild(RH.utils.createCell(p.code || '—', 'cell--muted'));
      tr.appendChild(RH.utils.createCell(String(RH.utils.toInteger(p.stock, 0)), 'cell--num cell-stock'));
      tr.appendChild(RH.utils.createCell(String(RH.utils.toInteger(p.minimum_stock, 0)), 'cell--num cell-stock'));

      const stock = RH.utils.toInteger(p.stock, 0);
      const min = RH.utils.toInteger(p.minimum_stock, 0);
      const info = RH.utils.stockInfo(stock, min);
      const statusCell = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'badge ' + info.modifier;
      badge.textContent = info.label;
      statusCell.appendChild(badge);
      tr.appendChild(statusCell);

      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
  }

  RH.stockTable = { render };
})();