(function () {
  'use strict';
  const DH = window.DH = window.DH || {};

  DH.state = {
    sales: [], filtered: [], search: '',
    customers: null, products: null,
    cart: [], formDataLoaded: false, submitting: false,
    editingSaleId: null, editingSale: null,
    productQuery: '', productSuggestions: [],
    productSuggestionIndex: -1, pickedProduct: null,
    pendingPasswordAction: null,
    lastDiscountEdit: 'brl',
    perms: { view: true, create: true, edit: true, remove: true }
  };
})();