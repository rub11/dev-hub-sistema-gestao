/* =========================================================
   DEV HUB · Cadastros · ui
   Toast, loading, alert, permissões, helpers.
   ========================================================= */
(function () {
  'use strict';
  const CAD = window.CAD;

  CAD.setText = function (id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  CAD.showGlobalAlert = function (msg, type) {
    const el = document.getElementById('global-alert');
    if (!el) return;
    el.textContent = msg;
    el.className = 'alert alert--' + (type || 'error');
    el.hidden = false;
  };

  CAD.friendlyError = function (err) {
    if (!err) return 'Tente novamente.';
    const m = String(err.message || '').toLowerCase();
    const code = String(err.code || '');

    if (m.includes('failed to fetch') || m.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    if (m.includes('row-level security') || m.includes('permission denied') || code === '42501') {
      return 'Você não tem permissão para executar esta ação.';
    }
    if (code === '23505' || m.includes('duplicate key') || m.includes('unique constraint')) {
      return 'Já existe um registro com este código.';
    }
    if (code === '23503' || m.includes('foreign key')) {
      return 'Não é possível excluir: existem registros vinculados.';
    }
    if (code === '23502' || m.includes('not-null')) {
      return 'Algum campo obrigatório não foi preenchido.';
    }
    return 'Não foi possível concluir. (' + (err.message || code || '?') + ')';
  };

  /* ---------- Toast ---------- */
  const TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>'
  };

  function dismissToast(el) {
    if (!el || el.classList.contains('is-leaving')) return;
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  }

  CAD.toast = function (message, type) {
    const region = document.getElementById('toast-region');
    if (!region) return;
    const kind = (type === 'success' || type === 'error' || type === 'info') ? type : 'info';

    const el = document.createElement('div');
    el.className = 'toast toast--' + kind;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');

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
    close.addEventListener('click', () => dismissToast(el));

    el.appendChild(icon);
    el.appendChild(text);
    el.appendChild(close);
    region.appendChild(el);

    const timer = setTimeout(() => dismissToast(el), 4200);
    el.addEventListener('mouseenter', () => clearTimeout(timer));
  };

  /* ---------- Sessão / usuário ---------- */
  CAD.setupUserMenu = function () {
    const trigger = document.getElementById('user-menu-trigger');
    const panel = document.getElementById('user-menu-panel');
    if (!trigger || !panel) return;

    const open = () => {
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      const first = panel.querySelector('.menu-item');
      if (first) first.focus();
    };
    const close = () => {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    };

    trigger.addEventListener('click', e => { e.stopPropagation(); panel.hidden ? open() : close(); });
    document.addEventListener('click', e => {
      if (panel.hidden) return;
      if (panel.contains(e.target) || trigger.contains(e.target)) return;
      close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !panel.hidden) { close(); trigger.focus(); }
    });
  };

  CAD.setupLogout = function () {
    document.querySelectorAll('[data-action="logout"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        await window.Auth.signOut();
      });
    });
  };

  CAD.renderUser = function (user, profile) {
    const meta = user.user_metadata || {};
    const fullName = (profile && profile.name) || meta.name || meta.full_name
      || (user.email ? user.email.split('@')[0] : '') || 'Usuário';
    const roleText = window.Auth ? window.Auth.roleLabel((profile && profile.role) || meta.role || '') : '';
    const firstName = String(fullName).trim().split(/\s+/)[0] || 'Usuário';
    const initial = firstName.charAt(0).toUpperCase() || '?';

    CAD.setText('user-avatar', initial);
    CAD.setText('user-name', fullName);
    CAD.setText('user-role', roleText || user.email || '');
    CAD.setText('greeting-name', 'Olá, ' + firstName);

    const badge = document.getElementById('greeting-role');
    if (badge) {
      if (roleText) { badge.textContent = roleText; badge.hidden = false; }
      else badge.hidden = true;
    }
  };

  /* ---------- Permissões ---------- */
  CAD.hasPerm = function (cap, fallback) {
    if (window.Perms && typeof window.Perms.has === 'function') {
      return window.Perms.has(cap);
    }
    return fallback !== false;
  };

  CAD.canEdit = function () {
    return CAD.state.perms.create || CAD.state.perms.edit;
  };
})();