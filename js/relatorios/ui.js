(function () {
  'use strict';
  const RH = window.RH;

  RH.ui = {
    showLoading(isLoading) {
      const loading = document.getElementById('report-loading');
      const content = document.getElementById('report-content');
      if (!loading || !content) return;
      if (isLoading) {
        loading.hidden = false;
        content.hidden = true;
      } else {
        loading.hidden = true;
        content.hidden = false;
      }
    },
    showGlobalAlert(message, type) {
      const el = document.getElementById('global-alert');
      if (!el) return;
      el.textContent = message;
      el.className = 'alert alert--' + (type || 'error');
      el.hidden = false;
    },
    hideGlobalAlert() {
      const el = document.getElementById('global-alert');
      if (!el) return;
      el.hidden = true;
      el.textContent = '';
    }
  };

  function dismissToast(toast) {
    if (!toast || toast.classList.contains('is-leaving')) return;
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    });
  }

  RH.toast = function (message, type) {
    const region = document.getElementById('toast-region');
    if (!region) return;
    const kind = (type === 'success' || type === 'error' || type === 'info') ? type : 'info';

    const toast = document.createElement('div');
    toast.className = 'toast toast--' + kind;
    toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'toast__icon';
    icon.innerHTML = RH.TOAST_ICONS[kind];

    const text = document.createElement('span');
    text.className = 'toast__message';
    text.textContent = message;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast__close';
    close.setAttribute('aria-label', 'Fechar notificação');
    close.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
      ' stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    close.addEventListener('click', () => dismissToast(toast));

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(close);
    region.appendChild(toast);

    const timer = setTimeout(() => dismissToast(toast), 4200);
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
  };
})();