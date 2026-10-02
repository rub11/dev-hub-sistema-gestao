/* =========================================================
   DEV HUB · Compras · state
   ---------------------------------------------------------
   Namespace compartilhado (window.Cmp) com:
     • Helpers DOM ($, $$)
     • Helpers de formatação
     • Supabase client + toast
     • Labels de status / pagamento / eventos
   Carregar SEMPRE antes dos outros arquivos de /compras/.
   ========================================================= */

(function () {
  'use strict';

  /* ---------- DOM ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- Datas / números ---------- */
  const todayISO = () => new Date().toISOString().slice(0, 10);

  const fmtBRL = (cents) => {
    const n = (Number(cents) || 0) / 100;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
  };

  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleString('pt-BR');
  };

  const parseBRLToCents = (str) => {
    if (str == null || str === '') return 0;
    const clean = String(str)
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : Math.round(n * 100);
  };

  /* ---------- Strings ---------- */
  const escapeHTML = (s) =>
    String(s || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));

  /* ---------- Inputs ---------- */
  const val = (sel, fallback = '') => {
    const el = $(sel);
    if (!el) { console.warn('[compras] elemento não encontrado:', sel); return fallback; }
    return el.value == null ? fallback : el.value;
  };
  const setVal = (sel, v) => {
    const el = $(sel);
    if (el) el.value = v == null ? '' : v;
  };

  /* ---------- Supabase ---------- */
  const db = () => {
    if (window.db && window.db.from) return window.db;
    if (window.supabaseClient && window.supabaseClient.from) return window.supabaseClient;
    throw new Error('Cliente Supabase não encontrado. Verifique js/supabase.js.');
  };

  /* ---------- Toast ---------- */
  const toast = (msg, kind) => {
    if (window.Toast && typeof window.Toast.show === 'function') {
      return window.Toast.show(msg, kind);
    }
    const el = document.createElement('div');
    el.className = kind === 'error' ? 'cmp-error' : 'cmp-info';
    el.style.cssText =
      'position:fixed;top:80px;right:20px;z-index:200;max-width:360px;box-shadow:var(--cmp-shadow-md)';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  };

  /* ---------- Labels ---------- */
  const STATUS_LABEL = {
    rascunho:              'Rascunho',
    aguardando_aprovacao:  'Aguardando aprovação',
    pendente_recebimento:  'Pendente de recebimento',
    recebida_parcial:      'Recebida parcial',
    recebida:              'Recebida',
    paga:                  'Paga',
    cancelada:             'Cancelada'
  };

  const PAYMENT_LABEL = {
    pix:              'PIX',
    boleto:           'Boleto',
    cartao_credito:   'Cartão de crédito',
    cartao_debito:    'Cartão de débito',
    transferencia:    'Transferência',
    dinheiro:         'Dinheiro',
    cheque:           'Cheque'
  };

  const EVENT_LABEL = {
    created:   'Compra criada',
    updated:   'Compra alterada',
    submitted: 'Enviada para aprovação',
    approved:  'Aprovada',
    received:  'Recebida',
    paid:      'Paga',
    cancelled: 'Cancelada'
  };

  /* ---------- Publica ---------- */
  window.Cmp = {
    $, $$, todayISO,
    fmtBRL, fmtDate, fmtDateTime, parseBRLToCents,
    escapeHTML, val, setVal,
    db, toast,
    STATUS_LABEL, PAYMENT_LABEL, EVENT_LABEL
  };

})();