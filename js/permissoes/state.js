/* =========================================================
   DEV HUB · Permissões · state
   Helpers globais + estado compartilhado + toast
   Publica em: window.PRM
   ========================================================= */
(function () {
  'use strict';

  const PRM = window.PRM;

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

  /* ---------- Toast ---------- */
  PRM.toast = function (message, kind = 'info') {
    const region = document.getElementById('toast-region');
    if (!region) return;

    const k = (kind === 'success' || kind === 'error' || kind === 'info') ? kind : 'info';
    const el = document.createElement('div');
    el.className = `toast toast--${k}`;
    el.setAttribute('role', k === 'error' ? 'alert' : 'status');

    const iconMap = {
      success: PRM.ICONS.toastOk,
      error:   PRM.ICONS.toastErr,
      info:    PRM.ICONS.toastInfo,
    };

    el.innerHTML = `
      <span class="toast__icon" aria-hidden="true">${iconMap[k]}</span>
      <span class="toast__message"></span>
      <button type="button" class="toast__close" aria-label="Fechar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    `;
    el.querySelector('.toast__message').textContent = message;

    const dismiss = () => {
      if (el.classList.contains('is-leaving')) return;
      el.classList.add('is-leaving');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    };

    el.querySelector('.toast__close').addEventListener('click', dismiss);
    region.appendChild(el);

    const timer = setTimeout(dismiss, 4200);
    el.addEventListener('mouseenter', () => clearTimeout(timer), { once: true });
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