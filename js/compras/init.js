/* =========================================================
   DEV HUB · Compras · init
   ---------------------------------------------------------
   Router por data-page.
   ========================================================= */

(function () {
  'use strict';

  const ROUTES = {
    'compras':         () => window.Cmp.pageComprasList(),
    'compras-nova':    () => window.Cmp.pageComprasNova(),
    'compras-receber': () => window.Cmp.pageComprasReceber(),
    'fornecedores':    () => window.Cmp.pageFornecedores()
  };

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    const fn = ROUTES[page];
    if (fn) {
      try { fn(); }
      catch (e) { console.error('[compras] erro em "' + page + '":', e); }
    }
  });

})();