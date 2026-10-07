/* =========================================================
   DEV HUB · Gestão · modal de tipos de perfil
   ========================================================= */
(function () {
  'use strict';
  const Gestao = window.Gestao;
  const state = Gestao.state;
  const { showToast, roleLabel, confirmDialog } = Gestao.utils;
  const { callerIsAdmin } = Gestao.session;

  const roleTypeEls = {};

  function setup() {
    roleTypeEls.modal     = document.getElementById('role-types-modal');
    roleTypeEls.form      = document.getElementById('role-type-form');
    roleTypeEls.id        = document.getElementById('role-type-id');
    roleTypeEls.label     = document.getElementById('role-type-label');
    roleTypeEls.base      = document.getElementById('role-type-base');
    roleTypeEls.slug      = document.getElementById('role-type-slug');
    roleTypeEls.feedback  = document.getElementById('role-type-feedback');
    roleTypeEls.saveBtn   = document.getElementById('role-type-save-btn');
    roleTypeEls.cancelBtn = document.getElementById('role-type-cancel-btn');
    roleTypeEls.list      = document.getElementById('role-types-list');
    roleTypeEls.openBtn   = document.getElementById('role-types-open-btn');

    if (!roleTypeEls.modal) return;

    if (roleTypeEls.openBtn) {
      roleTypeEls.openBtn.addEventListener('click', open);
    }

    roleTypeEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', close);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !roleTypeEls.modal.hidden) close();
    });

    if (roleTypeEls.form) roleTypeEls.form.addEventListener('submit', onSubmit);
    if (roleTypeEls.cancelBtn) roleTypeEls.cancelBtn.addEventListener('click', resetForm);

    if (roleTypeEls.label) {
      roleTypeEls.label.addEventListener('input', function () {
        if (roleTypeEls.id && roleTypeEls.id.value) return;
        if (roleTypeEls.slug) {
          roleTypeEls.slug.value = slugify(roleTypeEls.label.value);
        }
      });
    }

    applyBaseRestrictions();
  }

  function applyBaseRestrictions() {
    if (!roleTypeEls.base) return;
    const iAmAdmin = callerIsAdmin();

    Array.from(roleTypeEls.base.options).forEach(function (opt) {
      const v = String(opt.value || '').toLowerCase();
      if (!iAmAdmin && v !== 'user') { opt.remove(); return; }
      if (iAmAdmin && v === 'admin') { opt.remove(); }
    });

    if (!roleTypeEls.base.value) roleTypeEls.base.value = 'user';
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }

  async function load() {
    try {
      const { data, error } = await window.db
        .from('role_types')
        .select('id, slug, label, base_role, active, created_at')
        .order('created_at', { ascending: true });

      if (error) throw error;
      state.roleTypes = data || [];
      if (roleTypeEls.list) renderList();
    } catch (error) {
      console.error('[DEV HUB] Falha ao carregar tipos de perfil:', error);
      state.roleTypes = [];
    }
  }

  function open() {
    if (!state.perms.roles) {
      showToast('Você não tem permissão para gerenciar tipos de perfil.', 'error');
      return;
    }
    resetForm();
    renderList();
    roleTypeEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      if (roleTypeEls.label) roleTypeEls.label.focus();
    }, 60);
  }

  function close() {
    if (!roleTypeEls.modal) return;
    roleTypeEls.modal.hidden = true;
    document.body.style.overflow = '';
  }

  function resetForm() {
    if (!roleTypeEls.form) return;
    roleTypeEls.form.reset();
    if (roleTypeEls.id) roleTypeEls.id.value = '';
    if (roleTypeEls.cancelBtn) roleTypeEls.cancelBtn.hidden = true;
    if (roleTypeEls.saveBtn) {
      const lbl = roleTypeEls.saveBtn.querySelector('.btn__label');
      if (lbl) lbl.textContent = 'Adicionar';
    }
    clearFeedback();
  }

  function renderList() {
    if (!roleTypeEls.list) return;

    const lista = callerIsAdmin()
      ? state.roleTypes
      : state.roleTypes.filter(function (rt) {
          return String(rt.base_role || '').toLowerCase() === 'user';
        });

    roleTypeEls.list.innerHTML = '';

    if (lista.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'state-block state-block--compact';
      empty.innerHTML = '<p>Nenhum tipo cadastrado ainda.</p>';
      roleTypeEls.list.appendChild(empty);
      return;
    }

    lista.forEach(function (rt) {
      roleTypeEls.list.appendChild(buildRow(rt));
    });
  }

  function buildRow(rt) {
    const row = document.createElement('div');
    row.className = 'role-type-item role-type-item--custom';

    const info = document.createElement('div');
    info.className = 'role-type-item__info';

    const label = document.createElement('div');
    label.className = 'role-type-item__label';
    label.textContent = rt.label;

    const meta = document.createElement('div');
    meta.className = 'role-type-item__meta';
    meta.textContent = rt.slug + ' · base: ' + roleLabel(rt.base_role);

    info.appendChild(label);
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'role-type-item__actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'row-action';
    editBtn.title = 'Editar';
    editBtn.setAttribute('aria-label', 'Editar ' + rt.label);
    editBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
    editBtn.addEventListener('click', function () { edit(rt); });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'row-action row-action--danger';
    delBtn.title = 'Excluir';
    delBtn.setAttribute('aria-label', 'Excluir ' + rt.label);
    delBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
      '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
      '<path d="M10 11v6M14 11v6"/></svg>';
    delBtn.addEventListener('click', function () { remove(rt); });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    row.appendChild(info);
    row.appendChild(actions);
    return row;
  }

  function edit(rt) {
    if (roleTypeEls.id) roleTypeEls.id.value = rt.id;
    if (roleTypeEls.label) roleTypeEls.label.value = rt.label;
    if (roleTypeEls.slug) roleTypeEls.slug.value = rt.slug;

    if (roleTypeEls.base) {
      const wanted = String(rt.base_role || 'user').toLowerCase();
      const exists = Array.from(roleTypeEls.base.options).some(function (o) {
        return String(o.value).toLowerCase() === wanted;
      });
      roleTypeEls.base.value = exists ? wanted : 'user';
    }

    if (roleTypeEls.cancelBtn) roleTypeEls.cancelBtn.hidden = false;
    if (roleTypeEls.saveBtn) {
      const lbl = roleTypeEls.saveBtn.querySelector('.btn__label');
      if (lbl) lbl.textContent = 'Salvar alterações';
    }
    if (roleTypeEls.label) roleTypeEls.label.focus();
  }

  async function onSubmit(event) {
    event.preventDefault();
    clearFeedback();

    if (!state.perms.roles) {
      showFeedback('Você não tem permissão para gerenciar tipos de perfil.');
      return;
    }

    const id    = roleTypeEls.id ? roleTypeEls.id.value : '';
    const label = roleTypeEls.label ? roleTypeEls.label.value.trim() : '';
    const base  = roleTypeEls.base ? roleTypeEls.base.value : 'user';
    let   slug  = roleTypeEls.slug ? roleTypeEls.slug.value.trim() : '';
    if (!slug) slug = slugify(label);

    if (!label) {
      showFeedback('Informe o nome exibido.');
      if (roleTypeEls.label) roleTypeEls.label.focus();
      return;
    }
    if (!slug) {
      showFeedback('O identificador interno não pode ficar vazio.');
      if (roleTypeEls.slug) roleTypeEls.slug.focus();
      return;
    }
    if (['admin', 'gestor', 'user'].indexOf(base) === -1) {
      showFeedback('Papel base inválido.'); return;
    }
    if (!callerIsAdmin() && base !== 'user') {
      showFeedback('Apenas administradores podem criar tipos com esse papel base.'); return;
    }
    if (base === 'admin') {
      showFeedback('Não é permitido criar tipos com papel base Administrador.'); return;
    }
    if (!state.currentOrgId) {
      showFeedback('Não foi possível identificar sua empresa.'); return;
    }

    setBusy(true);
    try {
      if (id) {
        const { error } = await window.db
          .from('role_types')
          .update({ slug: slug, label: label, base_role: base })
          .eq('id', id);
        if (error) throw error;
        showToast('Tipo atualizado.', 'success');
      } else {
        const { error } = await window.db
          .from('role_types')
          .insert({
            organization_id: state.currentOrgId,
            slug: slug, label: label, base_role: base, active: true
          });
        if (error) throw error;
        showToast('Tipo criado.', 'success');
      }
      resetForm();
      await load();
    } catch (error) {
      console.error('[DEV HUB] Falha ao salvar tipo de perfil:', error);
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique')) {
        showFeedback('Já existe um tipo com este identificador.');
      } else if (msg.includes('row-level security') || msg.includes('permission')) {
        showFeedback('Você não tem permissão para criar este tipo.');
      } else {
        showFeedback(error.message || 'Não foi possível salvar.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(rt) {
    if (!state.perms.roles) {
      showToast('Você não tem permissão para gerenciar tipos de perfil.', 'error');
      return;
    }

    const ok = await confirmDialog(
      'Excluir o tipo "' + rt.label + '"?\n\n' +
      'Usuários já vinculados a ele continuarão existindo, mas o nome exibido ' +
      'cairá para o papel base.',
      { title: 'Excluir tipo de perfil', danger: true, confirmLabel: 'Excluir' }
    );
    if (!ok) return;

    setBusy(true);
    try {
      const { error } = await window.db.from('role_types').delete().eq('id', rt.id);
      if (error) throw error;
      showToast('Tipo excluído.', 'success');
      await load();
      await Gestao.members.load();
    } catch (error) {
      console.error('[DEV HUB] Falha ao excluir tipo:', error);
      showToast('Não foi possível excluir o tipo.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function setBusy(busy) {
    if (roleTypeEls.saveBtn) {
      roleTypeEls.saveBtn.disabled = busy;
      roleTypeEls.saveBtn.classList.toggle('is-loading', busy);
      roleTypeEls.saveBtn.setAttribute('aria-busy', String(busy));
    }
  }

  function showFeedback(msg) {
    if (!roleTypeEls.feedback) return;
    roleTypeEls.feedback.textContent = msg;
    roleTypeEls.feedback.hidden = false;
  }
  function clearFeedback() {
    if (!roleTypeEls.feedback) return;
    roleTypeEls.feedback.textContent = '';
    roleTypeEls.feedback.hidden = true;
  }

  Gestao.roleTypes = { setup, load, open, close };
})();