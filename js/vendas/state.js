(function () {
  'use strict';
  const DH = window.DH = window.DH || {};

  DH.state = {
    /* Vendas */
    sales: [], filtered: [], search: '',

    /* Form data */
    customers: null, products: null,
    cart: [], formDataLoaded: false, submitting: false,

    /* Modos do form */
    formMode: null,               // 'create' | 'edit' | 'correct' | 'quote' | 'from_quote'
    editingSaleId: null, editingSale: null,
    correctingSaleId: null, correctingSale: null,
    convertingFromQuote: null,

    /* Toggle "vender sem estoque" */
    noStock: false,

    /* Admin da plataforma */
    isPlatformAdmin: false,

    /* Busca de produto */
    productQuery: '', productSuggestions: [],
    productSuggestionIndex: -1, pickedProduct: null,

    /* Senha pendente (modal) */
    pendingPasswordAction: null,

    /* Desconto: qual campo foi editado por último */
    lastDiscountEdit: 'brl',       // 'brl' | 'pct'

    /* Orçamentos */
    quotes: {
      list: [],
      filtered: [],
      search: '',
      tab: 'sales'                 // 'sales' | 'quotes'
    },

    /* Permissões */
    perms: {
      view: true,
      create: true,
      edit: true,
      remove: false,
      correct: false,
      approve: false
    }
  };
})();