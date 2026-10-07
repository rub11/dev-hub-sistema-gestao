/* =========================================================
   DEV HUB · UI.confirm
   ========================================================= */
(function () {
  'use strict';
  if (window.UI && typeof window.UI.confirm === 'function') return;

  const UI = window.UI || (window.UI = {});
  let refs = null, resolverAtual = null, teardown = null;

  function ensureStyles() {
    if (document.getElementById('ui-confirm-styles')) return;
    const style = document.createElement('style');
    style.id = 'ui-confirm-styles';
    style.textContent = `
      .ui-confirm-backdrop{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,12,20,.62);backdrop-filter:blur(3px);opacity:0;animation:ui-confirm-fade 160ms ease forwards}
      @keyframes ui-confirm-fade{to{opacity:1}}
      .ui-confirm-card{width:100%;max-width:460px;background:#10161f;color:#e6eaf2;border:1px solid rgba(255,255,255,.08);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.55);padding:22px 22px 18px;transform:translateY(6px) scale(.98);animation:ui-confirm-pop 180ms cubic-bezier(.2,.9,.3,1.2) forwards;font-family:inherit}
      @keyframes ui-confirm-pop{to{transform:translateY(0) scale(1)}}
      .ui-confirm-title{margin:0 0 8px;font-size:17px;font-weight:600;color:#f5f7fb}
      .ui-confirm-message{margin:0 0 20px;font-size:14px;line-height:1.55;color:#b7c0cf;white-space:pre-wrap}
      .ui-confirm-actions{display:flex;justify-content:flex-end;gap:10px}
      .ui-confirm-btn{appearance:none;border:1px solid transparent;border-radius:9px;padding:9px 16px;font-size:13.5px;font-weight:600;font-family:inherit;cursor:pointer;transition:background 120ms ease,border-color 120ms ease,opacity 120ms ease}
      .ui-confirm-btn:disabled{opacity:.6;cursor:not-allowed}
      .ui-confirm-btn:focus-visible{outline:2px solid #7aa2ff;outline-offset:2px}
      .ui-confirm-btn--ghost{background:transparent;color:#c7d0dd;border-color:rgba(255,255,255,.14)}
      .ui-confirm-btn--ghost:hover{background:rgba(255,255,255,.05)}
      .ui-confirm-btn--primary{background:#3b82f6;color:#fff}
      .ui-confirm-btn--primary:hover{background:#2f74e6}
      .ui-confirm-btn--danger{background:#dc2626;color:#fff}
      .ui-confirm-btn--danger:hover{background:#c81e1e}
      body.ui-confirm-open{overflow:hidden}
    `;
    document.head.appendChild(style);
  }

  function ensureRefs() {
    if (refs) return refs;
    ensureStyles();

    const backdrop = document.createElement('div');
    backdrop.className = 'ui-confirm-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.hidden = true;

    const card = document.createElement('div');
    card.className = 'ui-confirm-card';

    const title = document.createElement('h3');
    title.className = 'ui-confirm-title';

    const message = document.createElement('p');
    message.className = 'ui-confirm-message';

    const actions = document.createElement('div');
    actions.className = 'ui-confirm-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'ui-confirm-btn ui-confirm-btn--ghost';
    cancelBtn.textContent = 'Cancelar';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'ui-confirm-btn ui-confirm-btn--primary';
    confirmBtn.textContent = 'Confirmar';

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    card.appendChild(title);
    card.appendChild(message);
    card.appendChild(actions);
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    refs = { backdrop, card, title, message, cancelBtn, confirmBtn };

    cancelBtn.addEventListener('click', () => fechar(false));
    confirmBtn.addEventListener('click', () => fechar(true));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) fechar(false); });

    return refs;
  }

  function fechar(resultado) {
    if (!resolverAtual) return;
    const resolver = resolverAtual;
    resolverAtual = null;
    if (refs && refs.backdrop) refs.backdrop.hidden = true;
    document.body.classList.remove('ui-confirm-open');
    if (teardown) { teardown(); teardown = null; }
    resolver(resultado);
  }

  UI.confirm = function (mensagem, opcoes) {
    const opts = opcoes || {};
    const r = ensureRefs();
    if (resolverAtual) fechar(false);

    r.title.textContent = opts.title || 'Confirmar ação';
    r.message.textContent = String(mensagem == null ? '' : mensagem);
    r.confirmBtn.textContent = opts.confirmLabel || 'Confirmar';
    r.cancelBtn.textContent  = opts.cancelLabel  || 'Cancelar';
    r.confirmBtn.className = 'ui-confirm-btn ' +
      (opts.danger ? 'ui-confirm-btn--danger' : 'ui-confirm-btn--primary');

    r.backdrop.hidden = false;
    document.body.classList.add('ui-confirm-open');
    setTimeout(() => r.confirmBtn.focus(), 30);

    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); fechar(false); }
      else if (event.key === 'Enter' && document.activeElement !== r.cancelBtn) {
        event.preventDefault(); fechar(true);
      }
    };
    document.addEventListener('keydown', onKey, true);
    teardown = () => document.removeEventListener('keydown', onKey, true);

    return new Promise((resolve) => { resolverAtual = resolve; });
  };

  UI.confirmDialog = UI.confirm;
})();