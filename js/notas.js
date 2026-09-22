/* =========================================================
   DEV HUB · Módulo de Notas
   ---------------------------------------------------------
   Documentos internos de venda. NÃO é NF-e fiscal.
   Usa apenas window.db (cliente já criado em js/supabase.js).
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
    customers: {},
    filtered: [],
    search: '',
    statusFilter: '',
    periodFilter: 'all',
    customStart: '',
    customEnd: '',
    loading: false,
    currentSaleId: null
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
    setupFilters();
    setupModal();

    // Verificação de sessão (getUser) — se não houver usuário, volta pro login
    try {
      const result = await window.db.auth.getUser();
      const user = result && result.data ? result.data.user : null;

      if (!user) {
        window.location.replace('index.html');
        return;
      }

      const profile = Auth.getProfile
        ? await Auth.getProfile(user.id)
        : null;
      renderUser(user, profile);
    } catch (error) {
      console.error('[DEV HUB] Falha ao verificar sessão:', error);
      window.location.replace('index.html');
      return;
    }

    watchAuthChanges();

    // Define datas padrão do período personalizado
    const now = new Date();
    state.customStart = toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
    state.customEnd = toDateInput(now);
    setInputValue('notas-start', state.customStart);
    setInputValue('notas-end', state.customEnd);

    await loadNotas();
  }

  /* =========================================================
     Sessão / usuário
     ========================================================= */
  function watchAuthChanges() {
    window.db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT' && window.Auth && !window.Auth.isSigningOut()) {
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
     Busca e filtros
     ========================================================= */
  function setupSearch() {
    const input = document.getElementById('notas-search');
    if (!input) return;

    input.addEventListener('input', function () {
      state.search = input.value.trim().toLowerCase();
      applyFilters();
    });
  }

  function setupFilters() {
    const statusSelect = document.getElementById('notas-status-filter');
    const periodSelect = document.getElementById('notas-period-filter');
    const customBox = document.getElementById('custom-period');
    const applyBtn = document.getElementById('notas-apply-period');

    if (statusSelect) {
      statusSelect.addEventListener('change', function () {
        state.statusFilter = statusSelect.value;
        applyFilters();
      });
    }

    if (periodSelect) {
      periodSelect.addEventListener('change', function () {
        state.periodFilter = periodSelect.value;
        if (customBox) customBox.hidden = state.periodFilter !== 'custom';
        if (state.periodFilter !== 'custom') applyFilters();
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        const start = getInputValue('notas-start');
        const end = getInputValue('notas-end');

        if (!start || !end) {
          showToast('Informe a data inicial e a data final.', 'error');
          return;
        }
        if (start > end) {
          showToast('A data inicial não pode ser maior que a final.', 'error');
          return;
        }

        state.customStart = start;
        state.customEnd = end;
        applyFilters();
      });
    }
  }

  function applyFilters() {
    let list = state.sales.slice();

    // Status
    if (state.statusFilter) {
      list = list.filter(function (sale) {
        return normalizeStatus(sale.status) === state.statusFilter;
      });
    }

    // Período
    const range = getPeriodRange();
    if (range) {
      list = list.filter(function (sale) {
        const d = new Date(sale.created_at);
        return d >= range.start && d <= range.end;
      });
    }

    // Busca (número, cliente, cpf/cnpj)
    if (state.search) {
      const term = state.search;
      list = list.filter(function (sale) {
        return matches(formatSaleNumberSearch(sale), term) ||
               matches(customerNameOf(sale), term) ||
               matches(customerDocumentOf(sale), term);
      });
    }

    state.filtered = list;
    renderTable();
    updateCountLabel();
  }

  function getPeriodRange() {
    const now = new Date();
    const filter = state.periodFilter;

    if (filter === 'all') return null;

    if (filter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
    if (filter === '7d') {
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    if (filter === '30d') {
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    if (filter === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
    if (filter === 'custom') {
      if (!state.customStart || !state.customEnd) return null;
      const start = new Date(state.customStart + 'T00:00:00');
      const end = new Date(state.customEnd + 'T23:59:59.999');
      return { start, end };
    }
    return null;
  }

  /* =========================================================
     Carregamento
     ========================================================= */
  async function loadNotas() {
    if (state.loading) return;
    state.loading = true;

    showLoading(true);

    try {
      // 1) Vendas (com join opcional em customers)
      let sales = await fetchSalesWithJoin();
      if (sales === null) {
        sales = await fetchSalesWithoutJoin();
      }
      if (sales === null) throw new Error('Falha ao carregar as vendas.');

      state.sales = sales;

      // 2) Mapa de clientes (para busca por CPF/CNPJ e para o modal)
      await loadCustomersMap();

      applyFilters();
    } catch (error) {
      console.error('[DEV HUB] Falha ao carregar notas:', error);
      state.sales = [];
      state.filtered = [];
      showEmptyState(
        'Não foi possível carregar as notas.',
        'Tente novamente em alguns instantes.'
      );
      updateCountLabel();
      showToast('Não foi possível carregar as notas.', 'error');
    } finally {
      state.loading = false;
      showLoading(false);
    }
  }

  async function fetchSalesWithJoin() {
    const { data, error } = await window.db
      .from('sales')
      .select('*, customers(name, cpf_cnpj, phone, email)')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[DEV HUB] Consulta com join falhou. Tentando fallback.', error);
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
    return data || [];
  }

  async function loadCustomersMap() {
    // Carrega todos os clientes referenciados
    const ids = Array.from(new Set(
      state.sales
        .map(function (s) { return s.customer_id; })
        .filter(Boolean)
    ));

    state.customers = {};
    if (ids.length === 0) return;

    const { data, error } = await window.db
      .from('customers')
      .select('id, name, cpf_cnpj, phone, email')
      .in('id', ids);

    if (error) {
      console.warn('[DEV HUB] Falha ao carregar clientes para o mapa.', error);
      return;
    }

    (data || []).forEach(function (c) {
      state.customers[c.id] = c;
    });
  }

  /* =========================================================
     Renderização da tabela
     ========================================================= */
  function renderTable() {
    const tbody = document.getElementById('notas-body');
    const wrap = document.getElementById('notas-table-wrap');
    if (!tbody || !wrap) return;

    if (state.sales.length === 0) {
      wrap.hidden = true;
      showEmptyState(
        'Nenhuma nota registrada ainda.',
        'As notas aparecem automaticamente quando você registra vendas.'
      );
      return;
    }

    if (state.filtered.length === 0) {
      wrap.hidden = true;
      showEmptyState(
        'Nenhuma nota encontrada.',
        'Ajuste a busca ou os filtros para encontrar o documento desejado.'
      );
      return;
    }

    hideEmptyState();
    wrap.hidden = false;
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    state.filtered.forEach(function (sale) {
      fragment.appendChild(buildRow(sale));
    });
    tbody.appendChild(fragment);
  }

  function buildRow(sale) {
    const row = document.createElement('tr');
    row.dataset.id = sale.id || '';

    row.appendChild(createCell(formatSaleNumber(sale), 'sale-number'));
    row.appendChild(createCell(customerNameOf(sale), 'cell--muted'));
    row.appendChild(createCell(formatDateTime(sale.created_at), 'cell--muted'));
    row.appendChild(createCell(formatMoney(sale.total), 'cell--num cell-price'));
    row.appendChild(createCell(paymentLabel(sale.payment_method), 'cell--muted'));
    row.appendChild(buildStatusCell(sale.status));
    row.appendChild(buildActionsCell(sale));

    return row;
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
    viewBtn.setAttribute('aria-label', 'Visualizar nota ' + formatSaleNumber(sale));
    viewBtn.title = 'Visualizar';
    viewBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/>' +
      '<circle cx="12" cy="12" r="3"/></svg>';
    viewBtn.addEventListener('click', function () { openNotaModal(sale); });

    wrap.appendChild(viewBtn);
    cell.appendChild(wrap);
    return cell;
  }

  /* =========================================================
     Estados visuais
     ========================================================= */
  function showLoading(isLoading) {
    const loading = document.getElementById('notas-loading');
    const wrap = document.getElementById('notas-table-wrap');
    const empty = document.getElementById('notas-empty');
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
    const empty = document.getElementById('notas-empty');
    const titleEl = document.getElementById('notas-empty-title');
    const textEl = document.getElementById('notas-empty-text');
    if (!empty) return;

    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    empty.hidden = false;
  }

  function hideEmptyState() {
    const empty = document.getElementById('notas-empty');
    if (empty) empty.hidden = true;
  }

  function updateCountLabel() {
    const label = document.getElementById('notas-count');
    if (!label) return;

    const total = state.sales.length;
    const shown = state.filtered.length;

    if (total === 0) {
      label.textContent = 'Nenhuma nota registrada';
      return;
    }
    if (shown === total) {
      label.textContent = total === 1
        ? '1 nota registrada'
        : total + ' notas registradas';
      return;
    }
    label.textContent = shown + ' de ' + total + ' notas exibidas';
  }

  function showGlobalAlert(message, type) {
    const el = document.getElementById('global-alert');
    if (!el) return;
    el.textContent = message;
    el.className = 'alert alert--' + (type || 'error');
    el.hidden = false;
  }

  /* =========================================================
     Modal: visualizar nota
     ========================================================= */
  const modalEls = {};

  function setupModal() {
    modalEls.modal = document.getElementById('nota-modal');
    modalEls.body  = document.getElementById('nota-body');
    modalEls.print = document.getElementById('nota-print-btn');
    if (!modalEls.modal) return;

    modalEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeNotaModal);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modalEls.modal.hidden) closeNotaModal();
    });

    if (modalEls.print) {
      modalEls.print.addEventListener('click', printNota);
    }
  }

  async function openNotaModal(sale) {
    if (!modalEls.modal) return;

    state.currentSaleId = sale.id || null;

    modalEls.body.innerHTML =
      '<div class="state-block"><span class="spinner" aria-hidden="true"></span>' +
      '<p>Carregando documento...</p></div>';

    modalEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';

    try {
      const items = await fetchSaleItems(sale.id);
      renderNotaDoc(sale, items);
    } catch (error) {
      console.error('[DEV HUB] Falha ao carregar itens da nota:', error);
      modalEls.body.innerHTML =
        '<div class="state-block"><p>Não foi possível carregar os itens deste documento.</p></div>';
    }
  }

  function closeNotaModal() {
    if (!modalEls.modal) return;
    modalEls.modal.hidden = true;
    document.body.style.overflow = '';
    state.currentSaleId = null;
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

  /* =========================================================
     Renderização do documento
     ========================================================= */
  function renderNotaDoc(sale, items) {
    if (!modalEls.body) return;

    const customer = state.customers[sale.customer_id] || null;
    const statusInfoObj = statusInfo(sale.status);

    const root = document.createElement('article');
    root.className = 'nota-doc';

    // ---------- Cabeçalho ----------
    const header = document.createElement('header');
    header.className = 'nota-doc__header';

    const brand = document.createElement('div');
    brand.className = 'nota-doc__brand';
    brand.innerHTML =
      '<span class="nota-doc__brand-mark" aria-hidden="true">DH</span>' +
      '<div>' +
        '<div class="nota-doc__brand-name">DEV HUB</div>' +
        '<div class="nota-doc__doc-type">Documento de venda</div>' +
      '</div>';
    header.appendChild(brand);

    const meta = document.createElement('div');
    meta.className = 'nota-doc__meta';
    meta.innerHTML =
      '<span class="nota-doc__meta-line">Número' +
        '<strong class="nota-doc__meta-number">' + escapeHtml(formatSaleNumber(sale)) + '</strong>' +
      '</span>' +
      '<span class="nota-doc__meta-line">Data' +
        '<strong>' + escapeHtml(formatDateTime(sale.created_at)) + '</strong>' +
      '</span>';
    header.appendChild(meta);

    root.appendChild(header);

    // ---------- Dados do cliente ----------
    const customerSection = document.createElement('section');
    customerSection.className = 'nota-doc__section';

    const customerTitle = document.createElement('h3');
    customerTitle.className = 'nota-doc__section-title';
    customerTitle.textContent = 'Cliente';
    customerSection.appendChild(customerTitle);

    const customerGrid = document.createElement('div');
    customerGrid.className = 'nota-doc__info-grid';

    customerGrid.appendChild(buildInfoItem('Nome', customerNameOf(sale)));
    customerGrid.appendChild(buildInfoItem('CPF/CNPJ', customer ? (customer.cpf_cnpj || '—') : '—'));
    customerGrid.appendChild(buildInfoItem('Telefone', customer ? (customer.phone || '—') : '—'));
    customerGrid.appendChild(buildInfoItem('E-mail', customer ? (customer.email || '—') : '—'));

    customerSection.appendChild(customerGrid);
    root.appendChild(customerSection);

    // ---------- Itens ----------
    const itemsSection = document.createElement('section');
    itemsSection.className = 'nota-doc__section';

    const itemsTitle = document.createElement('h3');
    itemsTitle.className = 'nota-doc__section-title';
    itemsTitle.textContent = 'Itens';
    itemsSection.appendChild(itemsTitle);

    if (!items || items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'nota-doc__info-value';
      empty.textContent = 'Nenhum item registrado para esta venda.';
      itemsSection.appendChild(empty);
    } else {
      const table = document.createElement('table');
      table.className = 'nota-doc__table';

      const thead = document.createElement('thead');
      thead.innerHTML =
        '<tr>' +
          '<th scope="col">Produto</th>' +
          '<th scope="col" class="cell--num">Qtd</th>' +
          '<th scope="col" class="cell--num">Valor unit.</th>' +
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

    root.appendChild(itemsSection);

    // ---------- Resumo ----------
    const totalsSection = document.createElement('section');
    totalsSection.className = 'nota-doc__section';

    const totalsTitle = document.createElement('h3');
    totalsTitle.className = 'nota-doc__section-title';
    totalsTitle.textContent = 'Resumo';
    totalsSection.appendChild(totalsTitle);

    const totals = document.createElement('div');
    totals.className = 'nota-doc__totals';

    totals.appendChild(buildTotalRow('Subtotal', formatMoney(sale.subtotal)));
    totals.appendChild(buildTotalRow('Desconto', '- ' + formatMoney(sale.discount)));
    totals.appendChild(buildTotalRow('Total', formatMoney(sale.total), true));

    totalsSection.appendChild(totals);
    root.appendChild(totalsSection);

    // ---------- Pagamento / Status / Observações ----------
    const extrasSection = document.createElement('section');
    extrasSection.className = 'nota-doc__section';

    const extrasTitle = document.createElement('h3');
    extrasTitle.className = 'nota-doc__section-title';
    extrasTitle.textContent = 'Pagamento e status';
    extrasSection.appendChild(extrasTitle);

    const extrasGrid = document.createElement('div');
    extrasGrid.className = 'nota-doc__info-grid';
    extrasGrid.appendChild(buildInfoItem('Forma de pagamento', paymentLabel(sale.payment_method)));
    extrasGrid.appendChild(buildInfoItem('Status', statusInfoObj.label));
    extrasSection.appendChild(extrasGrid);

    const notesLabel = document.createElement('div');
    notesLabel.className = 'nota-doc__info-label';
    notesLabel.textContent = 'Observações';
    extrasSection.appendChild(notesLabel);

    const notesBox = document.createElement('div');
    notesBox.className = 'nota-doc__notes';
    notesBox.textContent = (sale.notes && String(sale.notes).trim()) || 'Nenhuma observação registrada.';
    extrasSection.appendChild(notesBox);

    root.appendChild(extrasSection);

    // ---------- Rodapé ----------
    const footer = document.createElement('footer');
    footer.className = 'nota-doc__footer';
    footer.textContent = 'Documento interno gerado pelo DEV HUB · Não possui valor fiscal.';
    root.appendChild(footer);

    modalEls.body.innerHTML = '';
    modalEls.body.appendChild(root);
  }

  function buildInfoItem(label, value) {
    const wrap = document.createElement('div');
    wrap.className = 'nota-doc__info-item';

    const l = document.createElement('span');
    l.className = 'nota-doc__info-label';
    l.textContent = label;

    const v = document.createElement('span');
    v.className = 'nota-doc__info-value';
    v.textContent = value || '—';

    wrap.appendChild(l);
    wrap.appendChild(v);
    return wrap;
  }

  function buildTotalRow(label, value, isGrand) {
    const row = document.createElement('div');
    row.className = 'nota-doc__total-row' + (isGrand ? ' nota-doc__total-row--grand' : '');

    const l = document.createElement('span');
    l.textContent = label;

    const v = document.createElement('span');
    v.textContent = value;

    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  /* =========================================================
     Impressão
     ========================================================= */
  function printNota() {
    if (!state.currentSaleId) {
      showToast('Abra uma nota antes de imprimir.', 'error');
      return;
    }

    document.body.classList.add('printing-nota');

    // Após o print (ou cancelamento), remove a classe.
    // O setTimeout aqui é só para limpeza — não é usado para
    // resolver loading nem para esconder nada.
    const cleanup = function () {
      document.body.classList.remove('printing-nota');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 2000);

    window.print();
  }

  /* =========================================================
     Helpers de dados
     ========================================================= */
  function customerNameOf(sale) {
    if (sale.customers) {
      const c = Array.isArray(sale.customers) ? sale.customers[0] : sale.customers;
      if (c && c.name) return c.name;
    }
    if (sale.customer_id && state.customers[sale.customer_id]) {
      return state.customers[sale.customer_id].name || '—';
    }
    return 'Não informado';
  }

  function customerDocumentOf(sale) {
    if (sale.customers) {
      const c = Array.isArray(sale.customers) ? sale.customers[0] : sale.customers;
      if (c && c.cpf_cnpj) return String(c.cpf_cnpj);
    }
    if (sale.customer_id && state.customers[sale.customer_id]) {
      return String(state.customers[sale.customer_id].cpf_cnpj || '');
    }
    return '';
  }

  function paymentLabel(code) {
    if (!code) return 'Não informado';
    return PAYMENT_LABELS[code] || code;
  }

  function normalizeStatus(status) {
    const key = String(status || '').toLowerCase();
    if (key === 'cancelled') return 'canceled';
    return key;
  }

  function statusInfo(status) {
    const key = normalizeStatus(status);
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
    const n = toNumber(value, 0);
    return currencyFormatter.format(n);
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return dateFormatter.format(d);
  }

  /* =========================================================
     Helpers gerais
     ========================================================= */
  function createCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function matches(value, term) {
    if (!value) return false;
    return String(value).toLowerCase().includes(term);
  }

  function toNumber(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  }

  function toInteger(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function toDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  }

  function getInputValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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