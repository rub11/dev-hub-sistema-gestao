/* =========================================================
   DEV HUB · Gestão · modal de confirmação (toggle/delete)
   ========================================================= */
(function () {
  'use strict';
  const Gestao = window.Gestao;
  const state = Gestao.state;
  const { showToast } = Gestao.utils;

  const confirmEls = {};

  function setup() {
    confirmEls.modal = document.getElementById('confirm-modal');
    confirmEls.text  = document.getElementById('confirm-text');
    confirmEls.btn   = document.getElementById('confirm-action-btn');
    if (!confirmEls.modal || !confirmEls.btn) return;

    confirmEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', close);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !confirmEls.modal.hidden) close();
    });

    confirmEls.btn.addEventListener('click', onConfirm);
  }

  function confirmAction(type, member) {
    if (!state.perms.users) {
      showToast('Você não tem permissão para gerenciar usuários.', 'error');
      return;
    }

    state.action = { type: type, member: member };

    const isActive = member.active !== false;
    const name = member.name || 'este usuário';

    if (type === 'toggle') {
      if (isActive) {
        confirmEls.text.textContent =
          'Tem certeza que deseja desativar "' + name + '"? ' +
          'Usuários desativados não conseguem acessar o Dev Hub.';
        setButton('Desativar', 'danger');
      } else {
        confirmEls.text.textContent =
          'Deseja ativar "' + name + '" novamente? ' +
          'O usuário voltará a ter acesso ao Dev Hub.';
        setButton('Ativar', 'primary');
      }
    } else if (type === 'delete') {
      confirmEls.text.textContent =
        'Excluir "' + name + '"? Essa ação removerá o acesso do usuário ao Dev Hub. ' +
        'Os dados operacionais (clientes, produtos, vendas) não são afetados.';
      setButton('Excluir acesso', 'danger');
    }

    confirmEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    confirmEls.btn.focus();
  }

  function setButton(label, variant) {
    confirmEls.btn.className = 'btn btn--' + variant;
    const lbl = confirmEls.btn.querySelector('.btn__label');
    if (lbl) lbl.textContent = label;
  }

  function close() {
    if (state.acting) return;
    confirmEls.modal.hidden = true;
    document.body.style.overflow = '';
    state.action = null;
  }

  async function onConfirm() {
    if (state.acting || !state.action) return;

    if (!state.perms.users) {
      showToast('Você não tem permissão para gerenciar usuários.', 'error');
      close();
      return;
    }

    const { type, member } = state.action;
    setBusy(true);

    try {
      if (type === 'toggle') {
        const newActive = member.active === false;
        const { error } = await window.db
          .from('organization_members')
          .update({ active: newActive })
          .eq('id', member.id);
        if (error) throw error;
        showToast(newActive ? 'Usuário ativado.' : 'Usuário desativado.', 'success');
      } else if (type === 'delete') {
        const { error } = await window.db
          .from('organization_members')
          .delete()
          .eq('id', member.id);
        if (error) throw error;
        showToast('Acesso do usuário removido.', 'success');
      }

      confirmEls.modal.hidden = true;
      document.body.style.overflow = '';
      state.action = null;

      await Gestao.members.load();
    } catch (error) {
      console.error('[DEV HUB] Falha na operação:', error);
      showToast(Gestao.userModal.mapActionError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  function setBusy(busy) {
    state.acting = busy;
    if (confirmEls.btn) {
      confirmEls.btn.disabled = busy;
      confirmEls.btn.classList.toggle('is-loading', busy);
      confirmEls.btn.setAttribute('aria-busy', String(busy));
    }
  }

  Gestao.confirmModal = { setup, confirmAction, close };
})();