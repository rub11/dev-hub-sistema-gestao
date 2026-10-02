(function () {
  'use strict';
  const RH = window.RH;

  function render() {
    const grid = document.getElementById('payments-grid');
    const empty = document.getElementById('payments-empty');
    if (!grid || !empty) return;

    const valid = RH.utils.getValidSales();
    if (valid.length === 0) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    const map = new Map();
    valid.forEach(s => {
      const key = s.payment_method || '';
      if (!map.has(key)) map.set(key, { count: 0, total: 0 });
      const e = map.get(key);
      e.count += 1;
      e.total += RH.utils.toNumber(s.total, 0);
    });

    const rows = Array.from(map.entries())
      .map(e => ({ code: e[0], count: e[1].count, total: e[1].total }))
      .sort((a, b) => b.total - a.total);

    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    rows.forEach(row => {
      const card = document.createElement('div');
      card.className = 'payment-card';

      const label = document.createElement('span');
      label.className = 'payment-card__label';
      label.textContent = RH.utils.labelForPayment(row.code);

      const value = document.createElement('span');
      value.className = 'payment-card__value';
      value.textContent = RH.utils.formatMoney(row.total);

      const count = document.createElement('span');
      count.className = 'payment-card__count';
      count.textContent = row.count === 1
        ? '1 venda'
        : RH.NUMBER.format(row.count) + ' vendas';

      card.appendChild(label);
      card.appendChild(value);
      card.appendChild(count);
      fragment.appendChild(card);
    });
    grid.appendChild(fragment);
  }

  RH.payments = { render };
})();