/* =========================================================
   DEV HUB · Módulo de Vendas
   ---------------------------------------------------------
   Usa apenas window.db (cliente já criado em js/supabase.js)
   A gravação da venda é feita via RPC `create_sale` (atômica).
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Formatadores ---------- */
  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  /* ---------- Rótulos ---------- */
  const PAYMENT_LABELS = {
    '': 'Não informado',
    cash: 'Dinheiro',
    pix: 'Pix',
    debit_card: 'Cartão de débito',
    credit_card: 'Cartão de crédito',
    boleto: 'Boleto',
    other: 'Outro'
  };

  const STATUS_LABELS = {
    completed: { label: 'Concluída', modifier: 'badge--success' },
    pending:   { label: 'Pendente',  modifier: 'badge--warning' },
    canceled:  { label: 'Cancelada', modifier: 'badge--danger'  },
    cancelled: { label: 'Cancelada', modifier: 'badge--danger'  }
  };

  /* ---------- Estado ---------- */
  const state = {
    sales: [],
    filtered: [],
    search: '',
    // Dados do formulário
    customers: null,     // carregado uma vez
    products: null,      // recarregado toda vez que abre o form
    cart: [],            // [{ product_id, product_name, unit_price, quantity, subtotal, stock_available }]
    formDataLoaded: false,
    submitting: false,
    detailLoading: false
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
    setupSearch();
    setupToolbar();
    setupFormView();
    setupSaleForm();
    setupDetailModal();

    const session = await Auth.requireSession();
    if (!session) return;

    watchAuthChanges();

    const profile = await Auth.getProfile(session.user.id);
    renderUser(session.user, profile);

    await loadSales();
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
     Toolbar / busca
     ========================================================= */
  function setupToolbar() {
    const newBtn = document.getElementById('new-sale-btn');
    const emptyNewBtn = document.getElementById('empty-new-btn');

    if (newBtn) newBtn.addEventListener('click', openFormView);
    if (emptyNewBtn) emptyNewBtn.addEventListener('click', openFormView);
  }

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
      state.filtered = state.sales.slice();
    } else {
      const term = state.search;
      state.filtered = state.sales.filter(function (sale) {
        return matches(formatSaleNumberSearch(sale), term) ||
               matches(customerNameOf(sale), term) ||
               matches(PAYMENT_LABELS[sale.payment_method || ''] || sale.payment_method, term);
      });
    }
    renderSalesTable();
  }

  function matches(value, term) {
    if (!value) return false;
    return String(value).toLowerCase().includes(term);
  }

  /* =========================================================
     Carregar vendas
     ========================================================= */
  async function loadSales() {
    showLoading(true);

    let rows = await fetchSalesWithJoin();
    if (rows === null) {
      // fallback: sem join, busca clientes separadamente
      rows = await fetchSalesWithoutJoin();
    }

    showLoading(false);

    if (rows === null) {
      state.sales = [];
      state.filtered = [];
      showEmptyState(
        'Não foi possível carregar as vendas.',
        'Tente novamente em alguns instantes.',
        false
      );
      updateCountLabel();
      showToast('Não foi possível carregar as vendas.', 'error');
      return;
    }

    state.sales = rows;
    applyFilter();
    updateCountLabel();
  }

  async function fetchSalesWithJoin() {
    const { data, error } = await window.db
      .from('sales')
      .select('*, customers(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[DEV HUB] Consulta com join falhou; tentando fallback.', error);
      return null;
    }
    return data || [];
  }

  async function fetchSalesWithoutJoin() {
    const { data, error } = await window.db
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DEV HUB] Falha ao carregar vendas:', error);
      return null;
    }

    const sales = data || [];
    const ids = sales
      .map(function (s) { return s.customer_id; })
      .filter(function (id) { return Boolean(id); });

    if (ids.length === 0) return sales;

    const { data: customers, error: custErr } = await window.db
      .from('customers')
      .select('id, name')
      .in('id', ids);

    if (custErr) {
      console.warn('[DEV HUB] Não foi possível buscar nomes de clientes.', custErr);
      return sales;
    }

    const map = {};
    (customers || []).forEach(function (c) { map[c.id] = c.name; });

    return sales.map(function (s) {
      if (s.customer_id && map[s.customer_id]) {
        return Object.assign({}, s, { customers: { name: map[s.customer_id] } });
      }
      return s;
    });
  }

  function updateCountLabel() {
    const total = state.sales.length;
    const label = document.getElementById('sales-count');
    if (!label) return;

    if (total === 0) {
      label.textContent = 'Nenhuma venda registrada';
      return;
    }
    label.textContent = total === 1
      ? '1 venda registrada'
      : total + ' vendas registradas';
  }

  /* =========================================================
     Render da tabela de vendas
     ========================================================= */
  function renderSalesTable() {
    const tbody = document.getElementById('sales-body');
    const tableWrap = document.getElementById('sales-table-wrap');
    if (!tbody || !tableWrap) return;

    if (state.sales.length === 0) {
      tableWrap.hidden = true;
      showEmptyState(
        'Nenhuma venda registrada ainda.',
        'Comece registrando sua primeira venda.',
        true
      );
      return;
    }

    if (state.filtered.length === 0) {
      tableWrap.hidden = true;
      showEmptyState(
        'Nenhuma venda encontrada.',
        'Ajuste a busca para encontrar a venda desejada.',
        false
      );
      return;
    }

    hideEmptyState();
    tableWrap.hidden = false;

    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    state.filtered.forEach(function (sale) {
      fragment.appendChild(buildSaleRow(sale));
    });
    tbody.appendChild(fragment);
  }

  function buildSaleRow(sale) {
    const row = document.createElement('tr');
    row.dataset.id = sale.id || '';

    row.appendChild(createCell(formatSaleNumber(sale), 'sale-number'));
    row.appendChild(createCell(customerNameOf(sale), 'cell--muted'));
    row.appendChild(createCell(formatDateTime(sale.created_at), 'cell--muted'));
    row.appendChild(createCell(formatMoney(sale.subtotal), 'cell--num'));
    row.appendChild(createCell(formatMoney(sale.discount), 'cell--num'));
    row.appendChild(createCell(formatMoney(sale.total), 'cell--num cell-price'));
    row.appendChild(createCell(paymentLabel(sale.payment_method), 'cell--muted'));
    row.appendChild(buildStatusCell(sale.status));
    row.appendChild(buildActionsCell(sale));

    return row;
  }

  function createCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function buildStatusCell(status) {
    const cell = document.createElement('td');
    const info = statusInfo(status);

    const badge = document.createElement('span');
    badge.className = 'badge ' + info.modifier;
    badge.textContent = info.label;
    cell.appendChild(badge);

    return cell;
  }

  function buildActionsCell(sale) {
    const cell = document.createElement('td');
    cell.className = 'cell--num';

    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'row-action';
    btn.setAttribute('aria-label', 'Ver detalhes da venda ' + formatSaleNumber(sale));
    btn.title = 'Ver detalhes';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/>' +
      '<circle cx="12" cy="12" r="3"/></svg>';
    btn.addEventListener('click', function () { openDetailModal(sale); });

    wrap.appendChild(btn);
    cell.appendChild(wrap);

    return cell;
  }

  /* =========================================================
     Estados visuais da lista
     ========================================================= */
  function showLoading(isLoading) {
    const loading = document.getElementById('sales-loading');
    const wrap = document.getElementById('sales-table-wrap');
    const empty = document.getElementById('sales-empty');
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
    const empty = document.getElementById('sales-empty');
    const titleEl = document.getElementById('sales-empty-title');
    const textEl = document.getElementById('sales-empty-text');
    const cta = document.getElementById('empty-new-btn');
    if (!empty) return;

    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    if (cta) cta.hidden = !showCta;

    empty.hidden = false;
  }

  function hideEmptyState() {
    const empty = document.getElementById('sales-empty');
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
     View swap (lista ↔ formulário)
     ========================================================= */
  function setupFormView() {
    const back = document.getElementById('back-to-list');
    const cancel = document.getElementById('cancel-sale');
    if (back) back.addEventListener('click', closeFormView);
    if (cancel) cancel.addEventListener('click', closeFormView);
  }

  async function openFormView() {
    showView('form');
    if (!state.formDataLoaded) {
      await loadFormData();
    }
  }

  function closeFormView() {
    if (state.submitting) return;
    resetSaleForm();
    showView('list');
  }

  function showView(name) {
    const list = document.getElementById('view-list');
    const form = document.getElementById('view-form');
    if (!list || !form) return;

    const isForm = name === 'form';
    list.hidden = isForm;
    form.hidden = !isForm;

    if (isForm) window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* =========================================================
     Carregar dados do formulário (clientes + produtos ativos)
     ========================================================= */
  async function loadFormData() {
    state.formDataLoaded = false;

    const [customersRes, productsRes] = await Promise.all([
      window.db.from('customers').select('id, name').order('name', { ascending: true }),
      window.db.from('products').select('id, name, price, stock, active')
        .eq('active', true)
        .order('name', { ascending: true })
    ]);

    if (customersRes.error) {
      console.error('[DEV HUB] Falha ao carregar clientes:', customersRes.error);
      showToast('Não foi possível carregar os clientes.', 'error');
    }
    if (productsRes.error) {
      console.error('[DEV HUB] Falha ao carregar produtos:', productsRes.error);
      showToast('Não foi possível carregar os produtos.', 'error');
    }

    state.customers = customersRes.data || [];
    state.products  = productsRes.data  || [];

    populateCustomerSelect();
    populateProductSelect();

    state.formDataLoaded = true;
  }

  function populateCustomerSelect() {
    const select = document.getElementById('sale-customer');
    if (!select) return;

    // mantém apenas a primeira opção ("Cliente não informado")
    while (select.options.length > 1) select.remove(1);

    state.customers.forEach(function (c) {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.name || '(sem nome)';
      select.appendChild(option);
    });
  }

  function populateProductSelect() {
    const select = document.getElementById('sale-product');
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
     Formulário: bindings
     ========================================================= */
  const formEls = {};

  function setupSaleForm() {
    formEls.form         = document.getElementById('sale-form');
    formEls.customer     = document.getElementById('sale-customer');
    formEls.product      = document.getElementById('sale-product');
    formEls.productInfo  = document.getElementById('product-info');
    formEls.pricePreview = document.getElementById('product-price-preview');
    formEls.quantity     = document.getElementById('product-quantity');
    formEls.subtotalPrev = document.getElementById('product-subtotal-preview');
    formEls.addBtn       = document.getElementById('add-product-btn');
    formEls.cartBody     = document.getElementById('cart-body');
    formEls.cartWrap     = document.getElementById('cart-wrap');
    formEls.cartEmpty    = document.getElementById('cart-empty');
    formEls.discount     = document.getElementById('sale-discount');
    formEls.totalSub     = document.getElementById('total-subtotal');
    formEls.totalTotal   = document.getElementById('total-total');
    formEls.payment      = document.getElementById('sale-payment');
    formEls.notes        = document.getElementById('sale-notes');
    formEls.feedback     = document.getElementById('sale-form-feedback');
    formEls.submitBtn    = document.getElementById('submit-sale-btn');

    if (!formEls.form) return;

    formEls.product.addEventListener('change', onProductChange);
    formEls.quantity.addEventListener('input', updateAddPreview);
    formEls.addBtn.addEventListener('click', onAddProduct);
    formEls.discount.addEventListener('input', recalcTotals);
    formEls.form.addEventListener('submit', onSubmitSale);
  }

  function onProductChange() {
    const product = findProduct(formEls.product.value);

    if (!product) {
      formEls.productInfo.textContent = 'Selecione um produto para ver o preço e o estoque.';
      formEls.productInfo.className = 'product-info';
      formEls.pricePreview.value = formatMoney(0);
      formEls.quantity.value = '1';
      formEls.subtotalPrev.value = formatMoney(0);
      formEls.addBtn.disabled = true;
      return;
    }

    const stock = toInteger(product.stock, 0);
    const price = toNumber(product.price, 0);

    formEls.pricePreview.value = formatMoney(price);
    formEls.quantity.value = '1';
    updateAddPreview();

    let cls = 'product-info';
    let extra = '';
    if (stock === 0) {
      cls += ' product-info--stock-out';
      extra = ' — sem estoque';
    } else if (stock <= 0) {
      cls += ' product-info--stock-low';
    }
    formEls.productInfo.className = cls;
    formEls.productInfo.innerHTML =
      'Preço: <strong>' + escapeHtml(formatMoney(price)) + '</strong>' +
      ' · Estoque disponível: <strong>' + escapeHtml(String(stock)) + '</strong>' +
      escapeHtml(extra);

    formEls.addBtn.disabled = stock === 0;
  }

  function updateAddPreview() {
    const product = findProduct(formEls.product.value);
    if (!product) {
      formEls.subtotalPrev.value = formatMoney(0);
      return;
    }
    const qty = Math.max(1, toInteger(formEls.quantity.value, 1));
    const price = toNumber(product.price, 0);
    formEls.subtotalPrev.value = formatMoney(price * qty);
  }

  function onAddProduct() {
    const product = findProduct(formEls.product.value);
    if (!product) {
      showFormFeedback('Selecione um produto.');
      return;
    }

    const stock = toInteger(product.stock, 0);
    const qty = toInteger(formEls.quantity.value, 0);

    if (qty <= 0) {
      showFormFeedback('Informe uma quantidade válida.');
      formEls.quantity.focus();
      return;
    }

    // já existe no carrinho?
    const existing = state.cart.find(function (i) { return i.product_id === product.id; });
    const alreadyQty = existing ? existing.quantity : 0;

    if (alreadyQty + qty > stock) {
      showFormFeedback('Estoque insuficiente.');
      return;
    }

    const price = toNumber(product.price, 0);

    if (existing) {
      existing.quantity += qty;
      existing.subtotal = round2(existing.quantity * existing.unit_price);
    } else {
      state.cart.push({
        product_id: product.id,
        product_name: product.name || '',
        unit_price: price,
        quantity: qty,
        subtotal: round2(qty * price),
        stock_available: stock
      });
    }

    clearFormFeedback();

    // reset do bloco de adicionar
    formEls.product.value = '';
    onProductChange();

    renderCart();
    recalcTotals();
  }

  function renderCart() {
    if (!formEls.cartBody || !formEls.cartWrap || !formEls.cartEmpty) return;

    if (state.cart.length === 0) {
      formEls.cartWrap.hidden = true;
      formEls.cartEmpty.hidden = false;
      formEls.cartBody.innerHTML = '';
      return;
    }

    formEls.cartEmpty.hidden = true;
    formEls.cartWrap.hidden = false;
    formEls.cartBody.innerHTML = '';

    const fragment = document.createDocumentFragment();

    state.cart.forEach(function (item) {
      const row = document.createElement('tr');
      row.dataset.id = item.product_id;

      const nameCell = document.createElement('td');
      nameCell.className = 'cart-table__name';
      nameCell.textContent = item.product_name || '—';
      row.appendChild(nameCell);

      row.appendChild(createCell(formatMoney(item.unit_price), 'cell--num'));

      // Quantidade editável
      const qtyCell = document.createElement('td');
      qtyCell.className = 'cell--num';
      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.min = '1';
      qtyInput.step = '1';
      qtyInput.value = String(item.quantity);
      qtyInput.className = 'qty-input';
      qtyInput.setAttribute('aria-label', 'Quantidade de ' + item.product_name);
      qtyInput.addEventListener('change', function () {
        onQuantityChange(item.product_id, qtyInput.value, qtyInput);
      });
      qtyCell.appendChild(qtyInput);
      row.appendChild(qtyCell);

      row.appendChild(createCell(formatMoney(item.subtotal), 'cell--num cell-price'));

      // Remover
      const actionsCell = document.createElement('td');
      actionsCell.className = 'cell--num';
      const wrap = document.createElement('div');
      wrap.className = 'row-actions';
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'row-action row-action--danger';
      removeBtn.title = 'Remover';
      removeBtn.setAttribute('aria-label', 'Remover ' + item.product_name);
      removeBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
        ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M3 6h18"/>' +
        '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
        '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
      removeBtn.addEventListener('click', function () { removeFromCart(item.product_id); });
      wrap.appendChild(removeBtn);
      actionsCell.appendChild(wrap);
      row.appendChild(actionsCell);

      fragment.appendChild(row);
    });

    formEls.cartBody.appendChild(fragment);
  }

  function onQuantityChange(productId, rawValue, inputEl) {
    const item = state.cart.find(function (i) { return i.product_id === productId; });
    if (!item) return;

    const qty = toInteger(rawValue, 0);

    if (qty <= 0) {
      showFormFeedback('Informe uma quantidade válida.');
      inputEl.value = String(item.quantity);
      return;
    }

    if (qty > item.stock_available) {
      showFormFeedback('Estoque insuficiente.');
      inputEl.value = String(item.quantity);
      return;
    }

    item.quantity = qty;
    item.subtotal = round2(qty * item.unit_price);

    clearFormFeedback();
    renderCart();
    recalcTotals();
  }

  function removeFromCart(productId) {
    state.cart = state.cart.filter(function (i) { return i.product_id !== productId; });
    renderCart();
    recalcTotals();
    clearFormFeedback();
  }

  /* =========================================================
     Cálculos
     ========================================================= */
  function recalcTotals() {
    const subtotal = state.cart.reduce(function (sum, item) {
      return sum + toNumber(item.subtotal, 0);
    }, 0);

    let discount = toNumber(formEls.discount.value, 0);
    if (!Number.isFinite(discount) || discount < 0) discount = 0;

    // Não permite desconto > subtotal (evita total negativo)
    if (discount > subtotal) {
      discount = subtotal;
      formEls.discount.value = String(round2(discount));
    }

    const total = Math.max(0, round2(subtotal - discount));

    formEls.totalSub.textContent = formatMoney(subtotal);
    formEls.totalTotal.textContent = formatMoney(total);
  }

  /* =========================================================
     Submit
     ========================================================= */
  async function onSubmitSale(event) {
    event.preventDefault();
    if (state.submitting) return;

    clearFormFeedback();

    if (state.cart.length === 0) {
      showFormFeedback('Adicione pelo menos um produto à venda.');
      return;
    }

    // Revalida quantidades x estoque atual conhecido
    for (let i = 0; i < state.cart.length; i += 1) {
      const item = state.cart[i];
      if (item.quantity <= 0) {
        showFormFeedback('Informe uma quantidade válida.');
        return;
      }
      if (item.quantity > item.stock_available) {
        showFormFeedback('Estoque insuficiente para "' + item.product_name + '".');
        return;
      }
    }

    const subtotal = round2(state.cart.reduce(function (sum, item) {
      return sum + toNumber(item.subtotal, 0);
    }, 0));

    let discount = toNumber(formEls.discount.value, 0);
    if (!Number.isFinite(discount) || discount < 0) discount = 0;
    if (discount > subtotal) discount = subtotal;

    const total = round2(subtotal - discount);
    if (total < 0) {
      showFormFeedback('O total não pode ser negativo.');
      return;
    }

    const payload = {
      p_customer_id: formEls.customer.value || null,
      p_subtotal: subtotal,
      p_discount: round2(discount),
      p_total: total,
      p_payment_method: formEls.payment.value || '',
      p_notes: formEls.notes.value.trim() || '',
      p_items: state.cart.map(function (item) {
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: round2(item.unit_price),
          subtotal: round2(item.subtotal)
        };
      })
    };

    setSubmitting(true);

    try {
      const { data, error } = await window.db.rpc('create_sale', payload);

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      const saleNumber = result && result.sale_number;

      resetSaleForm();
      showView('list');

      // Recarrega lista + invalida cache de produtos (estoque mudou)
      state.formDataLoaded = false;
      await loadSales();

      showToast(
        saleNumber
          ? 'Venda #' + padNumber(saleNumber) + ' registrada com sucesso.'
          : 'Venda registrada com sucesso.',
        'success'
      );
    } catch (error) {
      console.error('[DEV HUB] Falha ao finalizar venda:', error);
      showFormFeedback(mapSaleError(error));
    } finally {
      setSubmitting(false);
    }
  }

  function setSubmitting(isSubmitting) {
    state.submitting = isSubmitting;

    if (formEls.submitBtn) {
      formEls.submitBtn.disabled = isSubmitting;
      formEls.submitBtn.classList.toggle('is-loading', isSubmitting);
      formEls.submitBtn.setAttribute('aria-busy', String(isSubmitting));
      const label = formEls.submitBtn.querySelector('.btn__label');
      if (label) label.textContent = isSubmitting ? 'Finalizando...' : 'Finalizar venda';
    }
  }

  function resetSaleForm() {
    if (!formEls.form) return;

    formEls.form.reset();
    formEls.customer.value = '';
    formEls.product.value = '';
    formEls.quantity.value = '1';
    formEls.discount.value = '0';
    formEls.payment.value = '';
    formEls.notes.value = '';
    state.cart = [];

    if (formEls.pricePreview) formEls.pricePreview.value = formatMoney(0);
    if (formEls.subtotalPrev) formEls.subtotalPrev.value = formatMoney(0);
    if (formEls.addBtn) formEls.addBtn.disabled = true;
    if (formEls.productInfo) {
      formEls.productInfo.textContent = 'Selecione um produto para ver o preço e o estoque.';
      formEls.productInfo.className = 'product-info';
    }

    clearFormFeedback();
    renderCart();
    recalcTotals();
  }

  function showFormFeedback(message) {
    if (!formEls.feedback) return;
    formEls.feedback.textContent = message;
    formEls.feedback.hidden = false;
  }

  function clearFormFeedback() {
    if (!formEls.feedback) return;
    formEls.feedback.textContent = '';
    formEls.feedback.hidden = true;
  }

  /* =========================================================
     Detalhes da venda
     ========================================================= */
  const detailEls = {};

  function setupDetailModal() {
    detailEls.modal  = document.getElementById('detail-modal');
    detailEls.title  = document.getElementById('detail-title');
    detailEls.status = document.getElementById('detail-status');
    detailEls.body   = document.getElementById('detail-body');
    if (!detailEls.modal) return;

    detailEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeDetailModal);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !detailEls.modal.hidden) closeDetailModal();
    });
  }

  async function openDetailModal(sale) {
    if (!detailEls.modal) return;

    detailEls.title.textContent = formatSaleNumber(sale);
    detailEls.status.innerHTML = '';
    detailEls.status.appendChild(buildStatusBadge(sale.status));
    detailEls.body.innerHTML =
      '<div class="state-block"><span class="spinner" aria-hidden="true"></span>' +
      '<p>Carregando detalhes...</p></div>';

    detailEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';

    const items = await fetchSaleItems(sale.id);

    renderDetail(sale, items || []);
  }

  function closeDetailModal() {
    if (!detailEls.modal) return;
    detailEls.modal.hidden = true;
    document.body.style.overflow = '';
  }

  async function fetchSaleItems(saleId) {
    if (!saleId) return [];

    const { data, error } = await window.db
      .from('sale_items')
      .select('*')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[DEV HUB] Falha ao carregar itens da venda:', error);
      return [];
    }
    return data || [];
  }

  function renderDetail(sale, items) {
    if (!detailEls.body) return;

    const fragment = document.createDocumentFragment();

    // --- Resumo ---
    const summary = document.createElement('section');
    summary.className = 'detail-section';

    const summaryTitle = document.createElement('h3');
    summaryTitle.className = 'detail-section__title';
    summaryTitle.textContent = 'Informações gerais';
    summary.appendChild(summaryTitle);

    const grid = document.createElement('div');
    grid.className = 'detail-grid';
    grid.appendChild(buildDetailItem('Cliente', customerNameOf(sale)));
    grid.appendChild(buildDetailItem('Data', formatDateTime(sale.created_at)));
    grid.appendChild(buildDetailItem('Forma de pagamento', paymentLabel(sale.payment_method)));
    grid.appendChild(buildDetailItem('Status', statusInfo(sale.status).label));
    summary.appendChild(grid);

    fragment.appendChild(summary);

    // --- Itens ---
    const itemsSection = document.createElement('section');
    itemsSection.className = 'detail-section';

    const itemsTitle = document.createElement('h3');
    itemsTitle.className = 'detail-section__title';
    itemsTitle.textContent = 'Produtos';
    itemsSection.appendChild(itemsTitle);

    if (!items || items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'cell--muted';
      empty.textContent = 'Nenhum item registrado para esta venda.';
      itemsSection.appendChild(empty);
    } else {
      const table = document.createElement('table');
      table.className = 'detail-items-table';

      const thead = document.createElement('thead');
      thead.innerHTML =
        '<tr>' +
        '<th scope="col">Produto</th>' +
        '<th scope="col" class="cell--num">Qtd</th>' +
        '<th scope="col" class="cell--num">Preço unit.</th>' +
        '<th scope="col" class="cell--num">Subtotal</th>' +
        '</tr>';
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      items.forEach(function (item) {
        const tr = document.createElement('tr');
        tr.appendChild(createCell(item.product_name || '—'));
        tr.appendChild(createCell(String(toInteger(item.quantity, 0)), 'cell--num'));
        tr.appendChild(createCell(formatMoney(item.unit_price), 'cell--num'));
        tr.appendChild(createCell(formatMoney(item.subtotal), 'cell--num'));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      itemsSection.appendChild(table);
    }

    fragment.appendChild(itemsSection);

    // --- Totais ---
    const totalsSection = document.createElement('section');
    totalsSection.className = 'detail-section';

    const totalsTitle = document.createElement('h3');
    totalsTitle.className = 'detail-section__title';
    totalsTitle.textContent = 'Totais';
    totalsSection.appendChild(totalsTitle);

    const totals = document.createElement('div');
    totals.className = 'detail-totals';
    totals.appendChild(buildTotalRow('Subtotal', formatMoney(sale.subtotal)));
    totals.appendChild(buildTotalRow('Desconto', '- ' + formatMoney(sale.discount)));
    totals.appendChild(buildTotalRow('Total', formatMoney(sale.total), true));
    totalsSection.appendChild(totals);

    fragment.appendChild(totalsSection);

    // --- Observações ---
    if (sale.notes && String(sale.notes).trim() !== '') {
      const notesSection = document.createElement('section');
      notesSection.className = 'detail-section';

      const notesTitle = document.createElement('h3');
      notesTitle.className = 'detail-section__title';
      notesTitle.textContent = 'Observações';
      notesSection.appendChild(notesTitle);

      const notesText = document.createElement('p');
      notesText.className = 'detail-grid__value';
      notesText.textContent = sale.notes;
      notesSection.appendChild(notesText);

      fragment.appendChild(notesSection);
    }

    detailEls.body.innerHTML = '';
    detailEls.body.appendChild(fragment);
  }

  function buildDetailItem(label, value) {
    const wrap = document.createElement('div');
    wrap.className = 'detail-grid__item';

    const l = document.createElement('span');
    l.className = 'detail-grid__label';
    l.textContent = label;

    const v = document.createElement('span');
    v.className = 'detail-grid__value';
    v.textContent = value;

    wrap.appendChild(l);
    wrap.appendChild(v);
    return wrap;
  }

  function buildTotalRow(label, value, isGrand) {
    const row = document.createElement('div');
    row.className = 'detail-totals__row' + (isGrand ? ' detail-totals__row--grand' : '');

    const l = document.createElement('span');
    l.textContent = label;

    const v = document.createElement('span');
    v.textContent = value;

    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  function buildStatusBadge(status) {
    const info = statusInfo(status);
    const badge = document.createElement('span');
    badge.className = 'badge ' + info.modifier;
    badge.textContent = info.label;
    return badge;
  }

  /* =========================================================
     Helpers de dados
     ========================================================= */
  function findProduct(id) {
    if (!id) return null;
    return state.products.find(function (p) { return p.id === id; }) || null;
  }

  function customerNameOf(sale) {
    const rel = sale.customers;
    if (rel) {
      const c = Array.isArray(rel) ? rel[0] : rel;
      if (c && c.name) return c.name;
    }
    return '—';
  }

  function paymentLabel(code) {
    if (!code) return '—';
    return PAYMENT_LABELS[code] || code;
  }

  function statusInfo(status) {
    const key = String(status || '').toLowerCase();
    return STATUS_LABELS[key] || { label: status || '—', modifier: '' };
  }

  function formatSaleNumber(sale) {
    if (!sale || sale.sale_number === null || sale.sale_number === undefined) return '—';
    return '#' + padNumber(sale.sale_number);
  }

  function formatSaleNumberSearch(sale) {
    if (!sale || sale.sale_number === null || sale.sale_number === undefined) return '';
    return String(sale.sale_number);
  }

  function padNumber(value) {
    const str = String(value);
    return str.length >= 6 ? str : '0'.repeat(6 - str.length) + str;
  }

  function formatMoney(value) {
    const number = toNumber(value, 0);
    return currencyFormatter.format(number);
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return dateFormatter.format(date);
  }

  /* =========================================================
     Helpers numéricos
     ========================================================= */
  function toNumber(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    const normalized = String(value).replace(',', '.').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function toInteger(value, fallback) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  /* =========================================================
     Erros
     ========================================================= */
  function mapSaleError(error) {
    console.error('[DEV HUB] Erro ao finalizar venda:', error);

    if (!error) return 'Não foi possível finalizar a venda. Tente novamente.';

    const message = String(error.message || '');
    const lower = message.toLowerCase();

    // Mensagens amigáveis vindas da nossa própria função RPC
    if (message.includes('Estoque insuficiente')) return message;
    if (message.includes('Produto não encontrado')) return message;
    if (message.includes('Produto indisponível')) return message;
    if (message.includes('pelo menos um produto')) return message;
    if (message.includes('Desconto não pode')) return message;
    if (message.includes('Total da venda não pode')) return message;
    if (message.includes('Quantidade inválida')) return message;

    if (lower.includes('failed to fetch') || lower.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    if (lower.includes('row-level security') || lower.includes('permission denied')) {
      return 'Você não tem permissão para finalizar vendas.';
    }
    if (lower.includes('function') && lower.includes('does not exist')) {
      return 'A função de finalização da venda não está disponível. Contate o suporte.';
    }

    return 'Não foi possível finalizar a venda. Tente novamente.';
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
     Utilidades
     ========================================================= */
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();