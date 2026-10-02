(function () {
  'use strict';
  const DH = window.DH;
  const state = DH.state;

  DH.utils = {
    toNumber(v, fb) {
      if (v === null || v === undefined || v === '') return fb;
      if (typeof v === 'number') return Number.isFinite(v) ? v : fb;
      const n = Number(String(v).replace(',', '.').trim());
      return Number.isFinite(n) ? n : fb;
    },
    toInteger(v, fb) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fb; },
    round2(v) { return Math.round((Number(v) + Number.EPSILON) * 100) / 100; },
    formatMoney(v) { return DH.CURRENCY.format(DH.utils.toNumber(v, 0)); },
    formatDateTime(v) {
      if (!v) return '—';
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? '—' : DH.DATE_FMT.format(d);
    },
    padNumber(v) {
      const s = String(v);
      return s.length >= 6 ? s : '0'.repeat(6 - s.length) + s;
    },
    formatSaleNumber(sale) {
      if (!sale || sale.sale_number === null || sale.sale_number === undefined) return '—';
      return '#' + DH.utils.padNumber(sale.sale_number);
    },
    formatSaleNumberSearch(sale) {
      if (!sale || sale.sale_number === null || sale.sale_number === undefined) return '';
      return String(sale.sale_number);
    },
    setText(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    },
    matches(v, term) {
      if (!v) return false;
      return String(v).toLowerCase().includes(term);
    },
    findProduct(id) {
      if (!id || !state.products) return null;
      return state.products.find(p => p.id === id) || null;
    },
    customerNameOf(sale) {
      const rel = sale.customers;
      if (rel) {
        const c = Array.isArray(rel) ? rel[0] : rel;
        if (c && c.name) return c.name;
      }
      return '—';
    },
    paymentLabel(code) {
      if (!code) return '—';
      return DH.PAYMENT_LABELS[code] || code;
    },
    statusInfo(status) {
      const key = String(status || '').toLowerCase();
      return DH.STATUS_LABELS[key] || { label: status || '—', modifier: '' };
    }
  };
})();