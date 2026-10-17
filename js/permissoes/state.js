/* =========================================================
   DEV HUB · Permissões · state
   Helpers globais + estado compartilhado + toast
   Publica em: window.PRM
   ========================================================= */
(function () {
  'use strict';

  const PRM = window.PRM;
  if (!PRM) {
    console.error('[permissoes] window.PRM não encontrado. Verifique a ordem dos scripts.');
    return;
  }

  /* ---------- DOM ---------- */
  PRM.$ = (sel, root = document) => root.querySelector(sel);

  /* ---------- String ---------- */
  PRM.escapeHtml = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

  PRM.slugify = (s) =>
    String(s || '').toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);

  /* ---------- Supabase ---------- */
  PRM.db = () => {
    if (window.db && window.db.from) return window.db;
    throw new Error('Supabase não configurado.');
  };

  /* ---------- Toast (delega para o módulo global) ---------- */
  PRM.toast = function (message, kind = 'info') {
    if (window.Toast && typeof window.Toast.show === 'function') {
      return window.Toast.show(message, kind);
    }
    console.warn('[permissoes] Toast global indisponível:', message);
  };

  /* ---------- Estado compartilhado ---------- */
  PRM.state = {
    orgId: null,
    profiles: [],       // [{ key, kind, label, slug, baseRole, id?, editable, userCount }]
    members: [],
    saved: {},          // slug → { screens:Set, actions:Set }
    draft: {},          // slug → { screens:Set, actions:Set }
    overrides: {},      // slug → { cap: bool }
    selected: null,
    ui: { roleQuery: '', capQuery: '', collapsed: {} },
  };
})();
