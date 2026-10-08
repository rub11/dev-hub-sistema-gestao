(function () {
  'use strict';
  const RH = window.RH;

  RH.state = {
    period: '30d',
    customStart: '',
    customEnd: '',
    movementTypeFilter: '',
    statusFilter: 'valid',          /* valid | '' | canceled | pending */
    loading: false,
    sales: [],
    previousSales: [],              /* vendas do período anterior (pro delta) */
    saleItems: [],
    products: [],
    movements: [],
    customersById: {},
    totalCustomers: 0,
    newCustomersInPeriod: 0,
    chart: null,
    paymentsChart: null,
    perms: { view: true, export: true, import: true },
    priceMin: null,
    priceMax: null,
    focusSection: null
  };
})();