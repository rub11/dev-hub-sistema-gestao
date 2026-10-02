(function () {
  'use strict';
  const RH = window.RH;

  RH.state = {
    period: '30d',
    customStart: '',
    customEnd: '',
    movementTypeFilter: '',
    loading: false,
    sales: [],
    saleItems: [],
    products: [],
    movements: [],
    customersById: {},
    totalCustomers: 0,
    newCustomersInPeriod: 0,
    chart: null,
    perms: { view: true, export: true },
    priceMin: null,
    priceMax: null,
    focusSection: null
  };
})();