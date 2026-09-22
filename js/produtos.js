/* =========================================================
   DEV HUB · Módulo de Produtos
   ---------------------------------------------------------
   Usa apenas window.db (cliente já criado em js/supabase.js)
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Formatadores ---------- */
  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  /* ---------- Estado interno ---------- */
  const state = {
    all: [],
    filtered: [],
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
    setupProductForm();
    setupConfirmModal();

    const session = await Auth.requireSession();
    if (!session) return;

    watchAuthChanges();

    const profile = await Auth.getProfile(session.user.id);
    renderUser(session.user, profile);

    await loadProducts();
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
     Toolbar (novo produto / botão do estado vazio)
     ========================================================= */
  function setupToolbar() {
    const newBtn = document.getElementById('new-product-btn');
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
      state.filtered = state.all.filter(function (product) {
        return matchesTerm(product.name, term) ||
               matchesTerm(product.code, term) ||
               matchesTerm(product.description, term);
      });
    }
    renderProducts();
  }

  function matchesTerm(value, term) {
    if (!value) return false;
    return String(value).toLowerCase().includes(term);
  }

  /* =========================================================
     Carregamento
     ========================================================= */
  async function loadProducts() {
    showLoading(true);

    const { data, error } = await window.db
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    showLoading(false);

    if (error) {
      console.error('[DEV HUB] Falha ao carregar produtos:', error);
      state.all = [];
      state.filtered = [];
      showEmptyState(
        'Não foi possível carregar os produtos.',
        'Tente novamente em alguns instantes.',
        false
      );
      updateCountLabel();
      showToast('Não foi possível carregar os produtos.', 'error');
      return;
    }

    state.all = data || [];
    applyFilter();
    updateCountLabel();
  }

  function updateCountLabel() {
    const total = state.all.length;
    const label = document.getElementById('products-count');
    if (!label) return;

    if (total === 0) {
      label.textContent = 'Nenhum produto cadastrado';
      return;
    }
    label.textContent = total === 1
      ? '1 produto cadastrado'
      : total + ' produtos cadastrados';
  }

  /* =========================================================
     Renderização
     ========================================================= */
  function renderProducts() {
    const tbody = document.getElementById('products-body');
    const tableWrap = document.getElementById('products-table-wrap');
    if (!tbody || !tableWrap) return;

    if (state.all.length === 0) {
      tableWrap.hidden = true;
      showEmptyState(
        'Nenhum produto cadastrado ainda.',
        'Comece adicionando o primeiro produto ao catálogo.',
        true
      );
      return;
    }

    if (state.filtered.length === 0) {
      tableWrap.hidden = true;
      showEmptyState(
        'Nenhum produto encontrado.',
        'Ajuste a busca para encontrar o produto desejado.',
        false
      );
      return;
    }

    hideEmptyState();
    tableWrap.hidden = false;

    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    state.filtered.forEach(function (product) {
      fragment.appendChild(buildRow(product));
    });
    tbody.appendChild(fragment);
  }

  function buildRow(product) {
    const row = document.createElement('tr');
    row.dataset.id = product.id || '';

    row.appendChild(buildProductCell(product));
    row.appendChild(createCell(product.code || '—', 'cell--muted'));
    row.appendChild(createCell(formatPrice(product.price), 'cell--num cell-price'));
    row.appendChild(buildStockCell(product.stock, product.minimum_stock));
    row.appendChild(createCell(formatInteger(product.minimum_stock), 'cell--num cell-stock'));
    row.appendChild(buildStatusCell(product.active));
    row.appendChild(buildActionsCell(product));

    return row;
  }

  function buildProductCell(product) {
    const cell = document.createElement('td');
    cell.className = 'cell-product';

    const name = document.createElement('span');
    name.textContent = product.name || '—';
    cell.appendChild(name);

    if (product.description) {
      const desc = document.createElement('small');
      desc.textContent = product.description;
      cell.appendChild(desc);
    }

    return cell;
  }

  function createCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function buildStockCell(stock, minimumStock) {
    const cell = document.createElement('td');
    cell.className = 'cell--num';

    const quantity = toInteger(stock);
    const minimum = toInteger(minimumStock);

    let modifier = 'stock-indicator--ok';
    let label = '';

    if (quantity === 0) {
      modifier = 'stock-indicator--out';
      label = 'Sem estoque';
    } else if (quantity <= minimum) {
      modifier = 'stock-indicator--low';
      label = 'Estoque baixo';
    }

    const wrapper = document.createElement('span');
    wrapper.className = 'stock-indicator ' + modifier;

    if (label) {
      const dot = document.createElement('span');
      dot.className = 'stock-indicator__dot';
      dot.setAttribute('aria-hidden', 'true');
      wrapper.appendChild(dot);
    }

    const value = document.createElement('span');
    value.textContent = label
      ? formatInteger(quantity) + ' · ' + label
      : formatInteger(quantity);
    wrapper.appendChild(value);

    cell.appendChild(wrapper);
    return cell;
  }

  function buildStatusCell(active) {
    const cell = document.createElement('td');
    const isActive = active === true;

    const badge = document.createElement('span');
    badge.className = 'badge ' + (isActive ? 'badge--success' : 'badge--danger');
    badge.textContent = isActive ? 'Ativo' : 'Inativo';

    cell.appendChild(badge);
    return cell;
  }

  function buildActionsCell(product) {
    const cell = document.createElement('td');
    cell.className = 'cell--num';

    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'row-action';
    editBtn.setAttribute('aria-label', 'Editar produto ' + (product.name || ''));
    editBtn.title = 'Editar';
    editBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 20h9"/>' +
      '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>' +
      '</svg>';
    editBtn.addEventListener('click', function () { openEditModal(product); });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'row-action row-action--danger';
    delBtn.setAttribute('aria-label', 'Excluir produto ' + (product.name || ''));
    delBtn.title = 'Excluir';
    delBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 6h18"/>' +
      '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
      '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
      '<path d="M10 11v6M14 11v6"/>' +
      '</svg>';
    delBtn.addEventListener('click', function () { openConfirmModal(product); });

    wrap.appendChild(editBtn);
    wrap.appendChild(delBtn);
    cell.appendChild(wrap);

    return cell;
  }

  /* =========================================================
     Estados visuais
     ========================================================= */
  function showLoading(isLoading) {
    const loading = document.getElementById('products-loading');
    const wrap = document.getElementById('products-table-wrap');
    const empty = document.getElementById('products-empty');
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
    const empty = document.getElementById('products-empty');
    const titleEl = document.getElementById('products-empty-title');
    const textEl = document.getElementById('products-empty-text');
    const cta = document.getElementById('empty-new-btn');
    if (!empty) return;

    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    if (cta) cta.hidden = !showCta;

    empty.hidden = false;
  }

  function hideEmptyState() {
    const empty = document.getElementById('products-empty');
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
     Modal: produto (criar/editar)
     ========================================================= */
  const modalEls = {};

  function setupProductForm() {
    modalEls.modal          = document.getElementById('product-modal');
    modalEls.title          = document.getElementById('product-modal-title');
    modalEls.form           = document.getElementById('product-form');
    modalEls.id             = document.getElementById('product-id');
    modalEls.name           = document.getElementById('product-name');
    modalEls.code           = document.getElementById('product-code');
    modalEls.description    = document.getElementById('product-description');
    modalEls.price          = document.getElementById('product-price');
    modalEls.stock          = document.getElementById('product-stock');
    modalEls.minimumStock   = document.getElementById('product-minimum-stock');
    modalEls.active         = document.getElementById('product-active');
    modalEls.activeLabel    = document.getElementById('product-active-label');
    modalEls.feedback       = document.getElementById('product-form-feedback');
    modalEls.saveBtn        = document.getElementById('product-save-btn');

    if (!modalEls.modal || !modalEls.form) return;

    modalEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeProductModal);
    });

    // Atualiza o rótulo "Ativo / Inativo" do switch
    modalEls.active.addEventListener('change', function () {
      modalEls.activeLabel.textContent = modalEls.active.checked ? 'Ativo' : 'Inativo';
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modalEls.modal.hidden) closeProductModal();
    });

    modalEls.form.addEventListener('submit', onSubmitProduct);
  }

  function openCreateModal() {
    state.editingId = null;
    modalEls.title.textContent = 'Novo produto';
    modalEls.form.reset();
    modalEls.id.value = '';
    modalEls.price.value = '0';
    modalEls.stock.value = '0';
    modalEls.minimumStock.value = '0';
    modalEls.active.checked = true;
    modalEls.activeLabel.textContent = 'Ativo';
    clearFormFeedback();
    openModal(modalEls.modal);
    modalEls.name.focus();
  }

  function openEditModal(product) {
    state.editingId = product.id;
    modalEls.title.textContent = 'Editar produto';
    modalEls.id.value = product.id || '';
    modalEls.name.value = product.name || '';
    modalEls.code.value = product.code || '';
    modalEls.description.value = product.description || '';
    modalEls.price.value = normalizeNumberInput(product.price);
    modalEls.stock.value = normalizeIntegerInput(product.stock);
    modalEls.minimumStock.value = normalizeIntegerInput(product.minimum_stock);
    modalEls.active.checked = product.active === true;
    modalEls.activeLabel.textContent = modalEls.active.checked ? 'Ativo' : 'Inativo';
    clearFormFeedback();
    openModal(modalEls.modal);
    modalEls.name.focus();
  }

  function closeProductModal() {
    if (state.saving) return;
    closeModal(modalEls.modal);
  }

  async function onSubmitProduct(event) {
    event.preventDefault();
    if (state.saving) return;

    clearFormFeedback();

    const name = modalEls.name.value.trim();
    const priceRaw = modalEls.price.value.trim();

    if (!name) {
      showFormFeedback('Informe o nome do produto.');
      modalEls.name.focus();
      return;
    }

    const price = parseNumber(priceRaw);
    if (price === null || price < 0) {
      showFormFeedback('Informe um preço válido (maior ou igual a zero).');
      modalEls.price.focus();
      return;
    }

    const stock = parseInteger(modalEls.stock.value, 0);
    const minimumStock = parseInteger(modalEls.minimumStock.value, 0);

    if (stock < 0 || minimumStock < 0) {
      showFormFeedback('Estoque não pode ser negativo.');
      modalEls.stock.focus();
      return;
    }

    const payload = {
      name: name,
      code: modalEls.code.value.trim() || null,
      description: modalEls.description.value.trim() || null,
      price: price,
      stock: stock,
      minimum_stock: minimumStock,
      active: modalEls.active.checked === true
    };

    setSaving(true);

    try {
      if (state.editingId) {
        const { error } = await window.db
          .from('products')
          .update(payload)
          .eq('id', state.editingId);

        if (error) throw error;
        showToast('Produto atualizado com sucesso.', 'success');
      } else {
        const { error } = await window.db
          .from('products')
          .insert(payload);

        if (error) throw error;
        showToast('Produto cadastrado com sucesso.', 'success');
      }

      closeModal(modalEls.modal);
      await loadProducts();
    } catch (error) {
      console.error('[DEV HUB] Falha ao salvar produto:', error);
      showFormFeedback(mapDbError(error, 'save'));
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
      if (label) label.textContent = isSaving ? 'Salvando...' : 'Salvar';
    }

    ['name', 'code', 'description', 'price', 'stock', 'minimumStock', 'active']
      .forEach(function (key) {
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

  function openConfirmModal(product) {
    state.deletingId = product.id;
    confirmEls.text.textContent =
      'Tem certeza que deseja excluir "' + (product.name || 'este produto') +
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
        .from('products')
        .delete()
        .eq('id', state.deletingId);

      if (error) throw error;

      closeModal(confirmEls.modal);
      state.deletingId = null;
      showToast('Produto excluído com sucesso.', 'success');
      await loadProducts();
    } catch (error) {
      console.error('[DEV HUB] Falha ao excluir produto:', error);

      // Produto vinculado a vendas (FK): mensagem amigável, sem detalhe técnico
      if (isForeignKeyError(error)) {
        closeModal(confirmEls.modal);
        state.deletingId = null;
        showToast(
          'Este produto não pode ser excluído porque está vinculado a uma ou mais vendas.',
          'error'
        );
      } else {
        showToast(mapDbError(error, 'delete'), 'error');
      }
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
    if (label) label.textContent = isDeleting ? 'Excluindo...' : 'Excluir';
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
     Formatação / conversão
     ========================================================= */
  function formatPrice(value) {
    const number = parseNumber(value);
    if (number === null) return 'R$ 0,00';
    return currencyFormatter.format(number);
  }

  function formatInteger(value) {
    const number = toInteger(value);
    return String(number);
  }

  function toInteger(value) {
    const number = parseInteger(value, 0);
    return number;
  }

  function parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    const normalized = String(value).replace(',', '.').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseInteger(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeNumberInput(value) {
    const number = parseNumber(value);
    return number === null ? '0' : String(number);
  }

  function normalizeIntegerInput(value) {
    const number = parseInteger(value, 0);
    return String(number);
  }

  /* =========================================================
     Erros de banco (mensagens amigáveis)
     ========================================================= */
  function isForeignKeyError(error) {
    if (!error) return false;
    const code = String(error.code || '');
    const message = String(error.message || '').toLowerCase();
    return code === '23503' ||
           message.includes('foreign key') ||
           message.includes('violates foreign key constraint');
  }

  function mapDbError(error, context) {
    console.error('[DEV HUB] Erro do Supabase:', error);

    const fallback = context === 'delete'
      ? 'Não foi possível excluir. Tente novamente.'
      : 'Não foi possível salvar. Tente novamente.';

    if (!error) return fallback;

    const code = String(error.code || '');
    const message = String(error.message || '').toLowerCase();

    if (message.includes('failed to fetch') || message.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    if (code === '23503' || message.includes('foreign key')) {
      return 'Este produto está vinculado a outros registros e não pode ser excluído.';
    }
    if (code === '23502' || message.includes('violates not-null')) {
      return 'Preencha todos os campos obrigatórios.';
    }
    if (code === '23514' || message.includes('violates check constraint')) {
      return 'Alguns valores informados não são permitidos.';
    }
    if (message.includes('row-level security') || message.includes('permission denied')) {
      return 'Você não tem permissão para executar esta ação.';
    }

    return fallback;
  }

  /* =========================================================
     Utilidades
     ========================================================= */
  function setText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = text;
  }
})();