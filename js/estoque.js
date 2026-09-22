/* =========================================================
   DEV HUB · Módulo de Estoque
   ---------------------------------------------------------
   Usa apenas window.db (cliente já criado em js/supabase.js).
   As movimentações usam a RPC `register_stock_movement`
   (atômica: valida + atualiza products.stock + insere em
   stock_movements numa única transação).
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Formatadores ---------- */
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  /* ---------- Rótulos ---------- */
  const TYPE_INFO = {
    entrada: { label: 'Entrada', modifier: 'badge--success', sign: '+' },
    saida:   { label: 'Saída',   modifier: 'badge--danger',  sign: '-' },
    ajuste:  { label: 'Ajuste',  modifier: 'badge--warning', sign: ''  }
  };

  const STATUS_INFO = {
    ok:  { label: 'Estoque normal', modifier: 'badge--success' },
    low: { label: 'Estoque baixo',  modifier: 'badge--warning' },
    out: { label: 'Sem estoque',    modifier: 'badge--danger'  }
  };

  /* ---------- Estado ---------- */
  const state = {
    products: [],
    productsFiltered: [],
    productsSearch: '',
    movements: [],
    movementsFiltered: [],
    movementsProductFilter: '',
    movementsTypeFilter: '',
    modalProduct: null,
    saving: false
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
    setupProductSearch();
    setupMovementFilters();
    setupMovementModal();

    const session = await Auth.requireSession();
    if (!session) return;

    watchAuthChanges();

    const profile = await Auth.getProfile(session.user.id);
    renderUser(session.user, profile);

    await Promise.all([loadProducts(), loadMovements()]);
    recomputeStats();
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
     Carregar produtos
     ========================================================= */
  async function loadProducts() {
    showLoading('products', true);

    const { data, error } = await window.db
      .from('products')
      .select('id, name, code, stock, minimum_stock, active, created_at')
      .order('name', { ascending: true });

    showLoading('products', false);

    if (error) {
      console.error('[DEV HUB] Falha ao carregar produtos:', error);
      state.products = [];
      state.productsFiltered = [];
      showEmpty('products',
        'Não foi possível carregar os produtos.',
        'Tente novamente em alguns instantes.'
      );
      updateCountLabel('products');
      showToast('Não foi possível carregar os produtos.', 'error');
      return;
    }

    state.products = data || [];
    applyProductFilter();
    updateCountLabel('products');
    populateProductFilter();
  }

  function applyProductFilter() {
    const term = state.productsSearch;
    if (!term) {
      state.productsFiltered = state.products.slice();
    } else {
      state.productsFiltered = state.products.filter(function (p) {
        return matches(p.name, term) || matches(p.code, term);
      });
    }
    renderProducts();
  }

  function renderProducts() {
    const tbody = document.getElementById('products-body');
    const wrap = document.getElementById('products-table-wrap');
    if (!tbody || !wrap) return;

    if (state.products.length === 0) {
      wrap.hidden = true;
      showEmpty('products',
        'Nenhum produto cadastrado.',
        'Cadastre produtos para começar a controlar o estoque.'
      );
      return;
    }

    if (state.productsFiltered.length === 0) {
      wrap.hidden = true;
      showEmpty('products',
        'Nenhum produto encontrado.',
        'Ajuste a busca para encontrar o produto desejado.'
      );
      return;
    }

    hideEmpty('products');
    wrap.hidden = false;
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    state.productsFiltered.forEach(function (product) {
      fragment.appendChild(buildProductRow(product));
    });
    tbody.appendChild(fragment);
  }

  function buildProductRow(product) {
    const row = document.createElement('tr');
    row.dataset.id = product.id || '';

    // Nome + aviso de inativo
    const nameCell = document.createElement('td');
    nameCell.className = 'cell-product';
    const name = document.createElement('span');
    name.textContent = product.name || '—';
    nameCell.appendChild(name);
    if (product.active === false) {
      const small = document.createElement('small');
      small.textContent = 'Inativo';
      nameCell.appendChild(small);
    }
    row.appendChild(nameCell);

    row.appendChild(createCell(product.code || '—', 'cell--muted'));

    const stock = toInteger(product.stock, 0);
    const minimum = toInteger(product.minimum_stock, 0);

    row.appendChild(createCell(String(stock), 'cell--num cell-stock'));
    row.appendChild(createCell(String(minimum), 'cell--num cell-stock'));
    row.appendChild(buildStatusCell(stock, minimum));
    row.appendChild(buildActionsCell(product));

    return row;
  }

  function buildStatusCell(stock, minimum) {
    const cell = document.createElement('td');
    const info = statusInfo(stock, minimum);

    const badge = document.createElement('span');
    badge.className = 'badge ' + info.modifier;
    badge.textContent = info.label;
    cell.appendChild(badge);

    return cell;
  }

  function buildActionsCell(product) {
    const cell = document.createElement('td');
    cell.className = 'cell--num';

    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'row-action';
    btn.setAttribute('aria-label', 'Movimentar estoque de ' + (product.name || ''));
    btn.title = 'Movimentar estoque';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="m17 3 4 4-4 4"/>' +
      '<path d="M21 7H8a4 4 0 0 0-4 4v1"/>' +
      '<path d="m7 21-4-4 4-4"/>' +
      '<path d="M3 17h13a4 4 0 0 0 4-4v-1"/></svg>';
    btn.addEventListener('click', function () { openMovementModal(product); });

    wrap.appendChild(btn);
    cell.appendChild(wrap);
    return cell;
  }

  /* =========================================================
     Carregar movimentações
     ========================================================= */
  async function loadMovements() {
    showLoading('movements', true);

    const { data, error } = await window.db
      .from('stock_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    showLoading('movements', false);

    if (error) {
      console.error('[DEV HUB] Falha ao carregar movimentações:', error);
      state.movements = [];
      state.movementsFiltered = [];
      showEmpty('movements',
        'Não foi possível carregar as movimentações.',
        'Tente novamente em alguns instantes.'
      );
      updateCountLabel('movements');
      showToast('Não foi possível carregar as movimentações.', 'error');
      return;
    }

    state.movements = data || [];
    applyMovementFilters();
    updateCountLabel('movements');
  }

  function applyMovementFilters() {
    const productId = state.movementsProductFilter;
    const type = state.movementsTypeFilter;

    state.movementsFiltered = state.movements.filter(function (m) {
      if (productId && m.product_id !== productId) return false;
      if (type && String(m.type || '').toLowerCase() !== type) return false;
      return true;
    });

    renderMovements();
  }

  function renderMovements() {
    const tbody = document.getElementById('movements-body');
    const wrap = document.getElementById('movements-table-wrap');
    if (!tbody || !wrap) return;

    const total = state.movements.length;
    const filtered = state.movementsFiltered;

    if (total === 0) {
      wrap.hidden = true;
      showEmpty('movements',
        'Nenhuma movimentação registrada.',
        'As movimentações de estoque aparecerão aqui.'
      );
      return;
    }

    if (filtered.length === 0) {
      wrap.hidden = true;
      showEmpty('movements',
        'Nenhuma movimentação encontrada.',
        'Ajuste os filtros para visualizar outras movimentações.'
      );
      return;
    }

    hideEmpty('movements');
    wrap.hidden = false;
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    filtered.forEach(function (m) {
      fragment.appendChild(buildMovementRow(m));
    });
    tbody.appendChild(fragment);
  }

  function buildMovementRow(movement) {
    const row = document.createElement('tr');

    row.appendChild(createCell(formatDateTime(movement.created_at), 'cell--muted'));
    row.appendChild(createCell(productName(movement.product_id), ''));
    row.appendChild(buildTypeCell(movement));
    row.appendChild(buildQuantityCell(movement));
    row.appendChild(createCell(String(toInteger(movement.previous_stock, 0)), 'cell--num cell-stock'));
    row.appendChild(createCell(String(toInteger(movement.new_stock, 0)), 'cell--num cell-stock'));
    row.appendChild(createCell(movement.reason || '—', 'movement-reason'));

    return row;
  }

  function buildTypeCell(movement) {
    const cell = document.createElement('td');
    const info = TYPE_INFO[String(movement.type || '').toLowerCase()];

    const badge = document.createElement('span');
    badge.className = 'badge ' + (info ? info.modifier : '');
    badge.textContent = info ? info.label : (movement.type || '—');
    cell.appendChild(badge);

    return cell;
  }

  function buildQuantityCell(movement) {
    const cell = document.createElement('td');
    cell.className = 'cell--num';

    const type = String(movement.type || '').toLowerCase();
    const qty = toInteger(movement.quantity, 0);

    let cls = 'movement-qty';
    let text;

    if (type === 'entrada') {
      cls += ' movement-qty--in';
      text = '+' + qty;
    } else if (type === 'saida') {
      cls += ' movement-qty--out';
      text = '-' + qty;
    } else {
      // ajuste: quantity pode ser positiva (aumentou) ou negativa (diminuiu)
      cls += qty >= 0 ? ' movement-qty--in' : ' movement-qty--out';
      text = qty >= 0 ? '+' + qty : String(qty);
    }

    const span = document.createElement('span');
    span.className = cls;
    span.textContent = text;
    cell.appendChild(span);

    return cell;
  }

  function populateProductFilter() {
    const select = document.getElementById('movement-filter-product');
    if (!select) return;

    while (select.options.length > 1) select.remove(1);

    state.products.forEach(function (p) {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.name || '(sem nome)';
      select.appendChild(option);
    });
  }

  /* =========================================================
     Estatísticas
     ========================================================= */
  function recomputeStats() {
    let withStock = 0;
    let low = 0;
    let out = 0;

    state.products.forEach(function (p) {
      const stock = toInteger(p.stock, 0);
      const min = toInteger(p.minimum_stock, 0);

      if (stock === 0) out += 1;
      else if (stock <= min) low += 1;
      else withStock += 1;
    });

    setText('stat-total', String(state.products.length));
    setText('stat-with-stock', String(withStock));
    setText('stat-low', String(low));
    setText('stat-out', String(out));
  }

  /* =========================================================
     Filtros / busca
     ========================================================= */
  function setupProductSearch() {
    const input = document.getElementById('product-search');
    if (!input) return;

    input.addEventListener('input', function () {
      state.productsSearch = input.value.trim().toLowerCase();
      applyProductFilter();
    });
  }

  function setupMovementFilters() {
    const product = document.getElementById('movement-filter-product');
    const type = document.getElementById('movement-filter-type');

    if (product) {
      product.addEventListener('change', function () {
        state.movementsProductFilter = product.value;
        applyMovementFilters();
        updateCountLabel('movements');
      });
    }
    if (type) {
      type.addEventListener('change', function () {
        state.movementsTypeFilter = type.value;
        applyMovementFilters();
        updateCountLabel('movements');
      });
    }
  }

  function updateCountLabel(section) {
    if (section === 'products') {
      const label = document.getElementById('products-count');
      if (!label) return;
      const total = state.products.length;
      if (total === 0) label.textContent = 'Nenhum produto cadastrado';
      else label.textContent = total === 1 ? '1 produto' : total + ' produtos';
      return;
    }

    if (section === 'movements') {
      const label = document.getElementById('movements-count');
      if (!label) return;
      const total = state.movementsFiltered.length;
      if (state.movements.length === 0) {
        label.textContent = 'Nenhuma movimentação registrada';
        return;
      }
      if (total === 0) {
        label.textContent = 'Nenhum resultado para os filtros aplicados';
        return;
      }
      label.textContent = total === 1
        ? '1 movimentação exibida'
        : total + ' movimentações exibidas';
    }
  }

  /* =========================================================
     Modal de movimentação
     ========================================================= */
  const modalEls = {};

  function setupMovementModal() {
    modalEls.modal        = document.getElementById('movement-modal');
    modalEls.form         = document.getElementById('movement-form');
    modalEls.productId    = document.getElementById('movement-product-id');
    modalEls.productName  = document.getElementById('movement-product-name');
    modalEls.currentStock = document.getElementById('movement-current-stock');
    modalEls.quantity     = document.getElementById('movement-quantity');
    modalEls.quantityLbl  = document.getElementById('movement-quantity-label');
    modalEls.quantityHint = document.getElementById('movement-quantity-hint');
    modalEls.reason       = document.getElementById('movement-reason');
    modalEls.feedback     = document.getElementById('movement-feedback');
    modalEls.saveBtn      = document.getElementById('movement-save-btn');
    modalEls.radios       = document.querySelectorAll('input[name="movement-type"]');

    if (!modalEls.modal || !modalEls.form) return;

    modalEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });

    modalEls.radios.forEach(function (radio) {
      radio.addEventListener('change', updateQuantityFieldForType);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modalEls.modal.hidden) closeModal();
    });

    modalEls.form.addEventListener('submit', onSubmitMovement);
  }

  function openMovementModal(product) {
    state.modalProduct = product;

    modalEls.productId.value = product.id;
    modalEls.productName.value = product.name || '';
    modalEls.currentStock.value = String(toInteger(product.stock, 0));
    modalEls.quantity.value = '';
    modalEls.reason.value = '';
    clearModalFeedback();

    // Reseta para "Entrada"
    modalEls.radios.forEach(function (radio) {
      radio.checked = radio.value === 'entrada';
    });
    updateQuantityFieldForType();

    modalEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modalEls.quantity.focus();
  }

  function closeModal() {
    if (state.saving) return;
    modalEls.modal.hidden = true;
    document.body.style.overflow = '';
    state.modalProduct = null;
  }

  function getSelectedType() {
    for (let i = 0; i < modalEls.radios.length; i += 1) {
      if (modalEls.radios[i].checked) return modalEls.radios[i].value;
    }
    return 'entrada';
  }

  function updateQuantityFieldForType() {
    const type = getSelectedType();

    if (type === 'entrada') {
      modalEls.quantityLbl.textContent = 'Quantidade';
      modalEls.quantityHint.textContent = 'Quantidade a adicionar ao estoque.';
    } else if (type === 'saida') {
      modalEls.quantityLbl.textContent = 'Quantidade';
      modalEls.quantityHint.textContent = 'Quantidade a retirar do estoque.';
    } else {
      modalEls.quantityLbl.textContent = 'Novo estoque';
      modalEls.quantityHint.textContent = 'O estoque será definido exatamente para este valor.';
    }
  }

  async function onSubmitMovement(event) {
    event.preventDefault();
    if (state.saving) return;

    clearModalFeedback();

    const productId = modalEls.productId.value;
    const type = getSelectedType();
    const rawQty = modalEls.quantity.value.trim();
    const reason = modalEls.reason.value.trim();

    if (!productId) {
      showModalFeedback('Selecione um produto.');
      return;
    }

    if (rawQty === '') {
      showModalFeedback('Informe uma quantidade válida.');
      modalEls.quantity.focus();
      return;
    }

    const qty = toInteger(rawQty, NaN);
    if (!Number.isFinite(qty) || qty < 0) {
      showModalFeedback('Informe uma quantidade válida.');
      modalEls.quantity.focus();
      return;
    }

    if (type !== 'ajuste' && qty <= 0) {
      showModalFeedback('A quantidade deve ser maior que zero.');
      modalEls.quantity.focus();
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await window.db.rpc('register_stock_movement', {
        p_product_id: productId,
        p_type: type,
        p_quantity: qty,
        p_reason: reason
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      const newStock = result && result.new_stock;

      modalEls.modal.hidden = true;
      document.body.style.overflow = '';
      state.modalProduct = null;

      showToast(
        newStock !== undefined && newStock !== null
          ? 'Estoque atualizado com sucesso. Novo estoque: ' + newStock + '.'
          : 'Estoque atualizado com sucesso.',
        'success'
      );

      // Recarrega produtos + movimentações em paralelo e recalcula cards
      await Promise.all([loadProducts(), loadMovements()]);
      recomputeStats();
    } catch (error) {
      console.error('[DEV HUB] Falha ao movimentar estoque:', error);
      showModalFeedback(mapMovementError(error));
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

    if (modalEls.quantity) modalEls.quantity.readOnly = isSaving;
    if (modalEls.reason) modalEls.reason.readOnly = isSaving;
    modalEls.radios.forEach(function (radio) { radio.disabled = isSaving; });
  }

  function showModalFeedback(message) {
    if (!modalEls.feedback) return;
    modalEls.feedback.textContent = message;
    modalEls.feedback.hidden = false;
  }

  function clearModalFeedback() {
    if (!modalEls.feedback) return;
    modalEls.feedback.textContent = '';
    modalEls.feedback.hidden = true;
  }

  /* =========================================================
     Estados (loading / vazio / alertas)
     ========================================================= */
  function showLoading(section, isLoading) {
    const loadingId = section === 'products' ? 'products-loading' : 'movements-loading';
    const wrapId = section === 'products' ? 'products-table-wrap' : 'movements-table-wrap';
    const emptyId = section === 'products' ? 'products-empty' : 'movements-empty';

    const loading = document.getElementById(loadingId);
    const wrap = document.getElementById(wrapId);
    const empty = document.getElementById(emptyId);
    if (!loading) return;

    if (isLoading) {
      loading.hidden = false;
      if (wrap) wrap.hidden = true;
      if (empty) empty.hidden = true;
    } else {
      loading.hidden = true;
    }
  }

  function showEmpty(section, title, text) {
    const prefix = section === 'products' ? 'products' : 'movements';
    const empty = document.getElementById(prefix + '-empty');
    const titleEl = document.getElementById(prefix + '-empty-title');
    const textEl = document.getElementById(prefix + '-empty-text');
    if (!empty) return;

    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    empty.hidden = false;
  }

  function hideEmpty(section) {
    const prefix = section === 'products' ? 'products' : 'movements';
    const empty = document.getElementById(prefix + '-empty');
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
     Erros
     ========================================================= */
  function mapMovementError(error) {
    console.error('[DEV HUB] Erro do Supabase (movimentação):', error);

    if (!error) return 'Não foi possível salvar a movimentação. Tente novamente.';

    const message = String(error.message || '');
    const lower = message.toLowerCase();

    // Mensagens amigáveis vindas da RPC
    if (message.includes('Estoque insuficiente')) return message;
    if (message.includes('Produto não encontrado')) return message;
    if (message.includes('Tipo de movimentação inválido')) return message;
    if (message.includes('quantidade válida')) return message;
    if (message.includes('maior que zero')) return message;

    if (lower.includes('failed to fetch') || lower.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    if (lower.includes('row-level security') || lower.includes('permission denied')) {
      return 'Você não tem permissão para movimentar o estoque.';
    }
    if (lower.includes('function') && lower.includes('does not exist')) {
      return 'A função de movimentação não está disponível. Contate o suporte.';
    }

    return 'Não foi possível salvar a movimentação. Tente novamente.';
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
     Helpers
     ========================================================= */
  function createCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function productName(productId) {
    if (!productId) return '—';
    const product = state.products.find(function (p) { return p.id === productId; });
    return (product && product.name) || '—';
  }

  function statusInfo(stock, minimum) {
    if (stock === 0) return STATUS_INFO.out;
    if (stock <= minimum) return STATUS_INFO.low;
    return STATUS_INFO.ok;
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return dateFormatter.format(date);
  }

  function toInteger(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function matches(value, term) {
    if (!value) return false;
    return String(value).toLowerCase().includes(term);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
})();