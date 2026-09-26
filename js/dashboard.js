/* =========================================================
   DEV HUB · Dashboard
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Formatadores ---------- */
  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
  const numberFormatter = new Intl.NumberFormat('pt-BR');
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  /* Campos candidatos a "valor da venda" (usado para somar).
     O primeiro encontrado em cada registro é utilizado. */
  const TOTAL_FIELDS = [
    'total', 'total_amount', 'total_value', 'valor_total',
    'amount', 'value', 'valor', 'price'
  ];

  const STATUS_CLASSES = {
    pago: 'badge--success',
    'concluída': 'badge--success',
    concluida: 'badge--success',
    finalizada: 'badge--success',
    aprovada: 'badge--success',
    pendente: 'badge--warning',
    aberta: 'badge--warning',
    processando: 'badge--warning',
    cancelada: 'badge--danger',
    cancelado: 'badge--danger',
    recusada: 'badge--danger',
    estornada: 'badge--danger'
  };

  let totalFieldWarningShown = false;

  document.addEventListener('DOMContentLoaded', init);

  /* =========================================================
     Inicialização
     ========================================================= */
  async function init() {
    const Auth = window.Auth;

    if (!Auth || !Auth.isConfigured() || !window.db) {
      showAlert(
        'Não foi possível conectar ao Supabase. Verifique as credenciais em js/supabase.js.',
        'error'
      );
      return;
    }

    setupSidebar();
    setupUserMenu();
    setupLogout();

    const session = await Auth.requireSession();
    if (!session) return;

    watchAuthChanges();

    const profile = await Auth.getProfile(session.user.id);
    renderUser(session.user, profile);

    await Promise.all([loadStats(), loadLatestSales()]);
  }

  /* =========================================================
     Alertas globais
     ========================================================= */
  function showAlert(message, type) {
    const alert = document.getElementById('global-alert');
    if (!alert) return;

    alert.textContent = message;
    alert.className = 'alert alert--' + (type || 'error');
    alert.hidden = false;
  }

  /* =========================================================
     Sessão
     ========================================================= */
  function watchAuthChanges() {
    if (!window.db) return;

    window.db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT' && !window.Auth.isSigningOut()) {
        window.location.replace('index.html?expired=1');
      }
    });
  }

  /* =========================================================
     Usuário
     ========================================================= */
  function renderUser(user, profile) {
    const meta = user.user_metadata || {};

    const fullName =
      (profile && profile.name) ||
      meta.name ||
      meta.full_name ||
      (user.email ? user.email.split('@')[0] : '') ||
      'Usuário';

    const role = (profile && profile.role) || meta.role || '';
    const roleText = window.Auth.roleLabel(role);

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

    document.title = 'Dashboard · DEV HUB';
  }

  /* =========================================================
     Sidebar (mobile)
     ========================================================= */
  function setupSidebar() {
    const toggle = document.getElementById('menu-toggle');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('sidebar');

    if (!toggle || !overlay || !sidebar) return;

    function openSidebar() {
      document.body.classList.add('sidebar-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Fechar menu');
      overlay.hidden = false;
    }

    function closeSidebar() {
      if (!document.body.classList.contains('sidebar-open')) return;
      document.body.classList.remove('sidebar-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menu');
      overlay.hidden = true;
    }

    toggle.addEventListener('click', function () {
      if (document.body.classList.contains('sidebar-open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    overlay.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeSidebar();
    });

    // Fecha o menu ao navegar (mobile)
    sidebar.querySelectorAll('a.nav__item').forEach(function (link) {
      link.addEventListener('click', closeSidebar);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1024) closeSidebar();
    });
  }

  /* =========================================================
     Menu do usuário
     ========================================================= */
  function setupUserMenu() {
    const trigger = document.getElementById('user-menu-trigger');
    const panel = document.getElementById('user-menu-panel');

    if (!trigger || !panel) return;

    function close() {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }

    function open() {
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      const firstItem = panel.querySelector('.menu-item:not([aria-disabled="true"])');
      if (firstItem) firstItem.focus();
    }

    trigger.addEventListener('click', function (event) {
      event.stopPropagation();
      if (panel.hidden) open();
      else close();
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
     Logout (sidebar + menu do usuário)
     ========================================================= */
  function setupLogout() {
    const buttons = document.querySelectorAll('[data-action="logout"]');

    buttons.forEach(function (button) {
      button.addEventListener('click', async function () {
        if (button.disabled) return;

        button.disabled = true;
        button.setAttribute('aria-busy', 'true');

        await window.Auth.signOut();
      });
    });
  }

  /* =========================================================
     Indicadores
     ========================================================= */
  async function loadStats() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [customers, products, todayTotal, monthTotal] = await Promise.all([
      countRows('customers'),
      countRows('products'),
      sumSalesSince(startOfDay.toISOString()),
      sumSalesSince(startOfMonth.toISOString())
    ]);

    setText('stat-customers', customers === null ? '—' : numberFormatter.format(customers));
    setText('stat-products', products === null ? '—' : numberFormatter.format(products));
    setText('stat-sales-today', todayTotal === null ? '—' : currencyFormatter.format(todayTotal));
    setText('stat-sales-month', monthTotal === null ? '—' : currencyFormatter.format(monthTotal));
  }

  async function countRows(table) {
    const { count, error } = await window.db
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('[DEV HUB] Falha ao contar registros de "' + table + '":', error);
      return null;
    }
    return count || 0;
  }

  async function sumSalesSince(sinceISO) {
    const { data, error } = await window.db
      .from('sales')
      .select('*')
      .gte('created_at', sinceISO);

    if (error) {
      console.error('[DEV HUB] Falha ao somar vendas desde ' + sinceISO + ':', error);
      return null;
    }

    return (data || []).reduce(function (sum, sale) {
      return sum + getSaleTotal(sale);
    }, 0);
  }

  /* =========================================================
     Últimas vendas
     ========================================================= */
  async function loadLatestSales() {
    let response = await window.db
      .from('sales')
      .select('*, customers(name)')
      .order('created_at', { ascending: false })
      .limit(5);

    // Se o relacionamento com `customers` não existir, tenta sem o join.
    if (response.error) {
      console.warn(
        '[DEV HUB] Consulta com relacionamento "customers" falhou. Tentando sem join.',
        response.error
      );

      response = await window.db
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
    }

    if (response.error) {
      console.error('[DEV HUB] Falha ao carregar as últimas vendas:', response.error);
      showSalesEmpty('Não foi possível carregar as vendas.');
      return;
    }

    renderSales(response.data || []);
  }

  function renderSales(sales) {
    const tbody = document.getElementById('sales-body');
    const emptyRow = document.getElementById('sales-empty');
    if (!tbody || !emptyRow) return;

    tbody.querySelectorAll('tr:not(#sales-empty)').forEach(function (row) {
      row.remove();
    });

    if (sales.length === 0) {
      showSalesEmpty('Nenhuma venda registrada ainda.');
      return;
    }

    const fragment = document.createDocumentFragment();

    sales.forEach(function (sale) {
      fragment.appendChild(buildSaleRow(sale));
    });

    tbody.insertBefore(fragment, emptyRow);
    emptyRow.hidden = true;
  }

  function showSalesEmpty(message) {
    const tbody = document.getElementById('sales-body');
    const emptyRow = document.getElementById('sales-empty');
    if (!tbody || !emptyRow) return;

    tbody.querySelectorAll('tr:not(#sales-empty)').forEach(function (row) {
      row.remove();
    });

    emptyRow.querySelector('td').textContent = message;
    emptyRow.hidden = false;
  }

  function buildSaleRow(sale) {
    const row = document.createElement('tr');

    row.appendChild(createCell(formatSaleNumber(sale), 'cell--mono'));
    row.appendChild(createCell(getCustomerName(sale)));
    row.appendChild(createCell(formatDate(sale.created_at), 'cell--muted'));
    row.appendChild(createCell(currencyFormatter.format(getSaleTotal(sale)), 'cell--num'));
    row.appendChild(createStatusCell(sale.status));

    return row;
  }

  function createCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function createStatusCell(status) {
    const cell = document.createElement('td');
    const raw = status === null || status === undefined ? '' : String(status).trim();

    if (!raw) {
      cell.textContent = '—';
      cell.className = 'cell--muted';
      return cell;
    }

    const badge = document.createElement('span');
    const modifier = STATUS_CLASSES[raw.toLowerCase()];
    badge.className = 'badge' + (modifier ? ' ' + modifier : '');
    badge.textContent = raw.charAt(0).toUpperCase() + raw.slice(1);
    cell.appendChild(badge);

    return cell;
  }

  /* =========================================================
     Helpers de dados
     ========================================================= */
  function formatSaleNumber(sale) {
    const candidate =
      sale.number || sale.numero || sale.code || sale.codigo || sale.id;

    if (!candidate) return '—';

    const value = String(candidate);
    return '#' + (value.length > 10 ? value.slice(0, 8).toUpperCase() : value);
  }

  function getCustomerName(sale) {
    const relation = sale.customers;

    if (relation) {
      const customer = Array.isArray(relation) ? relation[0] : relation;
      if (customer && customer.name) return customer.name;
    }

    return sale.customer_name || sale.cliente || '—';
  }

  function getSaleTotal(sale) {
    for (let i = 0; i < TOTAL_FIELDS.length; i += 1) {
      const value = sale[TOTAL_FIELDS[i]];

      if (typeof value === 'number' && Number.isFinite(value)) return value;

      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value.replace(',', '.'));
        if (Number.isFinite(parsed)) return parsed;
      }
    }

    if (!totalFieldWarningShown) {
      totalFieldWarningShown = true;
      console.warn(
        '[DEV HUB] Não foi possível identificar o campo de valor na tabela "sales". ' +
        'Campos verificados: ' + TOTAL_FIELDS.join(', ')
      );
    }

    return 0;
  }

  function formatDate(value) {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return dateFormatter.format(date);
  }

  function setText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = text;
  }
})();