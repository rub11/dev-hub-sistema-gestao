/* =========================================================
   DEV HUB · Relatórios · config.js
   Formatadores, labels, badges, ícones.
   ========================================================= */
(function () {
  'use strict';
  const RH = window.RH = window.RH || {};

  RH.CURRENCY = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  });
  RH.NUMBER = new Intl.NumberFormat('pt-BR');
  RH.SHORT_DATE = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
  RH.FULL_DATE  = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  RH.DATETIME   = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  RH.PAYMENT_LABELS = {
    '': 'Não informado',
    cash: 'Dinheiro',
    pix: 'Pix',
    debit_card: 'Cartão de débito',
    credit_card: 'Cartão de crédito',
    boleto: 'Boleto',
    other: 'Outro'
  };

  RH.MOVEMENT_TYPE_INFO = {
    entrada: { label: 'Entrada', modifier: 'badge--success' },
    saida:   { label: 'Saída',   modifier: 'badge--danger'  },
    ajuste:  { label: 'Ajuste',  modifier: 'badge--warning' }
  };

  RH.STOCK_STATUS = {
    ok:  { label: 'Normal',        modifier: 'badge--success' },
    low: { label: 'Estoque baixo', modifier: 'badge--warning' },
    out: { label: 'Sem estoque',   modifier: 'badge--danger'  }
  };

  RH.CANCELED_STATUS = ['canceled', 'cancelled'];

  RH.TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>'
  };
})();