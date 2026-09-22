/* =========================================================
   DEV HUB · Módulo de Clientes
   ---------------------------------------------------------
   Usa apenas window.db (cliente já criado em js/supabase.js)
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Formatadores ---------- */
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  /* ---------- Estado interno ---------- */
  const state = {
    all: [],          // registros carregados do Supabase
    filtered: [],     // após filtro de busca
    search: '',
    editingId: null,
    deletingId: null,
    saving: false,
    deleting: false
  };

  document.addEventListener('DOMContentLoaded', init);

  /* =========================================================
     Inicialização
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
    setupSearch();
    setupToolbar();
    setupCustomerForm();
    setupConfirmModal();

    const session = await Auth.requireSession();
    if (!session) return;

    watchAuthChanges();

    const profile = await Auth.getProfile(session.user.id);
    renderUser(session.user, profile);

    await loadCustomers();
  }

  /* =========================================================
     Sessão
     ========================================================= */
  function watchAuthChanges() {
    window.db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT' && !window.Auth.isSigningOut()) {
        window.location.replace('index.html?expired=1');
      }
    });
  }

  /* =========================================================
     Usuário (topbar)
     ========================================================= */
  function renderUser(user, profile) {
    const meta = user.user_metadata || {};

    const fullName =
      (profile && profile.name) ||
      meta.name ||
      meta.full_name ||
      (user.email ? user.email.split('@')[0] : '') ||
      'Usuário';

    const roleText = window.Auth.roleLabel((profile && profile.role) || meta.role || '');
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
     Sidebar (mobile)
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

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1024) close();
    });
  }

  /* =========================================================
     Menu do usuário
     ========================================================= */
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

  /* =========================================================
     Logout
     ========================================================= */
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
     Toolbar (novo cliente / botão do estado vazio)
     ========================================================= */
  function setupToolbar() {
    const newBtn = document.getElementById('new-customer-btn');
    const emptyNewBtn = document.getElementById('empty-new-btn');

    if (newBtn) newBtn.addEventListener('click', openCreateModal);
    if (emptyNewBtn) emptyNewBtn.addEventListener('click', openCreateModal);
  }

  /* =========================================================
     Busca (filtragem em frontend)
     ========================================================= */
  function setupSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;

    input.addEventListener('input', function () {
      state.search = input.value.trim().toLowerCase();
      applyFilter();
    });
  }

  function applyFilter() {
    if (!state.search) {
      state.filtered = state.all.slice();
    } else {
      const term = state.search;
      state.filtered = state.all.filter(function (customer) {
        return matchesTerm(customer.name, term) ||
               matchesTerm(customer.cpf_cnpj, term) ||
               matchesTerm(customer.phone, term) ||
               matchesTerm(customer.email, term);
      });
    }
    renderCustomers();
  }

  function matchesTerm(value, term) {
    if (!value) return false;
    return String(value).toLowerCase().includes(term);
  }

  /* =========================================================
     Carregamento dos clientes
     ========================================================= */
  async function loadCustomers() {
    showLoading(true);

    const { data, error } = await window.db
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    showLoading(false);

    if (error) {
      console.error('[DEV HUB] Falha ao carregar clientes:', error);
      state.all = [];
      state.filtered = [];
      showEmptyState(
        'Não foi possível carregar os clientes.',
        'Tente novamente em alguns instantes.',
        false
      );
      updateCountLabel();
      showToast('Não foi possível carregar os clientes.', 'error');
      return;
    }

    state.all = data || [];
    applyFilter();
    updateCountLabel();
  }

  function updateCountLabel() {
    const total = state.all.length;
    const label = document.getElementById('customers-count');
    if (!label) return;

    if (total === 0) {
      label.textContent = 'Nenhum cliente cadastrado';
      return;
    }
    label.textContent = total === 1
      ? '1 cliente cadastrado'
      : total + ' clientes cadastrados';
  }

  /* =========================================================
     Renderização da tabela
     ========================================================= */
  function renderCustomers() {
    const tbody = document.getElementById('customers-body');
    const tableWrap = document.getElementById('customers-table-wrap');
    if (!tbody || !tableWrap) return;

    // Nada cadastrado (não é filtro de busca vazio)
    if (state.all.length === 0) {
      tableWrap.hidden = true;
      showEmptyState(
        'Nenhum cliente cadastrado ainda.',
        'Comece adicionando o primeiro cliente ao sistema.',
        true
      );
      return;
    }

    // Existem registros, mas o filtro não retornou nada
    if (state.filtered.length === 0) {
      tableWrap.hidden = true;
      showEmptyState(
        'Nenhum cliente encontrado.',
        'Ajuste a busca para encontrar o cliente desejado.',
        false
      );
      return;
    }

    hideEmptyState();
    tableWrap.hidden = false;

    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    state.filtered.forEach(function (customer) {
      fragment.appendChild(buildRow(customer));
    });
    tbody.appendChild(fragment);
  }

  function buildRow(customer) {
    const row = document.createElement('tr');
    row.dataset.id = customer.id || '';

    row.appendChild(createCell(customer.name || '—', 'cell-name'));
    row.appendChild(createCell(customer.cpf_cnpj || '—', 'cell--muted'));
    row.appendChild(createCell(formatPhone(customer.phone), 'cell--muted'));
    row.appendChild(createCell(customer.email || '—', 'cell--muted'));
    row.appendChild(createCell(formatDate(customer.created_at), 'cell--muted'));
    row.appendChild(buildActionsCell(customer));

    return row;
  }

  function createCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function buildActionsCell(customer) {
    const cell = document.createElement('td');
    cell.className = 'cell--num';

    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'row-action';
    editBtn.setAttribute('aria-label', 'Editar cliente ' + (customer.name || ''));
    editBtn.title = 'Editar';
    editBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 20h9"/>' +
      '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>' +
      '</svg>';
    editBtn.addEventListener('click', function () { openEditModal(customer); });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'row-action row-action--danger';
    delBtn.setAttribute('aria-label', 'Excluir cliente ' + (customer.name || ''));
    delBtn.title = 'Excluir';
    delBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 6h18"/>' +
      '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
      '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
      '<path d="M10 11v6M14 11v6"/>' +
      '</svg>';
    delBtn.addEventListener('click', function () { openConfirmModal(customer); });

    wrap.appendChild(editBtn);
    wrap.appendChild(delBtn);
    cell.appendChild(wrap);

    return cell;
  }

  /* =========================================================
     Estados visuais
     ========================================================= */
  function showLoading(isLoading) {
    const loading = document.getElementById('customers-loading');
    const wrap = document.getElementById('customers-table-wrap');
    const empty = document.getElementById('customers-empty');
    if (!loading) return;

    if (isLoading) {
      loading.hidden = false;
      if (wrap) wrap.hidden = true;
      if (empty) empty.hidden = true;
    } else {
      loading.hidden = true;
    }
  }

  function showEmptyState(title, text, showCta) {
    const empty = document.getElementById('customers-empty');
    const titleEl = document.getElementById('customers-empty-title');
    const textEl = document.getElementById('customers-empty-text');
    const cta = document.getElementById('empty-new-btn');
    if (!empty) return;

    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    if (cta) cta.hidden = !showCta;

    empty.hidden = false;
  }

  function hideEmptyState() {
    const empty = document.getElementById('customers-empty');
    if (empty) empty.hidden = true;
  }

  function showGlobalAlert(message, type) {
    const alert = document.getElementById('global-alert');
    if (!alert) return;
    alert.textContent = message;
    alert.className = 'alert alert--' + (type || 'error');
    alert.hidden = false;
  }

  /* =========================================================
     Modal: cliente (criar/editar)
     ========================================================= */
  const modalEls = {};

  function setupCustomerForm() {
    modalEls.modal      = document.getElementById('customer-modal');
    modalEls.title      = document.getElementById('customer-modal-title');
    modalEls.form       = document.getElementById('customer-form');
    modalEls.id         = document.getElementById('customer-id');
    modalEls.name       = document.getElementById('customer-name');
    modalEls.document   = document.getElementById('customer-document');
    modalEls.phone      = document.getElementById('customer-phone');
    modalEls.email      = document.getElementById('customer-email');
    modalEls.address    = document.getElementById('customer-address');
    modalEls.notes      = document.getElementById('customer-notes');
    modalEls.feedback   = document.getElementById('customer-form-feedback');
    modalEls.saveBtn    = document.getElementById('customer-save-btn');

    if (!modalEls.modal || !modalEls.form) return;

    // Fechar
    modalEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeCustomerModal);
    });

    // Máscara leve para telefone
    modalEls.phone.addEventListener('input', function () {
      modalEls.phone.value = formatPhoneInput(modalEls.phone.value);
    });

    // Escape fecha
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modalEls.modal.hidden) closeCustomerModal();
    });

    modalEls.form.addEventListener('submit', onSubmitCustomer);
  }

  function openCreateModal() {
    state.editingId = null;
    modalEls.title.textContent = 'Novo cliente';
    modalEls.form.reset();
    modalEls.id.value = '';
    clearFormFeedback();
    openModal(modalEls.modal);
    modalEls.name.focus();
  }

  function openEditModal(customer) {
    state.editingId = customer.id;
    modalEls.title.textContent = 'Editar cliente';
    modalEls.id.value = customer.id || '';
    modalEls.name.value = customer.name || '';
    modalEls.document.value = customer.cpf_cnpj || '';
    modalEls.phone.value = formatPhoneInput(customer.phone || '');
    modalEls.email.value = customer.email || '';
    modalEls.address.value = customer.address || '';
    modalEls.notes.value = customer.notes || '';
    clearFormFeedback();
    openModal(modalEls.modal);
    modalEls.name.focus();
  }

  function closeCustomerModal() {
    if (state.saving) return;
    closeModal(modalEls.modal);
  }

  async function onSubmitCustomer(event) {
    event.preventDefault();
    if (state.saving) return;

    clearFormFeedback();

    const payload = {
      name: modalEls.name.value.trim(),
      cpf_cnpj: modalEls.document.value.trim() || null,
      phone: stripPhone(modalEls.phone.value) || null,
      email: modalEls.email.value.trim() || null,
      address: modalEls.address.value.trim() || null,
      notes: modalEls.notes.value.trim() || null
    };

    if (!payload.name) {
      showFormFeedback('Informe o nome do cliente.');
      modalEls.name.focus();
      return;
    }

    setSaving(true);

    try {
      if (state.editingId) {
        const { error } = await window.db
          .from('customers')
          .update(payload)
          .eq('id', state.editingId);

        if (error) throw error;
        showToast('Cliente atualizado com sucesso.', 'success');
      } else {
        const { error } = await window.db
          .from('customers')
          .insert(payload);

        if (error) throw error;
        showToast('Cliente cadastrado com sucesso.', 'success');
      }

      closeModal(modalEls.modal);
      await loadCustomers();
    } catch (error) {
      console.error('[DEV HUB] Falha ao salvar cliente:', error);
      showFormFeedback(mapDbError(error));
    } finally {
      setSaving(false);
    }
  }

  function setSaving(isSaving) {
    state.saving = isSaving;

    if (modalEls.saveBtn) {
      modalEls.saveBtn.disabled = isSaving;
      modalEls.saveBtn.classList.toggle('is-loading', isSaving);
      modalEls.saveBtn.setAttribute('aria-busy', String(isSaving));
      const label = modalEls.saveBtn.querySelector('.btn__label');
      if (label) label.textContent = isSaving ? 'Salvando…' : 'Salvar';
    }

    // Bloqueia campos enquanto salva
    ['name', 'document', 'phone', 'email', 'address', 'notes'].forEach(function (key) {
      if (modalEls[key]) modalEls[key].readOnly = isSaving;
    });
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

  /* =========================================================
     Modal: confirmar exclusão
     ========================================================= */
  const confirmEls = {};

  function setupConfirmModal() {
    confirmEls.modal = document.getElementById('confirm-modal');
    confirmEls.text  = document.getElementById('confirm-text');
    confirmEls.btn   = document.getElementById('confirm-delete-btn');
    if (!confirmEls.modal || !confirmEls.btn) return;

    confirmEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeConfirmModal);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !confirmEls.modal.hidden) closeConfirmModal();
    });

    confirmEls.btn.addEventListener('click', onConfirmDelete);
  }

  function openConfirmModal(customer) {
    state.deletingId = customer.id;
    confirmEls.text.textContent =
      'Tem certeza que deseja excluir "' + (customer.name || 'este cliente') +
      '"? Esta ação não pode ser desfeita.';
    openModal(confirmEls.modal);
    confirmEls.btn.focus();
  }

  function closeConfirmModal() {
    if (state.deleting) return;
    closeModal(confirmEls.modal);
  }

  async function onConfirmDelete() {
    if (state.deleting || !state.deletingId) return;

    setDeleting(true);

    try {
      const { error } = await window.db
        .from('customers')
        .delete()
        .eq('id', state.deletingId);

      if (error) throw error;

      closeModal(confirmEls.modal);
      state.deletingId = null;
      showToast('Cliente excluído com sucesso.', 'success');
      await loadCustomers();
    } catch (error) {
      console.error('[DEV HUB] Falha ao excluir cliente:', error);
      showToast(mapDbError(error), 'error');
    } finally {
      setDeleting(false);
    }
  }

  function setDeleting(isDeleting) {
    state.deleting = isDeleting;
    if (!confirmEls.btn) return;

    confirmEls.btn.disabled = isDeleting;
    confirmEls.btn.classList.toggle('is-loading', isDeleting);
    confirmEls.btn.setAttribute('aria-busy', String(isDeleting));

    const label = confirmEls.btn.querySelector('.btn__label');
    if (label) label.textContent = isDeleting ? 'Excluindo…' : 'Excluir';
  }

  /* =========================================================
     Helpers de modal
     ========================================================= */
  function openModal(modal) {
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;

    // Só libera o scroll se nenhum outro modal estiver aberto
    const anyOpen = Array.from(document.querySelectorAll('.modal'))
      .some(function (m) { return !m.hidden; });
    if (!anyOpen) document.body.style.overflow = '';
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

  /* =========================================================
     Formatação / máscaras
     ========================================================= */
  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return dateFormatter.format(date);
  }

  /** Formata telefone brasileiro (fixo ou celular) para exibição. */
  function formatPhone(value) {
    if (!value) return '—';
    const digits = stripPhone(value);
    if (!digits) return '—';

    if (digits.length === 11) {
      return '(' + digits.slice(0, 2) + ') ' +
             digits.slice(2, 7) + '-' + digits.slice(7);
    }
    if (digits.length === 10) {
      return '(' + digits.slice(0, 2) + ') ' +
             digits.slice(2, 6) + '-' + digits.slice(6);
    }
    if (digits.length === 9) {
      return digits.slice(0, 5) + '-' + digits.slice(5);
    }
    if (digits.length === 8) {
      return digits.slice(0, 4) + '-' + digits.slice(4);
    }
    return value;
  }

  /** Aplica máscara enquanto o usuário digita. */
  function formatPhoneInput(value) {
    const digits = stripPhone(value).slice(0, 11);
    if (!digits) return '';

    if (digits.length <= 2) return '(' + digits;
    if (digits.length <= 6) {
      return '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
    }
    if (digits.length <= 10) {
      return '(' + digits.slice(0, 2) + ') ' +
             digits.slice(2, 6) + '-' + digits.slice(6);
    }
    return '(' + digits.slice(0, 2) + ') ' +
           digits.slice(2, 7) + '-' + digits.slice(7);
  }

  function stripPhone(value) {
    return String(value || '').replace(/\D/g, '');
  }

  /* =========================================================
     Erros de banco (mensagens amigáveis)
     ========================================================= */
  function mapDbError(error) {
    console.error('[DEV HUB] Erro do Supabase:', error);

    if (!error) return 'Não foi possível salvar. Tente novamente.';

    const message = String(error.message || '').toLowerCase();

    if (message.includes('failed to fetch') || message.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    if (message.includes('row-level security') || message.includes('permission denied')) {
      return 'Você não tem permissão para executar esta ação.';
    }
    if (message.includes('duplicate') || message.includes('unique')) {
      return 'Já existe um registro com essas informações.';
    }
    if (message.includes('violates not-null')) {
      return 'Preencha todos os campos obrigatórios.';
    }

    return 'Não foi possível concluir a operação. Tente novamente.';
  }

  /* =========================================================
     Utilidades
     ========================================================= */
  function setText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = text;
  }
})();