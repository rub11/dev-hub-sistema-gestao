/* =========================================================
   DEV HUB · Financeiro · state
   ---------------------------------------------------------
   Namespace compartilhado (window.Fin) com:
   + utils (querySelector, formatação, parse, toast, db)
   + state global (compartilhado entre todos os arquivos)
   + labels (status, kind, meios de pagamento, tipos de movimento)

   Carregar SEMPRE antes dos outros arquivos de /financeiro/.
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
    ((Number(cents) || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
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

  const todayISO = () => new Date().toISOString().slice(0, 10);

  /* ---------- Supabase ---------- */
  const db = () => {
    if (window.db && window.db.from) return window.db;
    throw new Error('Supabase client não encontrado.');
  };

  /* ---------- Toast ---------- */
  const toast = (msg, kind) => {
    if (window.Toast && typeof window.Toast.show === 'function') {
      return window.Toast.show(msg, kind);
    }
    const el = document.createElement('div');
    el.className = kind === 'error' ? 'fin-err' : '';
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
    tab: 'pagar',
    viewMode: 'table',
    entries: [],
    movements: [],
    transfers: [],
    accounts: [],
    selected: new Set(),
    currentUser: null,
    filters: {
      kind: '',
      status: '',
      dueFrom: '', dueTo: '',
      issueFrom: '', issueTo: '',
      settleFrom: '', settleTo: '',
      doc: '', partner: '', notes: '',
      min: null, max: null,
      companies: [],
      natures:   [],
      accounts:  [],
      quick: {
        receitas: false,
        real: false,
        pendentes: false,
        despesas: false,
        provisao: false,
        baixados: false
      }
    },
    filterOptions: {
      companies: [],
      natures:   [],
      accounts:  []
    },
    custom: {
      enabled: false,
      filters: [],
      editor: {
        open: false,
        editingId: null,
        draft: null
      }
    }
  };

  /* =========================================================
     LABELS
     ========================================================= */
  const STATUS_LABEL = {
    pendente: 'Pendente', baixado: 'Baixado', provisao: 'Provisão',
    estornado: 'Estornado', cancelado: 'Cancelado'
  };

  const KIND_LABEL = { receita: 'Receita', despesa: 'Despesa' };

  const PAYMENT_METHODS = {
    pix: 'PIX', ted: 'TED', doc: 'DOC', transferencia: 'Transferência',
    boleto: 'Boleto', dinheiro: 'Dinheiro', cartao_credito: 'Cartão de crédito',
    cartao_debito: 'Cartão de débito', cheque: 'Cheque',
    debito_automatico: 'Débito automático', outro: 'Outro'
  };

  const MOV_TYPE_LABEL = {
    entrada: 'Entrada', saida: 'Saída', transferencia: 'Transferência',
    ajuste: 'Ajuste', estorno: 'Estorno'
  };

  /* =========================================================
     NAMESPACE PÚBLICO
     ========================================================= */
  window.Fin = Object.assign(window.Fin || {}, {
    $, $$, escapeHTML,
    fmtBRL, fmtDate, parseBRLToCents, todayISO,
    db, toast,
    state,
    STATUS_LABEL, KIND_LABEL, PAYMENT_METHODS, MOV_TYPE_LABEL
  });

})();