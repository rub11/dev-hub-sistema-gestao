/* =========================================================
   DEV HUB · Módulo de Vendas (avançado)
   ---------------------------------------------------------
   - Criação de venda (RPC create_sale)
   - Edição com senha + auditoria (RPC update_sale)
   - Exclusão com senha + auditoria (RPC delete_sale)
   - Busca de produto por nome/código/código de barras
     com sugestões e preview
   ========================================================= */

(function () {
  'use strict';

  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  });

  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

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

  const state = {
    // Lista
    sales: [],
    filtered: [],
    search: '',

    // Dados do formulário
    customers: null,
    products: null,
    cart: [],
    formDataLoaded: false,
    submitting: false,

    // Edição
    editingSaleId: null,

    // Busca de produto
    productQuery: '',
    productSuggestions: [],
    productSuggestionIndex: -1,
    pickedProduct: null,

    // Senha (callback pendente)
    pendingPasswordAction: null
  };

  document.addEventListener('DOMContentLoaded', init);

  /* =========================================================
     Init
     ========================================================= */
  async function init() {
    const Auth = window.Auth;

    if (!Auth || !Auth.isConfigured() || !window.db) {
      showGlobalAlert('Não foi possível conectar ao Supabase.', 'error');
      return;
    }

    setupSidebar();
    setupUserMenu();
    setupLogout();
    setupSearch();
    setupToolbar();
    setupFormView();
    setupSaleForm();
    setupProductSearch();
    setupDetailModal();
    setupAuditModal();
    setupPasswordModal();

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
      if (roleText) { roleBadge.textContent = roleText; roleBadge.hidden = false; }
      else { roleBadge.hidden = true; }
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
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    window.addEventListener('resize', function () { if (window.innerWidth >= 1024) close(); });
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
    function close() { panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); }

    trigger.addEventListener('click', function (e) { e.stopPropagation(); panel.hidden ? open() : close(); });
    document.addEventListener('click', function (e) {
      if (panel.hidden) return;
      if (panel.contains(e.target) || trigger.contains(e.target)) return;
      close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { close(); trigger.focus(); }
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
     Toolbar / busca da listagem
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
      state.filtered = state.sales.filter(function (s) {
        return matches(formatSaleNumberSearch(s), term) ||
               matches(customerNameOf(s), term) ||
               matches(s.created_by_name || '', term) ||
               matches(PAYMENT_LABELS[s.payment_method || ''] || s.payment_method, term);
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
    if (rows === null) rows = await fetchSalesWithoutJoin();

    showLoading(false);

    if (rows === null) {
      state.sales = [];
      state.filtered = [];
      showEmptyState('Não foi possível carregar as vendas.',
                     'Tente novamente em alguns instantes.', false);
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
      console.warn('[DEV HUB] Join falhou; tentando fallback.', error);
      return null;
    }
    return data || [];
  }

  async function fetchSalesWithoutJoin() {
    const { data, error } = await window.db
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { console.error('[DEV HUB] Falha ao carregar vendas:', error); return null; }

    const sales = data || [];
    const ids = sales.map(function (s) { return s.customer_id; }).filter(Boolean);
    if (ids.length === 0) return sales;

    const { data: customers, error: custErr } = await window.db
      .from('customers').select('id, name').in('id', ids);

    if (custErr) return sales;

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

    if (total === 0) { label.textContent = 'Nenhuma venda registrada'; return; }
    label.textContent = total === 1 ? '1 venda registrada' : total + ' vendas registradas';
  }

  /* =========================================================
     Render da tabela
     ========================================================= */
  function renderSalesTable() {
    const tbody = document.getElementById('sales-body');
    const tableWrap = document.getElementById('sales-table-wrap');
    if (!tbody || !tableWrap) return;

    if (state.sales.length === 0) {
      tableWrap.hidden = true;
      showEmptyState('Nenhuma venda registrada ainda.',
                     'Comece registrando sua primeira venda.', true);
      return;
    }
    if (state.filtered.length === 0) {
      tableWrap.hidden = true;
      showEmptyState('Nenhuma venda encontrada.',
                     'Ajuste a busca para encontrar a venda desejada.', false);
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
    row.appendChild(createCell(formatMoney(sale.total), 'cell--num cell-price'));
    row.appendChild(createCell(paymentLabel(sale.payment_method), 'cell--muted'));
    row.appendChild(buildStatusCell(sale.status));
    row.appendChild(createCell(sale.created_by_name || '—', 'cell--muted'));
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

    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'row-action';
    viewBtn.setAttribute('aria-label', 'Ver detalhes da venda ' + formatSaleNumber(sale));
    viewBtn.title = 'Ver detalhes';
    viewBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/>' +
      '<circle cx="12" cy="12" r="3"/></svg>';
    viewBtn.addEventListener('click', function () { openDetailModal(sale); });

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'row-action';
    editBtn.title = 'Editar venda';
    editBtn.setAttribute('aria-label', 'Editar venda ' + formatSaleNumber(sale));
    editBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 20h9"/>' +
      '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
    editBtn.addEventListener('click', function () { openEditSale(sale); });

    wrap.appendChild(viewBtn);
    wrap.appendChild(editBtn);
    cell.appendChild(wrap);
    return cell;
  }

  /* =========================================================
     Estados visuais
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
     View swap
     ========================================================= */
  function setupFormView() {
    const back = document.getElementById('back-to-list');
    const cancel = document.getElementById('cancel-sale');
    if (back) back.addEventListener('click', closeFormView);
    if (cancel) cancel.addEventListener('click', closeFormView);
  }

  async function openFormView() {
    state.editingSaleId = null;
    setFormMode('create');
    showView('form');
    if (!state.formDataLoaded) {
      await loadFormData();
    }
  }

  async function openEditSale(sale) {
    // Abre o formulário no modo edição DEPOIS de pedir a senha.
    // Aqui só carregamos os dados e trocamos a view; a validação
    // da senha acontece quando o usuário clica em "Salvar".
    state.editingSaleId = sale.id;

    showView('form');
    if (!state.formDataLoaded) {
      await loadFormData();
    }

    // Carrega os itens existentes
    const items = await fetchSaleItems(sale.id);

    state.cart = items.map(function (it) {
      return {
        product_id: it.product_id,
        product_name: it.product_name,
        unit_price: toNumber(it.unit_price, 0),
        quantity: toInteger(it.quantity, 0),
        subtotal: toNumber(it.subtotal, 0),
        stock_available: findProduct(it.product_id)?.stock ?? 0
      };
    });

    // Preenche o formulário
    formEls.customer.value = sale.customer_id || '';
    formEls.discount.value = String(toNumber(sale.discount, 0));
    formEls.payment.value = sale.payment_method || '';
    formEls.notes.value = sale.notes || '';

    setFormMode('edit', sale);
    renderCart();
    recalcTotals();
  }

  function setFormMode(mode, sale) {
    const isEdit = mode === 'edit';
    const title = document.querySelector('#view-form .page-head__title');
    const sub = document.querySelector('#view-form .page-head__sub');
    const submitLabel = formEls.submitBtn?.querySelector('.btn__label');

    if (title) title.textContent = isEdit ? 'Editar venda ' + formatSaleNumber(sale) : 'Nova venda';
    if (sub) sub.textContent = isEdit
      ? 'Alterações serão registradas no histórico com seu nome e horário.'
      : 'Selecione o cliente, adicione produtos e finalize.';
    if (submitLabel) submitLabel.textContent = isEdit ? 'Salvar alterações' : 'Finalizar venda';
  }

  function closeFormView() {
    if (state.submitting) return;
    resetSaleForm();
    state.editingSaleId = null;
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
     Carregar dados do formulário
     ========================================================= */
  async function loadFormData() {
    state.formDataLoaded = false;

    const [customersRes, productsRes] = await Promise.all([
      window.db.from('customers').select('id, name').order('name', { ascending: true }),
      window.db.from('products')
        .select('id, name, code, barcode, description, image_url, price, stock, minimum_stock, active')
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
    state.formDataLoaded = true;
  }

  function populateCustomerSelect() {
    const select = document.getElementById('sale-customer');
    if (!select) return;
    while (select.options.length > 1) select.remove(1);

    state.customers.forEach(function (c) {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.name || '(sem nome)';
      select.appendChild(option);
    });
  }

  /* =========================================================
     Formulário: bindings básicos
     ========================================================= */
  const formEls = {};

  function setupSaleForm() {
    formEls.form      = document.getElementById('sale-form');
    formEls.customer  = document.getElementById('sale-customer');
    formEls.cartBody  = document.getElementById('cart-body');
    formEls.cartWrap  = document.getElementById('cart-wrap');
    formEls.cartEmpty = document.getElementById('cart-empty');
    formEls.discount  = document.getElementById('sale-discount');
    formEls.totalSub  = document.getElementById('total-subtotal');
    formEls.totalTotal= document.getElementById('total-total');
    formEls.payment   = document.getElementById('sale-payment');
    formEls.notes     = document.getElementById('sale-notes');
    formEls.feedback  = document.getElementById('sale-form-feedback');
    formEls.submitBtn = document.getElementById('submit-sale-btn');

    if (!formEls.form) return;

    formEls.discount.addEventListener('input', recalcTotals);
    formEls.form.addEventListener('submit', onSubmitSale);
  }

  /* =========================================================
     BUSCA DE PRODUTOS
     ========================================================= */
  const searchEls = {};

  function setupProductSearch() {
    searchEls.wrap         = document.getElementById('product-search-wrap');
    searchEls.input        = document.getElementById('product-search-input');
    searchEls.clear        = document.getElementById('product-search-clear');
    searchEls.suggestions  = document.getElementById('product-suggestions');
    searchEls.pick         = document.getElementById('product-pick');
    searchEls.pickImage    = document.getElementById('product-pick-image');
    searchEls.pickPlaceholder = document.getElementById('product-pick-placeholder');
    searchEls.pickName     = document.getElementById('product-pick-name');
    searchEls.pickDesc     = document.getElementById('product-pick-desc');
    searchEls.pickPrice    = document.getElementById('product-pick-price');
    searchEls.pickStock    = document.getElementById('product-pick-stock');
    searchEls.pickCode     = document.getElementById('product-pick-code');
    searchEls.pickBarcode  = document.getElementById('product-pick-barcode');
    searchEls.pickQty      = document.getElementById('product-pick-qty');
    searchEls.pickAdd      = document.getElementById('product-pick-add');
    searchEls.pickClose    = document.getElementById('product-pick-close');

    if (!searchEls.input) return;

    searchEls.input.addEventListener('input', function () {
      state.productQuery = searchEls.input.value.trim();
      runProductSearch();
    });

    searchEls.input.addEventListener('focus', function () {
      if (state.productQuery) runProductSearch();
    });

    searchEls.input.addEventListener('keydown', onSearchKeydown);

    document.addEventListener('click', function (e) {
      if (searchEls.suggestions.hidden) return;
      if (searchEls.wrap.contains(e.target)) return;
      closeSuggestions();
    });

    searchEls.clear.addEventListener('click', clearProductSearch);
    searchEls.pickClose.addEventListener('click', closeProductPick);
    searchEls.pickAdd.addEventListener('click', addPickedProduct);
  }

  function runProductSearch() {
    const q = state.productQuery.toLowerCase();

    if (!q) {
      closeSuggestions();
      searchEls.clear.hidden = true;
      return;
    }

    searchEls.clear.hidden = false;

    const items = state.products.filter(function (p) {
      return matches(p.name, q) ||
             matches(p.code, q) ||
             matches(p.barcode, q) ||
             matches(p.description, q);
    }).slice(0, 20);

    state.productSuggestions = items;
    state.productSuggestionIndex = items.length > 0 ? 0 : -1;

    renderSuggestions(items, q);
  }

  function renderSuggestions(items, query) {
    const ul = searchEls.suggestions;
    if (!ul) return;

    ul.innerHTML = '';

    if (items.length === 0) {
      const li = document.createElement('li');
      li.className = 'product-suggestions__empty';
      li.textContent = 'Nenhum produto encontrado para "' + query + '".';
      ul.appendChild(li);
      ul.hidden = false;
      searchEls.input.setAttribute('aria-expanded', 'true');
      return;
    }

    items.forEach(function (p, idx) {
      const li = document.createElement('li');
      li.className = 'product-suggestions__item';
      li.setAttribute('role', 'option');
      li.dataset.id = p.id;
      if (idx === state.productSuggestionIndex) li.setAttribute('aria-selected', 'true');

      // Thumb
      const thumb = document.createElement('div');
      thumb.className = 'product-suggestions__thumb';
      if (p.image_url) {
        const img = document.createElement('img');
        img.src = p.image_url;
        img.alt = '';
        img.loading = 'lazy';
        thumb.appendChild(img);
      } else {
        thumb.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"' +
          ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="m21 8-9-5-9 5v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 21v-8"/></svg>';
      }

      // Info
      const info = document.createElement('div');
      info.className = 'product-suggestions__info';

      const name = document.createElement('div');
      name.className = 'product-suggestions__name';
      name.textContent = p.name || '(sem nome)';

      const meta = document.createElement('div');
      meta.className = 'product-suggestions__meta';
      const parts = [];
      if (p.barcode) parts.push('EAN ' + p.barcode);
      else if (p.code) parts.push('Cód. ' + p.code);
      parts.push(formatMoney(p.price));
      meta.textContent = parts.join(' · ');

      info.appendChild(name);
      info.appendChild(meta);

      li.appendChild(thumb);
      li.appendChild(info);

      li.addEventListener('mouseenter', function () {
        state.productSuggestionIndex = idx;
        highlightSuggestion();
      });
      li.addEventListener('mousedown', function (e) {
        e.preventDefault(); // não fecha o input
      });
      li.addEventListener('click', function () {
        pickProduct(p);
      });

      ul.appendChild(li);
    });

    ul.hidden = false;
    searchEls.input.setAttribute('aria-expanded', 'true');
  }

  function highlightSuggestion() {
    const ul = searchEls.suggestions;
    if (!ul) return;
    Array.prototype.forEach.call(ul.children, function (li, idx) {
      if (idx === state.productSuggestionIndex) li.setAttribute('aria-selected', 'true');
      else li.removeAttribute('aria-selected');
    });
  }

  function onSearchKeydown(e) {
    if (searchEls.suggestions.hidden) {
      if (e.key === 'ArrowDown') { runProductSearch(); e.preventDefault(); }
      return;
    }

    const len = state.productSuggestions.length;
    if (e.key === 'ArrowDown') {
      state.productSuggestionIndex = (state.productSuggestionIndex + 1) % Math.max(1, len);
      highlightSuggestion();
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      state.productSuggestionIndex = (state.productSuggestionIndex - 1 + Math.max(1, len)) % Math.max(1, len);
      highlightSuggestion();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const item = state.productSuggestions[state.productSuggestionIndex];
      if (item) { pickProduct(item); e.preventDefault(); }
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
  }

  function closeSuggestions() {
    if (!searchEls.suggestions) return;
    searchEls.suggestions.hidden = true;
    searchEls.input.setAttribute('aria-expanded', 'false');
  }

  function clearProductSearch() {
    if (!searchEls.input) return;
    searchEls.input.value = '';
    state.productQuery = '';
    state.productSuggestions = [];
    state.productSuggestionIndex = -1;
    searchEls.clear.hidden = true;
    closeSuggestions();
    closeProductPick();
    searchEls.input.focus();
  }

  function pickProduct(product) {
    state.pickedProduct = product;
    closeSuggestions();
    searchEls.input.value = product.name || '';
    state.productQuery = product.name || '';
    searchEls.clear.hidden = false;

    // Preenche o preview
    searchEls.pickName.textContent = product.name || '—';
    searchEls.pickDesc.textContent = product.description || 'Sem descrição cadastrada.';
    searchEls.pickPrice.textContent = formatMoney(product.price);
    searchEls.pickStock.textContent = String(toInteger(product.stock, 0));
    searchEls.pickCode.textContent = product.code || '—';
    searchEls.pickBarcode.textContent = product.barcode || '—';
    searchEls.pickQty.value = '1';

    // Imagem
    if (product.image_url) {
      searchEls.pickImage.src = product.image_url;
      searchEls.pickImage.hidden = false;
      searchEls.pickPlaceholder.hidden = true;
    } else {
      searchEls.pickImage.hidden = true;
      searchEls.pickPlaceholder.hidden = false;
    }

    searchEls.pick.hidden = false;

    const stock = toInteger(product.stock, 0);
    searchEls.pickAdd.disabled = stock === 0;
    if (stock === 0) {
      searchEls.pickQty.value = '0';
    }
  }

  function closeProductPick() {
    state.pickedProduct = null;
    if (searchEls.pick) searchEls.pick.hidden = true;
  }

  function addPickedProduct() {
    const product = state.pickedProduct;
    if (!product) return;

    const stock = toInteger(product.stock, 0);
    const qty = toInteger(searchEls.pickQty.value, 0);

    if (qty <= 0) {
      showFormFeedback('Informe uma quantidade válida.');
      searchEls.pickQty.focus();
      return;
    }

    const existing = state.cart.find(function (i) { return i.product_id === product.id; });
    const alreadyQty = existing ? existing.quantity : 0;

    if (alreadyQty + qty > stock) {
      showFormFeedback('Estoque insuficiente para "' + product.name + '".');
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
    clearProductSearch();
    renderCart();
    recalcTotals();
  }

  /* =========================================================
     Carrinho
     ========================================================= */
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

  function recalcTotals() {
    const subtotal = state.cart.reduce(function (sum, item) {
      return sum + toNumber(item.subtotal, 0);
    }, 0);

    let discount = toNumber(formEls.discount.value, 0);
    if (!Number.isFinite(discount) || discount < 0) discount = 0;
    if (discount > subtotal) {
      discount = subtotal;
      formEls.discount.value = String(round2(discount));
    }

    const total = Math.max(0, round2(subtotal - discount));
    formEls.totalSub.textContent = formatMoney(subtotal);
    formEls.totalTotal.textContent = formatMoney(total);
  }

  function resetSaleForm() {
    if (!formEls.form) return;

    formEls.form.reset();
    formEls.customer.value = '';
    formEls.discount.value = '0';
    formEls.payment.value = '';
    formEls.notes.value = '';
    state.cart = [];

    clearFormFeedback();
    clearProductSearch();
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
     Submit: criar OU editar
     ========================================================= */
  async function onSubmitSale(event) {
    event.preventDefault();
    if (state.submitting) return;

    clearFormFeedback();

    if (state.cart.length === 0) {
      showFormFeedback('Adicione pelo menos um produto à venda.');
      return;
    }

    for (let i = 0; i < state.cart.length; i += 1) {
      const item = state.cart[i];
      if (item.quantity <= 0) { showFormFeedback('Quantidade inválida.'); return; }
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
    if (total < 0) { showFormFeedback('O total não pode ser negativo.'); return; }

    const payload = {
      customer_id: formEls.customer.value || null,
      subtotal: subtotal,
      discount: round2(discount),
      total: total,
      payment_method: formEls.payment.value || '',
      notes: formEls.notes.value.trim() || '',
      items: state.cart.map(function (item) {
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: round2(item.unit_price),
          subtotal: round2(item.subtotal)
        };
      })
    };

    if (state.editingSaleId) {
      // Edição → pede a senha antes
      requestPassword(
        'Para salvar as alterações da venda ' + formatSaleNumber({ sale_number: state.editingSaleId }) +
        ', confirme sua senha. A alteração fica registrada no histórico.',
        async function (pwd) {
          await submitEditSale(payload, pwd);
        }
      );
      return;
    }

    // Criação
    await submitCreateSale(payload);
  }

  async function submitCreateSale(payload) {
    setSubmitting(true);
    try {
      const { data, error } = await window.db.rpc('create_sale', {
        p_customer_id: payload.customer_id,
        p_subtotal: payload.subtotal,
        p_discount: payload.discount,
        p_total: payload.total,
        p_payment_method: payload.payment_method,
        p_notes: payload.notes,
        p_items: payload.items
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      const saleNumber = result && result.sale_number;

      resetSaleForm();
      state.editingSaleId = null;
      showView('list');

      state.formDataLoaded = false;
      await loadSales();

      showToast(
        saleNumber
          ? 'Venda #' + padNumber(saleNumber) + ' registrada.'
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

  async function submitEditSale(payload, password) {
    setSubmitting(true);
    try {
      const { error } = await window.db.rpc('update_sale', {
        p_sale_id: state.editingSaleId,
        p_password: password,
        p_customer_id: payload.customer_id,
        p_subtotal: payload.subtotal,
        p_discount: payload.discount,
        p_total: payload.total,
        p_payment_method: payload.payment_method,
        p_notes: payload.notes,
        p_items: payload.items
      });

      if (error) throw error;

      resetSaleForm();
      state.editingSaleId = null;
      showView('list');

      state.formDataLoaded = false;
      await loadSales();

      showToast('Venda atualizada com sucesso.', 'success');
    } catch (error) {
      console.error('[DEV HUB] Falha ao atualizar venda:', error);
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
      if (label) {
        label.textContent = isSubmitting
          ? (state.editingSaleId ? 'Salvando...' : 'Finalizando...')
          : (state.editingSaleId ? 'Salvar alterações' : 'Finalizar venda');
      }
    }
  }

  /* =========================================================
     Modal: DETALHE
     ========================================================= */
  const detailEls = {};

  function setupDetailModal() {
    detailEls.modal  = document.getElementById('detail-modal');
    detailEls.title  = document.getElementById('detail-title');
    detailEls.status = document.getElementById('detail-status');
    detailEls.body   = document.getElementById('detail-body');
    detailEls.editBtn = document.getElementById('detail-edit-btn');
    detailEls.delBtn  = document.getElementById('detail-delete-btn');
    detailEls.auditBtn = document.getElementById('detail-audit-btn');
    if (!detailEls.modal) return;

    detailEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeDetailModal);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !detailEls.modal.hidden) closeDetailModal();
    });

    detailEls.editBtn.addEventListener('click', function () {
      const sale = detailEls.modal.__sale;
      if (!sale) return;
      closeDetailModal();
      openEditSale(sale);
    });

    detailEls.delBtn.addEventListener('click', function () {
      const sale = detailEls.modal.__sale;
      if (!sale) return;
      closeDetailModal();
      requestPassword(
        'Excluir a venda ' + formatSaleNumber(sale) + '? A ação devolve o estoque ' +
        'e fica registrada no histórico com seu nome e horário.',
        function (pwd) { executeDeleteSale(sale, pwd); }
      );
    });

    detailEls.auditBtn.addEventListener('click', function () {
      const sale = detailEls.modal.__sale;
      if (!sale) return;
      openAuditModal(sale);
    });
  }

  async function openDetailModal(sale) {
    if (!detailEls.modal) return;

    detailEls.modal.__sale = sale;

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
    detailEls.modal.__sale = null;
  }

  async function fetchSaleItems(saleId) {
    if (!saleId) return [];
    const { data, error } = await window.db
      .from('sale_items').select('*').eq('sale_id', saleId)
      .order('created_at', { ascending: true });
    if (error) { console.error('[DEV HUB] Erro ao carregar itens:', error); return []; }
    return data || [];
  }

  function renderDetail(sale, items) {
    if (!detailEls.body) return;
    const frag = document.createDocumentFragment();

    // Resumo
    const s1 = document.createElement('section');
    s1.className = 'detail-section';
    s1.innerHTML = '<h3 class="detail-section__title">Informações gerais</h3>';
    const grid = document.createElement('div');
    grid.className = 'detail-grid';
    grid.appendChild(buildDetailItem('Cliente', customerNameOf(sale)));
    grid.appendChild(buildDetailItem('Data', formatDateTime(sale.created_at)));
    grid.appendChild(buildDetailItem('Pagamento', paymentLabel(sale.payment_method)));
    grid.appendChild(buildDetailItem('Status', statusInfo(sale.status).label));
    grid.appendChild(buildDetailItem('Criada por', sale.created_by_name || '—'));
    if (sale.updated_by_name || sale.updated_at) {
      grid.appendChild(buildDetailItem(
        'Última alteração',
        (sale.updated_by_name || '—') + ' · ' + formatDateTime(sale.updated_at)
      ));
    }
    s1.appendChild(grid);
    frag.appendChild(s1);

    // Itens
    const s2 = document.createElement('section');
    s2.className = 'detail-section';
    s2.innerHTML = '<h3 class="detail-section__title">Produtos</h3>';

    if (!items || items.length === 0) {
      const p = document.createElement('p');
      p.className = 'cell--muted';
      p.textContent = 'Nenhum item.';
      s2.appendChild(p);
    } else {
      const table = document.createElement('table');
      table.className = 'detail-items-table';
      table.innerHTML =
        '<thead><tr>' +
        '<th>Produto</th><th class="cell--num">Qtd</th>' +
        '<th class="cell--num">Preço unit.</th><th class="cell--num">Subtotal</th>' +
        '</tr></thead>';
      const tb = document.createElement('tbody');
      items.forEach(function (it) {
        const tr = document.createElement('tr');
        tr.appendChild(createCell(it.product_name || '—'));
        tr.appendChild(createCell(String(toInteger(it.quantity, 0)), 'cell--num'));
        tr.appendChild(createCell(formatMoney(it.unit_price), 'cell--num'));
        tr.appendChild(createCell(formatMoney(it.subtotal), 'cell--num'));
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      s2.appendChild(table);
    }
    frag.appendChild(s2);

    // Totais
    const s3 = document.createElement('section');
    s3.className = 'detail-section';
    s3.innerHTML = '<h3 class="detail-section__title">Totais</h3>';
    const totals = document.createElement('div');
    totals.className = 'detail-totals';
    totals.appendChild(buildTotalRow('Subtotal', formatMoney(sale.subtotal)));
    totals.appendChild(buildTotalRow('Desconto', '- ' + formatMoney(sale.discount)));
    totals.appendChild(buildTotalRow('Total', formatMoney(sale.total), true));
    s3.appendChild(totals);
    frag.appendChild(s3);

    // Notas
    if (sale.notes && String(sale.notes).trim() !== '') {
      const s4 = document.createElement('section');
      s4.className = 'detail-section';
      s4.innerHTML = '<h3 class="detail-section__title">Observações</h3>';
      const p = document.createElement('p');
      p.className = 'detail-grid__value';
      p.textContent = sale.notes;
      s4.appendChild(p);
      frag.appendChild(s4);
    }

    detailEls.body.innerHTML = '';
    detailEls.body.appendChild(frag);
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
    wrap.appendChild(l); wrap.appendChild(v);
    return wrap;
  }

  function buildTotalRow(label, value, isGrand) {
    const row = document.createElement('div');
    row.className = 'detail-totals__row' + (isGrand ? ' detail-totals__row--grand' : '');
    const l = document.createElement('span'); l.textContent = label;
    const v = document.createElement('span'); v.textContent = value;
    row.appendChild(l); row.appendChild(v);
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
     Modal: HISTÓRICO (auditoria)
     ========================================================= */
  const auditEls = {};

  function setupAuditModal() {
    auditEls.modal = document.getElementById('audit-modal');
    auditEls.body  = document.getElementById('audit-body');
    if (!auditEls.modal) return;

    auditEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeAuditModal);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !auditEls.modal.hidden) closeAuditModal();
    });
  }

  async function openAuditModal(sale) {
    auditEls.body.innerHTML =
      '<div class="state-block"><span class="spinner" aria-hidden="true"></span>' +
      '<p>Carregando histórico...</p></div>';
    auditEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';

    const { data, error } = await window.db
      .from('sale_audit')
      .select('*')
      .eq('sale_id', sale.id)
      .order('created_at', { ascending: false });

    if (error) {
      auditEls.body.innerHTML =
        '<div class="state-block"><p>Não foi possível carregar o histórico.</p></div>';
      return;
    }

    renderAudit(data || []);
  }

  function closeAuditModal() {
    auditEls.modal.hidden = true;
    document.body.style.overflow = '';
  }

  function renderAudit(rows) {
    auditEls.body.innerHTML = '';

    if (rows.length === 0) {
      auditEls.body.innerHTML = '<div class="state-block"><p>Nenhuma alteração registrada.</p></div>';
      return;
    }

    const list = document.createElement('div');
    list.className = 'audit-list';

    rows.forEach(function (a) {
      const wrap = document.createElement('div');
      wrap.className = 'audit-item';

      const head = document.createElement('div');
      head.className = 'audit-item__head';

      const act = document.createElement('span');
      act.className = 'audit-item__action';
      act.textContent = auditActionLabel(a.action);

      const when = document.createElement('span');
      when.className = 'audit-item__when';
      when.textContent = formatDateTime(a.created_at);

      head.appendChild(act);
      head.appendChild(when);

      const who = document.createElement('p');
      who.className = 'audit-item__who';
      who.textContent = 'Por ' + (a.actor_name || a.actor_email || '—');

      wrap.appendChild(head);
      wrap.appendChild(who);

      if (a.changes && typeof a.changes === 'object') {
        const diff = document.createElement('div');
        diff.className = 'audit-item__diff';
        diff.textContent = formatChanges(a.changes);
        wrap.appendChild(diff);
      }

      list.appendChild(wrap);
    });

    auditEls.body.appendChild(list);
  }

  function auditActionLabel(action) {
    if (action === 'created') return 'Venda criada';
    if (action === 'updated') return 'Venda alterada';
    if (action === 'deleted') return 'Venda excluída';
    return action;
  }

  function formatChanges(changes) {
    const lines = [];
    Object.keys(changes).forEach(function (k) {
      const c = changes[k];
      if (c && typeof c === 'object' && ('from' in c || 'to' in c)) {
        const from = c.from === null || c.from === undefined ? '—' : String(c.from);
        const to = c.to === null || c.to === undefined ? '—' : String(c.to);
        if (from !== to) lines.push(k + ': ' + from + ' → ' + to);
      }
    });
    return lines.length === 0 ? '(sem alterações de cabeçalho)' : lines.join('\n');
  }

  /* =========================================================
     Modal: CONFIRMAR SENHA
     ========================================================= */
  const pwdEls = {};

  function setupPasswordModal() {
    pwdEls.modal   = document.getElementById('pwd-modal');
    pwdEls.form    = document.getElementById('pwd-form');
    pwdEls.hint    = document.getElementById('pwd-hint');
    pwdEls.input   = document.getElementById('pwd-input');
    pwdEls.feedback= document.getElementById('pwd-feedback');
    pwdEls.confirm = document.getElementById('pwd-confirm-btn');
    if (!pwdEls.modal) return;

    pwdEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closePasswordModal);
    });

    pwdEls.modal.querySelectorAll('[data-pw-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const input = document.getElementById(btn.getAttribute('data-pw-toggle'));
        if (!input) return;
        const visible = input.type === 'text';
        input.type = visible ? 'password' : 'text';
        btn.setAttribute('aria-pressed', String(!visible));
        input.focus({ preventScroll: true });
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !pwdEls.modal.hidden) closePasswordModal();
    });

    pwdEls.form.addEventListener('submit', function (e) {
      e.preventDefault();
      const pwd = pwdEls.input.value;
      if (!pwd) {
        showPwdFeedback('Informe sua senha.');
        pwdEls.input.focus();
        return;
      }
      const cb = state.pendingPasswordAction;
      state.pendingPasswordAction = null;
      closePasswordModal();
      if (cb) cb(pwd);
    });
  }

  /**
   * Pede a senha do usuário logado e chama `onConfirm(password)`.
   */
  function requestPassword(hint, onConfirm) {
    state.pendingPasswordAction = onConfirm;
    pwdEls.hint.textContent = hint;
    pwdEls.form.reset();
    clearPwdFeedback();
    setPwdBusy(false);
    pwdEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () { pwdEls.input.focus(); }, 50);
  }

  function closePasswordModal() {
    if (state.pendingPasswordAction === null) {
      pwdEls.modal.hidden = true;
      document.body.style.overflow = '';
      return;
    }
    // Cancelou
    state.pendingPasswordAction = null;
    pwdEls.modal.hidden = true;
    document.body.style.overflow = '';
  }

  function setPwdBusy(busy) {
    if (pwdEls.confirm) {
      pwdEls.confirm.disabled = busy;
      pwdEls.confirm.classList.toggle('is-loading', busy);
      const lbl = pwdEls.confirm.querySelector('.btn__label');
      if (lbl) lbl.textContent = busy ? 'Verificando...' : 'Confirmar';
    }
    if (pwdEls.input) pwdEls.input.readOnly = busy;
  }

  function showPwdFeedback(msg) {
    pwdEls.feedback.textContent = msg;
    pwdEls.feedback.hidden = false;
  }
  function clearPwdFeedback() {
    pwdEls.feedback.textContent = '';
    pwdEls.feedback.hidden = true;
  }

  /* =========================================================
     Executar exclusão (com senha)
     ========================================================= */
  async function executeDeleteSale(sale, password) {
    try {
      const { error } = await window.db.rpc('delete_sale', {
        p_sale_id: sale.id,
        p_password: password
      });
      if (error) throw error;

      showToast('Venda excluída com sucesso.', 'success');
      state.formDataLoaded = false;
      await loadSales();
    } catch (error) {
      console.error('[DEV HUB] Falha ao excluir venda:', error);
      showToast(mapSaleError(error), 'error');
    }
  }

  /* =========================================================
     Helpers de dados
     ========================================================= */
  function findProduct(id) {
    if (!id) return null;
    return state.products ? state.products.find(function (p) { return p.id === id; }) || null : null;
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
    return currencyFormatter.format(toNumber(value, 0));
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return dateFormatter.format(date);
  }

  function toNumber(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    const n = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(n) ? n : fallback;
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
    if (!error) return 'Não foi possível concluir a operação. Tente novamente.';
    const message = String(error.message || '');
    const code    = String(error.code || '');
    const lower   = message.toLowerCase();

    // Mensagens amigáveis vindas das RPCs
    if (message.includes('Senha incorreta')) return 'Senha incorreta. Tente novamente.';
    if (message.includes('Estoque insuficiente')) return message;
    if (message.includes('Produto não encontrado')) return message;
    if (message.includes('Produto indisponível')) return message;
    if (message.includes('pelo menos um produto')) return message;
    if (message.includes('Desconto não pode')) return message;
    if (message.includes('Total da venda não pode')) return message;
    if (message.includes('Quantidade inválida')) return message;
    if (message.includes('Sessão inválida')) return message;
    if (message.includes('Venda não encontrada')) return message;
    if (message.includes('Venda não pertence')) return message;

    if (lower.includes('failed to fetch') || lower.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    if (lower.includes('row-level security') || lower.includes('permission denied') || code === '42501') {
      return 'Você não tem permissão para executar esta ação.';
    }
    if ((lower.includes('could not find') && lower.includes('function')) ||
        (lower.includes('function') && lower.includes('does not exist')) ||
        code === 'PGRST202') {
      return 'A função não está instalada no banco. Contate o suporte.';
    }
    if (code === '23502' || lower.includes('violates not-null')) {
      return 'Algum campo obrigatório não foi preenchido.';
    }

    return 'Não foi possível concluir a operação. (' + (message || code || '?') + ')';
  }

  /* =========================================================
     Toasts
     ========================================================= */
  const TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>'
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
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
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
})();