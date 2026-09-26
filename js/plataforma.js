/* =========================================================
   DEV HUB · Administração da Plataforma
   ---------------------------------------------------------
   Apenas para platform_admin (profiles.is_platform_admin = true).
   Cria/edita empresas via RPC `create_organization_with_admin`
   ou update direto em `organizations` (RLS protege).
   ========================================================= */

(function () {
  'use strict';

  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const state = {
    orgs: [],
    filtered: [],
    search: '',
    loading: false,
    creating: false,
    action: null,
    acting: false,
    totalUsers: null
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
    setupOrgModal();
    setupConfirmModal();
    setupSearch();

    const session = await Auth.requireSession();
    if (!session) return;

    const profile = await Auth.getProfile(session.user.id);
    renderUser(session.user, profile);

    // Verificação real: consulta o flag no banco
    const allowed = await checkPlatformAdmin(session.user.id);
    if (!allowed) {
      window.location.replace('dashboard.html');
      return;
    }

    // Compatibilidade com nav.js: garante o flag no sessionStorage
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.is_platform_admin !== true) {
          data.is_platform_admin = true;
          sessionStorage.setItem('devhub_user', JSON.stringify(data));
        }
      }
    } catch (e) { /* ignora */ }

    watchAuthChanges();
    await Promise.all([loadOrganizations(), loadUserCount()]);
  }

  /* =========================================================
     Verificação real do flag
     ========================================================= */
  async function checkPlatformAdmin(userId) {
    try {
      const { data, error } = await window.db
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', userId)
        .limit(1);

      if (error) {
        console.error('[DEV HUB] Falha ao verificar platform_admin:', error);
        return false;
      }
      return Boolean(data && data[0] && data[0].is_platform_admin === true);
    } catch (e) {
      console.error('[DEV HUB] Erro inesperado em checkPlatformAdmin:', e);
      return false;
    }
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

    const roleText = 'Administrador da Plataforma';
    const firstName = String(fullName).trim().split(/\s+/)[0] || 'Usuário';
    const initial = firstName.charAt(0).toUpperCase() || '?';

    setText('user-avatar', initial);
    setText('user-name', fullName);
    setText('user-role', roleText);
    setText('greeting-name', 'Olá, ' + firstName);

    const roleBadge = document.getElementById('greeting-role');
    if (roleBadge) {
      roleBadge.textContent = roleText;
      roleBadge.hidden = false;
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
     Busca
     ========================================================= */
  function setupSearch() {
    const input = document.getElementById('orgs-search');
    if (!input) return;

    input.addEventListener('input', function () {
      state.search = input.value.trim().toLowerCase();
      applyFilter();
    });
  }

  function applyFilter() {
    if (!state.search) {
      state.filtered = state.orgs.slice();
    } else {
      const term = state.search;
      state.filtered = state.orgs.filter(function (o) {
        return matches(o.name, term) || matches(o.code, term);
      });
    }
    renderOrganizations();
    updateCountLabel();
  }

  /* =========================================================
     Carregar
     ========================================================= */
  async function loadOrganizations() {
    if (state.loading) return;
    state.loading = true;

    showLoading(true);

    try {
      const { data, error } = await window.db
        .from('organizations')
        .select('id, name, code, active, created_at')
        .order('created_at', { ascending: true });

      if (error) throw error;

      state.orgs = data || [];
      applyFilter();
      recomputeStats();
    } catch (error) {
      console.error('[DEV HUB] Falha ao carregar empresas:', error);
      state.orgs = [];
      state.filtered = [];
      showEmptyState(
        'Não foi possível carregar as empresas.',
        'Tente novamente em alguns instantes.'
      );
      updateCountLabel();
      showToast('Não foi possível carregar as empresas.', 'error');
    } finally {
      state.loading = false;
      showLoading(false);
    }
  }

  async function loadUserCount() {
    try {
      const { count, error } = await window.db
        .from('organization_members')
        .select('id', { count: 'exact', head: true });

      if (error) {
        console.warn('[DEV HUB] Falha ao contar usuários:', error);
        state.totalUsers = null;
      } else {
        state.totalUsers = count || 0;
      }
      setText('stat-total-users',
        state.totalUsers === null ? '—' : String(state.totalUsers));
    } catch (e) {
      console.warn('[DEV HUB] Erro inesperado ao contar usuários:', e);
      setText('stat-total-users', '—');
    }
  }

  /* =========================================================
     Renderização
     ========================================================= */
  function renderOrganizations() {
    const tbody = document.getElementById('orgs-body');
    const wrap  = document.getElementById('orgs-table-wrap');
    if (!tbody || !wrap) return;

    if (state.orgs.length === 0) {
      wrap.hidden = true;
      showEmptyState(
        'Nenhuma empresa cadastrada.',
        'Use o botão acima para criar a primeira empresa.'
      );
      return;
    }

    if (state.filtered.length === 0) {
      wrap.hidden = true;
      showEmptyState(
        'Nenhuma empresa encontrada.',
        'Ajuste a busca para encontrar a empresa desejada.'
      );
      return;
    }

    hideEmptyState();
    wrap.hidden = false;
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    state.filtered.forEach(function (org) {
      fragment.appendChild(buildRow(org));
    });
    tbody.appendChild(fragment);
  }

  function buildRow(org) {
    const row = document.createElement('tr');
    row.dataset.id = org.id;

    // Empresa
    const nameCell = document.createElement('td');
    nameCell.className = 'cell-org';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = org.name || '—';
    nameCell.appendChild(nameSpan);
    row.appendChild(nameCell);

    // Código
    row.appendChild(createCell(org.code || '—', 'cell-code'));

    // Status
    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    const isActive = org.active !== false;
    badge.className = 'badge ' + (isActive ? 'badge--success' : 'badge--danger');
    badge.textContent = isActive ? 'Ativa' : 'Inativa';
    statusCell.appendChild(badge);
    row.appendChild(statusCell);

    // Data
    row.appendChild(createCell(formatDate(org.created_at), 'cell--muted'));

    // Ações
    row.appendChild(buildActionsCell(org, { isActive: isActive }));

    return row;
  }

  function buildActionsCell(org, meta) {
    const cell = document.createElement('td');
    cell.className = 'cell--num';

    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    // ---------- Editar ----------
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'row-action';
    editBtn.title = 'Editar';
    editBtn.setAttribute('aria-label', 'Editar ' + (org.name || ''));
    editBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 20h9"/>' +
      '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
    editBtn.addEventListener('click', function () { openEditOrgModal(org); });
    wrap.appendChild(editBtn);

    // ---------- Ativar / Desativar ----------
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'row-action';
    toggleBtn.title = meta.isActive ? 'Desativar' : 'Ativar';
    toggleBtn.setAttribute('aria-label',
      (meta.isActive ? 'Desativar ' : 'Ativar ') + (org.name || ''));
    toggleBtn.innerHTML = meta.isActive
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
        ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/><path d="M12 2v10"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
        ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M20 6 9 17l-5-5"/></svg>';
    toggleBtn.addEventListener('click', function () { confirmToggle(org); });
    wrap.appendChild(toggleBtn);

    cell.appendChild(wrap);
    return cell;
  }

  /* =========================================================
     Stats / estados
     ========================================================= */
  function recomputeStats() {
    let active = 0;
    let inactive = 0;

    state.orgs.forEach(function (o) {
      if (o.active === false) inactive += 1;
      else active += 1;
    });

    setText('stat-total-orgs', String(state.orgs.length));
    setText('stat-active-orgs', String(active));
    setText('stat-inactive-orgs', String(inactive));
  }

  function updateCountLabel() {
    const label = document.getElementById('orgs-count');
    if (!label) return;
    const total = state.orgs.length;
    const shown = state.filtered.length;

    if (total === 0) {
      label.textContent = 'Nenhuma empresa cadastrada';
      return;
    }
    if (shown === total) {
      label.textContent = total === 1 ? '1 empresa' : total + ' empresas';
      return;
    }
    label.textContent = shown + ' de ' + total + ' empresas';
  }

  function showLoading(isLoading) {
    const loading = document.getElementById('orgs-loading');
    const wrap    = document.getElementById('orgs-table-wrap');
    const empty   = document.getElementById('orgs-empty');
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
    const empty = document.getElementById('orgs-empty');
    const titleEl = document.getElementById('orgs-empty-title');
    const textEl = document.getElementById('orgs-empty-text');
    if (!empty) return;

    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    empty.hidden = false;
  }

  function hideEmptyState() {
    const empty = document.getElementById('orgs-empty');
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
     Modal: nova empresa / editar empresa
     ========================================================= */
  const modalEls = {};

  function setupOrgModal() {
    modalEls.modal    = document.getElementById('org-modal');
    modalEls.form     = document.getElementById('org-form');
    modalEls.id       = document.getElementById('org-id');      // hidden
    modalEls.title    = document.getElementById('org-modal-title');
    modalEls.name     = document.getElementById('org-name');
    modalEls.code     = document.getElementById('org-code');
    modalEls.active   = document.getElementById('org-active');
    modalEls.feedback = document.getElementById('org-form-feedback');
    modalEls.saveBtn  = document.getElementById('org-save-btn');
    modalEls.openBtn  = document.getElementById('new-org-btn');

    if (!modalEls.modal || !modalEls.form) return;

    if (modalEls.openBtn) {
      modalEls.openBtn.addEventListener('click', openCreateModal);
    }

    modalEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeOrgModal);
    });

    // Normaliza código: UPPERCASE, só A-Z 0-9 -
    if (modalEls.code) {
      modalEls.code.addEventListener('input', function () {
        const clean = String(modalEls.code.value || '')
          .toUpperCase()
          .replace(/[^A-Z0-9-]/g, '');
        if (clean !== modalEls.code.value) modalEls.code.value = clean;
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modalEls.modal.hidden) closeOrgModal();
    });

    modalEls.form.addEventListener('submit', onSubmitOrg);
  }

  function setModalMode(mode) {
    const isEdit = mode === 'edit';
    if (modalEls.title) {
      modalEls.title.textContent = isEdit ? 'Editar empresa' : 'Nova empresa';
    }
    if (modalEls.saveBtn) {
      const label = modalEls.saveBtn.querySelector('.btn__label');
      if (label) label.textContent = isEdit ? 'Salvar alterações' : 'Criar empresa';
    }
  }

  function openCreateModal() {
    modalEls.form.reset();
    if (modalEls.id) modalEls.id.value = '';
    if (modalEls.active) modalEls.active.value = 'true';

    setModalMode('create');
    clearFormFeedback();
    setFormBusy(false);

    modalEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modalEls.name.focus();
  }

  function openEditOrgModal(org) {
    modalEls.form.reset();
    if (modalEls.id)     modalEls.id.value     = org.id || '';
    if (modalEls.name)   modalEls.name.value   = org.name || '';
    if (modalEls.code)   modalEls.code.value   = org.code || '';
    if (modalEls.active) modalEls.active.value = org.active === false ? 'false' : 'true';

    setModalMode('edit');
    clearFormFeedback();
    setFormBusy(false);

    modalEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modalEls.name.focus();
  }

  function closeOrgModal() {
    if (state.creating) return;
    modalEls.modal.hidden = true;
    document.body.style.overflow = '';
  }

  async function onSubmitOrg(event) {
    event.preventDefault();
    if (state.creating) return;

    clearFormFeedback();

    const id     = modalEls.id ? modalEls.id.value : '';
    const name   = modalEls.name.value.trim();
    const code   = modalEls.code.value.trim().toUpperCase();
    const active = modalEls.active.value !== 'false';

    if (!name) {
      showFormFeedback('Informe o nome da empresa.');
      modalEls.name.focus();
      return;
    }
    if (!code) {
      showFormFeedback('Informe o código da empresa.');
      modalEls.code.focus();
      return;
    }
    if (!/^[A-Z0-9-]{2,40}$/.test(code)) {
      showFormFeedback('Use apenas letras, números e hífen (mínimo 2 caracteres).');
      modalEls.code.focus();
      return;
    }

    setFormBusy(true);

    try {
      if (id) {
        // -------- Editar empresa existente --------
        const { error } = await window.db
          .from('organizations')
          .update({ name: name, code: code, active: active })
          .eq('id', id);

        if (error) throw error;

        closeOrgModal();
        showToast('Empresa atualizada com sucesso.', 'success');
      } else {
        // -------- Criar nova empresa --------
        const { error } = await window.db.rpc('create_organization_with_admin', {
          p_name: name,
          p_code: code,
          p_active: active
        });

        if (error) throw error;

        closeOrgModal();
        showToast('Empresa criada com sucesso.', 'success');
      }

      await loadOrganizations();
    } catch (error) {
      console.error('[DEV HUB] Falha ao salvar empresa:', error);
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
      if (label) {
        const isEdit = modalEls.id && modalEls.id.value;
        if (busy) label.textContent = isEdit ? 'Salvando...' : 'Criando...';
        else      label.textContent = isEdit ? 'Salvar alterações' : 'Criar empresa';
      }
    }

    [modalEls.name, modalEls.code, modalEls.active]
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
    if (!error) return 'Não foi possível salvar a empresa. Tente novamente.';
    const msg = String(error.message || '');
    const lower = msg.toLowerCase();

    if (msg === 'code_in_use' ||
        lower.includes('já está em uso') ||
        lower.includes('duplicate') ||
        lower.includes('unique')) {
      return 'Este código de empresa já está em uso.';
    }
    if (lower.includes('row-level security') || lower.includes('permission denied')) {
      return 'Você não tem permissão para executar esta ação.';
    }
    if (lower.includes('apenas administradores da plataforma')) {
      return 'Apenas administradores da plataforma podem executar esta ação.';
    }
    if (lower.includes('failed to fetch') || lower.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    return msg || 'Não foi possível salvar a empresa. Tente novamente.';
  }

  /* =========================================================
     Modal: confirmar toggle
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

  function confirmToggle(org) {
    state.action = { type: 'toggle', org: org };

    const isActive = org.active !== false;
    const name = org.name || 'esta empresa';

    if (isActive) {
      confirmEls.text.textContent =
        'Desativar "' + name + '"? ' +
        'Usuários desta empresa não conseguirão fazer login até que ela seja reativada.';
      setConfirmButton('Desativar', 'danger');
    } else {
      confirmEls.text.textContent =
        'Ativar "' + name + '" novamente? ' +
        'Usuários desta empresa voltarão a conseguir fazer login.';
      setConfirmButton('Ativar', 'primary');
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

    const { org } = state.action;
    setConfirmBusy(true);

    try {
      const newActive = org.active === false;
      const { error } = await window.db
        .from('organizations')
        .update({ active: newActive })
        .eq('id', org.id);

      if (error) throw error;

      showToast(newActive ? 'Empresa ativada.' : 'Empresa desativada.', 'success');

      confirmEls.modal.hidden = true;
      document.body.style.overflow = '';
      state.action = null;

      await loadOrganizations();
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
    if (!error) return 'Não foi possível concluir a operação.';
    const lower = String(error.message || '').toLowerCase();
    if (lower.includes('row-level security') || lower.includes('permission denied')) {
      return 'Você não tem permissão para executar esta ação.';
    }
    if (lower.includes('failed to fetch') || lower.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    return String(error.message || 'Não foi possível concluir a operação.');
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

  function matches(value, term) {
    if (!value) return false;
    return String(value).toLowerCase().includes(term);
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