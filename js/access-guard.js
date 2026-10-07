/* =========================================================
   DEV HUB · Guard de acesso
   ---------------------------------------------------------
   Renderiza uma tela de "Acesso negado" no lugar do conteúdo
   da página, sem redirect. Reutilizável em qualquer página.

   Uso:
     AccessGuard.deny({ title, message, backHref, backLabel });
   ========================================================= */

(function () {
  'use strict';

  function ensureStyles() {
    if (document.getElementById('access-guard-styles')) return;
    const style = document.createElement('style');
    style.id = 'access-guard-styles';
    style.textContent = `
      .access-denied {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 70vh;
        padding: 40px 24px;
        animation: accessFade 220ms ease;
      }
      @keyframes accessFade {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .access-denied__card {
        max-width: 460px;
        width: 100%;
        text-align: center;
        background: var(--surface, #0d131c);
        border: 1px solid var(--border, rgba(255,255,255,.08));
        border-radius: 16px;
        padding: 36px 28px 32px;
        box-shadow: 0 24px 60px rgba(0,0,0,.45);
      }
      .access-denied__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: rgba(239,68,68,.12);
        color: #ef4444;
        margin-bottom: 18px;
      }
      .access-denied__icon svg { width: 32px; height: 32px; }
      .access-denied__title {
        margin: 0 0 10px;
        font-size: 20px;
        font-weight: 700;
        color: var(--text, #e6eaf2);
        letter-spacing: -0.01em;
      }
      .access-denied__message {
        margin: 0 0 24px;
        font-size: 14px;
        line-height: 1.55;
        color: var(--text-muted, #8b95a7);
      }
      .access-denied__actions {
        display: flex;
        justify-content: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .access-denied__btn {
        appearance: none;
        border: 1px solid transparent;
        border-radius: 9px;
        padding: 10px 18px;
        font-size: 13.5px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: background 120ms ease, border-color 120ms ease, opacity 120ms ease;
      }
      .access-denied__btn--primary {
        background: #3b82f6;
        color: #fff;
      }
      .access-denied__btn--primary:hover { background: #2f74e6; }
      .access-denied__btn--ghost {
        background: transparent;
        color: #c7d0dd;
        border-color: rgba(255,255,255,.14);
      }
      .access-denied__btn--ghost:hover { background: rgba(255,255,255,.05); }
    `;
    document.head.appendChild(style);
  }

  /**
   * Substitui o conteúdo da página (dentro de <main>) pela tela
   * de acesso negado. Esconde tudo que estiver em <main>.
   */
  function deny(opts) {
    const o = opts || {};
    ensureStyles();

    const main =
      document.getElementById('main') ||
      document.querySelector('main.content') ||
      document.querySelector('main');

    if (!main) {
      // Fallback: alerta simples
      alert(o.message || 'Acesso negado.');
      return;
    }

    // Esconde tudo que já existe no <main>
    Array.from(main.children).forEach(function (child) {
      if (!child.classList.contains('access-denied')) {
        child.style.display = 'none';
        child.setAttribute('data-access-hidden', '1');
      }
    });

    // Evita duplicar
    if (main.querySelector('.access-denied')) return;

    const backHref  = o.backHref  || 'dashboard.html';
    const backLabel = o.backLabel || 'Voltar ao dashboard';

    const wrap = document.createElement('div');
    wrap.className = 'access-denied';
    wrap.setAttribute('role', 'alert');
    wrap.innerHTML = `
      <div class="access-denied__card">
        <span class="access-denied__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4.5" y="10.5" width="15" height="10" rx="2"/>
            <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>
          </svg>
        </span>
        <h2 class="access-denied__title">${escapeHtml(o.title || 'Acesso negado')}</h2>
        <p class="access-denied__message">${escapeHtml(
          o.message ||
          'Você não tem permissão para acessar esta área. Se precisar, fale com um administrador.'
        )}</p>
        <div class="access-denied__actions">
          <a class="access-denied__btn access-denied__btn--ghost" href="javascript:history.back()">
            Voltar
          </a>
          <a class="access-denied__btn access-denied__btn--primary" href="${escapeAttr(backHref)}">
            ${escapeHtml(backLabel)}
          </a>
        </div>
      </div>
    `;
    main.appendChild(wrap);

    // Esconde o page-head (caso esteja fora do main)
    document.querySelectorAll('.page-head').forEach(function (el) {
      el.style.display = 'none';
      el.setAttribute('data-access-hidden', '1');
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  window.AccessGuard = { deny };
})();