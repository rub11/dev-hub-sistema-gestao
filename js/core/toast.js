/* =========================================================
   DEV HUB · Core · Toast global
   ---------------------------------------------------------
   Implementação única de notificações usada por todos os
   módulos. Substitui as cópias locais que existiam em
   gestao/utils, parceiros/state, permissoes/state,
   aprovacoes/state e financeiro/state.

   API:
     Toast.show(message, kind)   // kind: success | error | info
     Toast.dismiss(element)

   Publica em: window.Toast
   ========================================================= */

(function () {
  'use strict';

  const ICONS = {
    success:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M20 6 9 17l-5-5"/></svg>',
    error:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>',
    info:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  function ensureRegion() {
    let region = document.getElementById('toast-region');
    if (!region) {
      region = document.createElement('div');
      region.id = 'toast-region';
      region.className = 'toast-region';
      document.body.appendChild(region);
    }
    return region;
  }

  function dismiss(el) {
    if (!el || el.classList.contains('is-leaving')) return;
    el.classList.add('is-leaving');

    let removed = false;
    const remove = function () {
      if (removed) return;
      removed = true;
      if (el.parentNode) el.parentNode.removeChild(el);
    };

    /* Fallback para prefers-reduced-motion / navegadores sem animationend */
    el.addEventListener('animationend', remove, { once: true });
    setTimeout(remove, 600);
  }

  function show(message, kind) {
    const k = (kind === 'success' || kind === 'error' || kind === 'info') ? kind : 'info';
    const region = ensureRegion();

    const el = document.createElement('div');
    el.className = 'toast toast--' + k;
    el.setAttribute('role', k === 'error' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'toast__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = ICONS[k];

    const text = document.createElement('span');
    text.className = 'toast__message';
    text.textContent = message == null ? '' : String(message);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast__close';
    close.setAttribute('aria-label', 'Fechar notificação');
    close.innerHTML = ICONS.close;
    close.addEventListener('click', function () { dismiss(el); });

    el.appendChild(icon);
    el.appendChild(text);
    el.appendChild(close);
    region.appendChild(el);

    let timer = setTimeout(function () { dismiss(el); }, 4200);
    el.addEventListener('mouseenter', function () { clearTimeout(timer); });
    el.addEventListener('mouseleave', function () {
      timer = setTimeout(function () { dismiss(el); }, 2200);
    });

    return el;
  }

  window.Toast = { show, dismiss };
})();
