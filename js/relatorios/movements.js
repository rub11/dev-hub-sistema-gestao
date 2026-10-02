(function () {
  'use strict';
  const RH = window.RH;
  const state = RH.state;

  function setupFilter() {
    const select = document.getElementById('movement-type-filter');
    if (!select) return;
    select.addEventListener('change', function () {
      state.movementTypeFilter = select.value;
      render();
    });
  }

  function render() {
    const wrap = document.getElementById('movements-wrap');
    const empty = document.getElementById('movements-empty');
    const tbody = document.getElementById('movements-body');
    const countLabel = document.getElementById('movements-count');
    if (!wrap || !empty || !tbody) return;

    const filter = state.movementTypeFilter;
    const rows = state.movements.filter(m => {
      if (!filter) return true;
      return String(m.type || '').toLowerCase() === filter;
    });

    if (state.movements.length === 0) {
      wrap.hidden = true; empty.hidden = false; tbody.innerHTML = '';
      if (countLabel) countLabel.textContent = 'Nenhuma movimentação no período';
      return;
    }

    if (rows.length === 0) {
      wrap.hidden = true; empty.hidden = false;
      empty.querySelector('p').textContent = 'Nenhuma movimentação encontrada com este filtro.';
      tbody.innerHTML = '';
      if (countLabel) countLabel.textContent = 'Nenhum resultado para o filtro aplicado';
      return;
    }

    empty.hidden = true; wrap.hidden = false; tbody.innerHTML = '';

    if (countLabel) {
      countLabel.textContent = rows.length === 1
        ? '1 movimentação exibida'
        : RH.NUMBER.format(rows.length) + ' movimentações exibidas';
    }

    const fragment = document.createDocumentFragment();
    rows.forEach(m => fragment.appendChild(buildRow(m)));
    tbody.appendChild(fragment);
  }

  function buildRow(movement) {
    const tr = document.createElement('tr');
    tr.appendChild(RH.utils.createCell(RH.utils.formatDateTime(movement.created_at), 'cell--muted'));
    tr.appendChild(RH.utils.createCell(productNameById(movement.product_id), ''));

    const typeCell = document.createElement('td');
    const info = RH.MOVEMENT_TYPE_INFO[String(movement.type || '').toLowerCase()];
    const badge = document.createElement('span');
    badge.className = 'badge ' + (info ? info.modifier : '');
    badge.textContent = info ? info.label : (movement.type || '—');
    typeCell.appendChild(badge);
    tr.appendChild(typeCell);

    const qtyCell = document.createElement('td');
    qtyCell.className = 'cell--num';
    const type = String(movement.type || '').toLowerCase();
    const qty = RH.utils.toInteger(movement.quantity, 0);
    const qtySpan = document.createElement('span');
    qtySpan.className = 'movement-qty';
    if (type === 'entrada') {
      qtySpan.classList.add('movement-qty--in');
      qtySpan.textContent = '+' + qty;
    } else if (type === 'saida') {
      qtySpan.classList.add('movement-qty--out');
      qtySpan.textContent = '-' + qty;
    } else {
      qtySpan.classList.add(qty >= 0 ? 'movement-qty--in' : 'movement-qty--out');
      qtySpan.textContent = qty >= 0 ? '+' + qty : String(qty);
    }
    qtyCell.appendChild(qtySpan);
    tr.appendChild(qtyCell);

    tr.appendChild(RH.utils.createCell(String(RH.utils.toInteger(movement.previous_stock, 0)), 'cell--num cell-stock'));
    tr.appendChild(RH.utils.createCell(String(RH.utils.toInteger(movement.new_stock, 0)), 'cell--num cell-stock'));
    tr.appendChild(RH.utils.createCell(movement.reason || '—', 'movement-reason'));
    return tr;
  }

  function productNameById(id) {
    if (!id) return '—';
    const product = state.products.find(p => p.id === id);
    return (product && product.name) || '—';
  }

  RH.movements = { setupFilter, render };
})();