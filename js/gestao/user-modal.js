/* =========================================================
   DEV HUB · Gestão · modal criar/editar usuário + permissões
   ========================================================= */
(function () {
  'use strict';
  const Gestao = window.Gestao;
  const state = Gestao.state;
  const { showToast, setText } = Gestao.utils;
  const { callerIsAdmin, visibleRoleTypes } = Gestao.session;

  const modalEls = {};

  function setup() {
    modalEls.modal    = document.getElementById('user-modal');
    modalEls.form     = document.getElementById('user-form');
    modalEls.name     = document.getElementById('user-form-name');
    modalEls.email    = document.getElementById('user-email');
    modalEls.password = document.getElementById('user-password');
    modalEls.role     = document.getElementById('user-form-role');
    modalEls.feedback = document.getElementById('user-form-feedback');
    modalEls.saveBtn  = document.getElementById('user-save-btn');
    modalEls.openBtn  = document.getElementById('new-user-btn');

    modalEls.passwordChangeBlock = document.getElementById('user-password-change-block');
    modalEls.currentPassword     = document.getElementById('user-current-password');
    modalEls.newPassword         = document.getElementById('user-new-password');

    modalEls.permsBlock    = document.getElementById('user-perms-block');
    modalEls.permsHint     = document.getElementById('user-perms-hint');
    modalEls.permsGroups   = document.getElementById('user-perms-groups');
    modalEls.permsFeedback = document.getElementById('user-perms-feedback');

    if (!modalEls.modal || !modalEls.form) return;

    if (modalEls.openBtn) {
      modalEls.openBtn.addEventListener('click', function () { open(null); });
    }

    modalEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', close);
    });

    modalEls.modal.querySelectorAll('[data-pw-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const targetId = btn.getAttribute('data-pw-toggle');
        const input = document.getElementById(targetId);
        if (!input) return;
        const visible = input.type === 'text';
        input.type = visible ? 'password' : 'text';
        btn.setAttribute('aria-pressed', String(!visible));
        btn.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha');
        input.focus({ preventScroll: true });
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modalEls.modal.hidden) close();
    });

    modalEls.form.addEventListener('submit', onSubmit);

    if (modalEls.role) {
      modalEls.role.addEventListener('change', function () {
        if (!state.editingMember) return;
        const opt = modalEls.role.options[modalEls.role.selectedIndex];
        const slug = (opt && opt.dataset && opt.dataset.slug) || '';
        loadUserPermsForSlug(slug);
      });
    }
  }

  function open(member) {
    if (!state.perms.users) {
      showToast('Você não tem permissão para gerenciar usuários.', 'error');
      return;
    }

    state.editingMember = member || null;
    const isEdit = Boolean(state.editingMember);

    modalEls.form.reset();
    clearFormFeedback();
    clearPermsFeedback();
    setFormBusy(false);

    modalEls.modal.querySelectorAll('[data-pw-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'Mostrar senha');
    });
    if (modalEls.currentPassword) modalEls.currentPassword.type = 'password';
    if (modalEls.newPassword) modalEls.newPassword.type = 'password';

    if (modalEls.passwordChangeBlock) {
      modalEls.passwordChangeBlock.hidden = !isEdit;
    }
    if (modalEls.permsBlock) {
      modalEls.permsBlock.hidden = !isEdit;
    }

    if (isEdit) {
      modalEls.name.value = state.editingMember.name || '';
      modalEls.email.value = state.editingMember.email || '';
      togglePasswordField(false);
      populateRoleSelect(state.editingMember.role_slug, state.editingMember.role);
      loadUserPermsForSlug(state.editingMember.role_slug || '');
    } else {
      togglePasswordField(true);
      populateRoleSelect(null, 'user');
      if (modalEls.currentPassword) modalEls.currentPassword.value = '';
      if (modalEls.newPassword) modalEls.newPassword.value = '';
      if (modalEls.permsGroups) modalEls.permsGroups.innerHTML = '';
    }

    setModalMode(isEdit ? 'edit' : 'create');

    modalEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    if (modalEls.name) modalEls.name.focus();
  }

  function close() {
    if (state.creating) return;
    state.editingMember = null;
    state.permsSlug = null;
    Gestao.permsGeneration += 1;
    if (modalEls.modal) modalEls.modal.hidden = true;
    document.body.style.overflow = '';
  }

  function setModalMode(mode) {
    if (!modalEls.modal) return;
    const title = modalEls.modal.querySelector('.modal__title');
    if (title) title.textContent = mode === 'edit' ? 'Editar usuário' : 'Criar novo usuário';

    if (modalEls.saveBtn) {
      const label = modalEls.saveBtn.querySelector('.btn__label');
      if (label) label.textContent = mode === 'edit' ? 'Salvar alterações' : 'Criar usuário';
    }
  }

  function togglePasswordField(show) {
    if (!modalEls.password) return;
    modalEls.password.required = show;
    modalEls.password.value = '';
    const container = modalEls.password.closest('.field') || modalEls.password.parentElement;
    if (container) container.hidden = !show;
  }

  /* ---------- Permissões ---------- */
  function loadUserPermsForSlug(slug) {
    if (!modalEls.permsBlock) return;

    state.permsSlug = String(slug || '').toLowerCase();
    Gestao.permsGeneration += 1;
    const generation = Gestao.permsGeneration;

    if (!state.permsSlug) {
      if (modalEls.permsHint) {
        modalEls.permsHint.textContent =
          'Este perfil usa as permissões padrão do papel base. ' +
          'Para personalizar, crie um "Tipo de perfil" e atribua a este usuário.';
      }
      if (modalEls.permsGroups) {
        modalEls.permsGroups.innerHTML =
          '<div class="state-block state-block--compact">' +
          '<p>Selecione um tipo personalizado (ex.: Vendedor) para editar as permissões.</p></div>';
      }
      return;
    }

    if (modalEls.permsHint) {
      modalEls.permsHint.textContent =
        'Marque o que este perfil pode ver e fazer. Salva automaticamente.';
    }
    if (modalEls.permsGroups) {
      modalEls.permsGroups.innerHTML =
        '<div class="state-block state-block--compact">' +
        '<span class="spinner" aria-hidden="true"></span>' +
        '<p>Carregando permissões…</p></div>';
    }

    fetchAndRenderPerms(state.permsSlug, generation);
  }

  async function fetchAndRenderPerms(slug, generation) {
    if (!state.currentOrgId) {
      if (generation !== Gestao.permsGeneration) return;
      renderPermsGroups({}, slug);
      return;
    }

    try {
      const { data, error } = await window.db
        .from('role_permissions')
        .select('capability, allowed')
        .eq('organization_id', state.currentOrgId)
        .eq('role_slug', slug);

      if (generation !== Gestao.permsGeneration) return;

      const map = {};
      if (!error && Array.isArray(data)) {
        data.forEach(function (r) { map[r.capability] = r.allowed === true; });
      } else if (error) {
        console.warn('[DEV HUB] Falha ao ler role_permissions:', error);
      }
      renderPermsGroups(map, slug);
    } catch (e) {
      if (generation !== Gestao.permsGeneration) return;
      console.error('[DEV HUB] Erro ao carregar permissões:', e);
      renderPermsGroups({}, slug);
    }
  }

  function renderPermsGroups(map, slug) {
    if (!modalEls.permsGroups) return;

    const effectiveSlug = slug || state.permsSlug;
    const rt = state.roleTypes.find(function (r) {
      return String(r.slug || '').toLowerCase() === effectiveSlug;
    });
    const baseRole = rt ? String(rt.base_role || 'user').toLowerCase() : 'user';
    const defaults =
      (window.Perms && window.Perms.DEFAULTS && window.Perms.DEFAULTS[baseRole]) || [];

    modalEls.permsGroups.innerHTML = '';

    Gestao.PERM_GROUPS.forEach(function (group) {
      const wrap = document.createElement('div');
      wrap.className = 'field-group';

      const title = document.createElement('p');
      title.className = 'field-group__title';
      title.textContent = group.title;
      wrap.appendChild(title);

      group.caps.forEach(function (pair) {
        const cap = pair[0];
        const lbl = pair[1];

        const row = document.createElement('label');
        row.className = 'user-perm-row';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        const hasDbRow = Object.prototype.hasOwnProperty.call(map, cap);
        cb.checked = hasDbRow ? map[cap] === true : (defaults.indexOf(cap) !== -1);
        cb.dataset.cap = cap;
        cb.addEventListener('change', function () {
          toggleUserPermission(cap, cb.checked, cb);
        });

        const txt = document.createElement('span');
        txt.textContent = lbl;

        row.appendChild(cb);
        row.appendChild(txt);
        wrap.appendChild(row);
      });

      modalEls.permsGroups.appendChild(wrap);
    });
  }

  async function toggleUserPermission(capability, allowed, cbEl) {
    const slug = state.permsSlug;
    if (!slug) return;

    if (!state.currentOrgId) {
      showPermsFeedback('Empresa não identificada.');
      if (cbEl) cbEl.checked = !allowed;
      return;
    }

    clearPermsFeedback();
    if (cbEl) cbEl.disabled = true;

    try {
      const { error } = await window.db
        .from('role_permissions')
        .upsert({
          organization_id: state.currentOrgId,
          role_slug: slug,
          capability: capability,
          allowed: allowed
        }, { onConflict: 'organization_id,role_slug,capability' });

      if (error) throw error;
      showToast(allowed ? 'Permissão concedida.' : 'Permissão removida.', 'success');
    } catch (error) {
      console.error('[DEV HUB] Falha ao salvar permissão:', error);
      const lower = String(error.message || '').toLowerCase();

      if (lower.includes('relation') && lower.includes('does not exist')) {
        showPermsFeedback('A tabela role_permissions não existe no banco. Rode o SQL de setup.');
      } else if (lower.includes('on conflict') || lower.includes('no unique')) {
        showPermsFeedback('Falta a unique constraint (organization_id, role_slug, capability).');
      } else if (lower.includes('row-level security') || lower.includes('permission denied')) {
        showPermsFeedback('Você não tem permissão para alterar permissões.');
      } else {
        showPermsFeedback('Não foi possível salvar: ' + (error.message || 'erro desconhecido'));
      }
      if (cbEl) cbEl.checked = !allowed;
    } finally {
      if (cbEl) cbEl.disabled = false;
    }
  }

  function showPermsFeedback(msg) {
    if (!modalEls.permsFeedback) return;
    modalEls.permsFeedback.textContent = msg;
    modalEls.permsFeedback.hidden = false;
  }
  function clearPermsFeedback() {
    if (!modalEls.permsFeedback) return;
    modalEls.permsFeedback.textContent = '';
    modalEls.permsFeedback.hidden = true;
  }

  /* ---------- Select de perfil ---------- */
  function populateRoleSelect(currentSlug, currentBaseRole) {
    if (!modalEls.role) return;

    modalEls.role.innerHTML = '';
    const iAmAdmin = callerIsAdmin();

    const baseOptions = [['user', 'Funcionário']];
    if (iAmAdmin) baseOptions.push(['gestor', 'Gestor']);

    baseOptions.forEach(function (pair) {
      const opt = document.createElement('option');
      opt.value = pair[0];
      opt.dataset.baseRole = pair[0];
      opt.dataset.slug = '';
      opt.textContent = pair[1];
      modalEls.role.appendChild(opt);
    });

    if (state.editingMember && iAmAdmin) {
      const opt = document.createElement('option');
      opt.value = 'admin';
      opt.dataset.baseRole = 'admin';
      opt.dataset.slug = '';
      opt.textContent = 'Administrador';
      modalEls.role.appendChild(opt);
    }

    const tipos = visibleRoleTypes();
    if (tipos.length > 0) {
      const sep = document.createElement('option');
      sep.disabled = true;
      sep.textContent = '──── Tipos personalizados ────';
      modalEls.role.appendChild(sep);

      tipos.forEach(function (rt) {
        const opt = document.createElement('option');
        opt.value = rt.slug;
        opt.dataset.baseRole = rt.base_role;
        opt.dataset.slug = rt.slug;
        opt.textContent = rt.label;
        modalEls.role.appendChild(opt);
      });
    }

    if (currentSlug) modalEls.role.value = currentSlug;
    else if (currentBaseRole) modalEls.role.value = currentBaseRole;
    else modalEls.role.value = 'user';
    if (!modalEls.role.value) modalEls.role.value = 'user';
  }

  /* ---------- Submit ---------- */
  async function onSubmit(event) {
    event.preventDefault();
    if (state.creating) return;

    if (!state.perms.users) {
      showFormFeedback('Você não tem permissão para gerenciar usuários.');
      return;
    }

    clearFormFeedback();

    const isEdit = Boolean(state.editingMember);
    const name = modalEls.name.value.trim();
    const email = modalEls.email.value.trim().toLowerCase();
    const password = modalEls.password ? modalEls.password.value : '';

    const selectedOpt = modalEls.role.options[modalEls.role.selectedIndex];
    const baseRole = (selectedOpt && selectedOpt.dataset && selectedOpt.dataset.baseRole) || 'user';
    const slug     = (selectedOpt && selectedOpt.dataset && selectedOpt.dataset.slug) || null;

    if (!name) { showFormFeedback('Informe o nome do usuário.'); modalEls.name.focus(); return; }
    if (!email) { showFormFeedback('Informe o e-mail do usuário.'); modalEls.email.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFormFeedback('Informe um e-mail válido.'); modalEls.email.focus(); return;
    }

    if (!isEdit) {
      if (!password) {
        showFormFeedback('Informe a senha inicial.'); modalEls.password.focus(); return;
      }
      if (password.length < 6) {
        showFormFeedback('A senha precisa ter pelo menos 6 caracteres.');
        modalEls.password.focus(); return;
      }
      if (baseRole === 'admin') {
        showFormFeedback('Administradores não podem ser criados por esta tela.'); return;
      }
      if (baseRole === 'gestor' && !callerIsAdmin()) {
        showFormFeedback('Apenas administradores podem criar gestores.'); return;
      }
    }

    if (isEdit) return onSubmitEditMember(name, email, baseRole, slug);

    const safeRole = (baseRole === 'gestor') ? 'gestor' : 'user';
    const safeSlug = (baseRole === 'admin') ? null : slug;

    setFormBusy(true);
    try {
      const { data, error } = await window.db.rpc('admin_create_user', {
        p_name: name,
        p_email: email,
        p_password: password,
        p_role: safeRole,
        p_role_slug: safeSlug
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row || !row.user_id) {
        throw new Error('Usuário criado, mas não foi possível confirmar o vínculo.');
      }

      modalEls.modal.hidden = true;
      document.body.style.overflow = '';
      showToast('Usuário criado com sucesso.', 'success');
      await Gestao.members.load();
    } catch (error) {
      console.error('[DEV HUB] Falha ao criar usuário:', error);
      showFormFeedback(mapCreateError(error));
    } finally {
      setFormBusy(false);
    }
  }

  async function onSubmitEditMember(name, email, baseRole, slug) {
    const member = state.editingMember;

    if (!state.perms.users) {
      showFormFeedback('Você não tem permissão para gerenciar usuários.'); return;
    }
    if (baseRole === 'gestor' && !callerIsAdmin()) {
      showFormFeedback('Apenas administradores podem definir o perfil Gestor.'); return;
    }

    const wasAdmin = String(member.role || '').toLowerCase() === 'admin';
    const willBeAdmin = baseRole === 'admin';
    if (wasAdmin && !willBeAdmin) {
      const adminCount = state.members.filter(function (m) {
        return String(m.role || '').toLowerCase() === 'admin';
      }).length;
      if (adminCount <= 1) {
        showFormFeedback(
          'Este é o único administrador da empresa. Promova outro usuário a ' +
          'administrador antes de rebaixar este.'
        );
        return;
      }
    }

    const currentPw = modalEls.currentPassword ? modalEls.currentPassword.value : '';
    const newPw     = modalEls.newPassword ? modalEls.newPassword.value : '';
    const wantsPasswordChange = (currentPw.trim() !== '') || (newPw.trim() !== '');

    if (wantsPasswordChange) {
      if (!currentPw.trim()) {
        showFormFeedback('Informe a senha atual do funcionário para poder trocá-la.');
        modalEls.currentPassword.focus(); return;
      }
      if (!newPw.trim()) {
        showFormFeedback('Informe a nova senha.'); modalEls.newPassword.focus(); return;
      }
      if (newPw.length < 6) {
        showFormFeedback('A nova senha precisa ter pelo menos 6 caracteres.');
        modalEls.newPassword.focus(); return;
      }
    }

    setFormBusy(true);
    let userUpdated = false;

    try {
      const { error } = await window.db
        .from('organization_members')
        .update({ name: name, email: email, role: baseRole, role_slug: slug })
        .eq('id', member.id);
      if (error) throw error;
      userUpdated = true;

      try {
        await window.db.from('profiles').update({ name: name, role: baseRole }).eq('id', member.user_id);
      } catch (syncError) {
        console.warn('[DEV HUB] profiles não sincronizado:', syncError);
      }

      if (wantsPasswordChange) {
        const { error: pwErr } = await window.db.rpc('admin_change_user_password', {
          p_user_id: member.user_id,
          p_current_password: currentPw,
          p_new_password: newPw
        });
        if (pwErr) throw pwErr;
      }

      modalEls.modal.hidden = true;
      document.body.style.overflow = '';
      state.editingMember = null;
      showToast(
        wantsPasswordChange
          ? 'Usuário atualizado e senha alterada.'
          : 'Usuário atualizado com sucesso.',
        'success'
      );
      await Gestao.members.load();
    } catch (error) {
      console.error('[DEV HUB] Falha ao editar usuário:', error);

      if (userUpdated && wantsPasswordChange) {
        modalEls.modal.hidden = true;
        document.body.style.overflow = '';
        state.editingMember = null;
        showToast(
          'Os dados do usuário foram salvos, mas não foi possível alterar a senha: ' +
          mapActionError(error),
          'error'
        );
        await Gestao.members.load();
      } else {
        showFormFeedback(mapActionError(error));
      }
    } finally {
      setFormBusy(false);
    }
  }

  function setFormBusy(busy) {
    state.creating = busy;
    if (modalEls.saveBtn) {
      modalEls.saveBtn.disabled = busy;
      modalEls.saveBtn.classList.toggle('is-loading', busy);
      modalEls.saveBtn.setAttribute('aria-busy', String(busy));
      const label = modalEls.saveBtn.querySelector('.btn__label');
      if (label) {
        const isEdit = Boolean(state.editingMember);
        if (busy) label.textContent = isEdit ? 'Salvando...' : 'Criando...';
        else      label.textContent = isEdit ? 'Salvar alterações' : 'Criar usuário';
      }
    }
    [modalEls.name, modalEls.email, modalEls.password, modalEls.role,
     modalEls.currentPassword, modalEls.newPassword]
      .forEach(function (input) { if (input) input.disabled = busy; });
  }

  function showFormFeedback(message) {
    if (!modalEls.feedback) return;
    modalEls.feedback.textContent = message;
    modalEls.feedback.hidden = false;
  }
  function clearFormFeedback() {
    if (!modalEls.feedback) return;
    modalEls.feedback.textContent = '';
    modalEls.feedback.hidden = true;
  }

  function mapCreateError(error) {
    if (!error) return 'Não foi possível criar o usuário. Tente novamente.';
    const msg = String(error.message || '');
    const lower = msg.toLowerCase();

    if (lower.includes('apenas administradores')) return 'Apenas administradores podem executar esta ação.';
    if (lower.includes('apenas o administrador da plataforma')) return 'Apenas o administrador da plataforma pode criar administradores.';
    if (lower.includes('already') || lower.includes('duplicate') ||
        lower.includes('registered') || lower.includes('já está sendo utilizado')) {
      return 'Este e-mail já está sendo utilizado.';
    }
    if (lower.includes('sessão') || lower.includes('session') || lower.includes('401')) {
      return 'Sua sessão expirou. Faça login novamente.';
    }
    if (lower.includes('senha') || lower.includes('password')) {
      return 'A senha informada não é aceita. Use pelo menos 6 caracteres.';
    }
    if (lower.includes('could not find') && lower.includes('function')) {
      return 'A função de criação não está instalada no banco. Contate o suporte.';
    }
    if (lower.includes('function') && lower.includes('does not exist')) {
      return 'A função de criação não está instalada no banco. Contate o suporte.';
    }
    if (lower.includes('failed to fetch') || lower.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    return msg || 'Não foi possível criar o usuário. Tente novamente.';
  }

  function mapActionError(error) {
    if (!error) return 'Não foi possível concluir a operação. Tente novamente.';
    const msg = String(error.message || '');
    const lower = msg.toLowerCase();

    if (lower.includes('senha atual do funcionário está incorreta')) {
      return 'A senha atual do funcionário está incorreta. Confira e tente novamente.';
    }
    if (lower.includes('nova senha precisa')) return msg;
    if (lower.includes('não pode alterar a senha de um administrador')) return msg;
    if (lower.includes('apenas administradores podem alterar senhas de gestores')) return msg;
    if (lower.includes('não pertence à sua empresa')) return msg;
    if (lower.includes('prevent_self_removal') || lower.includes('próprio')) {
      return 'Você não pode remover seu próprio acesso.';
    }
    if (lower.includes('apenas administradores')) return 'Apenas administradores podem executar esta ação.';
    if (lower.includes('row-level security') || lower.includes('permission denied')) {
      return 'Você não tem permissão para executar esta ação.';
    }
    if (lower.includes('failed to fetch') || lower.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    return msg || 'Não foi possível concluir a operação. Tente novamente.';
  }

  Gestao.userModal = { setup, open, close, mapActionError };
})();