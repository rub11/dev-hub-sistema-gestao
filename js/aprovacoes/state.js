/* =========================================================
   DEV HUB · Aprovacoes · state
   ---------------------------------------------------------
   Namespace compartilhado (window.Appr) com:
     • Helpers DOM ($, $$)
     • Helpers de formatação (escapeHTML, fmtBRL, fmtDate...)
     • Cliente Supabase + toast
     • Estado global (all, currentUser)
   ---------------------------------------------------------
   Carregar SEMPRE antes dos outros arquivos de /aprovacoes/.
   ========================================================= */

(function () {
  'use strict';

  /* ---------- DOM ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- String ---------- */
  const escapeHTML = (s) =>
    String(s || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));

  /* ---------- Números / datas ---------- */
  const fmtBRL = (cents) =>
    ((Number(cents) || 0) / 100).toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL'
    });

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

  const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return 'agora';
    if (diff < 3600)  return Math.floor(diff / 60) + ' min';
    if (diff < 86400) return Math.floor(diff / 3600) + ' h';
    return Math.floor(diff / 86400) + ' d';
  };

  /* ---------- Supabase ---------- */
  const db = () => {
    if (window.db && window.db.from) return window.db;
    if (window.supabaseClient && window.supabaseClient.from) return window.supabaseClient;
    throw new Error('Supabase client não encontrado.');
  };

  /* ---------- Toast ---------- */
  const toast = (msg, kind) => {
    if (window.Toast && typeof window.Toast.show === 'function') {
      return window.Toast.show(msg, kind);
    }
    const el = document.createElement('div');
    el.className = kind === 'error' ? 'appr-err' : '';
    el.style.cssText =
      'position:fixed;top:80px;right:20px;z-index:200;max-width:360px;' +
      'padding:12px 16px;border-radius:10px;background:' +
      (kind === 'error' ? 'var(--danger-soft)' : 'var(--accent-soft)') +
      ';color:' + (kind === 'error' ? 'var(--danger)' : 'var(--accent-hover)') +
      ';box-shadow:0 12px 32px -8px rgba(16,24,40,.24);font-size:13.5px';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  };

  /* =========================================================
     STATE
     ========================================================= */
  const state = {
    all: [],
    currentUser: null
  };

  /* =========================================================
     PUBLICA
     ========================================================= */
  window.Appr = Object.assign(window.Appr || {}, {
    $, $$,
    escapeHTML,
    fmtBRL, fmtDate, fmtDateTime, timeAgo,
    db, toast,
    state
  });

})();