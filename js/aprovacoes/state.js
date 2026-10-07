/* =========================================================
   DEV HUB · Aprovacoes · state
   ========================================================= */
(function () {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHTML = (s) =>
    String(s || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));

  const fmtBRL = (cents) =>
    ((Number(cents) || 0) / 100).toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL'
    });

  /* ⬇️ NOVO: formata valor em REAIS (vendas usam reais, não centavos) */
  const fmtBRLFromReais = (reais) =>
    (Number(reais) || 0).toLocaleString('pt-BR', {
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

  const padNum = (n) => {
    const s = String(n == null ? '' : n);
    return s.length >= 6 ? s : '0'.repeat(6 - s.length) + s;
  };
  const fmtSaleNumber = (sale) =>
    sale && sale.sale_number != null ? '#' + padNum(sale.sale_number) : '—';

  const db = () => {
    if (window.db && window.db.from) return window.db;
    if (window.supabaseClient && window.supabaseClient.from) return window.supabaseClient;
    throw new Error('Supabase client não encontrado.');
  };

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

  const state = {
    /* Compras */
    all: [],
    /* ⬇️ NOVO: vendas */
    sales: [],
    currentUser: null,
    isPlatformAdmin: false
  };

  window.Appr = Object.assign(window.Appr || {}, {
    $, $$,
    escapeHTML,
    fmtBRL, fmtBRLFromReais, fmtDate, fmtDateTime, timeAgo,
    padNum, fmtSaleNumber,
    db, toast,
    state
  });

})();