/* =========================================================
   DEV HUB · DRE · ui
   Session, user menu, logout, toasts, alerts, loading.
   ========================================================= */
(function () {
  'use strict';
  const DRE = window.DRE;

  /* ---------- Loading / Alert / Text ---------- */
  DRE.showLoading = function (isLoading) {
    const loading = document.getElementById('report-loading');
    const content = document.getElementById('report-content');
    if (!loading || !content) return;
    loading.hidden = !isLoading;
    content.hidden = isLoading;
  };

  DRE.showGlobalAlert = function (msg, type) {
    const el = document.getElementById('global-alert');
    if (!el) return;
    el.textContent = msg;
    el.className = 'alert alert--' + (type || 'error');
    el.hidden = false;
  };

  DRE.setText = function (id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  DRE.friendlyError = function (err) {
    if (!err) return 'Tente novamente.';
    const m = String(err.message || '').toLowerCase();
    if (m.includes('failed to fetch') || m.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    if (m.includes('row-level security') || m.includes('permission denied')) {
      return 'Você não tem permissão para acessar estes dados.';
    }
    return 'Tente novamente em alguns instantes.';
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

  DRE.toast = function (message, type) {
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

  /* ---------- Sessão ---------- */
  DRE.watchAuthChanges = function () {
    window.db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT' && window.Auth && !window.Auth.isSigningOut()) {
        window.location.replace('index.html?expired=1');
      }
    });
  };

  DRE.renderUser = function (user, profile) {
    const meta = user.user_metadata || {};
    const fullName = (profile && profile.name) || meta.name || meta.full_name
      || (user.email ? user.email.split('@')[0] : '') || 'Usuário';
    const roleText = window.Auth
      ? window.Auth.roleLabel((profile && profile.role) || meta.role || '')
      : '';
    const firstName = String(fullName).trim().split(/\s+/)[0] || 'Usuário';
    const initial = firstName.charAt(0).toUpperCase() || '?';

    DRE.setText('user-avatar', initial);
    DRE.setText('user-name', fullName);
    DRE.setText('user-role', roleText || user.email || '');
    DRE.setText('greeting-name', 'Olá, ' + firstName);

    const badge = document.getElementById('greeting-role');
    if (badge) {
      if (roleText) { badge.textContent = roleText; badge.hidden = false; }
      else badge.hidden = true;
    }
  };

  DRE.setupUserMenu = function () {
    const trigger = document.getElementById('user-menu-trigger');
    const panel = document.getElementById('user-menu-panel');
    if (!trigger || !panel) return;

    function open() {
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      const first = panel.querySelector('.menu-item');
      if (first) first.focus();
    }
    function close() { panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); }

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      panel.hidden ? open() : close();
    });
    document.addEventListener('click', e => {
      if (panel.hidden) return;
      if (panel.contains(e.target) || trigger.contains(e.target)) return;
      close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !panel.hidden) { close(); trigger.focus(); }
    });
  };

  DRE.setupLogout = function () {
    document.querySelectorAll('[data-action="logout"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        await window.Auth.signOut();
      });
    });
  };
})();