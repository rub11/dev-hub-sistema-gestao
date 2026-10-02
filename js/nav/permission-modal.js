/* =========================================================
   DEV HUB · Navegação · modal de acesso negado
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV;

  function injectPermissionModal() {
    if (document.getElementById('perm-denied-modal')) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'perm-denied-modal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="modal__backdrop" data-close-perm></div>' +
      '<div class="modal__dialog modal__dialog--sm" role="alertdialog" ' +
           'aria-modal="true" aria-labelledby="perm-denied-title">' +
        '<header class="modal__head">' +
          '<h2 class="modal__title" id="perm-denied-title">Acesso negado</h2>' +
          '<button type="button" class="icon-btn modal__close" ' +
                  'aria-label="Fechar" data-close-perm>' + NAV.ICONS.close + '</button>' +
        '</header>' +
        '<div class="modal__body">' +
          '<div class="perm-denied__icon" aria-hidden="true">' + NAV.ICONS.lock + '</div>' +
          '<p class="perm-denied__text">' +
            'Você não tem permissão para acessar a tela ' +
            '<strong data-perm-label>—</strong>.' +
          '</p>' +
          '<p class="perm-denied__hint">' +
            'Solicite acesso ao gestor ou administrador da plataforma.' +
          '</p>' +
        '</div>' +
        '<footer class="modal__foot">' +
          '<button type="button" class="btn btn--primary" data-close-perm>Entendi</button>' +
        '</footer>' +
      '</div>';

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-close-perm]').forEach(function (el) {
      el.addEventListener('click', closePermissionModal);
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !modal.hidden) closePermissionModal();
    });
  }

  function showPermissionDenied(label) {
    const modal = document.getElementById('perm-denied-modal');
    if (!modal) return;

    const labelEl = modal.querySelector('[data-perm-label]');
    if (labelEl) labelEl.textContent = '“' + (label || 'essa tela') + '”';

    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    const btn = modal.querySelector('.btn');
    if (btn) btn.focus();
  }

  function closePermissionModal() {
    const modal = document.getElementById('perm-denied-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  NAV.permissionModal = {
    inject: injectPermissionModal,
    show: showPermissionDenied,
    close: closePermissionModal
  };
})();