(function () {
  'use strict';
  const DH = window.DH;
  const state = DH.state;

  DH.ui = {
    showGlobalAlert(message, type) {
      const alert = document.getElementById('global-alert');
      if (!alert) return;
      alert.textContent = message;
      alert.className = 'alert alert--' + (type || 'error');
      alert.hidden = false;
    },
    showEmptyState(title, text, showCta) {
      const empty = document.getElementById('sales-empty');
      const titleEl = document.getElementById('sales-empty-title');
      const textEl = document.getElementById('sales-empty-text');
      const cta = document.getElementById('empty-new-btn');
      if (!empty) return;
      if (titleEl) titleEl.textContent = title;
      if (textEl) textEl.textContent = text;
      if (cta) cta.hidden = !showCta || !state.perms.create;
      empty.hidden = false;
    },
    hideEmptyState() {
      const empty = document.getElementById('sales-empty');
      if (empty) empty.hidden = true;
    },
    showLoading(isLoading) {
      const loading = document.getElementById('sales-loading');
      const wrap = document.getElementById('sales-table-wrap');
      const empty = document.getElementById('sales-empty');
      if (!loading) return;
      if (isLoading) {
        loading.hidden = false;
        if (wrap) wrap.hidden = true;
        if (empty) empty.hidden = true;
      } else {
        loading.hidden = true;
      }
    }
  };

  function dismissToast(toast) {
    if (!toast || toast.classList.contains('is-leaving')) return;
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    });
  }

  DH.toast = function (message, type) {
    const region = document.getElementById('toast-region');
    if (!region) return;
    const kind = (type === 'success' || type === 'error' || type === 'info') ? type : 'info';

    const toast = document.createElement('div');
    toast.className = 'toast toast--' + kind;
    toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'toast__icon';
    icon.innerHTML = DH.TOAST_ICONS[kind];

    const text = document.createElement('span');
    text.className = 'toast__message';
    text.textContent = message;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast__close';
    close.setAttribute('aria-label', 'Fechar notificação');
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    close.addEventListener('click', () => dismissToast(toast));

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(close);
    region.appendChild(toast);

    const timer = setTimeout(() => dismissToast(toast), 4200);
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
  };
})();