(function () {
  'use strict';
  const DH = window.DH;
  const state = DH.state;
  const els = {};

  function setup() {
    els.modal    = document.getElementById('pwd-modal');
    els.form     = document.getElementById('pwd-form');
    els.hint     = document.getElementById('pwd-hint');
    els.input    = document.getElementById('pwd-input');
    els.feedback = document.getElementById('pwd-feedback');
    els.confirm  = document.getElementById('pwd-confirm-btn');
    if (!els.modal) return;

    els.modal.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', close);
    });

    els.modal.querySelectorAll('[data-pw-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.getAttribute('data-pw-toggle'));
        if (!input) return;
        const visible = input.type === 'text';
        input.type = visible ? 'password' : 'text';
        btn.setAttribute('aria-pressed', String(!visible));
        input.focus({ preventScroll: true });
      });
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !els.modal.hidden) close();
    });

    els.form.addEventListener('submit', e => {
      e.preventDefault();
      const pwd = els.input.value;
      if (!pwd) {
        showFeedback('Informe sua senha.');
        els.input.focus();
        return;
      }
      const cb = state.pendingPasswordAction;
      state.pendingPasswordAction = null;
      close();
      if (cb) cb(pwd);
    });
  }

  function request(hint, onConfirm) {
    state.pendingPasswordAction = onConfirm;
    els.hint.textContent = hint;
    els.form.reset();
    clearFeedback();
    setBusy(false);
    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => els.input.focus(), 50);
  }

  function close() {
    state.pendingPasswordAction = null;
    els.modal.hidden = true;
    document.body.style.overflow = '';
  }

  function setBusy(busy) {
    if (els.confirm) {
      els.confirm.disabled = busy;
      els.confirm.classList.toggle('is-loading', busy);
      const lbl = els.confirm.querySelector('.btn__label');
      if (lbl) lbl.textContent = busy ? 'Verificando...' : 'Confirmar';
    }
    if (els.input) els.input.readOnly = busy;
  }

  function showFeedback(msg) {
    els.feedback.textContent = msg;
    els.feedback.hidden = false;
  }
  function clearFeedback() {
    els.feedback.textContent = '';
    els.feedback.hidden = true;
  }

  DH.modalPassword = { setup, request, close };
})();