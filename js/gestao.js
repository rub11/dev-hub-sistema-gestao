/* =========================================================
   DEV HUB · Área de Gestão
   ---------------------------------------------------------
   Apenas admin da organização (via DHRoles.canAccessManagement).
   Multi-tenant via RLS. Criação via Edge Function `create-user`.
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Formatadores ---------- */
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  /* ---------- Estado ---------- */
  const state = {
    members: [],
    currentUserId: null,
    currentRole: '',
    loading: false,
    creating: false,
    action: null,
    acting: false
  };

  document.addEventListener('DOMContentLoaded', init);

  /* =========================================================
     Init
     ========================================================= */
  async function init() {
    const Auth = window.Auth;

    if (!Auth || !Auth.isConfigured() || !window.db) {
      showGlobalAlert(
        'Não foi possível conectar ao Supabase. Verifique as credenciais em js/supabase.js.',
        'error'
      );
      return;
    }

    setupSidebar();
    setupUserMenu();
    setupLogout();
    setupUserModal();
    setupConfirmModal();

    const session = await Auth.requireSession();
    if (!session) return;
    state.currentUserId = session.user.id;

    const profile = await Auth.getProfile(session.user.id);
    renderUser(session.user, profile);

    state.currentRole = String((profile && profile.role) || '').toLowerCase();

    // Bloqueio de acesso: quem não pode gerenciar sai
    const canManage = window.DHRoles && typeof window.DHRoles.canAccessManagement === 'function'
      ? window.DHRoles.canAccessManagement(state.currentRole)
      : state.currentRole === 'admin';

    if (!canManage) {
      window.location.replace('dashboard.html');
      return;
    }

    watchAuthChanges();
    await loadMembers();
  }

  /* =========================================================
     Sessão / usuário
     ========================================================= */
  function watchAuthChanges() {
    window.db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT' && !window.Auth.isSigningOut()) {
        window.location.replace('index.html?expired=1');
      }
    });
  }

  function renderUser(user, profile) {
    const meta = user.user_metadata || {};
    const fullName =
      (profile && profile.name) ||
      meta.name || meta.full_name ||
      (user.email ? user.email.split('@')[0] : '') ||
      'Usuário';

    const roleText = window.DHRoles
      ? window.DHRoles.label((profile && profile.role) || meta.role || '')
      : window.Auth.roleLabel((profile && profile.role) || meta.role || '');

    const firstName = String(fullName).trim().split(/\s+/)[0] || 'Usuário';
    const initial = firstName.charAt(0).toUpperCase() || '?';

    setText('user-avatar', initial);
    setText('user-name', fullName);
    setText('user-role', roleText || user.email || '');
    setText('greeting-name', 'Olá, ' + firstName);

    const roleBadge = document.getElementById('greeting-role');
    if (roleBadge) {
      if (roleText) {
        roleBadge.textContent = roleText;
        roleBadge.hidden = false;
      } else {
        roleBadge.hidden = true;
      }
    }
  }

  /* =========================================================
     Sidebar / user menu / logout
     ========================================================= */
  function setupSidebar() {
    const toggle = document.getElementById('menu-toggle');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('sidebar');
    if (!toggle || !overlay || !sidebar) return;

    function open() {
      document.body.classList.add('sidebar-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Fechar menu');
      overlay.hidden = false;
    }
    function close() {
      if (!document.body.classList.contains('sidebar-open')) return;
      document.body.classList.remove('sidebar-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menu');
      overlay.hidden = true;
    }

    toggle.addEventListener('click', function () {
      document.body.classList.contains('sidebar-open') ? close() : open();
    });
    overlay.addEventListener('click', close);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
    });

    sidebar.querySelectorAll('a.nav__item').forEach(function (link) {
      link.addEventListener('click', close);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1024) close();
    });
  }

  function setupUserMenu() {
    const trigger = document.getElementById('user-menu-trigger');
    const panel = document.getElementById('user-menu-panel');
    if (!trigger || !panel) return;

    function open() {
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      const first = panel.querySelector('.menu-item:not([aria-disabled="true"])');
      if (first) first.focus();
    }
    function close() {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }

    trigger.addEventListener('click', function (event) {
      event.stopPropagation();
      panel.hidden ? open() : close();
    });

    document.addEventListener('click', function (event) {
      if (panel.hidden) return;
      if (panel.contains(event.target) || trigger.contains(event.target)) return;
      close();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hidden) {
        close();
        trigger.focus();
      }
    });
  }

  function setupLogout() {
    document.querySelectorAll('[data-action="logout"]').forEach(function (button) {
      button.addEventListener('click', async function () {
        if (button.disabled) return;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        await window.Auth.signOut();
      });
    });
  }

  /* =========================================================
     Carregar usuários da organização
     ========================================================= */
  async function loadMembers() {
    if (state.loading) return;
    state.loading = true;

    showLoading(true);

    try {
      const { data, error } = await window.db
        .from('organization_members')
        .select('id, user_id, organization_id, role, active, name, email, created_at')
        .order('created_at', { ascending: true });

      if (error) throw error;

      state.members = data || [];
      renderMembers();
      recomputeStats();
      updateCountLabel();
    } catch (error) {
      console.error('[DEV HUB] Falha ao carregar usuários:', error);
      state.members = [];
      showEmptyState(
        'Não foi possível carregar os usuários.',
        'Tente novamente em alguns instantes.'
      );
      updateCountLabel();
      showToast('Não foi possível carregar os usuários.', 'error');
    } finally {
      state.loading = false;
      showLoading(false);
    }
  }

  /* =========================================================
     Renderização
     ========================================================= */
  function renderMembers() {
    const tbody = document.getElementById('users-body');
    const wrap  = document.getElementById('users-table-wrap');
    if (!tbody || !wrap) return;

    if (state.members.length === 0) {
      wrap.hidden = true;
      showEmptyState(
        'Nenhum usuário cadastrado ainda.',
        'Use o botão acima para adicionar o primeiro usuário.'
      );
      return;
    }

    hideEmptyState();
    wrap.hidden = false;
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    state.members.forEach(function (m) {
      fragment.appendChild(buildRow(m));
    });
    tbody.appendChild(fragment);
  }

  function buildRow(member) {
    const isSelf = member.user_id === state.currentUserId;
    const roleKey = String(member.role || '').toLowerCase();
    const isActive = member.active !== false;

    const row = document.createElement('tr');
    row.dataset.id = member.id;

    // Nome
    const nameCell = document.createElement('td');
    nameCell.className = 'cell-user';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = member.name || '—';
    nameCell.appendChild(nameSpan);
    if (isSelf) {
      const small = document.createElement('small');
      small.textContent = 'Você';
      nameCell.appendChild(small);
    }
    row.appendChild(nameCell);

    // E-mail
    row.appendChild(createCell(member.email || '—', 'cell--muted'));

    // Perfil
    const roleCell = document.createElement('td');
    const roleTag = document.createElement('span');
    roleTag.className = 'role-tag' + roleModifier(roleKey);
    roleTag.textContent = roleLabel(roleKey);
    roleCell.appendChild(roleTag);
    row.appendChild(roleCell);

    // Status
    const statusCell = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = 'badge ' + (isActive ? 'badge--success' : 'badge--danger');
    statusBadge.textContent = isActive ? 'Ativo' : 'Inativo';
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);

    // Data
    row.appendChild(createCell(formatDate(member.created_at), 'cell--muted'));

    // Ações
    row.appendChild(buildActionsCell(member, { isSelf: isSelf, isActive: isActive }));

    return row;
  }

  function roleModifier(roleKey) {
    if (roleKey === 'admin' || roleKey === 'administrador') return ' role-tag--admin';
    if (roleKey === 'leader' || roleKey === 'lider') return ' role-tag--leader';
    return '';
  }

  function roleLabel(roleKey) {
    if (window.DHRoles) return window.DHRoles.label(roleKey) || 'Funcionário';
    if (roleKey === 'admin') return 'Administrador';
    if (roleKey === 'leader') return 'Líder';
    return 'Funcionário';
  }

  function buildActionsCell(member, meta) {
    const cell = document.createElement('td');
    cell.className = 'cell--num';

    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    if (!meta.isSelf) {
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'row-action';
      toggleBtn.title = meta.isActive ? 'Desativar' : 'Ativar';
      toggleBtn.setAttribute('aria-label',
        (meta.isActive ? 'Desativar ' : 'Ativar ') + (member.name || ''));
      toggleBtn.innerHTML = meta.isActive
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
          ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/>' +
          '<path d="M12 2v10"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
          ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M20 6 9 17l-5-5"/></svg>';
      toggleBtn.addEventListener('click', function () {
        confirmAction('toggle', member);
      });
      wrap.appendChild(toggleBtn);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'row-action row-action--danger';
      delBtn.title = 'Excluir acesso';
      delBtn.setAttribute('aria-label', 'Excluir acesso de ' + (member.name || ''));
      delBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
        ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M3 6h18"/>' +
        '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
        '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
        '<path d="M10 11v6M14 11v6"/>' +
        '</svg>';
      delBtn.addEventListener('click', function () {
        confirmAction('delete', member);
      });
      wrap.appendChild(delBtn);
    }

    if (wrap.childNodes.length === 0) {
      const dash = document.createElement('span');
      dash.className = 'cell--muted';
      dash.textContent = '—';
      wrap.appendChild(dash);
    }

    cell.appendChild(wrap);
    return cell;
  }

  /* =========================================================
     Estatísticas / estados
     ========================================================= */
  function recomputeStats() {
    let active = 0;
    let inactive = 0;

    state.members.forEach(function (m) {
      if (m.active === false) inactive += 1;
      else active += 1;
    });

    setText('stat-total', String(state.members.length));
    setText('stat-active', String(active));
    setText('stat-inactive', String(inactive));
  }

  function updateCountLabel() {
    const label = document.getElementById('users-count');
    if (!label) return;

    const total = state.members.length;
    if (total === 0) {
      label.textContent = 'Nenhum usuário cadastrado';
      return;
    }
    label.textContent = total === 1 ? '1 usuário' : total + ' usuários';
  }

  function showLoading(isLoading) {
    const loading = document.getElementById('users-loading');
    const wrap    = document.getElementById('users-table-wrap');
    const empty   = document.getElementById('users-empty');
    if (!loading) return;

    if (isLoading) {
      loading.hidden = false;
      if (wrap) wrap.hidden = true;
      if (empty) empty.hidden = true;
    } else {
      loading.hidden = true;
    }
  }

  function showEmptyState(title, text) {
    const empty = document.getElementById('users-empty');
    const titleEl = document.getElementById('users-empty-title');
    const textEl = document.getElementById('users-empty-text');
    if (!empty) return;

    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    empty.hidden = false;
  }

  function hideEmptyState() {
    const empty = document.getElementById('users-empty');
    if (empty) empty.hidden = true;
  }

  function showGlobalAlert(message, type) {
    const el = document.getElementById('global-alert');
    if (!el) return;
    el.textContent = message;
    el.className = 'alert alert--' + (type || 'error');
    el.hidden = false;
  }

  /* =========================================================
     Modal: novo usuário
     ========================================================= */
  const modalEls = {};

  function setupUserModal() {
    modalEls.modal    = document.getElementById('user-modal');
    modalEls.form     = document.getElementById('user-form');
    modalEls.name     = document.getElementById('user-name');
    modalEls.email    = document.getElementById('user-email');
    modalEls.password = document.getElementById('user-password');
    modalEls.role     = document.getElementById('user-role');
    modalEls.feedback = document.getElementById('user-form-feedback');
    modalEls.saveBtn  = document.getElementById('user-save-btn');
    modalEls.openBtn  = document.getElementById('new-user-btn');

    if (!modalEls.modal || !modalEls.form) return;

    if (modalEls.openBtn) {
      modalEls.openBtn.addEventListener('click', openCreateModal);
    }

    modalEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeCreateModal);
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
      if (event.key === 'Escape' && !modalEls.modal.hidden) closeCreateModal();
    });

    modalEls.form.addEventListener('submit', onSubmitCreate);
  }

  function openCreateModal() {
    modalEls.form.reset();
    if (modalEls.role) modalEls.role.value = 'user';
    clearFormFeedback();
    setFormBusy(false);

    modalEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modalEls.name.focus();
  }

  function closeCreateModal() {
    if (state.creating) return;
    modalEls.modal.hidden = true;
    document.body.style.overflow = '';
  }

  async function onSubmitCreate(event) {
    event.preventDefault();
    if (state.creating) return;

    clearFormFeedback();

    const name = modalEls.name.value.trim();
    const email = modalEls.email.value.trim();
    const password = modalEls.password.value;
    const role = (modalEls.role && modalEls.role.value) || 'user';

    if (!name) {
      showFormFeedback('Informe o nome do usuário.');
      modalEls.name.focus();
      return;
    }
    if (!email) {
      showFormFeedback('Informe o e-mail do usuário.');
      modalEls.email.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFormFeedback('Informe um e-mail válido.');
      modalEls.email.focus();
      return;
    }
    if (!password) {
      showFormFeedback('Informe a senha inicial.');
      modalEls.password.focus();
      return;
    }
    if (password.length < 6) {
      showFormFeedback('A senha precisa ter pelo menos 6 caracteres.');
      modalEls.password.focus();
      return;
    }

    // Nunca enviamos 'admin' pelo frontend — o backend rejeitaria
    // de todo modo, mas mantemos a barreira dupla.
    const safeRole = (role === 'leader') ? 'leader' : 'user';

    setFormBusy(true);

    try {
      const session = await window.Auth.getSession();
      if (!session || !session.access_token) {
        throw new Error('Sessão inválida.');
      }

      const baseUrl = (window.db && window.db.supabaseUrl) || '';
      const url = baseUrl.replace(/\/$/, '') + '/functions/v1/create-user';

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + session.access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          email: email,
          password: password,
          role: safeRole
        })
      });

      let payload = null;
      try { payload = await res.json(); } catch (e) { payload = null; }

      if (!res.ok) {
        const msg = (payload && (payload.error || payload.message)) || '';
        throw new Error(msg || ('Falha na criação (HTTP ' + res.status + ')'));
      }

      modalEls.modal.hidden = true;
      document.body.style.overflow = '';
      showToast('Usuário criado com sucesso.', 'success');

      await loadMembers();
    } catch (error) {
      console.error('[DEV HUB] Falha ao criar usuário:', error);
      showFormFeedback(mapCreateError(error));
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
      if (label) label.textContent = busy ? 'Criando...' : 'Criar usuário';
    }

    [modalEls.name, modalEls.email, modalEls.password, modalEls.role]
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

    if (lower.includes('already') || lower.includes('duplicate') || lower.includes('registered')) {
      return 'Este e-mail já está sendo utilizado.';
    }
    if (lower.includes('admin')) {
      return 'Apenas administradores podem criar usuários.';
    }
    if (lower.includes('session') || lower.includes('auth') || lower.includes('401')) {
      return 'Sua sessão expirou. Faça login novamente.';
    }
    if (lower.includes('password')) {
      return 'A senha informada não é aceita. Use pelo menos 6 caracteres.';
    }
    if (lower.includes('failed to fetch') || lower.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    return msg || 'Não foi possível criar o usuário. Tente novamente.';
  }

  /* =========================================================
     Modal: confirmar ação
     ========================================================= */
  const confirmEls = {};

  function setupConfirmModal() {
    confirmEls.modal = document.getElementById('confirm-modal');
    confirmEls.text  = document.getElementById('confirm-text');
    confirmEls.btn   = document.getElementById('confirm-action-btn');
    if (!confirmEls.modal || !confirmEls.btn) return;

    confirmEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeConfirmModal);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !confirmEls.modal.hidden) closeConfirmModal();
    });

    confirmEls.btn.addEventListener('click', onConfirmAction);
  }

  function confirmAction(type, member) {
    state.action = { type: type, member: member };

    const isActive = member.active !== false;
    const name = member.name || 'este usuário';

    if (type === 'toggle') {
      if (isActive) {
        confirmEls.text.textContent =
          'Tem certeza que deseja desativar "' + name + '"? ' +
          'Usuários desativados não conseguem acessar o Dev Hub.';
        setConfirmButton('Desativar', 'danger');
      } else {
        confirmEls.text.textContent =
          'Deseja ativar "' + name + '" novamente? ' +
          'O usuário voltará a ter acesso ao Dev Hub.';
        setConfirmButton('Ativar', 'primary');
      }
    } else if (type === 'delete') {
      confirmEls.text.textContent =
        'Excluir "' + name + '"? Essa ação removerá o acesso do usuário ao Dev Hub. ' +
        'Os dados operacionais (clientes, produtos, vendas) não são afetados.';
      setConfirmButton('Excluir acesso', 'danger');
    }

    confirmEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    confirmEls.btn.focus();
  }

  function setConfirmButton(label, variant) {
    confirmEls.btn.className = 'btn btn--' + variant;
    const lbl = confirmEls.btn.querySelector('.btn__label');
    if (lbl) lbl.textContent = label;
  }

  function closeConfirmModal() {
    if (state.acting) return;
    confirmEls.modal.hidden = true;
    document.body.style.overflow = '';
    state.action = null;
  }

  async function onConfirmAction() {
    if (state.acting || !state.action) return;

    const { type, member } = state.action;
    setConfirmBusy(true);

    try {
      if (type === 'toggle') {
        const newActive = member.active === false;
        const { error } = await window.db
          .from('organization_members')
          .update({ active: newActive })
          .eq('id', member.id);

        if (error) throw error;

        showToast(
          newActive ? 'Usuário ativado.' : 'Usuário desativado.',
          'success'
        );
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

      await loadMembers();
    } catch (error) {
      console.error('[DEV HUB] Falha na operação:', error);
      showToast(mapActionError(error), 'error');
    } finally {
      setConfirmBusy(false);
    }
  }

  function setConfirmBusy(busy) {
    state.acting = busy;

    if (confirmEls.btn) {
      confirmEls.btn.disabled = busy;
      confirmEls.btn.classList.toggle('is-loading', busy);
      confirmEls.btn.setAttribute('aria-busy', String(busy));
    }
  }

  function mapActionError(error) {
    if (!error) return 'Não foi possível concluir a operação. Tente novamente.';
    const msg = String(error.message || '');
    const lower = msg.toLowerCase();

    if (lower.includes('prevent_self_removal') || lower.includes('próprio')) {
      return 'Você não pode remover seu próprio acesso.';
    }
    if (lower.includes('row-level security') || lower.includes('permission denied')) {
      return 'Você não tem permissão para executar esta ação.';
    }
    if (lower.includes('failed to fetch') || lower.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    return msg || 'Não foi possível concluir a operação. Tente novamente.';
  }

  /* =========================================================
     Helpers
     ========================================================= */
  function createCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return dateFormatter.format(d);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /* =========================================================
     Toasts
     ========================================================= */
  const TOAST_ICONS = {
    success:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M20 6 9 17l-5-5"/></svg>',
    error:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>',
    info:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>'
  };

  function showToast(message, type) {
    const region = document.getElementById('toast-region');
    if (!region) return;

    const kind = type === 'success' || type === 'error' || type === 'info' ? type : 'info';

    const toast = document.createElement('div');
    toast.className = 'toast toast--' + kind;
    toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'toast__icon';
    icon.innerHTML = TOAST_ICONS[kind];

    const text = document.createElement('span');
    text.className = 'toast__message';
    text.textContent = message;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast__close';
    close.setAttribute('aria-label', 'Fechar notificação');
    close.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
      ' stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    close.addEventListener('click', function () { dismissToast(toast); });

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(close);
    region.appendChild(toast);

    const timer = setTimeout(function () { dismissToast(toast); }, 4200);
    toast.addEventListener('mouseenter', function () { clearTimeout(timer); });
  }

  function dismissToast(toast) {
    if (!toast || toast.classList.contains('is-leaving')) return;
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    });
  }
})();