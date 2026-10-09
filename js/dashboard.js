/* =========================================================
   DEV HUB · Dashboard
   ---------------------------------------------------------
   Fase 1: KPIs, gráficos, rankings, alertas, estoque crítico
   Fase 2: Activity feed (timeline)
   Fase 3: [NOVO] Cards clicáveis — KPIs, gráficos e rankings
           navegam para a tela correspondente.
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Formatadores ---------- */
  const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtNum = new Intl.NumberFormat('pt-BR');
  const fmtDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
  const fmtDateFull = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const PAYMENT_LABELS = {
    '': 'Não informado',
    cash: 'Dinheiro',
    pix: 'Pix',
    debit_card: 'Cartão de débito',
    credit_card: 'Cartão de crédito',
    boleto: 'Boleto',
    other: 'Outro'
  };

  const CANCELED = ['canceled', 'cancelled'];

  /* ---------- Estado ---------- */
  const state = {
    period: '30d',
    customStart: '',
    customEnd: '',
    user: null,
    isPlatformAdmin: false,
    currentOrgId: null,
    charts: { revenue: null, payments: null },
    loading: false,
    loadGeneration: 0
  };

  const numberAnimations = new WeakMap();

  /* =========================================================
     Init
     ========================================================= */
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    if (!window.db) return;

    setupUserMenu();
    setupLogout();
    setupPeriod();

    const Auth = window.Auth;
    if (!Auth || !Auth.isConfigured()) return;

    const session = await Auth.requireSession();
    if (!session) return;

    const profile = await Auth.getProfile(session.user.id);
    renderUser(session.user, profile);

    const ctx = await resolveContext(Auth, session);
    state.user = ctx;
    state.isPlatformAdmin = Boolean(ctx && ctx.is_platform_admin);

    state.currentOrgId = await getCurrentOrgId(Auth, session, profile);

    if (state.isPlatformAdmin) {
      const kpiOrgs = document.querySelector('[data-kpi="orgs"]');
      if (kpiOrgs) kpiOrgs.hidden = false;
    }

    const today = new Date();
    setInputValue('dash-start', toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)));
    setInputValue('dash-end', toDateInput(today));

    /* [NOVO] Liga os cliques ANTES de carregar (a UI já existe) */
    bindDashboardClicks();

    await loadDashboard();

    if (window.db.auth && window.db.auth.onAuthStateChange) {
      window.db.auth.onAuthStateChange(function (event) {
        if (event === 'SIGNED_OUT' && Auth && !Auth.isSigningOut()) {
          window.location.replace('index.html?expired=1');
        }
      });
    }

    window.addEventListener('org:changed', function () {
      getCurrentOrgId(Auth, session, null).then(function (orgId) {
        state.currentOrgId = orgId;
        loadDashboard();
      });
    });
  }

  /* =========================================================
     [NOVO] Navegação por clique
     ========================================================= */
  function goToPage(pageId, fallbackHref) {
    /* Tenta abrir como aba (respeita permissões) */
    if (window.NAV &&
        typeof NAV.findItemById === 'function' &&
        NAV.tabs && typeof NAV.tabs.open === 'function') {
      const item = NAV.findItemById(pageId);
      if (item) {
        NAV.tabs.open(item);
        return;
      }
    }
    /* Fallback: navega direto */
    window.location.href = fallbackHref || (pageId + '.html');
  }

  function bindClickable(el, pageId, fallbackHref) {
    if (!el) return;
    if (el.dataset.clickBound === '1') return;
    el.dataset.clickBound = '1';

    el.classList.add('is-clickable');
    el.setAttribute('role', 'link');
    el.setAttribute('tabindex', '0');

    el.addEventListener('click', function (e) {
      /* Ignora cliques em elementos interativos internos */
      if (e.target.closest('a, button, select, input, textarea, label, [role="button"]')) return;
      goToPage(pageId, fallbackHref);
    });

    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('a, button, select, input, textarea, label')) return;
        e.preventDefault();
        goToPage(pageId, fallbackHref);
      }
    });
  }

  function bindDashboardClicks() {
    /* ---------- KPIs ---------- */
    bindClickable(document.querySelector('[data-kpi="customers"]'), 'parceiros', 'parceiros.html');
    bindClickable(document.querySelector('[data-kpi="sales"]'),     'vendas',    'vendas.html');
    bindClickable(document.querySelector('[data-kpi="revenue"]'),   'vendas',    'vendas.html');
    bindClickable(document.querySelector('[data-kpi="products"]'),  'produtos',  'produtos.html');
    bindClickable(document.querySelector('[data-kpi="users"]'),     'gestao',    'gestao.html');
    bindClickable(document.querySelector('[data-kpi="orgs"]'),      'empresas',  'plataforma.html#empresas');

    /* ---------- Gráficos ---------- */
    const chartsGrid = document.querySelector('.dash-grid--charts');
    if (chartsGrid) {
      const cards = chartsGrid.querySelectorAll('.dash-card');
      if (cards[0]) bindClickable(cards[0], 'vendas', 'vendas.html');
      if (cards[1]) bindClickable(cards[1], 'vendas', 'vendas.html');
    }

    /* ---------- Rankings ---------- */
    const topProducts = document.getElementById('dash-top-products');
    if (topProducts) {
      const card = topProducts.closest('.dash-card');
      if (card) bindClickable(card, 'produtos', 'produtos.html');
    }
    const topCustomers = document.getElementById('dash-top-customers');
    if (topCustomers) {
      const card = topCustomers.closest('.dash-card');
      if (card) bindClickable(card, 'parceiros', 'parceiros.html');
    }
  }

  /* =========================================================
     Helper: descobre a org ativa do usuário
     ========================================================= */
  async function getCurrentOrgId(Auth, session, profileArg) {
    try {
      let profile = profileArg;
      if (!profile && session && session.user) {
        profile = await Auth.getProfile(session.user.id);
      }
      if (profile && profile.organization_id) return profile.organization_id;
    } catch (e) { /* ignora */ }

    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (raw) {
        const ctx = JSON.parse(raw);
        if (ctx && ctx.organization_id) return ctx.organization_id;
      }
    } catch (e) { /* ignora */ }

    try {
      const { data } = await window.db.rpc('get_user_organization_id');
      if (data) return data;
    } catch (e) { /* ignora */ }

    return null;
  }

  async function resolveContext(Auth, session) {
    try {
      if (typeof Auth.getStoredUser === 'function') {
        const ctx = Auth.getStoredUser();
        if (ctx) return ctx;
      }
    } catch (e) { /* ignora */ }

    if (session && session.user && typeof Auth.getProfile === 'function') {
      try { return await Auth.getProfile(session.user.id); }
      catch (e) { /* ignora */ }
    }
    return null;
  }

  /* =========================================================
     Header (usuário)
     ========================================================= */
  function setupUserMenu() {
    const trigger = document.getElementById('user-menu-trigger');
    const panel = document.getElementById('user-menu-panel');
    if (!trigger || !panel) return;

    function open() { panel.hidden = false; trigger.setAttribute('aria-expanded', 'true'); }
    function close() { panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.hidden ? open() : close();
    });
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
    document.querySelectorAll('[data-action="logout"]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (btn.disabled) return;
        btn.disabled = true;
        if (window.Auth && typeof window.Auth.signOut === 'function') {
          await window.Auth.signOut();
        } else {
          window.location.href = 'index.html';
        }
      });
    });
  }

  function renderUser(user, profile) {
    const meta = user.user_metadata || {};
    const fullName =
      (profile && profile.name) ||
      meta.name || meta.full_name ||
      (user.email ? user.email.split('@')[0] : '') ||
      'Usuário';

    const roleText = window.Auth && window.Auth.roleLabel
      ? window.Auth.roleLabel((profile && profile.role) || meta.role || '')
      : '';

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
     Período
     ========================================================= */
  function setupPeriod() {
    const select = document.getElementById('dash-period');
    const custom = document.getElementById('dash-period-custom');
    const applyBtn = document.getElementById('dash-apply');
    if (!select) return;

    select.addEventListener('change', function () {
      state.period = select.value;
      if (custom) custom.hidden = state.period !== 'custom';
      if (state.period === 'custom') {
        updateRangeLabel();
        return;
      }
      loadDashboard();
    });

    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        const s = getInputValue('dash-start');
        const e = getInputValue('dash-end');
        if (!s || !e) { showToast('Informe data inicial e final.', 'error'); return; }
        if (s > e) { showToast('Data inicial maior que a final.', 'error'); return; }
        state.customStart = s;
        state.customEnd = e;
        loadDashboard();
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
        start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
        break;
      case '30d':
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        start = new Date(end); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case '3m':
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case 'custom':
      default: {
        const s = state.customStart ? new Date(state.customStart + 'T00:00:00') : null;
        const e = state.customEnd ? new Date(state.customEnd + 'T23:59:59.999') : null;

        start = (s && !isNaN(s.getTime()))
          ? s
          : new Date(now.getFullYear(), now.getMonth(), 1);
        end = (e && !isNaN(e.getTime()))
          ? e
          : now;

        if (start > end) {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = now;
        }
        break;
      }
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = now;
    }

    return { start, end };
  }

  function updateRangeLabel() {
    const { start, end } = getPeriodRange();
    const sameDay = start.toDateString() === end.toDateString();
    const label = sameDay
      ? 'Período: ' + fmtDateFull.format(start)
      : 'Período: ' + fmtDateFull.format(start) + ' → ' + fmtDateFull.format(end);
    setText('dash-range', label);
  }

  /* =========================================================
     Carga principal
     ========================================================= */
  async function loadDashboard() {
    state.loadGeneration += 1;
    const myGen = state.loadGeneration;
    state.loading = true;

    if (!state.currentOrgId) {
      state.currentOrgId = await getCurrentOrgId(window.Auth, null, null);
    }

    updateRangeLabel();
    clearAllKpis();

    const { start, end } = getPeriodRange();
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    await Promise.allSettled([
      loadCustomerKpis(startISO, endISO, myGen),
      loadSalesAndRevenue(startISO, endISO, myGen),
      loadProductKpis(myGen),
      loadUserKpis(myGen),
      state.isPlatformAdmin ? loadOrgKpis(myGen) : Promise.resolve(),
      loadTopProducts(startISO, endISO, myGen),
      loadTopCustomers(startISO, endISO, myGen),
      loadStockAlerts(myGen),
      loadActivityFeed(myGen)
    ]);

    if (myGen === state.loadGeneration) {
      state.loading = false;
    }
  }

  function clearAllKpis() {
    document.querySelectorAll('.kpi__value').forEach(function (el) {
      el.textContent = '—';
      el.classList.add('skeleton');
    });
    document.querySelectorAll('.kpi__hint').forEach(function (el) { el.innerHTML = '&nbsp;'; });
  }

  function isStale(myGen) {
    return myGen !== undefined && myGen !== state.loadGeneration;
  }

  /* =========================================================
     KPIs
     ========================================================= */
  async function loadCustomerKpis(startISO, endISO, myGen) {
    try {
      if (!state.currentOrgId) throw new Error('no-org');

      const [totalRes, newRes] = await Promise.all([
        window.db.from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', state.currentOrgId),
        window.db.from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', state.currentOrgId)
          .gte('created_at', startISO).lte('created_at', endISO)
      ]);

      if (isStale(myGen)) return;

      const total = (totalRes && totalRes.count) || 0;
      const novos = (newRes && newRes.count) || 0;

      setKpi('customers', total, novos > 0
        ? '<strong>+' + fmtNum.format(novos) + '</strong> no período'
        : 'Nenhum novo no período');
    } catch (e) {
      if (isStale(myGen)) return;
      setKpiError('customers');
    }
  }

  async function loadSalesAndRevenue(startISO, endISO, myGen) {
    try {
      if (!state.currentOrgId) throw new Error('no-org');

      const res = await window.db.from('sales')
        .select('id, total, status, payment_method, created_at')
        .eq('organization_id', state.currentOrgId)
        .gte('created_at', startISO).lte('created_at', endISO);

      if (res.error) throw res.error;
      if (isStale(myGen)) return;

      const all = res.data || [];
      const valid = all.filter(function (s) {
        return CANCELED.indexOf(String(s.status || '').toLowerCase()) === -1;
      });

      const count = valid.length;
      const revenue = valid.reduce(function (sum, s) { return sum + toNumber(s.total); }, 0);

      setKpi('sales', count, count > 0
        ? (count === 1 ? '1 venda no período' : fmtNum.format(count) + ' vendas no período')
        : 'Sem vendas registradas');

      setKpi('revenue', fmtBRL.format(revenue), count > 0
        ? 'Ticket médio: ' + fmtBRL.format(revenue / count)
        : 'Sem faturamento');

      renderRevenueChart(valid, startISO, endISO);
      renderPaymentsChart(valid);
    } catch (e) {
      if (isStale(myGen)) return;
      setKpiError('sales');
      setKpiError('revenue');
      renderEmptyChart('chart-revenue');
      renderEmptyChart('chart-payments');
    }
  }

  async function loadProductKpis(myGen) {
    try {
      if (!state.currentOrgId) throw new Error('no-org');

      const res = await window.db.from('products')
        .select('id, stock, minimum_stock, active')
        .eq('organization_id', state.currentOrgId);

      if (res.error) throw res.error;
      if (isStale(myGen)) return;

      const all = res.data || [];
      const total = all.length;
      const low = all.filter(function (p) {
        const s = toNumber(p.stock), m = toNumber(p.minimum_stock);
        return s > 0 && s <= m;
      }).length;
      const out = all.filter(function (p) { return toNumber(p.stock) === 0; }).length;

      const hint = (low + out) > 0
        ? '<strong>' + fmtNum.format(low + out) + '</strong> em estado crítico'
        : 'Estoque em nível adequado';

      setKpi('products', total, hint);
    } catch (e) {
      if (isStale(myGen)) return;
      setKpiError('products');
    }
  }

  async function loadUserKpis(myGen) {
    try {
      if (!state.currentOrgId) throw new Error('no-org');

      const [totalRes, activeRes] = await Promise.all([
        window.db.from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', state.currentOrgId),
        window.db.from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', state.currentOrgId)
          .eq('active', true)
      ]);

      if (isStale(myGen)) return;

      const total = (totalRes && totalRes.count) || 0;
      const active = (activeRes && activeRes.count) || 0;

      setKpi('users', total, active > 0
        ? '<strong>' + fmtNum.format(active) + '</strong> ativos'
        : 'Nenhum ativo');
    } catch (e) {
      if (isStale(myGen)) return;
      setKpiError('users');
    }
  }

  async function loadOrgKpis(myGen) {
    try {
      const [totalRes, activeRes] = await Promise.all([
        window.db.from('organizations').select('id', { count: 'exact', head: true }),
        window.db.from('organizations').select('id', { count: 'exact', head: true }).eq('active', true)
      ]);

      if (isStale(myGen)) return;

      const total = (totalRes && totalRes.count) || 0;
      const active = (activeRes && activeRes.count) || 0;

      setKpi('orgs', total, active > 0
        ? '<strong>' + fmtNum.format(active) + '</strong> ativas'
        : 'Nenhuma ativa');
    } catch (e) {
      if (isStale(myGen)) return;
      setKpiError('orgs');
    }
  }

  /* =========================================================
     Gráficos
     ========================================================= */
  function renderRevenueChart(validSales, startISO, endISO) {
    const canvas = document.getElementById('chart-revenue');
    const empty = canvas ? canvas.parentElement.querySelector('[data-empty]') : null;
    if (!canvas) return;

    if (typeof window.Chart === 'undefined') {
      if (empty) {
        empty.hidden = false;
        const p = empty.querySelector('p');
        if (p) p.textContent = 'Biblioteca de gráficos não disponível.';
      }
      return;
    }

    const start = new Date(startISO);
    const end = new Date(endISO);
    const buckets = new Map();
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor <= end) {
      const k = toDateKey(cursor);
      buckets.set(k, { label: fmtDate.format(cursor), total: 0, count: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    validSales.forEach(function (s) {
      const k = toDateKey(new Date(s.created_at));
      const b = buckets.get(k);
      if (b) { b.total += toNumber(s.total); b.count += 1; }
    });

    const arr = Array.from(buckets.values());
    const hasData = arr.some(function (b) { return b.total > 0; });

    if (!hasData) {
      if (state.charts.revenue) { state.charts.revenue.destroy(); state.charts.revenue = null; }
      if (empty) empty.hidden = false;
      canvas.style.display = 'none';
      return;
    }

    if (empty) empty.hidden = true;
    canvas.style.display = '';

    const labels = arr.map(function (b) { return b.label; });
    const totals = arr.map(function (b) { return b.total; });

    const styles = readChartTheme();

    if (state.charts.revenue) state.charts.revenue.destroy();
    state.charts.revenue = new window.Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Faturamento',
          data: totals,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,.12)',
          fill: true,
          tension: 0.32,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#6366f1',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: styles.tooltipBg,
            titleColor: styles.tooltipTitle,
            bodyColor: styles.tooltipBody,
            padding: 10,
            callbacks: {
              label: function (ctx) { return 'Faturamento: ' + fmtBRL.format(ctx.parsed.y); }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: styles.tick, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 16 }
          },
          y: {
            beginAtZero: true,
            grid: { color: styles.grid },
            ticks: {
              color: styles.tick,
              font: { size: 11 },
              callback: function (v) { return 'R$ ' + fmtNum.format(v); }
            }
          }
        }
      }
    });
  }

  function renderPaymentsChart(validSales) {
    const canvas = document.getElementById('chart-payments');
    const empty = canvas ? canvas.parentElement.querySelector('[data-empty]') : null;
    if (!canvas) return;

    if (typeof window.Chart === 'undefined') {
      if (empty) empty.hidden = false;
      return;
    }

    const map = new Map();
    validSales.forEach(function (s) {
      const key = s.payment_method || '';
      map.set(key, (map.get(key) || 0) + toNumber(s.total));
    });

    const entries = Array.from(map.entries())
      .filter(function (e) { return e[1] > 0; })
      .sort(function (a, b) { return b[1] - a[1]; });

    if (entries.length === 0) {
      if (state.charts.payments) { state.charts.payments.destroy(); state.charts.payments = null; }
      if (empty) empty.hidden = false;
      canvas.style.display = 'none';
      return;
    }

    if (empty) empty.hidden = true;
    canvas.style.display = '';

    const palette = ['#6366f1', '#059669', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#94a3b8'];
    const styles = readChartTheme();

    if (state.charts.payments) state.charts.payments.destroy();
    state.charts.payments = new window.Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: entries.map(function (e) { return PAYMENT_LABELS[e[0]] || e[0] || 'Outro'; }),
        datasets: [{
          data: entries.map(function (e) { return e[1]; }),
          backgroundColor: palette.slice(0, entries.length),
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle',
              padding: 12, color: styles.legend,
              font: { size: 11.5 }
            }
          },
          tooltip: {
            backgroundColor: styles.tooltipBg,
            titleColor: styles.tooltipTitle,
            bodyColor: styles.tooltipBody,
            padding: 10,
            callbacks: {
              label: function (ctx) {
                const total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                const pct = total > 0 ? (ctx.parsed / total * 100).toFixed(1) : '0';
                return ctx.label + ': ' + fmtBRL.format(ctx.parsed) + ' (' + pct + '%)';
              }
            }
          }
        }
      }
    });
  }

  function readChartTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      tick: isDark ? '#94a3b8' : '#9ca3af',
      grid: isDark ? 'rgba(148,163,184,.10)' : '#f3f4f6',
      legend: isDark ? '#cbd5e1' : '#4b5563',
      tooltipBg: isDark ? '#0f172a' : '#111827',
      tooltipTitle: '#fff',
      tooltipBody: '#e5e7eb'
    };
  }

  document.addEventListener('theme:changed', function () {
    if (!state.charts.revenue && !state.charts.payments) return;

    try {
      if (state.charts.revenue) {
        const cfg = state.charts.revenue.config;
        const canvas = state.charts.revenue.canvas;
        state.charts.revenue.destroy();
        state.charts.revenue = null;

        if (canvas) {
          const styles = readChartTheme();
          cfg.options.plugins.tooltip.backgroundColor = styles.tooltipBg;
          cfg.options.plugins.tooltip.titleColor = styles.tooltipTitle;
          cfg.options.plugins.tooltip.bodyColor = styles.tooltipBody;
          if (cfg.options.scales && cfg.options.scales.x) {
            cfg.options.scales.x.ticks.color = styles.tick;
          }
          if (cfg.options.scales && cfg.options.scales.y) {
            cfg.options.scales.y.ticks.color = styles.tick;
            cfg.options.scales.y.grid.color = styles.grid;
          }
          state.charts.revenue = new window.Chart(canvas.getContext('2d'), cfg);
        }
      }

      if (state.charts.payments) {
        const cfg = state.charts.payments.config;
        const canvas = state.charts.payments.canvas;
        state.charts.payments.destroy();
        state.charts.payments = null;

        if (canvas) {
          const styles = readChartTheme();
          cfg.options.plugins.tooltip.backgroundColor = styles.tooltipBg;
          cfg.options.plugins.tooltip.titleColor = styles.tooltipTitle;
          cfg.options.plugins.tooltip.bodyColor = styles.tooltipBody;
          if (cfg.options.plugins.legend && cfg.options.plugins.legend.labels) {
            cfg.options.plugins.legend.labels.color = styles.legend;
          }
          state.charts.payments = new window.Chart(canvas.getContext('2d'), cfg);
        }
      }
    } catch (e) {
      console.warn('[DEV HUB] Falha ao redesenhar charts no tema:', e);
    }
  });

  /* =========================================================
     Rankings
     ========================================================= */
  async function loadTopProducts(startISO, endISO, myGen) {
    const wrap = document.getElementById('dash-top-products');
    if (!wrap) return;

    try {
      if (!state.currentOrgId) throw new Error('no-org');

      const salesRes = await window.db.from('sales')
        .select('id, status')
        .eq('organization_id', state.currentOrgId)
        .gte('created_at', startISO).lte('created_at', endISO);

      if (salesRes.error) throw salesRes.error;
      if (isStale(myGen)) return;

      const ids = (salesRes.data || [])
        .filter(function (s) { return CANCELED.indexOf(String(s.status || '').toLowerCase()) === -1; })
        .map(function (s) { return s.id; });

      if (ids.length === 0) return renderEmptyRank(wrap, 'Nenhuma venda no período.');

      const itemsRes = await window.db.from('sale_items')
        .select('product_id, product_name, quantity, subtotal')
        .in('sale_id', ids);
      if (itemsRes.error) throw itemsRes.error;
      if (isStale(myGen)) return;

      const map = new Map();
      (itemsRes.data || []).forEach(function (it) {
        const key = it.product_id || ('name:' + it.product_name);
        if (!map.has(key)) map.set(key, { name: it.product_name || '—', qty: 0, total: 0 });
        const e = map.get(key);
        e.qty += toNumber(it.quantity);
        e.total += toNumber(it.subtotal);
      });

      const rows = Array.from(map.values())
        .sort(function (a, b) { return b.qty - a.qty; })
        .slice(0, 5);

      if (rows.length === 0) return renderEmptyRank(wrap, 'Sem itens de venda no período.');

      const max = rows[0].qty || 1;
      wrap.innerHTML = rows.map(function (r, i) {
        const pct = (r.qty / max) * 100;
        return (
          '<div class="rank-item">' +
            '<div class="rank-item__pos">' + (i + 1) + '</div>' +
            '<div class="rank-item__body">' +
              '<span class="rank-item__name">' + escapeHTML(r.name) + '</span>' +
              '<div class="rank-item__bar"><span style="width:' + pct.toFixed(1) + '%"></span></div>' +
            '</div>' +
            '<div class="rank-item__value">' + fmtNum.format(r.qty) +
              '<small>' + fmtBRL.format(r.total) + '</small>' +
            '</div>' +
          '</div>'
        );
      }).join('');
    } catch (e) {
      if (isStale(myGen)) return;
      renderEmptyRank(wrap, 'Não foi possível carregar os produtos.');
    }
  }

  async function loadTopCustomers(startISO, endISO, myGen) {
    const wrap = document.getElementById('dash-top-customers');
    if (!wrap) return;

    try {
      if (!state.currentOrgId) throw new Error('no-org');

      const salesRes = await window.db.from('sales')
        .select('customer_id, total, status')
        .eq('organization_id', state.currentOrgId)
        .gte('created_at', startISO).lte('created_at', endISO);

      if (salesRes.error) throw salesRes.error;
      if (isStale(myGen)) return;

      const valid = (salesRes.data || []).filter(function (s) {
        return CANCELED.indexOf(String(s.status || '').toLowerCase()) === -1 && s.customer_id;
      });

      if (valid.length === 0) return renderEmptyRank(wrap, 'Nenhuma venda com cliente no período.');

      const map = new Map();
      valid.forEach(function (s) {
        if (!map.has(s.customer_id)) map.set(s.customer_id, { id: s.customer_id, count: 0, total: 0 });
        const e = map.get(s.customer_id);
        e.count += 1;
        e.total += toNumber(s.total);
      });

      const rows = Array.from(map.values())
        .sort(function (a, b) { return b.total - a.total; })
        .slice(0, 5);

      const ids = rows.map(function (r) { return r.id; });
      const namesRes = await window.db.from('customers')
        .select('id, name')
        .eq('organization_id', state.currentOrgId)
        .in('id', ids);
      if (isStale(myGen)) return;

      const names = {};
      (namesRes.data || []).forEach(function (c) { names[c.id] = c.name; });

      if (rows.length === 0) return renderEmptyRank(wrap, 'Nenhuma venda com cliente no período.');

      const max = rows[0].total || 1;
      wrap.innerHTML = rows.map(function (r, i) {
        const pct = (r.total / max) * 100;
        const name = names[r.id] || 'Cliente';
        return (
          '<div class="rank-item">' +
            '<div class="rank-item__pos">' + (i + 1) + '</div>' +
            '<div class="rank-item__body">' +
              '<span class="rank-item__name">' + escapeHTML(name) + '</span>' +
              '<div class="rank-item__bar"><span style="width:' + pct.toFixed(1) + '%"></span></div>' +
            '</div>' +
            '<div class="rank-item__value">' + fmtBRL.format(r.total) +
              '<small>' + fmtNum.format(r.count) + (r.count === 1 ? ' compra' : ' compras') + '</small>' +
            '</div>' +
          '</div>'
        );
      }).join('');
    } catch (e) {
      if (isStale(myGen)) return;
      renderEmptyRank(wrap, 'Não foi possível carregar os clientes.');
    }
  }

  function renderEmptyRank(wrap, msg) {
    wrap.innerHTML = '<p class="dash-empty dash-empty--inline">' + escapeHTML(msg) + '</p>';
  }

  /* =========================================================
     Estoque + Alertas
     ========================================================= */
  async function loadStockAlerts(myGen) {
    const alertsWrap = document.getElementById('dash-alerts');
    const stockWrap = document.getElementById('dash-stock-list');

    try {
      if (!state.currentOrgId) throw new Error('no-org');

      const res = await window.db.from('products')
        .select('id, name, stock, minimum_stock, active')
        .eq('organization_id', state.currentOrgId)
        .order('stock', { ascending: true });

      if (res.error) throw res.error;
      if (isStale(myGen)) return;

      const all = res.data || [];
      const out = all.filter(function (p) { return toNumber(p.stock) === 0; });
      const low = all.filter(function (p) {
        const s = toNumber(p.stock), m = toNumber(p.minimum_stock);
        return s > 0 && s <= m;
      });

      renderAlerts(alertsWrap, { out, low });
      renderStockList(stockWrap, { out, low });
    } catch (e) {
      if (isStale(myGen)) return;
      if (alertsWrap) alertsWrap.innerHTML = '<p class="dash-empty dash-empty--inline">Não foi possível carregar os alertas.</p>';
      if (stockWrap)  stockWrap.innerHTML  = '<p class="dash-empty dash-empty--inline">Não foi possível carregar o estoque.</p>';
    }
  }

  function renderAlerts(wrap, data) {
    if (!wrap) return;
    const alerts = [];

    if (data.out.length > 0) {
      alerts.push({
        kind: 'danger',
        icon: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
        text: '<strong>' + data.out.length + '</strong> ' +
              (data.out.length === 1 ? 'produto está' : 'produtos estão') + ' sem estoque',
        href: 'estoque.html'
      });
    }

    if (data.low.length > 0) {
      alerts.push({
        kind: 'warn',
        icon: '<path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
        text: '<strong>' + data.low.length + '</strong> ' +
              (data.low.length === 1 ? 'produto está' : 'produtos estão') + ' com estoque baixo',
        href: 'estoque.html'
      });
    }

    if (alerts.length === 0) {
      wrap.innerHTML = '<p class="dash-empty dash-empty--inline">Tudo em ordem. Nenhum alerta no momento.</p>';
      return;
    }

    wrap.innerHTML = alerts.map(function (a) {
      return (
        '<div class="alert-item alert-item--' + a.kind + '">' +
          '<span class="alert-item__icon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
                 'stroke-linecap="round" stroke-linejoin="round">' + a.icon + '</svg>' +
          '</span>' +
          '<span class="alert-item__text">' + a.text + '</span>' +
          '<a class="alert-item__link" href="' + a.href + '">Ver</a>' +
        '</div>'
      );
    }).join('');
  }

  function renderStockList(wrap, data) {
    if (!wrap) return;

    const list = data.out.concat(data.low).slice(0, 8);

    if (list.length === 0) {
      wrap.innerHTML = '<p class="dash-empty dash-empty--inline">Nenhum produto em estado crítico.</p>';
      return;
    }

    wrap.innerHTML = list.map(function (p) {
      const isOut = toNumber(p.stock) === 0;
      const cls = isOut ? 'stock-pill--out' : 'stock-pill--low';
      return (
        '<a class="stock-pill ' + cls + '" href="estoque.html">' +
          '<span class="stock-pill__dot"></span>' +
          '<span class="stock-pill__name">' + escapeHTML(p.name || '—') + '</span>' +
          '<span class="stock-pill__qty">' + fmtNum.format(toNumber(p.stock)) + ' un.</span>' +
        '</a>'
      );
    }).join('');
  }

  /* =========================================================
     Activity feed
     ========================================================= */
  async function loadActivityFeed(myGen) {
    const wrap = document.getElementById('dash-feed');
    if (!wrap) return;

    try {
      if (!state.currentOrgId) throw new Error('no-org');

      const res = await window.db
        .from('activity_log')
        .select('id, actor_name, action, entity_type, entity_name, metadata, created_at')
        .eq('organization_id', state.currentOrgId)
        .order('created_at', { ascending: false })
        .limit(12);

      if (res.error) throw res.error;
      if (isStale(myGen)) return;

      const rows = res.data || [];

      if (rows.length === 0) {
        wrap.innerHTML = '<p class="dash-empty dash-empty--inline">Ainda não há atividades registradas. Quando algo acontecer no sistema, aparecerá aqui.</p>';
        return;
      }

      wrap.innerHTML = rows.map(buildFeedItem).join('');
    } catch (e) {
      if (isStale(myGen)) return;
      console.error('[DEV HUB] Falha ao carregar atividade:', e);
      wrap.innerHTML = '<p class="dash-empty dash-empty--inline">Não foi possível carregar a atividade recente.</p>';
    }
  }

  function buildFeedItem(row) {
    const iconKey = iconForEntity(row.entity_type);
    const text = describeAction(row);
    const time = timeAgo(row.created_at);
    const actor = row.actor_name || 'Sistema';

    const iconSVG = FEED_ICONS[iconKey] || FEED_ICONS.default;

    return (
      '<div class="feed-item">' +
        '<span class="feed-item__icon feed-item__icon--' + iconKey + '" aria-hidden="true">' +
          iconSVG +
        '</span>' +
        '<div class="feed-item__body">' +
          '<p class="feed-item__text">' + text + '</p>' +
          '<p class="feed-item__meta">por <strong>' + escapeHTML(actor) + '</strong></p>' +
        '</div>' +
        '<span class="feed-item__time">' + escapeHTML(time) + '</span>' +
      '</div>'
    );
  }

  function iconForEntity(type) {
    switch (type) {
      case 'sale':           return 'sale';
      case 'customer':       return 'customer';
      case 'product':        return 'product';
      case 'user':           return 'user';
      case 'organization':   return 'org';
      case 'stock_movement': return 'movement';
      default:               return 'default';
    }
  }

  const FEED_ICONS = {
    sale:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>' +
      '<path d="M2.5 3.5h2.3l2.3 11.6a1.8 1.8 0 0 0 1.8 1.4h8.8a1.8 1.8 0 0 0 1.8-1.4L21 7.5H6"/></svg>',
    customer:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/>' +
      '<circle cx="9" cy="7.5" r="3.5"/></svg>',
    product:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="m21 8-9-5-9 5v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 21v-8"/></svg>',
    user:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/>' +
      '<circle cx="9" cy="7.5" r="3.5"/>' +
      '<path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/></svg>',
    org:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/>' +
      '<path d="M15 21V9h4a2 2 0 0 1 2 2v10"/></svg>',
    movement:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="m12 2.5 9 5-9 5-9-5z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 17.5 9 5 9-5"/></svg>',
    default:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>'
  };

  function describeAction(row) {
    const rawName = row.entity_name;
    const entity = (rawName && String(rawName).trim())
      ? escapeHTML(String(rawName))
      : '<em>(sem nome)</em>';

    const action = row.action;
    const type = row.entity_type;

    let meta = row.metadata || {};
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta) || {}; }
      catch (e) { meta = {}; }
    }

    if (type === 'sale') {
      return 'Nova venda registrada para <em>' + entity + '</em>';
    }
    if (type === 'customer') {
      return action === 'delete'
        ? 'Cliente <em>' + entity + '</em> foi excluído'
        : 'Novo cliente cadastrado: <em>' + entity + '</em>';
    }
    if (type === 'product') {
      return action === 'delete'
        ? 'Produto <em>' + entity + '</em> foi excluído'
        : 'Novo produto cadastrado: <em>' + entity + '</em>';
    }
    if (type === 'user') {
      return 'Novo usuário vinculado: <em>' + entity + '</em>';
    }
    if (type === 'organization') {
      return 'Nova empresa cadastrada: <em>' + entity + '</em>';
    }
    if (type === 'stock_movement') {
      const t = String(meta.type || '').toLowerCase();
      const qty = meta.quantity != null ? meta.quantity : '—';
      const label = t === 'entrada' ? 'entrada'
                  : t === 'saida'   ? 'saída'
                  : 'ajuste';
      return 'Movimentação de estoque (' + label + ' de ' + escapeHTML(String(qty)) + ') em <em>' + entity + '</em>';
    }
    return 'Ação em <em>' + entity + '</em>';
  }

  function timeAgo(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    const diff = Math.max(0, Date.now() - then);
    const s = Math.floor(diff / 1000);
    if (s < 45)     return 'agora';
    if (s < 90)     return 'há 1 min';
    const m = Math.floor(s / 60);
    if (m < 60)     return 'há ' + m + ' min';
    const h = Math.floor(m / 60);
    if (h < 24)     return 'há ' + h + (h === 1 ? ' hora' : ' horas');
    const d = Math.floor(h / 24);
    if (d < 7)      return 'há ' + d + (d === 1 ? ' dia' : ' dias');
    const w = Math.floor(d / 7);
    if (w < 5)      return 'há ' + w + (w === 1 ? ' semana' : ' semanas');
    return fmtDateFull.format(new Date(iso));
  }

  /* =========================================================
     Helpers de KPI
     ========================================================= */
  function setKpi(key, value, hint) {
    const el = document.querySelector('[data-kpi="' + key + '"]');
    if (!el) return;
    const valueEl = el.querySelector('[data-value]');
    const hintEl = el.querySelector('[data-hint]');

    if (valueEl) {
      valueEl.classList.remove('skeleton');
      if (typeof value === 'number') {
        animateNumber(valueEl, value, function (n) { return fmtNum.format(n); });
      } else {
        valueEl.textContent = value;
      }
    }
    if (hintEl && hint) hintEl.innerHTML = hint;
  }

  function setKpiError(key) {
    const el = document.querySelector('[data-kpi="' + key + '"]');
    if (!el) return;
    const valueEl = el.querySelector('[data-value]');
    const hintEl = el.querySelector('[data-hint]');
    if (valueEl) { valueEl.classList.remove('skeleton'); valueEl.textContent = '—'; }
    if (hintEl) hintEl.textContent = 'Indisponível agora';
  }

  function animateNumber(el, target, format) {
    const prev = numberAnimations.get(el);
    if (prev && typeof prev.cancel === 'function') prev.cancel();

    const duration = 700;
    const startTime = performance.now();
    let raf = null;
    let cancelled = false;

    function tick(now) {
      if (cancelled) return;
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        el.textContent = format(target);
        numberAnimations.delete(el);
      }
    }
    raf = requestAnimationFrame(tick);

    numberAnimations.set(el, {
      cancel: function () {
        cancelled = true;
        if (raf) cancelAnimationFrame(raf);
        numberAnimations.delete(el);
      }
    });
  }

  function renderEmptyChart(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const empty = canvas.parentElement.querySelector('[data-empty]');
    canvas.style.display = 'none';
    if (empty) empty.hidden = false;
  }

  /* =========================================================
     Helpers
     ========================================================= */
  function toNumber(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function toDateInput(date) { return toDateKey(date); }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function getInputValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* =========================================================
     Toasts
     ========================================================= */
  const TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>'
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
    close.setAttribute('aria-label', 'Fechar');
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    close.addEventListener('click', function () { toast.remove(); });

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(close);
    region.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('is-leaving');
      setTimeout(function () { toast.remove(); }, 300);
    }, 4000);
  }

})();