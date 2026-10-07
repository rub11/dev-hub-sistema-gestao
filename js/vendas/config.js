(function () {
  'use strict';
  const DH = window.DH = window.DH || {};

  DH.CURRENCY = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  DH.DATE_FMT = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  DH.PAYMENT_LABELS = {
    '': 'Não informado',
    cash: 'Dinheiro', pix: 'Pix',
    debit_card: 'Cartão de débito', credit_card: 'Cartão de crédito',
    boleto: 'Boleto', other: 'Outro'
  };

  DH.STATUS_LABELS = {
    completed:        { label: 'Concluída',            modifier: 'badge--success' },
    pending:          { label: 'Pendente',             modifier: 'badge--warning' },
    pending_approval: { label: 'Aguardando aprovação', modifier: 'badge--warning' },
    canceled:         { label: 'Cancelada',            modifier: 'badge--danger'  },
    cancelled:        { label: 'Cancelada',            modifier: 'badge--danger'  },
    rejected:         { label: 'Rejeitada',            modifier: 'badge--danger'  },
    corrected:        { label: 'Corrigida',            modifier: 'badge--muted'   },
    replaced:         { label: 'Substituída',          modifier: 'badge--muted'   }
  };

  DH.TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>'
  };
})();