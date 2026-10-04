/* =========================================================
   DEV HUB · Permissões · modals
   Modal de novo/editar role_type + confirmação genérica
   + menu popover do perfil (⋯)
   Publica em: window.PRM
   ========================================================= */
(function () {
  'use strict';

  const PRM = window.PRM;
  const { $, state, ICONS, slugify, toast } = PRM;

  /* ============================================================
     MODAL DE ROLE TYPE
     ============================================================ */
  const roleModal = $('#role-modal');
  const roleForm  = $('#role-form');
  let editingRoleId = null;

  function openRoleModal(profile) {
    editingRoleId = profile && profile.id ? profile.id : null;
    $('#role-modal-title').textContent = profile ? 'Editar tipo de perfil' : 'Novo tipo de perfil';
    roleForm.reset();
    $('#role-feedback').hidden = true;

    if (profile) {
      roleForm.label.value = profile.label;
      roleForm.slug.value  = profile.slug;
      roleForm.slug.readOnly = true;
      roleForm.baseRole.value = profile.baseRole;
    } else {
      roleForm.slug.readOnly = false;
    }

    roleModal.hidden = false;
    setTimeout(() => roleForm.label.focus(), 40);
  }

  function closeRoleModal() {
    roleModal.hidden = true;
    editingRoleId = null;
  }

  /* ============================================================
     MODAL DE CONFIRMAÇÃO
     ============================================================ */
  const confirmModal = $('#confirm-modal');
  let confirmCallback = null;

  function openConfirm(text, cb, okLabel) {
    $('#confirm-text').textContent = text;
    $('#btn-confirm .prm-btn__label').textContent = okLabel || 'Excluir';
    confirmCallback = cb;
    confirmModal.hidden = false;
  }

  function closeConfirm() {
    confirmModal.hidden = true;
    confirmCallback = null;
  }

  /* ============================================================
     MENU POPOVER (⋯) — em vez de window.prompt
     ============================================================ */
  const menuEl = document.getElementById('role-menu');
  let menuTargetKey = null;

  function openRoleMenu(key, anchor) {
    if (!menuEl) return;

    menuTargetKey = key;

    /* Posiciona primeiro invisível, depois mostra e mede */
    menuEl.hidden = false;
    menuEl.classList.remove('is-open');

    const r = anchor.getBoundingClientRect();
    const mRect = menuEl.getBoundingClientRect();
    const margin = 8;

    let top = r.bottom + 6;
    let left = r.right - mRect.width;

    if (left < margin) left = margin;
    if (left + mRect.width > window.innerWidth - margin) {
      left = window.innerWidth - mRect.width - margin;
    }
    if (top + mRect.height > window.innerHeight - margin) {
      const above = r.top - 6 - mRect.height;
      if (above >= margin) top = above;
      else top = Math.max(margin, window.innerHeight - mRect.height - margin);
    }

    menuEl.style.top  = top  + 'px';
    menuEl.style.left = left + 'px';

    /* Animação */
    void menuEl.offsetWidth;
    menuEl.classList.add('is-open');
  }

  function closeRoleMenu() {
    if (!menuEl) return;
    menuEl.classList.remove('is-open');
    menuTargetKey = null;
    setTimeout(() => { menuEl.hidden = true; }, 160);
  }

  function handleRoleMenu(key, anchor) {
    /* Se chamado sem âncora (compatibilidade), faz fallback */
    if (!anchor) {
      const p = state.profiles.find((x) => x.key === key);
      if (!p) return;
      openRoleModal(p);
      return;
    }
    openRoleMenu(key, anchor);
  }

  /* Delegação de eventos no menu */
  function bindRoleMenuEvents() {
    if (!menuEl) return;

    menuEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const key = menuTargetKey;
      const p = state.profiles.find((x) => x.key === key);
      closeRoleMenu();
      if (!p) return;

      if (action === 'edit')   openRoleModal(p);
      if (action === 'delete') confirmDeleteRole(p);
    });

    /* Fecha ao clicar fora */
    document.addEventListener('click', (e) => {
      if (!menuEl || menuEl.hidden) return;
      if (menuEl.contains(e.target)) return;
      if (e.target.closest('[data-menu]')) return; /* o próprio botão cuida */
      closeRoleMenu();
    });

    /* Fecha ao rolar / redimensionar */
    window.addEventListener('scroll', () => {
      if (menuEl && !menuEl.hidden) closeRoleMenu();
    }, true);
    window.addEventListener('resize', () => {
      if (menuEl && !menuEl.hidden) closeRoleMenu();
    });

    /* Fecha com Escape */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuEl && !menuEl.hidden) closeRoleMenu();
    });
  }

  /* ============================================================
     EXCLUIR PERFIL
     ============================================================ */
  function confirmDeleteRole(profile) {
    if (!profile.id) return;
    openConfirm(
      `Excluir "${profile.label}"?\n\nUsuários vinculados irão para "Funcionário".`,
      async () => {
        await PRM.deleteRoleType(profile);
        await PRM.loadAll();
        state.selected = state.profiles[0].key;
        PRM.render();
        toast('Tipo excluído.', 'success');
      },
      'Excluir'
    );
  }

  /* ============================================================
     BIND DE EVENTOS
     ============================================================ */
  PRM.setupModalEvents = function () {
    /* Abrir novo role */
    $('#btn-new-role').addEventListener('click', () => openRoleModal(null));

    /* Fechar role-modal */
    roleModal.addEventListener('click', (e) => {
      if (e.target.matches('[data-close]')) closeRoleModal();
    });

    /* Auto-slug */
    roleForm.label.addEventListener('input', () => {
      if (editingRoleId) return;
      roleForm.slug.value = slugify(roleForm.label.value);
    });

    /* Submit do role */
    roleForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const label    = roleForm.label.value.trim();
      const slug     = roleForm.slug.value.trim().toLowerCase();
      const baseRole = roleForm.baseRole.value;

      const fb = $('#role-feedback');
      fb.hidden = true;

      if (!label)    { fb.textContent = 'Informe o nome.'; fb.hidden = false; roleForm.label.focus(); return; }
      if (!slug)     { fb.textContent = 'Informe o slug.'; fb.hidden = false; roleForm.slug.focus(); return; }
      if (['admin', 'gestor', 'user'].indexOf(slug) !== -1 && !editingRoleId) {
        fb.textContent = 'Esse slug é reservado pelo sistema.';
        fb.hidden = false;
        roleForm.slug.focus();
        return;
      }

      const btn = $('#btn-save-role');
      btn.classList.add('is-loading');
      btn.disabled = true;

      try {
        if (editingRoleId) {
          await PRM.updateRoleType(editingRoleId, { label, baseRole });
        } else {
          await PRM.createRoleType({ label, slug, baseRole });
        }

        closeRoleModal();
        await PRM.loadAll();
        PRM.render();
        toast(editingRoleId ? 'Tipo atualizado.' : 'Tipo criado.', 'success');
      } catch (err) {
        console.error('[permissoes] salvar role_type:', err);
        const msg = String(err.message || '').toLowerCase();
        if (msg.includes('duplicate') || msg.includes('unique')) {
          fb.textContent = 'Já existe um tipo com esse slug.';
        } else {
          fb.textContent = err.message || 'Erro ao salvar.';
        }
        fb.hidden = false;
      } finally {
        btn.classList.remove('is-loading');
        btn.disabled = false;
      }
    });

    /* Fechar confirm-modal */
    confirmModal.addEventListener('click', (e) => {
      if (e.target.matches('[data-close]')) closeConfirm();
    });

    /* Confirmar exclusão */
    $('#btn-confirm').addEventListener('click', async () => {
      if (!confirmCallback) return;
      const btn = $('#btn-confirm');
      btn.classList.add('is-loading');
      btn.disabled = true;
      try {
        await confirmCallback();
        closeConfirm();
      } catch (err) {
        console.error(err);
        toast('Erro: ' + (err.message || err), 'error');
      } finally {
        btn.classList.remove('is-loading');
        btn.disabled = false;
      }
    });

    /* Escape fecha modais */
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!roleModal.hidden)    closeRoleModal();
      if (!confirmModal.hidden) closeConfirm();
    });

    /* Bind do menu popover */
    bindRoleMenuEvents();

    /* Expõe para uso externo */
    PRM.handleRoleMenu  = handleRoleMenu;
    PRM.openRoleModal   = openRoleModal;
    PRM.closeRoleMenu   = closeRoleMenu;
  };
})();