(function () {
  'use strict';
  const RH = window.RH;
  const state = RH.state;
  const U = () => RH.utils;

  function renderSales() {
    const valid = U().getValidSales();
    const count = valid.length;
    const revenue = valid.reduce((s, x) => s + U().toNumber(x.total, 0), 0);
    const discounts = valid.reduce((s, x) => s + U().toNumber(x.discount, 0), 0);
    const ticket = count > 0 ? revenue / count : 0;

    U().setText('kpi-sales-count', RH.NUMBER.format(count));
    U().setText('kpi-revenue', U().formatMoney(revenue));
    U().setText('kpi-ticket', U().formatMoney(ticket));
    U().setText('kpi-discounts', U().formatMoney(discounts));
  }

  function renderCustomers() {
    const valid = U().getValidSales();
    const uniqueBuyers = new Set(valid.map(s => s.customer_id).filter(Boolean));
    U().setText('kpi-total-customers', RH.NUMBER.format(state.totalCustomers));
    U().setText('kpi-buying-customers', RH.NUMBER.format(uniqueBuyers.size));
    U().setText('kpi-new-customers', RH.NUMBER.format(state.newCustomersInPeriod));
  }

  function renderStock() {
    let withStock = 0, low = 0, out = 0, total = 0;
    RH.filters.applyPriceFilterToProducts().forEach(p => {
      total += 1;
      const stock = U().toInteger(p.stock, 0);
      const min = U().toInteger(p.minimum_stock, 0);
      if (stock === 0) out += 1;
      else if (stock <= min) low += 1;
      else withStock += 1;
    });
    U().setText('kpi-total-products', RH.NUMBER.format(total));
    U().setText('kpi-with-stock', RH.NUMBER.format(withStock));
    U().setText('kpi-low-stock', RH.NUMBER.format(low));
    U().setText('kpi-out-stock', RH.NUMBER.format(out));
  }

  RH.kpis = { renderSales, renderCustomers, renderStock };
})();