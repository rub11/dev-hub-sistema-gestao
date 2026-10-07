(function () {
  'use strict';
  const DH = window.DH = window.DH || {};

  DH.state = {
    sales: [], filtered: [], search: '',
    customers: null, products: null,
    cart: [], formDataLoaded: false, submitting: false,

    /* Formas de pagamento */
    paymentMethods: null,
    appliedMethodDiscount: null,

    /* Modos */
    formMode: null,
    editingSaleId: null, editingSale: null,
    correctingSaleId: null, correctingSale: null,
    convertingFromQuote: null,

    noStock: false,
    isPlatformAdmin: false,

    productQuery: '', productSuggestions: [],
    productSuggestionIndex: -1, pickedProduct: null,

    pendingPasswordAction: null,
    lastDiscountEdit: 'brl',

    quotes: {
      list: [], filtered: [], search: '',
      tab: 'sales'
    },

    perms: {
      view: true, create: true, edit: true,
      remove: false, correct: false, approve: false
    }
  };
})();