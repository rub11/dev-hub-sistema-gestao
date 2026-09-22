/* =========================================================
   DEV HUB · Módulo de Relatórios
   ---------------------------------------------------------
   Usa apenas window.db. Todas as consultas são feitas
   no Supabase; agregações são calculadas em memória.
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Formatadores ---------- */
  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  const numberFormatter = new Intl.NumberFormat('pt-BR');

  const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit'
  });

  const fullDateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
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

  const MOVEMENT_TYPE_INFO = {
    entrada: { label: 'Entrada', modifier: 'badge--success' },
    saida:   { label: 'Saída',   modifier: 'badge--danger'  },
    ajuste:  { label: 'Ajuste',  modifier: 'badge--warning' }
  };

  const STOCK_STATUS = {
    ok:  { label: 'Normal',         modifier: 'badge--success' },
    low: { label: 'Estoque baixo',  modifier: 'badge--warning' },
    out: { label: 'Sem estoque',    modifier: 'badge--danger'  }
  };

  const CANCELED_STATUS = ['canceled', 'cancelled'];

  /* ---------- Estado ---------- */
  const state = {
    period: '30d',
    customStart: '',
    customEnd: '',
    movementTypeFilter: '',
    loading: false,
    // dados
    sales: [],
    saleItems: [],
    products: [],
    movements: [],
    customersById: {},
    totalCustomers: 0,
    newCustomersInPeriod: 0,
    chart: null
  };

  document.addEventListener('DOMContentLoaded', init);

  /* =========================================================
     Init
     ========================================================= */
  async function init() {
    if (!window.db || window.DEV_HUB_CONFIGURED !== true) {
      showGlobalAlert(
        'Não foi possível conectar ao Supabase. Verifique as credenciais em js/supabase.js.',
        'error'
      );
      return;
    }

    setupSidebar();
    setupUserMenu();
    setupLogout();
    setupPeriodControls();
    setupExportButtons();
    setupMovementFilter();

    // Verificação de sessão (usa getUser, como pedido)
    try {
      const result = await window.db.auth.getUser();
      const user = result && result.data ? result.data.user : null;
      if (!user) {
        window.location.replace('index.html');
        return;
      }

      const profile = window.Auth
        ? await window.Auth.getProfile(user.id)
        : null;
      renderUser(user, profile);
    } catch (error) {
      console.error('[DEV HUB] Falha ao verificar sessão:', error);
      window.location.replace('index.html');
      return;
    }

    watchAuthChanges();

    // Define datas do período personalizado por padrão
    const today = new Date();
    state.customStart = toDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
    state.customEnd = toDateInput(today);
    setInputValue('period-start', state.customStart);
    setInputValue('period-end', state.customEnd);

    await refresh();
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

    const roleText = window.Auth
      ? window.Auth.roleLabel((profile && profile.role) || meta.role || '')
      : ((profile && profile.role) || '');

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
     Período
     ========================================================= */
  function setupPeriodControls() {
    document.querySelectorAll('.segmented__btn[data-period]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const period = btn.dataset.period;

        document.querySelectorAll('.segmented__btn[data-period]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });

        state.period = period;

        const custom = document.getElementById('period-custom');
        if (custom) custom.hidden = period !== 'custom';

        if (period === 'custom') {
          // só busca quando clicar em Aplicar
          updatePeriodRangeLabel();
          return;
        }
        refresh();
      });
    });

    const applyBtn = document.getElementById('apply-custom-period');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        const start = getInputValue('period-start');
        const end = getInputValue('period-end');

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
        refresh();
      });
    }
  }

  function getPeriodRange() {
    const now = new Date();
    let start, end;

    switch (state.period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case '7d':
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        start = new Date(end);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case '30d':
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        start = new Date(end);
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case 'custom':
      default:
        start = state.customStart
          ? new Date(state.customStart + 'T00:00:00')
          : new Date(now.getFullYear(), now.getMonth(), 1);
        end = state.customEnd
          ? new Date(state.customEnd + 'T23:59:59.999')
          : now;
        break;
    }

    return { start, end };
  }

  function updatePeriodRangeLabel() {
    const { start, end } = getPeriodRange();
    setText('period-range', formatRangeLabel(start, end));
  }

  function formatRangeLabel(start, end) {
    const sameDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();

    if (sameDay) return 'Período: ' + fullDateFormatter.format(start);
    return 'Período: ' + fullDateFormatter.format(start) + ' → ' + fullDateFormatter.format(end);
  }

  /* =========================================================
     Filtro de movimentações
     ========================================================= */
  function setupMovementFilter() {
    const select = document.getElementById('movement-type-filter');
    if (!select) return;

    select.addEventListener('change', function () {
      state.movementTypeFilter = select.value;
      renderMovements();
    });
  }

  /* =========================================================
     Atualização completa
     ========================================================= */
  async function refresh() {
    if (state.loading) return;
    state.loading = true;

    showLoading(true);
    updatePeriodRangeLabel();
    setExportButtonsEnabled(false);

    const { start, end } = getPeriodRange();
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    try {
      // ---------- Onda 1: consultas independentes em paralelo ----------
      const [
        salesRes,
        productsRes,
        movementsRes,
        totalCustomersRes,
        newCustomersRes
      ] = await Promise.all([
        window.db.from('sales')
          .select('*')
          .gte('created_at', startISO)
          .lte('created_at', endISO)
          .order('created_at', { ascending: false }),

        window.db.from('products')
          .select('id, name, code, stock, minimum_stock, active, price, created_at'),

        window.db.from('stock_movements')
          .select('*')
          .gte('created_at', startISO)
          .lte('created_at', endISO)
          .order('created_at', { ascending: false })
          .limit(500),

        window.db.from('customers').select('id', { count: 'exact', head: true }),

        window.db.from('customers')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startISO)
          .lte('created_at', endISO)
      ]);

      if (salesRes.error) throw salesRes.error;
      if (productsRes.error) throw productsRes.error;
      if (movementsRes.error) throw movementsRes.error;

      state.sales = salesRes.data || [];
      state.products = productsRes.data || [];
      state.movements = movementsRes.data || [];
      state.totalCustomers = (totalCustomersRes && totalCustomersRes.count) || 0;
      state.newCustomersInPeriod = (newCustomersRes && newCustomersRes.count) || 0;

      // ---------- Onda 2: itens e nomes dos clientes ----------
      const validSales = state.sales.filter(function (s) {
        return !isCanceled(s.status);
      });

      const saleIds = validSales.map(function (s) { return s.id; });
      const customerIds = Array.from(new Set(
        validSales.map(function (s) { return s.customer_id; }).filter(Boolean)
      ));

      const [itemsRes, customersRes] = await Promise.all([
        saleIds.length
          ? window.db.from('sale_items').select('*').in('sale_id', saleIds)
          : Promise.resolve({ data: [], error: null }),

        customerIds.length
          ? window.db.from('customers').select('id, name').in('id', customerIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (customersRes.error) throw customersRes.error;

      state.saleItems = itemsRes.data || [];
      state.customersById = {};
      (customersRes.data || []).forEach(function (c) {
        state.customersById[c.id] = c.name;
      });

      // ---------- Render ----------
      renderSalesKpis();
      renderChart();
      renderPayments();
      renderTopProducts();
      renderTopCustomers();
      renderCustomerKpis();
      renderStockKpis();
      renderStockTable();
      renderMovements();

      setExportButtonsEnabled(true);
      hideGlobalAlert();
    } catch (error) {
      console.error('[DEV HUB] Falha ao carregar relatórios:', error);
      showGlobalAlert(
        'Não foi possível carregar os relatórios. ' + friendlyError(error),
        'error'
      );
      showToast('Não foi possível carregar os relatórios.', 'error');
    } finally {
      state.loading = false;
      showLoading(false);
    }
  }

  function showLoading(isLoading) {
    const loading = document.getElementById('report-loading');
    const content = document.getElementById('report-content');
    if (!loading || !content) return;

    if (isLoading) {
      loading.hidden = false;
      content.hidden = true;
    } else {
      loading.hidden = true;
      content.hidden = false;
    }
  }

  /* =========================================================
     1. Resumo de vendas
     ========================================================= */
  function renderSalesKpis() {
    const valid = getValidSales();

    const count = valid.length;
    const revenue = valid.reduce(function (sum, s) {
      return sum + toNumber(s.total, 0);
    }, 0);
    const discounts = valid.reduce(function (sum, s) {
      return sum + toNumber(s.discount, 0);
    }, 0);
    const ticket = count > 0 ? revenue / count : 0;

    setText('kpi-sales-count', numberFormatter.format(count));
    setText('kpi-revenue', formatMoney(revenue));
    setText('kpi-ticket', formatMoney(ticket));
    setText('kpi-discounts', formatMoney(discounts));
  }

  /* =========================================================
     2. Gráfico de evolução
     ========================================================= */
  function renderChart() {
    const canvas = document.getElementById('chart-evolution');
    const empty = document.getElementById('chart-empty');
    const wrap = document.getElementById('chart-wrap');
    if (!canvas || !wrap || !empty) return;

    const valid = getValidSales();

    if (typeof window.Chart === 'undefined') {
      // Chart.js não carregou — esconde o canvas e mostra aviso
      canvas.style.display = 'none';
      empty.hidden = false;
      empty.querySelector('p').textContent = 'Não foi possível carregar a biblioteca de gráficos.';
      return;
    }

    if (valid.length === 0) {
      canvas.style.display = 'none';
      empty.hidden = false;
      empty.querySelector('p').textContent = 'Sem dados suficientes para exibir o gráfico no período.';
      if (state.chart) {
        state.chart.destroy();
        state.chart = null;
      }
      return;
    }

    empty.hidden = true;
    canvas.style.display = '';

    const { start, end } = getPeriodRange();
    const buckets = buildDayBuckets(valid, start, end);

    const labels = buckets.map(function (b) { return b.label; });
    const counts = buckets.map(function (b) { return b.count; });
    const totals = buckets.map(function (b) { return round2(b.total); });

    if (state.chart) {
      state.chart.destroy();
      state.chart = null;
    }

    const ctx = canvas.getContext('2d');
    state.chart = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Vendas (un.)',
            data: counts,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            tension: 0.32,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#6366f1',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            yAxisID: 'yCount',
            fill: true
          },
          {
            label: 'Faturamento (R$)',
            data: totals,
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.10)',
            tension: 0.32,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#059669',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            yAxisID: 'yRevenue',
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 14,
              font: { family: 'Inter', size: 12 },
              color: '#4b5563'
            }
          },
          tooltip: {
            backgroundColor: '#111827',
            padding: 10,
            titleFont: { family: 'Inter', size: 12, weight: '600' },
            bodyFont: { family: 'Inter', size: 12 },
            callbacks: {
              label: function (context) {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                if (context.dataset.yAxisID === 'yRevenue') {
                  return label + ': ' + currencyFormatter.format(value);
                }
                return label + ': ' + numberFormatter.format(value);
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#9ca3af',
              font: { family: 'Inter', size: 11 },
              maxRotation: 0,
              autoSkipPadding: 12
            }
          },
          yCount: {
            position: 'left',
            beginAtZero: true,
            grid: { color: '#f3f4f6' },
            ticks: {
              color: '#9ca3af',
              font: { family: 'Inter', size: 11 },
              precision: 0
            }
          },
          yRevenue: {
            position: 'right',
            beginAtZero: true,
            grid: { display: false },
            ticks: {
              color: '#9ca3af',
              font: { family: 'Inter', size: 11 },
              callback: function (value) {
                return 'R$ ' + numberFormatter.format(value);
              }
            }
          }
        }
      }
    });
  }

  function buildDayBuckets(sales, start, end) {
    const map = new Map();
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());

    while (cursor <= end) {
      const key = toDateKey(cursor);
      map.set(key, {
        key: key,
        label: shortDateFormatter.format(cursor),
        count: 0,
        total: 0
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    sales.forEach(function (s) {
      const d = new Date(s.created_at);
      const key = toDateKey(d);
      const bucket = map.get(key);
      if (bucket) {
        bucket.count += 1;
        bucket.total += toNumber(s.total, 0);
      }
    });

    return Array.from(map.values());
  }

  /* =========================================================
     3. Formas de pagamento
     ========================================================= */
  function renderPayments() {
    const grid = document.getElementById('payments-grid');
    const empty = document.getElementById('payments-empty');
    if (!grid || !empty) return;

    const valid = getValidSales();

    if (valid.length === 0) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    // Agrupa por payment_method (respeitando o que existe no banco)
    const map = new Map();
    valid.forEach(function (s) {
      const key = s.payment_method || '';
      if (!map.has(key)) map.set(key, { count: 0, total: 0 });
      const entry = map.get(key);
      entry.count += 1;
      entry.total += toNumber(s.total, 0);
    });

    // Ordena por total desc
    const rows = Array.from(map.entries())
      .map(function (entry) { return { code: entry[0], ...entry[1] }; })
      .sort(function (a, b) { return b.total - a.total; });

    grid.innerHTML = '';

    const fragment = document.createDocumentFragment();
    rows.forEach(function (row) {
      const card = document.createElement('div');
      card.className = 'payment-card';

      const label = document.createElement('span');
      label.className = 'payment-card__label';
      label.textContent = labelForPayment(row.code);

      const value = document.createElement('span');
      value.className = 'payment-card__value';
      value.textContent = formatMoney(row.total);

      const count = document.createElement('span');
      count.className = 'payment-card__count';
      count.textContent = row.count === 1
        ? '1 venda'
        : numberFormatter.format(row.count) + ' vendas';

      card.appendChild(label);
      card.appendChild(value);
      card.appendChild(count);
      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
  }

  function labelForPayment(code) {
    if (!code) return 'Não informado';
    if (PAYMENT_LABELS[code]) return PAYMENT_LABELS[code];
    // fallback: humaniza o código bruto
    return String(code).replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  /* =========================================================
     4. Top produtos
     ========================================================= */
  function renderTopProducts() {
    const wrap = document.getElementById('top-products-wrap');
    const empty = document.getElementById('top-products-empty');
    const tbody = document.getElementById('top-products-body');
    if (!wrap || !empty || !tbody) return;

    if (state.saleItems.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      tbody.innerHTML = '';
      return;
    }

    const map = new Map();
    state.saleItems.forEach(function (item) {
      const key = item.product_id || ('name:' + (item.product_name || '—'));
      if (!map.has(key)) {
        map.set(key, { name: item.product_name || '—', quantity: 0, revenue: 0 });
      }
      const entry = map.get(key);
      entry.quantity += toInteger(item.quantity, 0);
      entry.revenue += toNumber(item.subtotal, 0);
    });

    const rows = Array.from(map.values())
      .sort(function (a, b) { return b.quantity - a.quantity || b.revenue - a.revenue; })
      .slice(0, 10);

    if (rows.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    wrap.hidden = false;
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    rows.forEach(function (row) {
      const tr = document.createElement('tr');
      tr.appendChild(createCell(row.name, 'cell-product'));
      tr.appendChild(createCell(numberFormatter.format(row.quantity), 'cell--num'));
      tr.appendChild(createCell(formatMoney(row.revenue), 'cell--num cell-price'));
      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
  }

  /* =========================================================
     5. Top clientes
     ========================================================= */
  function renderTopCustomers() {
    const wrap = document.getElementById('top-customers-wrap');
    const empty = document.getElementById('top-customers-empty');
    const tbody = document.getElementById('top-customers-body');
    if (!wrap || !empty || !tbody) return;

    const valid = getValidSales();

    const map = new Map();
    valid.forEach(function (s) {
      if (!s.customer_id) return;
      if (!map.has(s.customer_id)) {
        map.set(s.customer_id, { id: s.customer_id, count: 0, total: 0 });
      }
      const entry = map.get(s.customer_id);
      entry.count += 1;
      entry.total += toNumber(s.total, 0);
    });

    const rows = Array.from(map.values())
      .sort(function (a, b) { return b.total - a.total; })
      .slice(0, 10);

    if (rows.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      tbody.innerHTML = '';
      return;
    }

    empty.hidden = true;
    wrap.hidden = false;
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    rows.forEach(function (row) {
      const tr = document.createElement('tr');
      tr.appendChild(createCell(
        state.customersById[row.id] || 'Cliente',
        'cell-product'
      ));
      tr.appendChild(createCell(numberFormatter.format(row.count), 'cell--num'));
      tr.appendChild(createCell(formatMoney(row.total), 'cell--num cell-price'));
      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
  }

  /* =========================================================
     6. Indicadores de clientes
     ========================================================= */
  function renderCustomerKpis() {
    const valid = getValidSales();
    const uniqueBuyers = new Set(
      valid.map(function (s) { return s.customer_id; }).filter(Boolean)
    );

    setText('kpi-total-customers', numberFormatter.format(state.totalCustomers));
    setText('kpi-buying-customers', numberFormatter.format(uniqueBuyers.size));
    setText('kpi-new-customers', numberFormatter.format(state.newCustomersInPeriod));
  }

  /* =========================================================
     7. Estoque: KPIs + tabela
     ========================================================= */
  function renderStockKpis() {
    let withStock = 0;
    let low = 0;
    let out = 0;
    let total = 0;

    state.products.forEach(function (p) {
      total += 1;
      const stock = toInteger(p.stock, 0);
      const min = toInteger(p.minimum_stock, 0);

      if (stock === 0) out += 1;
      else if (stock <= min) low += 1;
      else withStock += 1;
    });

    setText('kpi-total-products', numberFormatter.format(total));
    setText('kpi-with-stock', numberFormatter.format(withStock));
    setText('kpi-low-stock', numberFormatter.format(low));
    setText('kpi-out-stock', numberFormatter.format(out));
  }

  function renderStockTable() {
    const wrap = document.getElementById('stock-table-wrap');
    const empty = document.getElementById('stock-table-empty');
    const tbody = document.getElementById('stock-table-body');
    if (!wrap || !empty || !tbody) return;

    if (state.products.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      tbody.innerHTML = '';
      return;
    }

    empty.hidden = true;
    wrap.hidden = false;
    tbody.innerHTML = '';

    // Ordena: sem estoque, baixo, normal — depois por nome
    const sorted = state.products.slice().sort(function (a, b) {
      const sa = stockOrder(a);
      const sb = stockOrder(b);
      if (sa !== sb) return sa - sb;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    const fragment = document.createDocumentFragment();
    sorted.forEach(function (p) {
      const tr = document.createElement('tr');

      const nameCell = document.createElement('td');
      nameCell.className = 'cell-product';
      const name = document.createElement('span');
      name.textContent = p.name || '—';
      nameCell.appendChild(name);
      if (p.active === false) {
        const small = document.createElement('small');
        small.textContent = 'Inativo';
        nameCell.appendChild(small);
      }
      tr.appendChild(nameCell);

      tr.appendChild(createCell(p.code || '—', 'cell--muted'));
      tr.appendChild(createCell(String(toInteger(p.stock, 0)), 'cell--num cell-stock'));
      tr.appendChild(createCell(String(toInteger(p.minimum_stock, 0)), 'cell--num cell-stock'));

      const stock = toInteger(p.stock, 0);
      const min = toInteger(p.minimum_stock, 0);
      const info = stockInfo(stock, min);
      const statusCell = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'badge ' + info.modifier;
      badge.textContent = info.label;
      statusCell.appendChild(badge);
      tr.appendChild(statusCell);

      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
  }

  function stockOrder(product) {
    const stock = toInteger(product.stock, 0);
    const min = toInteger(product.minimum_stock, 0);
    if (stock === 0) return 0;
    if (stock <= min) return 1;
    return 2;
  }

  function stockInfo(stock, min) {
    if (stock === 0) return STOCK_STATUS.out;
    if (stock <= min) return STOCK_STATUS.low;
    return STOCK_STATUS.ok;
  }

  /* =========================================================
     8. Movimentações
     ========================================================= */
  function renderMovements() {
    const wrap = document.getElementById('movements-wrap');
    const empty = document.getElementById('movements-empty');
    const tbody = document.getElementById('movements-body');
    const countLabel = document.getElementById('movements-count');
    if (!wrap || !empty || !tbody) return;

    const filter = state.movementTypeFilter;
    const rows = state.movements.filter(function (m) {
      if (!filter) return true;
      return String(m.type || '').toLowerCase() === filter;
    });

    if (state.movements.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      tbody.innerHTML = '';
      if (countLabel) countLabel.textContent = 'Nenhuma movimentação no período';
      return;
    }

    if (rows.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      empty.querySelector('p').textContent = 'Nenhuma movimentação encontrada com este filtro.';
      tbody.innerHTML = '';
      if (countLabel) countLabel.textContent = 'Nenhum resultado para o filtro aplicado';
      return;
    }

    empty.hidden = true;
    wrap.hidden = false;
    tbody.innerHTML = '';

    if (countLabel) {
      countLabel.textContent = rows.length === 1
        ? '1 movimentação exibida'
        : numberFormatter.format(rows.length) + ' movimentações exibidas';
    }

    const fragment = document.createDocumentFragment();
    rows.forEach(function (m) {
      fragment.appendChild(buildMovementRow(m));
    });
    tbody.appendChild(fragment);
  }

  function buildMovementRow(movement) {
    const tr = document.createElement('tr');

    tr.appendChild(createCell(formatDateTime(movement.created_at), 'cell--muted'));
    tr.appendChild(createCell(productNameById(movement.product_id), ''));

    // Tipo
    const typeCell = document.createElement('td');
    const info = MOVEMENT_TYPE_INFO[String(movement.type || '').toLowerCase()];
    const badge = document.createElement('span');
    badge.className = 'badge ' + (info ? info.modifier : '');
    badge.textContent = info ? info.label : (movement.type || '—');
    typeCell.appendChild(badge);
    tr.appendChild(typeCell);

    // Quantidade (com sinal)
    const qtyCell = document.createElement('td');
    qtyCell.className = 'cell--num';
    const type = String(movement.type || '').toLowerCase();
    const qty = toInteger(movement.quantity, 0);
    const qtySpan = document.createElement('span');
    qtySpan.className = 'movement-qty';
    if (type === 'entrada') {
      qtySpan.classList.add('movement-qty--in');
      qtySpan.textContent = '+' + qty;
    } else if (type === 'saida') {
      qtySpan.classList.add('movement-qty--out');
      qtySpan.textContent = '-' + qty;
    } else {
      qtySpan.classList.add(qty >= 0 ? 'movement-qty--in' : 'movement-qty--out');
      qtySpan.textContent = qty >= 0 ? '+' + qty : String(qty);
    }
    qtyCell.appendChild(qtySpan);
    tr.appendChild(qtyCell);

    tr.appendChild(createCell(String(toInteger(movement.previous_stock, 0)), 'cell--num cell-stock'));
    tr.appendChild(createCell(String(toInteger(movement.new_stock, 0)), 'cell--num cell-stock'));
    tr.appendChild(createCell(movement.reason || '—', 'movement-reason'));

    return tr;
  }

  function productNameById(id) {
    if (!id) return '—';
    const product = state.products.find(function (p) { return p.id === id; });
    return (product && product.name) || '—';
  }

  /* =========================================================
     Exportação CSV
     ========================================================= */
  function setupExportButtons() {
    const salesBtn = document.getElementById('export-sales-btn');
    const productsBtn = document.getElementById('export-products-btn');

    if (salesBtn) salesBtn.addEventListener('click', exportSalesCSV);
    if (productsBtn) productsBtn.addEventListener('click', exportProductsCSV);
  }

  function setExportButtonsEnabled(enabled) {
    const salesBtn = document.getElementById('export-sales-btn');
    const productsBtn = document.getElementById('export-products-btn');
    if (salesBtn) salesBtn.disabled = !enabled;
    if (productsBtn) productsBtn.disabled = !enabled;
  }

  function exportSalesCSV() {
    const valid = getValidSales();

    if (valid.length === 0) {
      showToast('Nenhuma venda para exportar no período selecionado.', 'error');
      return;
    }

    const headers = ['Nº', 'Data', 'Cliente', 'Subtotal', 'Desconto', 'Total', 'Pagamento', 'Status'];
    const rows = valid.map(function (s) {
      return [
        s.sale_number != null ? s.sale_number : '',
        formatDateTimeCSV(s.created_at),
        customerNameForCSV(s.customer_id),
        toCSVNumber(s.subtotal),
        toCSVNumber(s.discount),
        toCSVNumber(s.total),
        labelForPayment(s.payment_method),
        s.status || ''
      ];
    });

    const filename = 'vendas_' + fileStamp() + '.csv';
    downloadCSV(filename, headers, rows);
    showToast('Exportação de vendas concluída.', 'success');
  }

  function exportProductsCSV() {
    if (state.products.length === 0) {
      showToast('Nenhum produto para exportar.', 'error');
      return;
    }

    const headers = ['Produto', 'Código', 'Estoque', 'Estoque mínimo', 'Situação', 'Preço', 'Ativo'];
    const rows = state.products.map(function (p) {
      const stock = toInteger(p.stock, 0);
      const min = toInteger(p.minimum_stock, 0);
      return [
        p.name || '',
        p.code || '',
        stock,
        min,
        stockInfo(stock, min).label,
        toCSVNumber(p.price),
        p.active === false ? 'Não' : 'Sim'
      ];
    });

    const filename = 'produtos_' + fileStamp() + '.csv';
    downloadCSV(filename, headers, rows);
    showToast('Exportação de produtos concluída.', 'success');
  }

  function downloadCSV(filename, headers, rows) {
    const SEP = ';';
    const BOM = '\uFEFF';

    function esc(value) {
      const s = value === null || value === undefined ? '' : String(value);
      if (s.indexOf(SEP) !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }

    const lines = [headers.map(esc).join(SEP)];
    rows.forEach(function (r) {
      lines.push(r.map(esc).join(SEP));
    });

    const csv = BOM + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function toCSVNumber(value) {
    const n = toNumber(value, 0);
    return n.toFixed(2).replace('.', ',');
  }

  function customerNameForCSV(customerId) {
    if (!customerId) return 'Não informado';
    return state.customersById[customerId] || 'Cliente';
  }

  function formatDateTimeCSV(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR');
  }

  function fileStamp() {
    const d = new Date();
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
           '_' + pad(d.getHours()) + pad(d.getMinutes());
  }

  /* =========================================================
     Helpers
     ========================================================= */
  function getValidSales() {
    return state.sales.filter(function (s) {
      return !isCanceled(s.status);
    });
  }

  function isCanceled(status) {
    if (!status) return false;
    return CANCELED_STATUS.indexOf(String(status).toLowerCase()) !== -1;
  }

  function createCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function formatMoney(value) {
    return currencyFormatter.format(toNumber(value, 0));
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return dateTimeFormatter.format(d);
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

  function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function toDateInput(date) {
    return toDateKey(date);
  }

  function getInputValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function friendlyError(error) {
    if (!error) return 'Tente novamente.';
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    if (msg.includes('row-level security') || msg.includes('permission denied')) {
      return 'Você não tem permissão para acessar estes dados.';
    }
    return 'Tente novamente em alguns instantes.';
  }

  function showGlobalAlert(message, type) {
    const el = document.getElementById('global-alert');
    if (!el) return;
    el.textContent = message;
    el.className = 'alert alert--' + (type || 'error');
    el.hidden = false;
  }

  function hideGlobalAlert() {
    const el = document.getElementById('global-alert');
    if (!el) return;
    el.hidden = true;
    el.textContent = '';
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