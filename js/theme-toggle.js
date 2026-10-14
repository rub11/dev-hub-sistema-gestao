/* =========================================================
   DEV HUB · Botão de trocar tema
   ---------------------------------------------------------
   1. Tenta injetar dentro da topbar (ao lado do user menu)
   2. Se não achar topbar → flutua no canto inferior direito
   3. Clique alterna light ↔ dark
   4. Clique longo (700ms) volta para 'auto'
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Onde encaixar o botão ---------- */
  function findTopbarSlot() {
    /* Candidatos em ordem de preferência:
       - antes do user (à esquerda dele)
       - antes do sino
       - append no container da topbar */
    const beforeSelectors = [
      '.app-tabs__user',
      '.app-tabs__bell',
      '.topbar__user',
      '.topbar__actions'
    ];

    for (const sel of beforeSelectors) {
      const el = document.querySelector(sel);
      if (el && el.parentNode) return { el, mode: 'before' };
    }

    const appendSelectors = [
      '.app-tabs',
      '.topbar',
      'header.topbar',
      'header.app-header'
    ];

    for (const sel of appendSelectors) {
      const el = document.querySelector(sel);
      if (el) return { el, mode: 'append' };
    }

    return null;
  }

  /* ---------- Constrói o botão ---------- */
  function buildButton(placement) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle theme-toggle--' + placement;
    btn.setAttribute('aria-label', 'Alternar tema');
    btn.title = 'Alternar tema (clique longo: automático)';

    btn.innerHTML = `
      <svg class="theme-toggle__sun" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>
      <svg class="theme-toggle__moon" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    `;

    let pressTimer = null;
    let longPressed = false;

    btn.addEventListener('pointerdown', function () {
      longPressed = false;
      pressTimer = setTimeout(function () {
        longPressed = true;
        window.Theme.set('auto');
      }, 700);
    });

    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      btn.addEventListener(ev, function () {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      });
    });

    btn.addEventListener('click', function () {
      if (longPressed) return;
      window.Theme.toggle();
    });

    return btn;
  }

  /* ---------- Init ---------- */
  function init() {
    if (!window.Theme) return;
    if (document.querySelector('.theme-toggle')) return;

    const slot = findTopbarSlot();

    if (slot) {
      const btn = buildButton('inline');
      if (slot.mode === 'before') {
        slot.el.parentNode.insertBefore(btn, slot.el);
      } else {
        slot.el.appendChild(btn);
      }
    } else {
      /* Fallback: flutua no canto inferior direito */
      const btn = buildButton('floating');
      document.body.appendChild(btn);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();