/* =========================================================
   DEV HUB · Parceiros · state
   ---------------------------------------------------------
   Namespace compartilhado (window.Parn).
   Módulo de PARCEIROS (clientes + fornecedores + transportadoras).
   Não existe mais tela separada de "clientes".
   ========================================================= */

(function () {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- String ---------- */
  const escapeHtml = (v) =>
    String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  const matches = (v, t) => v && String(v).toLowerCase().includes(t);

  /* ---------- Labels ---------- */
  const typeLabel = (t) => {
    const k = String(t || '').toUpperCase();
    if (k === 'PF') return 'Física';
    if (k === 'PJ') return 'Jurídica';
    return t || '—';
  };

  const shortCode = (p) => {
    if (!p || !p.id) return '—';
    const str = String(p.id).replace(/\D/g, '');
    return str ? str.slice(0, 4) : String(p.id).slice(0, 4);
  };

  const numberOrNull = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    let str = String(v).trim();
    if (str.indexOf(',') !== -1 && str.indexOf('.') !== -1) str = str.replace(/\./g, '').replace(',', '.');
    else if (str.indexOf(',') !== -1) str = str.replace(',', '.');
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
  };

  /* ---------- Máscaras ---------- */
  function bindMask(input, maskFn) {
    if (!input) return;
    input.addEventListener('input', () => { input.value = maskFn(input.value); });
  }
  function maskCPF(v) {
    return String(v || '').replace(/\D/g, '').slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  function maskCNPJ(v) {
    return String(v || '').replace(/\D/g, '').slice(0, 14)
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
  function maskCEP(v) {
    return String(v || '').replace(/\D/g, '').slice(0, 8)
      .replace(/(\d{5})(\d)/, '$1-$2');
  }
  function maskPhone(v) {
    const d = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return '(' + d;
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }
  const formatPhone = (v) => maskPhone(v);

  /* ---------- Helpers derivados ---------- */
  function primaryPhone(c) {
    const list = c.customer_phones || [];
    const p = list.find(x => x.is_primary) || list[0];
    if (p && p.phone) return formatPhone(p.phone);
    return c.phone ? formatPhone(c.phone) : '—';
  }
  function primaryEmail(c) {
    const list = c.customer_emails || [];
    const e = list.find(x => x.is_primary) || list[0];
    return (e && e.email) || c.email || '—';
  }
  function primaryCity(c) {
    const list = c.customer_addresses || [];
    const a = list.find(x => x.is_primary) || list[0];
    if (!a || !a.city) return '—';
    return a.city + (a.state ? ' - ' + a.state : '');
  }
  function primaryAddressLine(p) {
    const list = p.customer_addresses || [];
    const x = list.find(a => a.is_primary) || list[0];
    if (!x) return '—';
    const parts = [x.street, x.number].filter(Boolean);
    return parts.length ? parts.join(', ') : (x.city || '—');
  }

  /* ---------- Toast ---------- */
  const TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>'
  };

  function showToast(message, type) {
    const region = document.getElementById('toast-region');
    if (!region) return;
    const kind = type === 'success' || type === 'error' || type === 'info' ? type : 'info';
    const toast = document.createElement('div');
    toast.className = 'toast toast--' + kind;
    toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'toast__icon';
    icon.innerHTML = TOAST_ICONS[kind];

    const text = document.createElement('span');
    text.className = 'toast__message';
    text.textContent = message;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast__close';
    close.setAttribute('aria-label', 'Fechar');
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    close.addEventListener('click', () => dismissToast(toast));

    toast.appendChild(icon); toast.appendChild(text); toast.appendChild(close);
    region.appendChild(toast);
    const t = setTimeout(() => dismissToast(toast), 4200);
    toast.addEventListener('mouseenter', () => clearTimeout(t));
  }

  function dismissToast(t) {
    if (!t || t.classList.contains('is-leaving')) return;
    t.classList.add('is-leaving');
    t.addEventListener('animationend', () => {
      if (t.parentNode) t.parentNode.removeChild(t);
    });
  }

  /* ---------- State ---------- */
  const state = {
    all: [],
    filtered: [],
    search: '',
    kind: 'all',
    filterType: '',
    filterStatus: '',
    filterKind: '',

    editingId: null,
    deletingId: null,
    saving: false,
    deleting: false,

    phones: [],
    emails: [],
    addresses: [],
    contacts: [],

    perms: { view: true, create: true, edit: true, remove: true },

    editGeneration: 0
  };

  /* ---------- API pública ---------- */
  window.Parn = {
    $, $$, escapeHtml, setText, matches,
    typeLabel, shortCode, numberOrNull,
    bindMask, maskCPF, maskCNPJ, maskCEP, maskPhone, formatPhone,
    primaryPhone, primaryEmail, primaryCity, primaryAddressLine,
    showToast, dismissToast,
    state
  };

})();