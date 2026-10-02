(function () {
  'use strict';
  const DH = window.DH;
  const { state, utils } = DH;

  function el(name) { return DH.form.els()[name]; }

  function createCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function render() {
    const cartBody = el('cartBody');
    const cartWrap = el('cartWrap');
    const cartEmpty = el('cartEmpty');
    if (!cartBody || !cartWrap || !cartEmpty) return;

    if (state.cart.length === 0) {
      cartWrap.hidden = true;
      cartEmpty.hidden = false;
      cartBody.innerHTML = '';
      return;
    }

    cartEmpty.hidden = true;
    cartWrap.hidden = false;
    cartBody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    state.cart.forEach(item => {
      const row = document.createElement('tr');
      row.dataset.id = item.product_id;

      const nameCell = document.createElement('td');
      nameCell.className = 'cart-table__name';
      nameCell.textContent = item.product_name || '—';
      row.appendChild(nameCell);

      row.appendChild(createCell(utils.formatMoney(item.unit_price), 'cell--num'));

      const qtyCell = document.createElement('td');
      qtyCell.className = 'cell--num';
      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.min = '1';
      qtyInput.step = '1';
      qtyInput.value = String(item.quantity);
      qtyInput.className = 'qty-input';
      qtyInput.setAttribute('aria-label', 'Quantidade de ' + item.product_name);
      qtyInput.addEventListener('change',
        () => onQuantityChange(item.product_id, qtyInput.value, qtyInput));
      qtyCell.appendChild(qtyInput);
      row.appendChild(qtyCell);

      row.appendChild(createCell(utils.formatMoney(item.subtotal), 'cell--num cell-price'));

      const actionsCell = document.createElement('td');
      actionsCell.className = 'cell--num';
      const wrap = document.createElement('div');
      wrap.className = 'row-actions';
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'row-action row-action--danger';
      removeBtn.title = 'Remover';
      removeBtn.setAttribute('aria-label', 'Remover ' + item.product_name);
      removeBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
        ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M3 6h18"/>' +
        '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
        '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
      removeBtn.addEventListener('click', () => remove(item.product_id));
      wrap.appendChild(removeBtn);
      actionsCell.appendChild(wrap);
      row.appendChild(actionsCell);

      fragment.appendChild(row);
    });
    cartBody.appendChild(fragment);
  }

  function onQuantityChange(productId, rawValue, inputEl) {
    const item = state.cart.find(i => i.product_id === productId);
    if (!item) return;
    const qty = utils.toInteger(rawValue, 0);

    if (qty <= 0) {
      showFeedback('Informe uma quantidade válida.');
      inputEl.value = String(item.quantity);
      return;
    }
    if (qty > item.stock_available) {
      showFeedback('Estoque insuficiente.');
      inputEl.value = String(item.quantity);
      return;
    }

    item.quantity = qty;
    item.subtotal = utils.round2(qty * item.unit_price);
    clearFeedback();
    render();
    recalc();
  }

  function remove(productId) {
    state.cart = state.cart.filter(i => i.product_id !== productId);
    render();
    recalc();
    clearFeedback();
  }

  function recalc() {
    const subtotal = state.cart.reduce((sum, item) =>
      sum + utils.toNumber(item.subtotal, 0), 0);
    let discount = 0;

    const discountEl = el('discount');
    const discountPctEl = el('discountPct');

    if (state.lastDiscountEdit === 'pct' && discountPctEl) {
      let pct = utils.toNumber(discountPctEl.value, 0);
      if (!Number.isFinite(pct) || pct < 0) pct = 0;
      if (pct > 100) { pct = 100; discountPctEl.value = '100'; }
      discount = utils.round2(subtotal * pct / 100);
      discountEl.value = String(discount);
    } else {
      discount = utils.toNumber(discountEl.value, 0);
      if (!Number.isFinite(discount) || discount < 0) discount = 0;
      if (discount > subtotal) {
        discount = subtotal;
        discountEl.value = String(utils.round2(discount));
      }
      const pct = subtotal > 0 ? utils.round2(discount / subtotal * 100) : 0;
      if (discountPctEl) discountPctEl.value = String(pct);
    }

    const total = Math.max(0, utils.round2(subtotal - discount));
    el('totalSub').textContent = utils.formatMoney(subtotal);
    el('totalTotal').textContent = utils.formatMoney(total);
  }

  function reset() {
    const form = el('form');
    if (!form) return;
    form.reset();
    el('customer').value = '';
    el('discount').value = '0';
    if (el('discountPct')) el('discountPct').value = '0';
    el('payment').value = '';
    el('notes').value = '';
    state.cart = [];
    state.lastDiscountEdit = 'brl';
    clearFeedback();
    DH.productSearch.clear();
    render();
    recalc();
  }

  function showFeedback(message) {
    const fb = el('feedback');
    if (!fb) return;
    fb.textContent = message;
    fb.hidden = false;
  }

  function clearFeedback() {
    const fb = el('feedback');
    if (!fb) return;
    fb.textContent = '';
    fb.hidden = true;
  }

  DH.cart = { render, recalc, reset, showFeedback, clearFeedback };
})();