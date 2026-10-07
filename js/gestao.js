/* =========================================================
   DEV HUB · Área de Gestão
   ---------------------------------------------------------
   - Admin / Gestor criam usuários (regras por papel)
   - Permissões por tipo de perfil DENTRO do modal de usuário
   - Alterar senha do funcionário direto no modal de edição
   - Acesso à página via management.view (granular) OU papel base
   ---------------------------------------------------------
   CORREÇÕES APLICADAS:
   1. Race condition em `loadUserPermsForSlug`: token de geração
      descarta respostas obsoletas ao trocar o tipo de perfil.
   2. `onSubmitEditMember` distingue "dados salvos + senha falhou"
      e informa o usuário em vez de mostrar erro genérico.
   3. Guards de null em `roleTypeEls.*` (label, id, form, slug).
   4. `PERM_GROUPS` inclui o grupo "Notas fiscais" — antes as
      caps `invoices.*` não eram configuráveis pela UI.
   5. Toggle de senha reseta ao abrir o modal do usuário.
   6. `resolveOrgId()` com fallback pro sessionStorage.
   7. `deleteRoleType` usa `UI.confirm` (modal custom) em vez do
      `window.confirm` nativo — com fallback seguro caso o
      ui-confirm.js não esteja carregado.
   ========================================================= */

(function () {
  'use strict';

  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const HIDDEN_SELF_EMAIL = 'juliodasilva0101@gmail.com';

  const ROLE_ADMIN   = ['admin', 'administrador'];
  const ROLE_MANAGER = ['gestor', 'manager'];

  /* Grupos de permissão exibidos no modal do usuário.
     CORREÇÃO #4: adicionado grupo "Notas fiscais" — caps
     `invoices.*` existiam no permissions.js mas não tinham
     representação na UI. */
  const PERM_GROUPS = [
    { title: 'Geral', caps: [
      ['dashboard.view', 'Ver dashboard']
    ]},
    { title: 'Vendas', caps: [
      ['sales.view',   'Ver vendas'],
      ['sales.create', 'Criar venda'],
      ['sales.edit',   'Editar venda'],
      ['sales.delete', 'Excluir venda']
    ]},
    { title: 'Notas', caps: [
      ['notes.view',  'Ver notas'],
      ['notes.print', 'Imprimir notas']
    ]},
    { title: 'Notas fiscais', caps: [
      ['invoices.view',   'Ver notas fiscais'],
      ['invoices.create', 'Emitir nota fiscal'],
      ['invoices.cancel', 'Cancelar nota fiscal'],
      ['invoices.delete', 'Excluir nota fiscal']
    ]},
    { title: 'Clientes', caps: [
      ['customers.view',   'Ver clientes'],
      ['customers.create', 'Criar cliente'],
      ['customers.edit',   'Editar cliente'],
      ['customers.delete', 'Excluir cliente']
    ]},
    { title: 'Produtos', caps: [
      ['products.view',   'Ver produtos'],
      ['products.create', 'Criar produto'],
      ['products.edit',   'Editar produto'],
      ['products.delete', 'Excluir produto']
    ]},
    { title: 'Estoque', caps: [
      ['stock.view',     'Ver estoque'],
      ['stock.movement', 'Movimentar estoque'],
      ['stock.audit',    'Ver auditoria de estoque'],
      ['stock.report',   'Exportar relatório de estoque']
    ]},
    { title: 'Relatórios', caps: [
      ['reports.view',   'Ver relatórios'],
      ['reports.export', 'Exportar CSV']
    ]},
    { title: 'Gestão', caps: [
      ['management.view',  'Acessar Gestão'],
      ['management.roles', 'Gerenciar tipos de perfil'],
      ['management.users', 'Gerenciar usuários']
    ]}
  ];

  const state = {
    members: [],
    roleTypes: [],
    currentUserId: null,
    currentUserEmail: '',
    currentRole: '',
    currentOrgId: null,
    loading: false,
    creating: false,
    editingMember: null,
    action: null,
    acting: false,
    permsSlug: null,

    perms: {
      view:  true,
      roles: true,
      users: true
    }
  };

  /* CORREÇÃO #1: token de geração para evitar race em
     loadUserPermsForSlug / fetchAndRenderPerms. */
  let permsGeneration = 0;

  document.addEventListener('DOMContentLoaded', init);

  /* =========================================================
     Confirm helper (usa UI.confirm se existir, senão nativo)
     ---------------------------------------------------------
     CORREÇÃO #7: substitui window.confirm pelo modal custom,
     com fallback seguro caso o ui-confirm.js não tenha sido
     carregado (evita "UI is not defined" quebrar a página).
     ========================================================= */
  function confirmDialog(message, options) {
    if (window.UI && typeof window.UI.confirm === 'function') {
      return window.UI.confirm(message, options || {});
    }
    // Fallback: usa o confirm nativo do navegador.
    try {
      return Promise.resolve(window.confirm(message));
    } catch (e) {
      return Promise.resolve(false);
    }
  }

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
    setupRoleTypesModal();
    setupConfirmModal();

    const session = await Auth.requireSession();
    if (!session) return;
    state.currentUserId = session.user.id;
    state.currentUserEmail = String(session.user.email || '').toLowerCase();

    const profile = await Auth.getProfile(session.user.id);
    renderUser(session.user, profile);

    state.currentRole = String((profile && profile.role) || '').toLowerCase();

    /* CORREÇÃO #6: resolveOrgId com fallback pro sessionStorage. */
    state.currentOrgId = resolveOrgId(profile);

    if (window.Perms && typeof window.Perms.load === 'function') {
      try { await window.Perms.load(); } catch (e) { /* fallback */ }
    }

    state.perms.view  = hasPerm('management.view',  true);
    state.perms.roles = hasPerm('management.roles', true);
    state.perms.users = hasPerm('management.users', true);

    const hasBase = window.DHRoles && typeof window.DHRoles.canAccessManagement === 'function'
      ? window.DHRoles.canAccessManagement(state.currentRole)
      : state.currentRole === 'admin';

    const canManage = state.perms.view || hasBase;

    if (!canManage) {
      window.location.replace('dashboard.html');
      return;
    }

    applyPermissionsToUI();

    watchAuthChanges();
    await Promise.all([loadMembers(), loadRoleTypes()]);
  }

  /* CORREÇÃO #6: fallback se profile.organization_id vier null. */
  function resolveOrgId(profile) {
    if (profile && profile.organization_id) return profile.organization_id;
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (raw) {
        const ctx = JSON.parse(raw);
        if (ctx && ctx.organization_id) return ctx.organization_id;
      }
    } catch (e) { /* ignora */ }
    return null;
  }

  function hasPerm(cap, fallback) {
    if (window.Perms && typeof window.Perms.has === 'function') {
      return window.Perms.has(cap);
    }
    return fallback !== false;
  }

  function applyPermissionsToUI() {
    const roleTypesBtn = document.getElementById('role-types-open-btn');
    const newUserBtn   = document.getElementById('new-user-btn');

    if (roleTypesBtn && !state.perms.roles) roleTypesBtn.hidden = true;
    if (newUserBtn   && !state.perms.users) newUserBtn.hidden   = true;
  }

  /* =========================================================
     Helpers de permissão
     ========================================================= */
  function callerIsAdmin() {
    return ROLE_ADMIN.indexOf(state.currentRole) !== -1;
  }

  function visibleRoleTypes() {
    if (callerIsAdmin()) return state.roleTypes.slice();
    return state.roleTypes.filter(function (rt) {
      return String(rt.base_role || '').toLowerCase() === 'user';
    });
  }

  function canEditMember(member) {
    if (!state.perms.users) return false;
    if (member.user_id === state.currentUserId) return false;

    const baseRole = String(member.role || '').toLowerCase();
    const memberSlug = String(member.role_slug || '').toLowerCase();
    const memberType = memberSlug
      ? state.roleTypes.find(function (r) { return r.slug === memberSlug; })
      : null;
    const effectiveBase = memberType ? String(memberType.base_role || 'user') : baseRole;

    if (callerIsAdmin()) return true;
    return effectiveBase === 'user';
  }

  function canManageMember(member) {
    if (!state.perms.users) return false;
    return canEditMember(member);
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
     Carregar usuários
     ========================================================= */
  async function loadMembers() {
    if (state.loading) return;
    state.loading = true;

    showLoading(true);

    try {
      const { data, error } = await window.db
        .from('organization_members')
        .select('id, user_id, organization_id, role, role_slug, active, name, email, created_at')
        .order('created_at', { ascending: true });

      if (error) throw error;

      let rows = data || [];

      if (state.currentUserEmail !== HIDDEN_SELF_EMAIL) {
        rows = rows.filter(function (m) {
          return String(m.email || '').toLowerCase() !== HIDDEN_SELF_EMAIL;
        });
      }

      state.members = rows;
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
     Renderização da tabela
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
    const baseRole = String(member.role || '').toLowerCase();
    const isActive = member.active !== false;

    const row = document.createElement('tr');
    row.dataset.id = member.id;

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

    row.appendChild(createCell(member.email || '—', 'cell--muted'));

    const roleCell = document.createElement('td');
    const roleTag = document.createElement('span');
    roleTag.className = 'role-tag' + roleModifier(baseRole);
    roleTag.textContent = displayRoleLabel(member);
    roleCell.appendChild(roleTag);
    row.appendChild(roleCell);

    const statusCell = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = 'badge ' + (isActive ? 'badge--success' : 'badge--danger');
    statusBadge.textContent = isActive ? 'Ativo' : 'Inativo';
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);

    row.appendChild(createCell(formatDate(member.created_at), 'cell--muted'));

    row.appendChild(buildActionsCell(member, { isSelf: isSelf, isActive: isActive }));

    return row;
  }

  function roleModifier(roleKey) {
    if (roleKey === 'admin' || roleKey === 'administrador') return ' role-tag--admin';
    if (roleKey === 'gestor' || roleKey === 'manager' || roleKey === 'leader' || roleKey === 'lider') {
      return ' role-tag--leader';
    }
    return '';
  }

  function roleLabel(roleKey) {
    if (window.DHRoles) return window.DHRoles.label(roleKey) || 'Funcionário';
    if (roleKey === 'admin') return 'Administrador';
    if (roleKey === 'gestor') return 'Gestor';
    if (roleKey === 'leader') return 'Líder';
    return 'Funcionário';
  }

  function displayRoleLabel(member) {
    const slug = String(member.role_slug || '').toLowerCase();
    if (slug) {
      const rt = state.roleTypes.find(function (r) {
        return String(r.slug || '').toLowerCase() === slug;
      });
      if (rt) return rt.label;
    }
    return roleLabel(String(member.role || '').toLowerCase());
  }

  function buildActionsCell(member, meta) {
    const cell = document.createElement('td');
    cell.className = 'cell--num';

    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    if (!meta.isSelf) {
      const canEdit = canEditMember(member);
      const canManage = canManageMember(member);

      if (canEdit) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'row-action';
        editBtn.title = 'Editar';
        editBtn.setAttribute('aria-label', 'Editar ' + (member.name || ''));
        editBtn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
          ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M12 20h9"/>' +
          '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
        editBtn.addEventListener('click', function () { openUserModal(member); });
        wrap.appendChild(editBtn);
      }

      if (canManage) {
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
        toggleBtn.addEventListener('click', function () { confirmAction('toggle', member); });
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
        delBtn.addEventListener('click', function () { confirmAction('delete', member); });
        wrap.appendChild(delBtn);
      }
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
     Stats / estados
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
     MODAL: USUÁRIO
     ========================================================= */
  const modalEls = {};

  function setupUserModal() {
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
      modalEls.openBtn.addEventListener('click', function () { openUserModal(null); });
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

    modalEls.form.addEventListener('submit', onSubmitUser);

    if (modalEls.role) {
      modalEls.role.addEventListener('change', function () {
        if (!state.editingMember) return;
        const opt = modalEls.role.options[modalEls.role.selectedIndex];
        const slug = (opt && opt.dataset && opt.dataset.slug) || '';
        loadUserPermsForSlug(slug);
      });
    }
  }

  function openUserModal(member) {
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

    /* CORREÇÃO #5: reseta o estado visual dos toggles de senha. */
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

  function closeCreateModal() {
    if (state.creating) return;
    state.editingMember = null;
    state.permsSlug = null;
    /* Invalida qualquer fetch de perms em curso */
    permsGeneration += 1;
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

  /* =========================================================
     PERMISSÕES — bloco embutido no modal do usuário
     ========================================================= */
  function loadUserPermsForSlug(slug) {
    if (!modalEls.permsBlock) return;

    state.permsSlug = String(slug || '').toLowerCase();

    /* CORREÇÃO #1: cada chamada incrementa a geração. */
    permsGeneration += 1;
    const generation = permsGeneration;

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
      if (generation !== permsGeneration) return;
      renderPermsGroups({}, slug);
      return;
    }

    try {
      const { data, error } = await window.db
        .from('role_permissions')
        .select('capability, allowed')
        .eq('organization_id', state.currentOrgId)
        .eq('role_slug', slug);

      /* CORREÇÃO #1: descarta resposta obsoleta. */
      if (generation !== permsGeneration) return;

      const map = {};
      if (!error && Array.isArray(data)) {
        data.forEach(function (r) { map[r.capability] = r.allowed === true; });
      } else if (error) {
        console.warn('[DEV HUB] Falha ao ler role_permissions:', error);
      }

      renderPermsGroups(map, slug);
    } catch (e) {
      if (generation !== permsGeneration) return;
      console.error('[DEV HUB] Erro ao carregar permissões:', e);
      renderPermsGroups({}, slug);
    }
  }

  /* CORREÇÃO #1: renderPermsGroups recebe o slug explicitamente
     para não depender de state.permsSlug (que pode ter mudado). */
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

    PERM_GROUPS.forEach(function (group) {
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
        cb.checked = hasDbRow
          ? map[cap] === true
          : (defaults.indexOf(cap) !== -1);

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
        showPermsFeedback(
          'A tabela role_permissions não existe no banco. Rode o SQL de setup.'
        );
      } else if (lower.includes('on conflict') || lower.includes('no unique')) {
        showPermsFeedback(
          'Falta a unique constraint (organization_id, role_slug, capability) na tabela.'
        );
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

  /* =========================================================
     Select de perfil
     ========================================================= */
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

    if (currentSlug) {
      modalEls.role.value = currentSlug;
    } else if (currentBaseRole) {
      modalEls.role.value = currentBaseRole;
    } else {
      modalEls.role.value = 'user';
    }

    if (!modalEls.role.value) modalEls.role.value = 'user';
  }

  /* =========================================================
     Submit do modal de usuário
     ========================================================= */
  async function onSubmitUser(event) {
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

    if (!isEdit) {
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
      if (baseRole === 'admin') {
        showFormFeedback('Administradores não podem ser criados por esta tela.');
        return;
      }
      if (baseRole === 'gestor' && !callerIsAdmin()) {
        showFormFeedback('Apenas administradores podem criar gestores.');
        return;
      }
    }

    if (isEdit) {
      return onSubmitEditMember(name, email, baseRole, slug);
    }

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

      await loadMembers();
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
      showFormFeedback('Você não tem permissão para gerenciar usuários.');
      return;
    }

    if (baseRole === 'gestor' && !callerIsAdmin()) {
      showFormFeedback('Apenas administradores podem definir o perfil Gestor.');
      return;
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
        modalEls.currentPassword.focus();
        return;
      }
      if (!newPw.trim()) {
        showFormFeedback('Informe a nova senha.');
        modalEls.newPassword.focus();
        return;
      }
      if (newPw.length < 6) {
        showFormFeedback('A nova senha precisa ter pelo menos 6 caracteres.');
        modalEls.newPassword.focus();
        return;
      }
    }

    setFormBusy(true);

    /* CORREÇÃO #2: rastreia se o update de dados já foi feito,
       para diferenciar "tudo ok" de "dados salvos, senha falhou". */
    let userUpdated = false;

    try {
      const { error } = await window.db
        .from('organization_members')
        .update({
          name: name,
          email: email,
          role: baseRole,
          role_slug: slug
        })
        .eq('id', member.id);

      if (error) throw error;
      userUpdated = true;

      try {
        await window.db
          .from('profiles')
          .update({ name: name, role: baseRole })
          .eq('id', member.user_id);
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

      await loadMembers();
    } catch (error) {
      console.error('[DEV HUB] Falha ao editar usuário:', error);

      /* CORREÇÃO #2: se o update dos dados já foi feito mas a
         troca de senha falhou, fechamos o modal (para não
         confundir) e mostramos uma mensagem específica. */
      if (userUpdated && wantsPasswordChange) {
        modalEls.modal.hidden = true;
        document.body.style.overflow = '';
        state.editingMember = null;
        showToast(
          'Os dados do usuário foram salvos, mas não foi possível alterar a senha: ' +
          mapActionError(error),
          'error'
        );
        await loadMembers();
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
        if (busy) {
          label.textContent = isEdit ? 'Salvando...' : 'Criando...';
        } else {
          label.textContent = isEdit ? 'Salvar alterações' : 'Criar usuário';
        }
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

    if (lower.includes('apenas administradores')) {
      return 'Apenas administradores podem executar esta ação.';
    }
    if (lower.includes('apenas o administrador da plataforma')) {
      return 'Apenas o administrador da plataforma pode criar administradores.';
    }
    if (lower.includes('already') ||
        lower.includes('duplicate') ||
        lower.includes('registered') ||
        lower.includes('já está sendo utilizado')) {
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

  /* =========================================================
     TIPOS DE PERFIL (role_types)
     ========================================================= */
  const roleTypeEls = {};

  function setupRoleTypesModal() {
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
      roleTypeEls.openBtn.addEventListener('click', openRoleTypesModal);
    }

    roleTypeEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeRoleTypesModal);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !roleTypeEls.modal.hidden) closeRoleTypesModal();
    });

    /* CORREÇÃO #3: guards de null em todos os elementos opcionais. */
    if (roleTypeEls.form) {
      roleTypeEls.form.addEventListener('submit', onSubmitRoleType);
    }

    if (roleTypeEls.cancelBtn) {
      roleTypeEls.cancelBtn.addEventListener('click', resetRoleTypeForm);
    }

    if (roleTypeEls.label) {
      roleTypeEls.label.addEventListener('input', function () {
        if (roleTypeEls.id && roleTypeEls.id.value) return;
        if (roleTypeEls.slug) {
          roleTypeEls.slug.value = slugify(roleTypeEls.label.value);
        }
      });
    }

    applyRoleTypeBaseRestrictions();
  }

  function applyRoleTypeBaseRestrictions() {
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

  async function loadRoleTypes() {
    try {
      const { data, error } = await window.db
        .from('role_types')
        .select('id, slug, label, base_role, active, created_at')
        .order('created_at', { ascending: true });

      if (error) throw error;
      state.roleTypes = data || [];
      if (roleTypeEls.list) renderRoleTypesList();
    } catch (error) {
      console.error('[DEV HUB] Falha ao carregar tipos de perfil:', error);
      state.roleTypes = [];
    }
  }

  function openRoleTypesModal() {
    if (!state.perms.roles) {
      showToast('Você não tem permissão para gerenciar tipos de perfil.', 'error');
      return;
    }
    resetRoleTypeForm();
    renderRoleTypesList();
    roleTypeEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      if (roleTypeEls.label) roleTypeEls.label.focus();
    }, 60);
  }

  function closeRoleTypesModal() {
    if (!roleTypeEls.modal) return;
    roleTypeEls.modal.hidden = true;
    document.body.style.overflow = '';
  }

  function resetRoleTypeForm() {
    if (!roleTypeEls.form) return;
    roleTypeEls.form.reset();
    if (roleTypeEls.id) roleTypeEls.id.value = '';
    if (roleTypeEls.cancelBtn) roleTypeEls.cancelBtn.hidden = true;
    if (roleTypeEls.saveBtn) {
      const lbl = roleTypeEls.saveBtn.querySelector('.btn__label');
      if (lbl) lbl.textContent = 'Adicionar';
    }
    clearRoleTypeFeedback();
  }

  function renderRoleTypesList() {
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
      roleTypeEls.list.appendChild(buildRoleTypeRow(rt));
    });
  }

  function buildRoleTypeRow(rt) {
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
    editBtn.addEventListener('click', function () { editRoleType(rt); });

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
    delBtn.addEventListener('click', function () { deleteRoleType(rt); });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    row.appendChild(info);
    row.appendChild(actions);
    return row;
  }

  function editRoleType(rt) {
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

  async function onSubmitRoleType(event) {
    event.preventDefault();
    clearRoleTypeFeedback();

    if (!state.perms.roles) {
      showRoleTypeFeedback('Você não tem permissão para gerenciar tipos de perfil.');
      return;
    }

    const id    = roleTypeEls.id ? roleTypeEls.id.value : '';
    const label = roleTypeEls.label ? roleTypeEls.label.value.trim() : '';
    const base  = roleTypeEls.base ? roleTypeEls.base.value : 'user';
    let   slug  = roleTypeEls.slug ? roleTypeEls.slug.value.trim() : '';
    if (!slug) slug = slugify(label);

    if (!label) {
      showRoleTypeFeedback('Informe o nome exibido.');
      if (roleTypeEls.label) roleTypeEls.label.focus();
      return;
    }
    if (!slug) {
      showRoleTypeFeedback('O identificador interno não pode ficar vazio.');
      if (roleTypeEls.slug) roleTypeEls.slug.focus();
      return;
    }
    if (['admin', 'gestor', 'user'].indexOf(base) === -1) {
      showRoleTypeFeedback('Papel base inválido.');
      return;
    }

    if (!callerIsAdmin() && base !== 'user') {
      showRoleTypeFeedback('Apenas administradores podem criar tipos com esse papel base.');
      return;
    }
    if (base === 'admin') {
      showRoleTypeFeedback('Não é permitido criar tipos com papel base Administrador.');
      return;
    }

    if (!state.currentOrgId) {
      showRoleTypeFeedback('Não foi possível identificar sua empresa.');
      return;
    }

    setRoleTypeBusy(true);

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
            slug: slug,
            label: label,
            base_role: base,
            active: true
          });
        if (error) throw error;
        showToast('Tipo criado.', 'success');
      }

      resetRoleTypeForm();
      await loadRoleTypes();
    } catch (error) {
      console.error('[DEV HUB] Falha ao salvar tipo de perfil:', error);
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique')) {
        showRoleTypeFeedback('Já existe um tipo com este identificador.');
      } else if (msg.includes('row-level security') || msg.includes('permission')) {
        showRoleTypeFeedback('Você não tem permissão para criar este tipo.');
      } else {
        showRoleTypeFeedback(error.message || 'Não foi possível salvar.');
      }
    } finally {
      setRoleTypeBusy(false);
    }
  }

  async function deleteRoleType(rt) {
    if (!state.perms.roles) {
      showToast('Você não tem permissão para gerenciar tipos de perfil.', 'error');
      return;
    }

    /* CORREÇÃO #7: modal custom em vez do window.confirm nativo. */
    const ok = await confirmDialog(
      'Excluir o tipo "' + rt.label + '"?\n\n' +
      'Usuários já vinculados a ele continuarão existindo, mas o nome exibido ' +
      'cairá para o papel base.',
      {
        title: 'Excluir tipo de perfil',
        danger: true,
        confirmLabel: 'Excluir'
      }
    );
    if (!ok) return;

    setRoleTypeBusy(true);
    try {
      const { error } = await window.db
        .from('role_types')
        .delete()
        .eq('id', rt.id);
      if (error) throw error;

      showToast('Tipo excluído.', 'success');
      await loadRoleTypes();
      await loadMembers();
    } catch (error) {
      console.error('[DEV HUB] Falha ao excluir tipo:', error);
      showToast('Não foi possível excluir o tipo.', 'error');
    } finally {
      setRoleTypeBusy(false);
    }
  }

  function setRoleTypeBusy(busy) {
    if (roleTypeEls.saveBtn) {
      roleTypeEls.saveBtn.disabled = busy;
      roleTypeEls.saveBtn.classList.toggle('is-loading', busy);
      roleTypeEls.saveBtn.setAttribute('aria-busy', String(busy));
    }
  }

  function showRoleTypeFeedback(msg) {
    if (!roleTypeEls.feedback) return;
    roleTypeEls.feedback.textContent = msg;
    roleTypeEls.feedback.hidden = false;
  }
  function clearRoleTypeFeedback() {
    if (!roleTypeEls.feedback) return;
    roleTypeEls.feedback.textContent = '';
    roleTypeEls.feedback.hidden = true;
  }

  /* =========================================================
     Modal: confirmar ação (toggle / delete)
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

    if (!state.perms.users) {
      showToast('Você não tem permissão para gerenciar usuários.', 'error');
      closeConfirmModal();
      return;
    }

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
    if (lower.includes('apenas administradores')) {
      return 'Apenas administradores podem executar esta ação.';
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