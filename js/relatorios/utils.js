(function () {
  'use strict';
  const RH = window.RH;
  const state = RH.state;

  RH.utils = {
    toNumber(v, fb) {
      if (v === null || v === undefined || v === '') return fb;
      if (typeof v === 'number') return Number.isFinite(v) ? v : fb;
      const n = Number(String(v).replace(',', '.'));
      return Number.isFinite(n) ? n : fb;
    },
    toInteger(v, fb) {
      if (v === null || v === undefined || v === '') return fb;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : fb;
    },
    round2(v) { return Math.round((Number(v) + Number.EPSILON) * 100) / 100; },
    formatMoney(v) { return RH.CURRENCY.format(RH.utils.toNumber(v, 0)); },
    formatDateTime(v) {
      if (!v) return '—';
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? '—' : RH.DATETIME.format(d);
    },
    toDateKey(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + d;
    },
    toDateInput(date) { return RH.utils.toDateKey(date); },
    getInputValue(id) {
      const el = document.getElementById(id);
      return el ? el.value : '';
    },
    setInputValue(id, value) {
      const el = document.getElementById(id);
      if (el) el.value = value;
    },
    setText(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    },
    createCell(text, className) {
      const cell = document.createElement('td');
      cell.textContent = text;
      if (className) cell.className = className;
      return cell;
    },

    /* ---------- Vendas filtradas por status ---------- */
    getValidSales() {
      const filter = state.statusFilter;

      if (filter === 'canceled') {
        return state.sales.filter(s => RH.utils.isCanceled(s.status));
      }
      if (filter === 'pending') {
        return state.sales.filter(s => String(s.status || '').toLowerCase() === 'pending');
      }
      if (filter === '') {
        return state.sales.slice(); // todas
      }
      // 'valid' (default) — não canceladas
      return state.sales.filter(s => !RH.utils.isCanceled(s.status));
    },

    /* ---------- Vendas do período anterior (pro delta) ---------- */
    getPreviousValidSales() {
      const filter = state.statusFilter;

      if (filter === 'canceled') {
        return state.previousSales.filter(s => RH.utils.isCanceled(s.status));
      }
      if (filter === 'pending') {
        return state.previousSales.filter(s => String(s.status || '').toLowerCase() === 'pending');
      }
      if (filter === '') {
        return state.previousSales.slice();
      }
      return state.previousSales.filter(s => !RH.utils.isCanceled(s.status));
    },

    isCanceled(status) {
      if (!status) return false;
      return RH.CANCELED_STATUS.indexOf(String(status).toLowerCase()) !== -1;
    },

    /* ---------- Delta % ---------- */
    computeDelta(current, previous) {
      const c = Number(current) || 0;
      const p = Number(previous) || 0;
      if (p === 0 && c === 0) return { pct: 0, dir: 'neutral', label: '—' };
      if (p === 0) return { pct: 100, dir: 'up', label: '+100%' };
      const pct = ((c - p) / p) * 100;
      const dir = pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'neutral';
      const label = (pct > 0 ? '+' : '') + pct.toFixed(1).replace('.', ',') + '%';
      return { pct: pct, dir: dir, label: label };
    },

    friendlyError(error) {
      if (!error) return 'Tente novamente.';
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('failed to fetch') || msg.includes('network')) {
        return 'Não foi possível conectar ao servidor.';
      }
      if (msg.includes('row-level security') || msg.includes('permission denied')) {
        return 'Você não tem permissão para acessar estes dados.';
      }
      return 'Tente novamente em alguns instantes.';
    },
    labelForPayment(code) {
      if (!code) return 'Não informado';
      if (RH.PAYMENT_LABELS[code]) return RH.PAYMENT_LABELS[code];
      return String(code).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    },
    stockInfo(stock, min) {
      if (stock === 0) return RH.STOCK_STATUS.out;
      if (stock <= min) return RH.STOCK_STATUS.low;
      return RH.STOCK_STATUS.ok;
    },
    toCSVNumber(v) {
      const n = RH.utils.toNumber(v, 0);
      return n.toFixed(2).replace('.', ',');
    },
    formatDateTimeCSV(v) {
      if (!v) return '';
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString('pt-BR');
    },
    fileStamp() {
      const d = new Date();
      const pad = n => String(n).padStart(2, '0');
      return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
             '_' + pad(d.getHours()) + pad(d.getMinutes());
    },
    customerNameForCSV(customerId) {
      if (!customerId) return 'Não informado';
      return state.customersById[customerId] || 'Cliente';
    }
  };
})();