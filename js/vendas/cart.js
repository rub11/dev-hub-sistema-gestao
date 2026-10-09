/* =========================================================
   DEV HUB · Vendas · cart.js
   Carrinho com avisos de estoque + valor pago + evento de recalc.
   ---------------------------------------------------------
   [NOVO] Dispara DH.payments.recalc() a cada mudança pra
   atualizar o resumo de pagamentos múltiplos.
   ========================================================= */
(function () {
  'use strict';
  const DH = window.DH;
  const { state, utils } = DH;

  function el(name) { return DH.form.els()[name]; }

  function isQuoteMode() {
    return state.formMode === 'quote' || state.formMode === 'quote_edit';
  }

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
      if (DH.form && DH.form.refreshSubmitEnabled) DH.form.refreshSubmitEnabled();
      return;
    }

    cartEmpty.hidden = true;
    cartWrap.hidden = false;
    cartBody.innerHTML = '';

    const quoteMode = isQuoteMode();

    const fragment = document.createDocumentFragment();
    state.cart.forEach(item => {
      const row = document.createElement('tr');
      row.dataset.id = item.product_id;

      const nameCell = document.createElement('td');
      nameCell.className = 'cart-table__name';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = item.product_name || '—';
      nameCell.appendChild(nameSpan);

      const faltaEstoque = item.quantity > item.stock_available;

      if (faltaEstoque) {
        const warn = document.createElement('span');
        warn.className = quoteMode
          ? 'cart-badge cart-badge--warn'
          : 'cart-badge cart-badge--danger';
        warn.title = 'Estoque disponível: ' + item.stock_available;
        warn.textContent = 'sem estoque';
        nameCell.appendChild(warn);
      }
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

    if (DH.form && DH.form.refreshSubmitEnabled) DH.form.refreshSubmitEnabled();
  }

  function onQuantityChange(productId, rawValue, inputEl) {
    const item = state.cart.find(i => i.product_id === productId);
    if (!item) return;
    const qty = utils.toInteger(rawValue, 0);
    const quoteMode = isQuoteMode();
    const allowNoStock = !!state.noStock;

    if (qty <= 0) {
      showFeedback('Informe uma quantidade válida.');
      inputEl.value = String(item.quantity);
      return;
    }

    if (qty > item.stock_available && !quoteMode && !allowNoStock) {
      showFeedback(
        'Estoque insuficiente. Marque "Vender sem estoque" para continuar.'
      );
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

    /* Valor pago */
    const depositEl = document.getElementById('sale-deposit');
    let deposit = depositEl ? utils.toNumber(depositEl.value, 0) : 0;
    if (!Number.isFinite(deposit) || deposit < 0) deposit = 0;
    if (deposit > total) {
      deposit = total;
      if (depositEl) depositEl.value = String(utils.round2(deposit));
    }
    const balance = Math.max(0, utils.round2(total - deposit));

    const totalSubEl = el('totalSub');
    const totalTotalEl = el('totalTotal');
    if (totalSubEl) totalSubEl.textContent = utils.formatMoney(subtotal);
    if (totalTotalEl) totalTotalEl.textContent = utils.formatMoney(total);

    /* Saldo a receber */
    const balanceRow = document.getElementById('totals-balance-row');
    const balanceEl  = document.getElementById('total-balance');
    if (balanceRow && balanceEl) {
      if (deposit > 0) {
        balanceRow.hidden = false;
        balanceEl.textContent = utils.formatMoney(balance);
      } else {
        balanceRow.hidden = true;
      }
    }

    /* Atualiza botão finalizar */
    if (DH.form && DH.form.refreshSubmitEnabled) DH.form.refreshSubmitEnabled();

    /* ⬇️ Atualiza resumo de pagamentos múltiplos */
    if (DH.payments) DH.payments.recalc();

    /* ⬇️ Dispara evento pra outros módulos (installments antigo, etc.) */
    document.dispatchEvent(new CustomEvent('sale:recalc'));
  }

  function reset() {
    const form = el('form');
    if (!form) return;
    form.reset();

    if (el('customer')) el('customer').value = '';
    if (el('discount')) el('discount').value = '0';
    if (el('discountPct')) el('discountPct').value = '0';
    if (el('notes')) el('notes').value = '';

    const depositEl = document.getElementById('sale-deposit');
    if (depositEl) depositEl.value = '0';

    const validEl = document.getElementById('sale-valid-until');
    if (validEl) validEl.value = '';

    state.cart = [];
    state.lastDiscountEdit = 'brl';
    state.noStock = false;
    const noStockEl = document.getElementById('sale-no-stock');
    if (noStockEl) noStockEl.checked = false;

    const warn = document.getElementById('payment-warn');
    if (warn) warn.hidden = true;

    clearFeedback();
    if (DH.productSearch && DH.productSearch.clear) DH.productSearch.clear();
    if (DH.installments) DH.installments.reset();
    if (DH.payments) DH.payments.reset();

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