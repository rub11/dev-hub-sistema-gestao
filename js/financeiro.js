/* =========================================================
   DEV HUB · Financeiro · Multi-abas
   ---------------------------------------------------------
   Abas: A Pagar · A Receber · Todos os Títulos · Movimentações · Transferências
   + Baixa com múltiplas formas de pagamento
   + Transferência entre contas
   + Cabeçalho contextual (título/subtítulo/ícone dinâmicos)
   + Indicador deslizante nas abas
   + Contadores com bump
   + Modal de título visual ERP (estilo Sankhya)
   + Modo Grade / Tabela (títulos clicáveis abrem o modal)
   + FIX: organização resolvida no insert (sessionStorage → profiles)
   + FIX: erros visíveis (feedback + toast + console)
   ========================================================= */

(function () {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHTML = (s) =>
    String(s || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));

  const fmtBRL = (cents) =>
    ((Number(cents) || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
  };

  const parseBRLToCents = (str) => {
    if (str == null || str === '') return 0;
    const clean = String(str)
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : Math.round(n * 100);
  };

  const todayISO = () => new Date().toISOString().slice(0, 10);

  const db = () => {
    if (window.db && window.db.from) return window.db;
    throw new Error('Supabase client não encontrado.');
  };

  const toast = (msg, kind) => {
    if (window.Toast && typeof window.Toast.show === 'function') {
      return window.Toast.show(msg, kind);
    }
    const el = document.createElement('div');
    el.className = kind === 'error' ? 'fin-err' : '';
    el.style.cssText =
      'position:fixed;top:80px;right:20px;z-index:200;max-width:360px;' +
      'padding:12px 16px;border-radius:10px;background:' +
      (kind === 'error' ? 'var(--danger-soft)' : 'var(--accent-soft)') +
      ';color:' + (kind === 'error' ? 'var(--danger)' : 'var(--accent-hover)') +
      ';box-shadow:0 12px 32px -8px rgba(16,24,40,.24);font-size:13.5px';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  };

  /* =========================================================
     ESTADO
     ========================================================= */
  const state = {
    tab: 'pagar',
    viewMode: 'table',
    entries: [],
    movements: [],
    transfers: [],
    accounts: [],
    selected: new Set(),
    currentUser: null,
    filters: {
      kind: '',
      status: 'pendente',
      dueFrom: '',
      dueTo: '',
      issueFrom: '',
      issueTo: '',
      settleFrom: '',
      settleTo: '',
      doc: '',
      partner: '',
      company: '',
      nature: '',
      account: '',
      min: null,
      max: null,
      notes: '',
      quick: {
        receitas: false,
        real: false,
        pendentes: true,
        despesas: false,
        provisao: false,
        baixados: false
      }
    }
  };

  const STATUS_LABEL = {
    pendente:  'Pendente',
    baixado:   'Baixado',
    provisao:  'Provisão',
    estornado: 'Estornado',
    cancelado: 'Cancelado'
  };

  const KIND_LABEL = {
    receita: 'Receita',
    despesa: 'Despesa'
  };

  const PAYMENT_METHODS = {
    pix:               'PIX',
    ted:               'TED',
    doc:               'DOC',
    transferencia:     'Transferência',
    boleto:            'Boleto',
    dinheiro:          'Dinheiro',
    cartao_credito:    'Cartão de crédito',
    cartao_debito:     'Cartão de débito',
    cheque:            'Cheque',
    debito_automatico: 'Débito automático',
    outro:             'Outro'
  };

  const MOV_TYPE_LABEL = {
    entrada:       'Entrada',
    saida:         'Saída',
    transferencia: 'Transferência',
    ajuste:        'Ajuste',
    estorno:       'Estorno'
  };

  /* =========================================================
     ORGANIZAÇÃO (resolução robusta)
     ========================================================= */
  function resolveOrgIdSync() {
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (raw) {
        const ctx = JSON.parse(raw);
        if (ctx && ctx.organization_id) return ctx.organization_id;
      }
    } catch (e) { /* ignora */ }
    return null;
  }

  async function resolveOrgIdAsync() {
    const fast = resolveOrgIdSync();
    if (fast) return fast;

    try {
      const { data: u } = await db().auth.getUser();
      if (u && u.user) {
        const { data: prof } = await db().from('profiles')
          .select('organization_id').eq('id', u.user.id).maybeSingle();
        if (prof && prof.organization_id) return prof.organization_id;
      }
    } catch (e) { console.warn('[fin] resolveOrgIdAsync:', e); }
    return null;
  }

  /* =========================================================
     NAVEGAÇÃO CONTEXTUAL DAS ABAS PRINCIPAIS
     ========================================================= */
  const TAB_CONTEXT = {
    pagar: {
      title: 'Contas a pagar',
      subtitle: 'Gerencie seus compromissos financeiros, vencimentos e baixas.',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>`
    },
    receber: {
      title: 'Contas a receber',
      subtitle: 'Acompanhe seus recebimentos, vencimentos e valores em aberto.',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`
    },
    todos: {
      title: 'Todos os títulos',
      subtitle: 'Visão unificada de contas a pagar, a receber e demais lançamentos.',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/></svg>`
    },
    movimentos: {
      title: 'Movimentações financeiras',
      subtitle: 'Acompanhe todas as entradas, saídas e movimentações das suas contas.',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>`
    },
    transferencias: {
      title: 'Transferências',
      subtitle: 'Gerencie transferências entre suas contas financeiras.',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7h12l-4-4"/><path d="M16 17H4l4 4"/></svg>`
    }
  };

  let headSwapToken = 0;

  function swapHeadText(title, subtitle) {
    const titleEl = document.getElementById('finHeadTitle');
    const subEl   = document.getElementById('finHeadSub');
    if (!titleEl || !subEl) return;

    headSwapToken += 1;
    const myToken = headSwapToken;

    titleEl.classList.remove('is-leaving', 'is-entering');
    subEl.classList.remove('is-leaving', 'is-entering');
    void titleEl.offsetWidth;

    titleEl.classList.add('is-leaving');
    subEl.classList.add('is-leaving');

    setTimeout(() => {
      if (myToken !== headSwapToken) return;
      titleEl.textContent = title;
      subEl.textContent = subtitle;
      titleEl.classList.remove('is-leaving');
      subEl.classList.remove('is-leaving');
      void titleEl.offsetWidth;
      titleEl.classList.add('is-entering');
      subEl.classList.add('is-entering');
      setTimeout(() => {
        if (myToken !== headSwapToken) return;
        titleEl.classList.remove('is-entering');
        subEl.classList.remove('is-entering');
      }, 320);
    }, 180);
  }

  function swapHeadIcon(svgHTML) {
    const el = document.getElementById('finHeadIcon');
    if (!el) return;
    el.innerHTML = svgHTML;
    el.classList.remove('is-swapping');
    void el.offsetWidth;
    el.classList.add('is-swapping');
    el.addEventListener('animationend', () => el.classList.remove('is-swapping'), { once: true });
  }

  function applyTabContext(tab, animate = true) {
    const ctx = TAB_CONTEXT[tab];
    if (!ctx) return;

    if (animate) {
      swapHeadText(ctx.title, ctx.subtitle);
      swapHeadIcon(ctx.icon);
    } else {
      const titleEl = document.getElementById('finHeadTitle');
      const subEl   = document.getElementById('finHeadSub');
      const iconEl  = document.getElementById('finHeadIcon');
      if (titleEl) titleEl.textContent = ctx.title;
      if (subEl)   subEl.textContent   = ctx.subtitle;
      if (iconEl)  iconEl.innerHTML    = ctx.icon;
    }
  }

  function moveIndicator() {
    const nav = document.querySelector('.fin-tabs--main');
    if (!nav) return;
    const ind = nav.querySelector('.fin-tabs__indicator');
    const active = nav.querySelector('.fin-tab.is-active');
    if (!ind || !active) return;

    const navRect = nav.getBoundingClientRect();
    const tabRect = active.getBoundingClientRect();
    const navStyles = getComputedStyle(nav);
    const borderLeft = parseFloat(navStyles.borderLeftWidth) || 0;

    ind.style.width = tabRect.width + 'px';
    ind.style.transform = `translateX(${tabRect.left - navRect.left - borderLeft}px)`;
  }

  function setCount(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const next = String(value);
    if (el.textContent === next) return;
    el.textContent = next;
    el.classList.remove('is-bumping');
    void el.offsetWidth;
    el.classList.add('is-bumping');
    el.addEventListener('animationend', () => el.classList.remove('is-bumping'), { once: true });
  }

  /* =========================================================
     MODO DE VISUALIZAÇÃO (tabela / grade)
     ========================================================= */
  function setViewMode(mode) {
    if (mode !== 'table' && mode !== 'grid') return;
    state.viewMode = mode;

    $$('.fin-view-btn').forEach((b) => {
      const on = b.dataset.view === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });

    $$('.fin-view-host').forEach((host) => {
      host.querySelectorAll('[data-view]').forEach((el) => {
        el.hidden = el.dataset.view !== mode;
      });
    });
  }

  function setupViewToggles() {
    $$('.fin-view-toggle').forEach((group) => {
      group.addEventListener('click', (e) => {
        const btn = e.target.closest('.fin-view-btn');
        if (!btn) return;
        setViewMode(btn.dataset.view);
      });
    });

    setViewMode(state.viewMode);
  }

  /* =========================================================
     CARREGAMENTO
     ========================================================= */
  async function loadUser() {
    try {
      const { data: u } = await db().auth.getUser();
      if (u && u.user) {
        const { data: prof } = await db().from('profiles')
          .select('id, name, email').eq('id', u.user.id).maybeSingle();
        state.currentUser = prof || { id: u.user.id, name: u.user.email };
      }
    } catch (e) { console.warn(e); }
  }

  async function loadAccounts() {
    try {
      const { data, error } = await db().from('financial_accounts')
        .select('id, name, bank_name, account_type, current_balance_cents, active')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      state.accounts = data || [];
      populateAccountFilter();
    } catch (e) {
      console.error(e);
      state.accounts = [];
    }
  }

  async function loadEntries() {
    try {
      const { data, error } = await db().from('financial_entries')
        .select('*')
        .order('due_date', { ascending: true })
        .limit(500);
      if (error) throw error;
      state.entries = data || [];
    } catch (e) {
      console.error(e);
      state.entries = [];
    }
  }

  async function loadMovements() {
    try {
      const { data, error } = await db().from('financial_movements')
        .select(`
          id, account_id, type, amount_cents, movement_date,
          description, origin_type, balance_after_cents, reconciled,
          created_at
        `)
        .order('movement_date', { ascending: false })
        .order('created_at',   { ascending: false })
        .limit(500);
      if (error) throw error;
      state.movements = data || [];
    } catch (e) {
      console.error(e);
      state.movements = [];
    }
  }

  async function loadTransfers() {
    try {
      const { data, error } = await db().from('financial_transfers')
        .select('*')
        .order('transfer_date', { ascending: false })
        .order('created_at',    { ascending: false })
        .limit(200);
      if (error) throw error;
      state.transfers = data || [];
    } catch (e) {
      console.error(e);
      state.transfers = [];
    }
  }

  async function loadAll() {
    await Promise.all([
      loadEntries(),
      loadMovements(),
      loadTransfers(),
      loadAccounts()
    ]);
    renderAll();
  }

  function populateAccountFilter() {
    const sel = $('#f-account');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Todas as contas</option>' +
      state.accounts.map((a) => `<option value="${a.id}">${escapeHTML(a.name)}</option>`).join('');
    if (current) sel.value = current;
  }

  /* =========================================================
     TABS PRINCIPAIS
     ========================================================= */
  function setupTabs() {
    const nav = document.querySelector('.fin-tabs--main');
    if (!nav) return;

    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('.fin-tab');
      if (!btn || !btn.dataset.mainTab) return;
      switchTab(btn.dataset.mainTab);
    });

    nav.addEventListener('keydown', (e) => {
      const tabs = Array.from(nav.querySelectorAll('.fin-tab'));
      const idx = tabs.findIndex((t) => t.classList.contains('is-active'));
      let next = -1;
      if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
      if (e.key === 'ArrowLeft')  next = (idx - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home')       next = 0;
      if (e.key === 'End')        next = tabs.length - 1;
      if (next < 0) return;
      e.preventDefault();
      tabs[next].focus();
      switchTab(tabs[next].dataset.mainTab);
    });

    let rafId = null;
    const scheduleMove = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => { rafId = null; moveIndicator(); });
    };
    window.addEventListener('resize', scheduleMove);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleMove).catch(() => {});
    }

    requestAnimationFrame(moveIndicator);
  }

  function switchTab(tab) {
    if (state.tab === tab) return;
    state.tab = tab;
    state.selected.clear();

    $$('.fin-tabs--main .fin-tab').forEach((b) => {
      const on = b.dataset.mainTab === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
      b.setAttribute('tabindex', on ? '0' : '-1');
    });

    requestAnimationFrame(moveIndicator);
    applyTabContext(tab, true);

    $$('.fin-main > .fin-tabpane').forEach((p) => {
      const on = p.dataset.mainPane === tab;
      p.classList.toggle('is-active', on);
      if (on) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
    });

    renderAll();
  }

  /* =========================================================
     RENDER GENÉRICO
     ========================================================= */
  function renderAll() {
    setCount('count-pagar',
      state.entries.filter((e) => e.kind === 'despesa' && e.status === 'pendente').length);
    setCount('count-receber',
      state.entries.filter((e) => e.kind === 'receita' && e.status === 'pendente').length);
    setCount('count-todos', state.entries.length);
    setCount('count-movimentos', state.movements.length);
    setCount('count-transferencias', state.transfers.length);

    if (state.tab === 'pagar')          renderEntries('despesa', 'pagar');
    else if (state.tab === 'receber')   renderEntries('receita', 'receber');
    else if (state.tab === 'todos')     renderAllEntries();
    else if (state.tab === 'movimentos') renderMovements();
    else if (state.tab === 'transferencias') renderTransfers();

    updateFilterBadge();
  }

  /* =========================================================
     FILTROS
     ========================================================= */
  function applyEntryFilters(kind) {
    const f = state.filters;
    let rows = state.entries.filter((e) => e.kind === kind);

    if (f.status)     rows = rows.filter((r) => r.status === f.status);
    if (f.dueFrom)    rows = rows.filter((r) => r.due_date >= f.dueFrom);
    if (f.dueTo)      rows = rows.filter((r) => r.due_date <= f.dueTo);
    if (f.issueFrom)  rows = rows.filter((r) => (r.issue_date || '') >= f.issueFrom);
    if (f.issueTo)    rows = rows.filter((r) => (r.issue_date || '') <= f.issueTo);
    if (f.settleFrom) rows = rows.filter((r) => (r.settlement_date || '') >= f.settleFrom);
    if (f.settleTo)   rows = rows.filter((r) => (r.settlement_date || '') <= f.settleTo);
    if (f.doc)        rows = rows.filter((r) =>
      (r.doc_number || '').toLowerCase().includes(f.doc.toLowerCase()));
    if (f.partner)    rows = rows.filter((r) =>
      (r.partner_name || '').toLowerCase().includes(f.partner.toLowerCase()) ||
      (r.partner_doc  || '').toLowerCase().includes(f.partner.toLowerCase()));
    if (f.company)    rows = rows.filter((r) =>
      (r.company_name || '').toLowerCase().includes(f.company.toLowerCase()));
    if (f.nature)     rows = rows.filter((r) =>
      (r.nature_name || '').toLowerCase().includes(f.nature.toLowerCase()));
    if (f.notes)      rows = rows.filter((r) =>
      (r.notes || '').toLowerCase().includes(f.notes.toLowerCase()));
    if (f.min != null) rows = rows.filter((r) => Number(r.amount_cents) >= f.min);
    if (f.max != null) rows = rows.filter((r) => Number(r.amount_cents) <= f.max);

    const q = f.quick;
    if (q.pendentes && !q.baixados) rows = rows.filter((r) => r.status === 'pendente');
    if (q.baixados && !q.pendentes) rows = rows.filter((r) => r.status === 'baixado');
    if (q.provisao) rows = rows.filter((r) => r.status === 'provisao');

    return rows;
  }

  function applyAllEntriesFilters() {
    const f = state.filters;
    let rows = state.entries.slice();

    if (f.dueFrom)    rows = rows.filter((r) => r.due_date >= f.dueFrom);
    if (f.dueTo)      rows = rows.filter((r) => r.due_date <= f.dueTo);
    if (f.issueFrom)  rows = rows.filter((r) => (r.issue_date || '') >= f.issueFrom);
    if (f.issueTo)    rows = rows.filter((r) => (r.issue_date || '') <= f.issueTo);
    if (f.settleFrom) rows = rows.filter((r) => (r.settlement_date || '') >= f.settleFrom);
    if (f.settleTo)   rows = rows.filter((r) => (r.settlement_date || '') <= f.settleTo);
    if (f.doc)        rows = rows.filter((r) =>
      (r.doc_number || '').toLowerCase().includes(f.doc.toLowerCase()));
    if (f.partner)    rows = rows.filter((r) =>
      (r.partner_name || '').toLowerCase().includes(f.partner.toLowerCase()) ||
      (r.partner_doc  || '').toLowerCase().includes(f.partner.toLowerCase()));
    if (f.company)    rows = rows.filter((r) =>
      (r.company_name || '').toLowerCase().includes(f.company.toLowerCase()));
    if (f.nature)     rows = rows.filter((r) =>
      (r.nature_name || '').toLowerCase().includes(f.nature.toLowerCase()));
    if (f.notes)      rows = rows.filter((r) =>
      (r.notes || '').toLowerCase().includes(f.notes.toLowerCase()));
    if (f.min != null) rows = rows.filter((r) => Number(r.amount_cents) >= f.min);
    if (f.max != null) rows = rows.filter((r) => Number(r.amount_cents) <= f.max);

    rows.sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')));

    return rows;
  }

  /* =========================================================
     RENDER · ENTRADAS (tabela + grid)
     ========================================================= */
  function getViewHost(tab) {
    return document.querySelector(`[data-main-pane="${tab}"] [data-view-host]`);
  }

  function renderEntries(kind, tab) {
    const host = getViewHost(tab);
    if (!host) return;

    const rows = applyEntryFilters(kind);
    const tableEl = host.querySelector('[data-view="table"]');
    const gridEl  = host.querySelector('[data-view="grid"]');

    if (tableEl) tableEl.hidden = state.viewMode !== 'table';
    if (gridEl)  gridEl.hidden  = state.viewMode !== 'grid';

    const tbody = tableEl ? tableEl.querySelector('tbody') : null;
    renderEntryTable(tbody, tab, rows, /*showKind*/ false);
    renderEntryGrid(gridEl, tab, rows);

    renderTotals(tab, rows);
  }

  function renderAllEntries() {
    const host = getViewHost('todos');
    if (!host) return;

    const rows = applyAllEntriesFilters();
    const tableEl = host.querySelector('[data-view="table"]');
    const gridEl  = host.querySelector('[data-view="grid"]');

    if (tableEl) tableEl.hidden = state.viewMode !== 'table';
    if (gridEl)  gridEl.hidden  = state.viewMode !== 'grid';

    const tbody = tableEl ? tableEl.querySelector('tbody') : null;
    renderEntryTable(tbody, 'todos', rows, /*showKind*/ true);
    renderEntryGrid(gridEl, 'todos', rows);

    renderTotals('todos', rows);
  }

  function renderEntryTable(tbody, tab, rows, showKind) {
    if (!tbody) return;
    const colSpan = showKind ? 9 : 10;

    if (!rows.length) {
      tbody.innerHTML = `
        <tr><td colspan="${colSpan}" style="padding:0;border:0">
          <div class="fin-empty">
            <div class="fin-empty__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M2.5 10h19"/>
              </svg>
            </div>
            <h3 class="fin-empty__title">Nenhum título encontrado</h3>
            <p class="fin-empty__text">Ajuste os filtros ou crie um novo lançamento.</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r) => {
      const sel = state.selected.has(r.id) ? ' is-selected' : '';
      const stClass = 'fin-badge--' + r.status;
      const bal = Number(r.current_balance_cents || (r.amount_cents - (r.paid_cents || 0)));
      const amountClass = r.kind === 'receita' ? 'fin-money--positive' : 'fin-money--negative';
      const sign = r.kind === 'receita' ? '+' : '-';

      const kindCell = showKind
        ? `<td><span class="fin-badge fin-badge--${r.kind}">${escapeHTML(KIND_LABEL[r.kind] || r.kind)}</span></td>`
        : '';

      const checkboxCell = showKind
        ? ''
        : `<td><input type="checkbox" data-check="${r.id}" ${sel ? 'checked' : ''} /></td>`;

      return `
        <tr data-id="${r.id}" class="${sel} fin-row-clickable">
          ${checkboxCell}
          ${kindCell}
          <td>
            <div class="fin-code">${escapeHTML(r.title_code || r.doc_number || '—')}</div>
            <div class="fin-partner__meta">${escapeHTML(r.notes || '')}</div>
          </td>
          <td><span class="fin-badge ${stClass}">${escapeHTML(STATUS_LABEL[r.status] || r.status)}</span></td>
          <td>${fmtDate(r.due_date)}</td>
          <td>
            <div class="fin-partner">
              <span class="fin-partner__name">${escapeHTML(r.partner_name || '—')}</span>
              ${r.partner_doc ? `<span class="fin-partner__meta">${escapeHTML(r.partner_doc)}</span>` : ''}
            </div>
          </td>
          <td>${r.doc_number ? escapeHTML(r.doc_number) : '<span style="color:var(--text-muted)">—</span>'}</td>
          ${showKind ? '' : `
            <td>
              ${r.installment_number && r.installments_total
                ? `<span style="font-variant-numeric:tabular-nums">${r.installment_number}/${r.installments_total}</span>`
                : '<span style="color:var(--text-muted)">—</span>'}
            </td>`}
          <td class="cell--num">
            <span class="fin-money ${amountClass}">${sign} ${fmtBRL(r.amount_cents)}</span>
          </td>
          <td class="cell--num">
            <span class="fin-money">${fmtBRL(bal)}</span>
          </td>
          <td class="cell--right">
            <div class="fin-row-actions" style="display:inline-flex;gap:4px">
              ${r.status === 'pendente' ? `
                <button class="fin-btn fin-btn--ghost fin-btn--sm" data-action="settle-one" data-id="${r.id}" title="Baixar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </button>` : ''}
              ${r.status === 'baixado' ? `
                <button class="fin-btn fin-btn--ghost fin-btn--sm" data-action="reverse-one" data-id="${r.id}" title="Estornar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>
                </button>` : ''}
              <button class="fin-btn fin-btn--ghost fin-btn--sm" data-action="view-one" data-id="${r.id}" title="Abrir / editar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

    bindEntryRowActions(tbody);
  }

  function renderEntryGrid(gridEl, tab, rows) {
    if (!gridEl) return;

    if (!rows.length) {
      gridEl.innerHTML = `
        <div class="fin-empty" style="grid-column:1/-1">
          <div class="fin-empty__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M2.5 10h19"/>
            </svg>
          </div>
          <h3 class="fin-empty__title">Nenhum título encontrado</h3>
          <p class="fin-empty__text">Ajuste os filtros ou crie um novo lançamento.</p>
        </div>`;
      return;
    }

    gridEl.innerHTML = rows.map(buildEntryCard).join('');

    gridEl.querySelectorAll('.fin-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const row = state.entries.find((x) => x.id === id);
        if (row) openEntryModal(row);
      });
    });
  }

  function buildEntryCard(r) {
    const bal = Number(r.current_balance_cents || (r.amount_cents - (r.paid_cents || 0)));
    const stLabel = STATUS_LABEL[r.status] || r.status;
    const kindLabel = KIND_LABEL[r.kind] || r.kind;
    const valueClass = r.kind === 'receita' ? 'fin-money--positive' : 'fin-money--negative';
    const sign = r.kind === 'receita' ? '+' : '-';

    let dueMeta = '';
    let dueClass = '';
    if (r.due_date) {
      const today = new Date(todayISO() + 'T00:00:00');
      const due   = new Date(r.due_date + 'T00:00:00');
      const diffDays = Math.round((due - today) / 86400000);
      if (diffDays < 0 && r.status === 'pendente') {
        dueMeta = `Venceu há ${Math.abs(diffDays)}d`;
        dueClass = 'fin-card__due--late';
      } else if (diffDays === 0) {
        dueMeta = 'Vence hoje';
        dueClass = 'fin-card__due--today';
      } else if (diffDays > 0) {
        dueMeta = `Vence em ${diffDays}d`;
      } else {
        dueMeta = fmtDate(r.due_date);
      }
    }

    return `
      <button type="button" class="fin-card fin-card--${escapeHTML(r.kind || 'despesa')}"
              data-id="${escapeHTML(r.id)}"
              aria-label="Abrir título ${escapeHTML(r.title_code || r.doc_number || '')}">
        <header class="fin-card__head">
          <span class="fin-badge fin-badge--${escapeHTML(r.kind || 'despesa')}">${escapeHTML(kindLabel)}</span>
          <span class="fin-card__date">${fmtDate(r.due_date)}</span>
        </header>

        <h4 class="fin-card__title">${escapeHTML(r.title_code || r.doc_number || '—')}</h4>
        <p class="fin-card__partner">${escapeHTML(r.partner_name || '—')}</p>

        <div class="fin-card__value ${valueClass}">${sign} ${fmtBRL(r.amount_cents)}</div>

        <footer class="fin-card__foot">
          <span class="fin-badge fin-badge--${escapeHTML(r.status)}">${escapeHTML(stLabel)}</span>
          <span class="fin-card__due ${dueClass}">${escapeHTML(dueMeta)}</span>
        </footer>
      </button>
    `;
  }

  function bindEntryRowActions(tbody) {
    tbody.querySelectorAll('[data-check]').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.check;
        if (e.target.checked) state.selected.add(id);
        else state.selected.delete(id);
        e.target.closest('tr').classList.toggle('is-selected', e.target.checked);
        updateActionButtons();
      });
    });

    tbody.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const row = state.entries.find((x) => x.id === id);
        if (!row) return;
        if (btn.dataset.action === 'settle-one')  openSettleModal(row);
        if (btn.dataset.action === 'reverse-one') openReverseModal(row);
        if (btn.dataset.action === 'view-one')    openEntryModal(row);
      });
    });

    tbody.querySelectorAll('tr.fin-row-clickable').forEach((tr) => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button, input, a, select, label')) return;
        const id = tr.dataset.id;
        const row = state.entries.find((x) => x.id === id);
        if (row) openEntryModal(row);
      });
      tr.style.cursor = 'pointer';
    });

    updateActionButtons();
  }

  /* =========================================================
     TOTAIS
     ========================================================= */
  function renderTotals(tab, rows) {
    const wrap = $(`#fin-totals-${tab}`);
    if (!wrap) return;

    let receitas = 0, despesas = 0, baixado = 0, aberto = 0;

    rows.forEach((r) => {
      const a = Number(r.amount_cents) || 0;
      const p = Number(r.paid_cents) || 0;
      if (r.kind === 'receita') receitas += a; else despesas += a;
      baixado += p;
      aberto += Math.max(0, a - p);
    });

    if (tab === 'todos') {
      wrap.innerHTML = `
        <div class="fin-total">
          <span class="fin-total__label">Receitas</span>
          <span class="fin-total__value" style="color:var(--success)">${fmtBRL(receitas)}</span>
        </div>
        <div class="fin-total">
          <span class="fin-total__label">Despesas</span>
          <span class="fin-total__value" style="color:var(--danger)">${fmtBRL(despesas)}</span>
        </div>
        <div class="fin-total">
          <span class="fin-total__label">Rec-Desp</span>
          <span class="fin-total__value">${fmtBRL(receitas - despesas)}</span>
        </div>
        <div class="fin-total">
          <span class="fin-total__label">Baixado</span>
          <span class="fin-total__value">${fmtBRL(baixado)}</span>
        </div>
        <div class="fin-total fin-total--receita">
          <span class="fin-total__label">Em aberto</span>
          <span class="fin-total__value">${fmtBRL(aberto)}</span>
        </div>`;
      return;
    }

    let total = 0;
    rows.forEach((r) => { total += Number(r.amount_cents) || 0; });

    wrap.innerHTML = `
      <div class="fin-total">
        <span class="fin-total__label">Total</span>
        <span class="fin-total__value">${fmtBRL(total)}</span>
      </div>
      <div class="fin-total">
        <span class="fin-total__label">Baixado</span>
        <span class="fin-total__value">${fmtBRL(baixado)}</span>
      </div>
      <div class="fin-total fin-total--receita">
        <span class="fin-total__label">Em aberto</span>
        <span class="fin-total__value">${fmtBRL(aberto)}</span>
      </div>`;
  }

  /* =========================================================
     RENDER · MOVIMENTAÇÕES
     ========================================================= */
  function renderMovements() {
    const tbody = $('#fin-tbody-movimentos');
    if (!tbody) return;

    const accountFilter = state.filters.account;
    let rows = state.movements.slice();
    if (accountFilter) rows = rows.filter((m) => m.account_id === accountFilter);
    if (state.filters.dueFrom) rows = rows.filter((m) => m.movement_date >= state.filters.dueFrom);
    if (state.filters.dueTo)   rows = rows.filter((m) => m.movement_date <= state.filters.dueTo);

    if (!rows.length) {
      tbody.innerHTML = `
        <tr><td colspan="8" style="padding:0;border:0">
          <div class="fin-empty">
            <div class="fin-empty__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m7 15 3.5-4 3 2.5L20 7"/>
              </svg>
            </div>
            <h3 class="fin-empty__title">Nenhuma movimentação</h3>
            <p class="fin-empty__text">Não há movimentações no período selecionado.</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((m) => {
      const acc = state.accounts.find((a) => a.id === m.account_id);
      const isIn = Number(m.amount_cents) > 0;
      const cls = isIn ? 'fin-money--positive' : 'fin-money--negative';
      const sign = isIn ? '+' : '-';
      return `
        <tr>
          <td>${fmtDate(m.movement_date)}</td>
          <td>${escapeHTML(acc ? acc.name : '—')}</td>
          <td>${escapeHTML(MOV_TYPE_LABEL[m.type] || m.type)}</td>
          <td>${escapeHTML(m.description || '—')}</td>
          <td>
            ${m.origin_type
              ? `<span class="fin-badge" style="background:var(--surface-2);color:var(--text-muted)">${escapeHTML(m.origin_type)}</span>`
              : '—'}
          </td>
          <td class="cell--num">
            <span class="fin-money ${cls}">${sign} ${fmtBRL(Math.abs(m.amount_cents))}</span>
          </td>
          <td class="cell--num">
            <span class="fin-money">${m.balance_after_cents != null ? fmtBRL(m.balance_after_cents) : '—'}</span>
          </td>
          <td>
            ${m.reconciled
              ? '<span class="fin-badge fin-badge--baixado">Conciliado</span>'
              : '<span style="color:var(--text-muted);font-size:12px">—</span>'}
          </td>
        </tr>`;
    }).join('');
  }

  /* =========================================================
     RENDER · TRANSFERÊNCIAS
     ========================================================= */
  function renderTransfers() {
    const tbody = $('#fin-tbody-transferencias');
    if (!tbody) return;

    let rows = state.transfers.slice();
    if (state.filters.account) {
      rows = rows.filter((t) =>
        t.from_account_id === state.filters.account ||
        t.to_account_id   === state.filters.account);
    }

    if (!rows.length) {
      tbody.innerHTML = `
        <tr><td colspan="6" style="padding:0;border:0">
          <div class="fin-empty">
            <div class="fin-empty__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 10 2 5l5-5"/><path d="M2 5h13a5 5 0 0 1 0 10h-3"/>
                <path d="M17 14l5 5-5 5"/><path d="M22 19H9a5 5 0 0 1 0-10h3"/>
              </svg>
            </div>
            <h3 class="fin-empty__title">Nenhuma transferência</h3>
            <p class="fin-empty__text">Use o botão "Transferir" para mover saldo entre contas.</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((t) => {
      const from = state.accounts.find((a) => a.id === t.from_account_id);
      const to   = state.accounts.find((a) => a.id === t.to_account_id);
      return `
        <tr>
          <td>${fmtDate(t.transfer_date)}</td>
          <td>${escapeHTML(from ? from.name : '—')}</td>
          <td>${escapeHTML(to ? to.name : '—')}</td>
          <td>${escapeHTML(t.description || '—')}</td>
          <td class="cell--num"><span class="fin-money">${fmtBRL(t.amount_cents)}</span></td>
          <td>${escapeHTML(t.created_by_name || '—')}</td>
        </tr>`;
    }).join('');
  }

  /* =========================================================
     BADGE FILTROS
     ========================================================= */
  function updateFilterBadge() {
    const f = state.filters;
    let n = 0;
    ['kind','dueFrom','dueTo','issueFrom','issueTo','settleFrom','settleTo',
     'doc','partner','company','nature','account','notes'].forEach((k) => {
      if (f[k]) n++;
    });
    const badge = $('#fin-filter-count');
    if (badge) {
      badge.textContent = String(n);
      badge.style.background = n > 0 ? '#ef4444' : 'var(--border)';
      badge.style.color = n > 0 ? '#fff' : 'var(--text-muted)';
    }
  }

  function updateActionButtons() {
    const n = state.selected.size;
    const pane = $(`.fin-main > .fin-tabpane[data-main-pane="${state.tab}"]`);
    if (!pane) return;
    pane.querySelectorAll('.fin-actions [data-action]').forEach((btn) => {
      btn.disabled = n === 0;
    });
    const editBtn = pane.querySelector('.fin-actions [data-action="edit"]');
    const delBtn  = pane.querySelector('.fin-actions [data-action="delete"]');
    if (editBtn) editBtn.disabled = n !== 1;
    if (delBtn)  delBtn.disabled  = n !== 1;
  }

  /* =========================================================
     MODAL · BAIXA
     ========================================================= */
  function openSettleModal(entry) {
    const balance = Number(entry.current_balance_cents || (entry.amount_cents - (entry.paid_cents || 0)));

    const modal = document.createElement('div');
    modal.className = 'fin-modal';
    modal.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog fin-modal__dialog--lg">
        <header class="fin-modal__head">
          <div>
            <h3 class="fin-modal__title">${entry.kind === 'receita' ? 'Receber' : 'Baixar'} título</h3>
            <p style="margin:4px 0 0;font-size:13px;color:var(--text-soft)">
              ${escapeHTML(entry.title_code || entry.doc_number || '')}
              · ${escapeHTML(entry.partner_name || 'Sem parceiro')}
            </p>
          </div>
          <button class="fin-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>

        <div class="fin-modal__body">

          <div class="sp-header">
            <div class="sp-header__title">Saldo atual do título</div>
            <div class="sp-header__value">${fmtBRL(balance)}</div>
          </div>

          <div class="fin-grid fin-grid--4 sp-grid">
            <div class="fin-field">
              <label>Valor a baixar</label>
              <input type="text" id="sp-amount" value="${(balance / 100).toFixed(2).replace('.', ',')}" />
            </div>
            <div class="fin-field">
              <label>Desconto</label>
              <input type="text" id="sp-discount" value="0,00" />
            </div>
            <div class="fin-field">
              <label>Juros</label>
              <input type="text" id="sp-interest" value="0,00" />
            </div>
            <div class="fin-field">
              <label>Multa</label>
              <input type="text" id="sp-penalty" value="0,00" />
            </div>
          </div>

          <div class="fin-grid fin-grid--2">
            <div class="fin-field">
              <label>Data da baixa</label>
              <input type="date" id="sp-date" value="${todayISO()}" />
            </div>
            <div class="fin-field">
              <label>Tarifa bancária</label>
              <input type="text" id="sp-fee" value="0,00" />
            </div>
          </div>

          <div class="fin-section-title" style="margin-top:8px">Formas de pagamento</div>

          <div class="sp-lines" id="sp-lines">
            <div class="sp-lines__head">
              <span>Método</span>
              <span>Conta bancária</span>
              <span style="text-align:right">Valor</span>
              <span></span>
            </div>
            <div id="sp-lines-body"></div>
          </div>

          <button type="button" class="sp-add" id="sp-add">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Adicionar forma de pagamento
          </button>

          <div class="sp-summary">
            <span class="sp-summary__label">Total das formas</span>
            <span class="sp-summary__value" id="sp-total">R$ 0,00</span>
          </div>

          <div class="fin-field">
            <label>Observações</label>
            <input type="text" id="sp-notes" placeholder="Opcional" />
          </div>

          <div id="sp-error" hidden class="fin-err"></div>
        </div>

        <footer class="fin-modal__foot">
          <button type="button" class="fin-btn fin-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="fin-btn fin-btn--primary" id="sp-confirm">
            Confirmar baixa
          </button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    const linesBody = modal.querySelector('#sp-lines-body');
    const totalEl   = modal.querySelector('#sp-total');
    const amountEl  = modal.querySelector('#sp-amount');

    const accountOptions = state.accounts.length
      ? state.accounts.map((a) => `<option value="${a.id}">${escapeHTML(a.name)}</option>`).join('')
      : '<option value="">— Nenhuma conta cadastrada —</option>';

    const methodOptions = Object.entries(PAYMENT_METHODS)
      .map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

    function buildLine(defaultAmountCents) {
      const row = document.createElement('div');
      row.className = 'sp-lines__row';
      row.innerHTML = `
        <select data-field="method">${methodOptions}</select>
        <select data-field="account">
          <option value="">— Sem conta —</option>
          ${accountOptions}
        </select>
        <input type="text" data-field="amount" value="${(defaultAmountCents / 100).toFixed(2).replace('.', ',')}" />
        <button type="button" class="sp-lines__remove" data-action="remove" title="Remover">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      `;

      row.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', recalc));
      row.querySelector('[data-action="remove"]').addEventListener('click', () => {
        row.remove();
        recalc();
      });

      return row;
    }

    function addLine(defaultAmountCents) {
      linesBody.appendChild(buildLine(defaultAmountCents || 0));
      recalc();
    }

    function recalc() {
      let sum = 0;
      linesBody.querySelectorAll('.sp-lines__row').forEach((row) => {
        const v = parseBRLToCents(row.querySelector('[data-field="amount"]').value);
        sum += v;
      });

      const target = parseBRLToCents(amountEl.value);

      totalEl.textContent = fmtBRL(sum);
      const ok = sum === target;
      totalEl.classList.toggle('sp-summary__value--ok',  ok);
      totalEl.classList.toggle('sp-summary__value--err', !ok);
    }

    amountEl.addEventListener('input', recalc);
    modal.querySelector('#sp-add').addEventListener('click', () => addLine(0));

    addLine(balance);

    modal.querySelector('#sp-confirm').addEventListener('click', async () => {
      const err = modal.querySelector('#sp-error');
      err.hidden = true;

      const amount  = parseBRLToCents(amountEl.value);
      const disc    = parseBRLToCents(modal.querySelector('#sp-discount').value);
      const intr    = parseBRLToCents(modal.querySelector('#sp-interest').value);
      const pen     = parseBRLToCents(modal.querySelector('#sp-penalty').value);
      const fee     = parseBRLToCents(modal.querySelector('#sp-fee').value);
      const date    = modal.querySelector('#sp-date').value;
      const notes   = modal.querySelector('#sp-notes').value.trim();

      if (amount <= 0) { err.textContent = 'Valor a baixar deve ser maior que zero.'; err.hidden = false; return; }

      const items = [];
      let sumItems = 0;
      linesBody.querySelectorAll('.sp-lines__row').forEach((row) => {
        const method = row.querySelector('[data-field="method"]').value;
        const accId  = row.querySelector('[data-field="account"]').value || null;
        const val    = parseBRLToCents(row.querySelector('[data-field="amount"]').value);
        if (val > 0) {
          items.push({ method, account_id: accId, amount_cents: val });
          sumItems += val;
        }
      });

      if (items.length === 0) { err.textContent = 'Adicione ao menos uma forma de pagamento.'; err.hidden = false; return; }
      if (sumItems !== amount) {
        err.textContent = `Soma das formas (${fmtBRL(sumItems)}) difere do valor a baixar (${fmtBRL(amount)}).`;
        err.hidden = false;
        return;
      }

      const cleared = Math.max(0, amount + disc - intr - pen - fee);

      const btn = modal.querySelector('#sp-confirm');
      btn.disabled = true;

      try {
        const { data, error } = await db().rpc('settle_title', {
          p_title_id:        entry.id,
          p_amount_cents:    amount,
          p_cleared_cents:   cleared,
          p_discount_cents:  disc,
          p_interest_cents:  intr,
          p_penalty_cents:   pen,
          p_fee_cents:       fee,
          p_settlement_date: date,
          p_items:           items,
          p_notes:           notes || null
        });
        if (error) throw error;

        toast(`Baixa registrada! Status: ${STATUS_LABEL[data.status] || data.status}`);
        close();
        await loadAll();
      } catch (e) {
        console.error(e);
        err.textContent = e.message;
        err.hidden = false;
        btn.disabled = false;
      }
    });
  }

  /* =========================================================
     MODAL · ESTORNAR
     ========================================================= */
  async function openReverseModal(entry) {
    let lastSettlement = null;
    try {
      const { data } = await db().from('financial_settlements')
        .select('*')
        .eq('entry_id', entry.id)
        .eq('action', 'baixa')
        .order('created_at', { ascending: false })
        .limit(1);
      lastSettlement = data && data[0] ? data[0] : null;
    } catch (e) { console.error(e); }

    if (!lastSettlement) {
      toast('Nenhuma baixa encontrada para estornar.', 'error');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'fin-modal';
    modal.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog">
        <header class="fin-modal__head">
          <h3 class="fin-modal__title">Estornar baixa</h3>
          <button class="fin-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>
        <div class="fin-modal__body">
          <p style="margin:0;font-size:13.5px;color:var(--text-soft)">
            Baixa de <strong>${fmtBRL(lastSettlement.amount_cents)}</strong>
            em ${fmtDate(lastSettlement.settlement_date)}.
            O título voltará para pendente e a movimentação será revertida.
          </p>
          <div class="fin-field">
            <label>Motivo do estorno *</label>
            <textarea id="r-reason" rows="3" placeholder="Ex.: baixa em duplicidade, valor incorreto..." style="width:100%;min-height:80px;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14.5px;resize:vertical"></textarea>
          </div>
          <div id="r-error" hidden class="fin-err"></div>
        </div>
        <footer class="fin-modal__foot">
          <button type="button" class="fin-btn fin-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="fin-btn fin-btn--danger" id="r-confirm">Confirmar estorno</button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    const reasonEl = modal.querySelector('#r-reason');
    reasonEl.focus();

    modal.querySelector('#r-confirm').addEventListener('click', async () => {
      const err = modal.querySelector('#r-error');
      err.hidden = true;
      const reason = reasonEl.value.trim();
      if (reason.length < 5) { err.textContent = 'Motivo muito curto.'; err.hidden = false; return; }

      const btn = modal.querySelector('#r-confirm');
      btn.disabled = true;
      try {
        const { error } = await db().rpc('reverse_settlement_v2', {
          p_settlement_id: lastSettlement.id,
          p_reason:        reason
        });
        if (error) throw error;
        close();
        toast('Estorno registrado.');
        await loadAll();
      } catch (e) {
        console.error(e);
        err.textContent = e.message;
        err.hidden = false;
        btn.disabled = false;
      }
    });
  }

  /* =========================================================
     MODAL · NOVA TRANSFERÊNCIA
     ========================================================= */
  function openTransferModal() {
    if (!state.accounts.length) {
      toast('Cadastre contas bancárias antes de transferir.', 'error');
      return;
    }

    const accountOptions = state.accounts.map((a) =>
      `<option value="${a.id}">${escapeHTML(a.name)} — ${fmtBRL(a.current_balance_cents)}</option>`
    ).join('');

    const modal = document.createElement('div');
    modal.className = 'fin-modal';
    modal.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog">
        <header class="fin-modal__head">
          <h3 class="fin-modal__title">Nova transferência</h3>
          <button class="fin-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>
        <div class="fin-modal__body">
          <div class="fin-grid fin-grid--2">
            <div class="fin-field">
              <label>De (origem) *</label>
              <select id="t-from">${accountOptions}</select>
            </div>
            <div class="fin-field">
              <label>Para (destino) *</label>
              <select id="t-to">${accountOptions}</select>
            </div>
          </div>

          <div class="fin-grid fin-grid--2">
            <div class="fin-field">
              <label>Valor *</label>
              <input type="text" id="t-amount" placeholder="0,00" />
            </div>
            <div class="fin-field">
              <label>Data *</label>
              <input type="date" id="t-date" value="${todayISO()}" />
            </div>
          </div>

          <div class="fin-field">
            <label>Descrição</label>
            <input type="text" id="t-desc" placeholder="Ex.: Transferência para conta salário" />
          </div>

          <div id="t-error" hidden class="fin-err"></div>
        </div>
        <footer class="fin-modal__foot">
          <button type="button" class="fin-btn fin-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="fin-btn fin-btn--primary" id="t-confirm">Transferir</button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    const fromEl = modal.querySelector('#t-from');
    const toEl   = modal.querySelector('#t-to');
    toEl.value = state.accounts.find((a) => a.id !== fromEl.value)?.id || '';

    fromEl.addEventListener('change', () => {
      if (fromEl.value === toEl.value) {
        const alt = state.accounts.find((a) => a.id !== fromEl.value);
        if (alt) toEl.value = alt.id;
      }
    });

    modal.querySelector('#t-confirm').addEventListener('click', async () => {
      const err = modal.querySelector('#t-error');
      err.hidden = true;

      const from = fromEl.value;
      const to   = toEl.value;
      const amount = parseBRLToCents(modal.querySelector('#t-amount').value);
      const date = modal.querySelector('#t-date').value;
      const desc = modal.querySelector('#t-desc').value.trim();

      if (from === to) { err.textContent = 'Conta de origem e destino devem ser diferentes.'; err.hidden = false; return; }
      if (amount <= 0) { err.textContent = 'Informe um valor válido.'; err.hidden = false; return; }

      const btn = modal.querySelector('#t-confirm');
      btn.disabled = true;
      try {
        const { error } = await db().rpc('transfer_between_accounts', {
          p_from_account_id: from,
          p_to_account_id:   to,
          p_amount_cents:    amount,
          p_transfer_date:   date,
          p_description:     desc || null
        });
        if (error) throw error;
        close();
        toast('Transferência registrada.');
        await loadAll();
      } catch (e) {
        console.error(e);
        err.textContent = e.message;
        err.hidden = false;
        btn.disabled = false;
      }
    });
  }

  /* =========================================================
     MODAL · NOVO / EDITAR TÍTULO (visual ERP · estilo Sankhya)
     ========================================================= */
  function openEntryModal(entry) {
    const isEdit = !!entry;
    const e = entry || {};
    const balance = Number(e.current_balance_cents || (Number(e.amount_cents || 0) - Number(e.paid_cents || 0)));
    const paidCents = Number(e.paid_cents || 0);

    const modal = document.createElement('div');
    modal.className = 'fin-modal fin-modal--erp';
    modal.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog fin-modal__dialog--erp" role="dialog" aria-modal="true"
           aria-labelledby="entry-modal-title">

        <header class="fin-modal__head">
          <h3 class="fin-modal__title" id="entry-modal-title">
            ${isEdit ? 'Editar título' : 'Novo título'}
          </h3>
          <button class="fin-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </header>

        <div class="fin-erp-toolbar" role="toolbar" aria-label="Ações do título">
          <button type="button" class="fin-erp-tool" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            <span>Baixar</span>
          </button>
          <button type="button" class="fin-erp-tool" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>
            <span>Estornar</span>
          </button>
          <button type="button" class="fin-erp-tool" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14h3M12 10h3M17 6h3"/></svg>
            <span>Ratear</span>
          </button>
          <button type="button" class="fin-erp-tool" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></svg>
            <span>Parcelar</span>
          </button>
          <button type="button" class="fin-erp-tool" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M2.5 10h19"/></svg>
            <span>Receber</span>
          </button>
          <button type="button" class="fin-erp-tool" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
            <span>Ver renegociação</span>
          </button>
        </div>

        <nav class="fin-tabs fin-tabs--erp" role="tablist" aria-label="Seções do título">
          <button type="button" class="fin-tab is-active" data-tab="lancamento" role="tab" aria-selected="true">Lançamento</button>
          <button type="button" class="fin-tab" data-tab="outras" role="tab" aria-selected="false">Outras informações</button>
          <button type="button" class="fin-tab" data-tab="geral" role="tab" aria-selected="false">Geral</button>
          <button type="button" class="fin-tab" data-tab="boleto" role="tab" aria-selected="false">Boleto</button>
        </nav>

        <div class="fin-modal__body fin-erp-body">

          <section class="fin-tabpane is-active" data-pane="lancamento">

            <div class="fin-erp-row fin-erp-row--3">
              <div class="fin-erp-field">
                <label for="e-unique">Nro Único</label>
                <input type="text" id="e-unique" value="${escapeHTML(e.unique_number || '')}" />
              </div>
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-obs-padrao">Observação padrão</label>
                <input type="text" id="e-obs-padrao" placeholder="" />
                <button type="button" class="fin-erp-search-btn" id="e-partner-search" aria-label="Buscar parceiro">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                  </svg>
                </button>
              </div>
              <div class="fin-erp-field">
                <label>Baixa Realizada pelo Importador</label>
                <label class="fin-erp-switch">
                  <input type="checkbox" id="e-baixa-importador" />
                  <span class="fin-erp-switch-track"></span>
                  <span class="fin-erp-switch-label">Ativar</span>
                </label>
              </div>
            </div>

            <div class="fin-erp-row">
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-partner">Parceiro <span class="req">*</span></label>
                <input type="text" id="e-partner" value="${escapeHTML(e.partner_name || '')}" placeholder="Nome" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar parceiro" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                  </svg>
                </button>
              </div>

              <div class="fin-erp-field">
                <label for="e-kind">Receita/Despesa <span class="req">*</span></label>
                <select id="e-kind">
                  <option value="despesa" ${e.kind === 'despesa' || !e.kind ? 'selected' : ''}>Despesa</option>
                  <option value="receita" ${e.kind === 'receita' ? 'selected' : ''}>Receita</option>
                </select>
              </div>

              <div class="fin-erp-field">
                <label>Provisão</label>
                <label class="fin-erp-switch">
                  <input type="checkbox" id="e-provisao" ${e.status === 'provisao' ? 'checked' : ''} />
                  <span class="fin-erp-switch-track"></span>
                  <span class="fin-erp-switch-label">Marcar como provisão</span>
                </label>
                <input type="hidden" id="e-status" value="${e.status || 'pendente'}" />
              </div>

              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-company">Empresa <span class="req">*</span></label>
                <input type="text" id="e-company" value="${escapeHTML(e.company_name || '')}" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar empresa" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="fin-erp-row">
              <div class="fin-erp-field">
                <label for="e-docnum">Nro Nota <span class="req">*</span></label>
                <input type="text" id="e-docnum" value="${escapeHTML(e.doc_number || '')}" />
              </div>

              <div class="fin-erp-field">
                <label for="e-issue">Dt. Negociação <span class="req">*</span></label>
                <input type="date" id="e-issue" value="${escapeHTML(e.issue_date || todayISO())}" />
              </div>

              <div class="fin-erp-field">
                <label for="e-amount">Vlr. do Desdobramento <span class="req">*</span></label>
                <input type="text" id="e-amount"
                       value="${(Number(e.amount_cents || 0) / 100).toFixed(2).replace('.', ',')}"
                       placeholder="0,00" />
              </div>

              <div class="fin-erp-field">
                <label for="e-net">Valor Líquido</label>
                <input type="text" id="e-net"
                       value="${(balance / 100).toFixed(2).replace('.', ',')}" readonly />
              </div>
            </div>

            <div class="fin-erp-row">
              <div class="fin-erp-field">
                <label for="e-due">Dt. Vencimento <span class="req">*</span></label>
                <input type="date" id="e-due" value="${escapeHTML(e.due_date || todayISO())}" />
              </div>
              <div class="fin-erp-field">
                <label for="e-doc">CNPJ / CPF</label>
                <input type="text" id="e-doc" value="${escapeHTML(e.partner_doc || '')}" />
              </div>
              <div class="fin-erp-field">
                <label for="e-installments">Parcela (1/1)</label>
                <input type="text" id="e-installments"
                       value="${e.installment_number && e.installments_total ? e.installment_number + '/' + e.installments_total : '1/1'}" />
              </div>
              <div class="fin-erp-field"></div>
            </div>

            <div class="fin-erp-row fin-erp-row--full">
              <div class="fin-erp-field">
                <label for="e-notes">Histórico</label>
                <textarea id="e-notes" rows="2">${escapeHTML(e.notes || '')}</textarea>
              </div>
            </div>

            <div class="fin-erp-row">
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-bank">Banco <span class="req">*</span></label>
                <input type="text" id="e-bank" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar banco" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                  </svg>
                </button>
              </div>
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-tipo-titulo">Tipo de Título <span class="req">*</span></label>
                <input type="text" id="e-tipo-titulo" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar tipo de título" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                  </svg>
                </button>
              </div>
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-tipo-operacao">Tipo Operação <span class="req">*</span></label>
                <input type="text" id="e-tipo-operacao" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar tipo de operação" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                  </svg>
                </button>
              </div>
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-nature">Natureza <span class="req">*</span></label>
                <input type="text" id="e-nature" value="${escapeHTML(e.nature_name || '')}" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar natureza" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="fin-erp-row">
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-costcenter">Centro Resultado</label>
                <input type="text" id="e-costcenter" value="${escapeHTML(e.cost_center_name || '')}" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar centro de resultado" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                  </svg>
                </button>
              </div>
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-account">Conta Bancária</label>
                <input type="text" id="e-account" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar conta" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                  </svg>
                </button>
              </div>
              <div class="fin-erp-field">
                <label for="e-data-baixa">Data Baixa</label>
                <input type="date" id="e-data-baixa" value="${e.settlement_date || ''}" />
              </div>
              <div class="fin-erp-field">
                <label for="e-vlr-baixa">Vlr Baixa</label>
                <input type="text" id="e-vlr-baixa"
                       value="${(paidCents / 100).toFixed(2).replace('.', ',')}" readonly />
              </div>
            </div>

            <div class="fin-erp-row fin-erp-row--3">
              <div class="fin-erp-field">
                <label for="e-dt-mov">Dt/Hr Movimentação</label>
                <input type="datetime-local" id="e-dt-mov" />
              </div>
              <div class="fin-erp-field">
                <label for="e-vlr-liberar">Vlr. a liberar</label>
                <input type="text" id="e-vlr-liberar" placeholder="0,00" />
              </div>
              <div class="fin-erp-field">
                <label for="e-nfse">Nro. NFS-e</label>
                <input type="text" id="e-nfse" value="${escapeHTML(e.nfse_number || '')}" />
              </div>
            </div>

            <div class="fin-erp-row fin-erp-row--2">
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-contract">Nro Contrato</label>
                <input type="text" id="e-contract" value="${escapeHTML(e.contract_number || '')}" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar contrato" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                  </svg>
                </button>
              </div>
            </div>

            <div id="e-error" hidden class="fin-err"></div>
          </section>

          <section class="fin-tabpane" data-pane="outras">
            <div class="fin-erp-row fin-erp-row--3">
              <div class="fin-erp-field">
                <label for="e-nfse-2">Nº NFS-e</label>
                <input type="text" id="e-nfse-2" value="${escapeHTML(e.nfse_number || '')}" />
              </div>
              <div class="fin-erp-field">
                <label for="e-unique-2">Nº Único</label>
                <input type="text" id="e-unique-2" value="${escapeHTML(e.unique_number || '')}" />
              </div>
              <div class="fin-erp-field">
                <label for="e-contract-2">Contrato</label>
                <input type="text" id="e-contract-2" value="${escapeHTML(e.contract_number || '')}" />
              </div>
            </div>
          </section>

          <section class="fin-tabpane" data-pane="geral">
            <div class="fin-erp-row fin-erp-row--full">
              <div class="fin-erp-field">
                <label for="e-general">Observações gerais</label>
                <textarea id="e-general" rows="4"></textarea>
              </div>
            </div>
          </section>

          <section class="fin-tabpane" data-pane="boleto">
            <div class="fin-erp-row fin-erp-row--full">
              <div class="fin-erp-field">
                <label>Informações do boleto</label>
                <p style="font-size:13px;color:var(--text-muted);margin:6px 0 0">
                  Emissão de boleto ainda não disponível nesta versão.
                </p>
              </div>
            </div>
          </section>
        </div>

        <footer class="fin-modal__foot fin-erp-foot">
          <div class="fin-erp-totals">
            <span class="fin-erp-tot-receita"><strong>Receita:</strong> <span id="e-tot-receita">0,00</span></span>
            <span class="fin-erp-tot-despesa"><strong>Despesa:</strong> <span id="e-tot-despesa">0,00</span></span>
            <span><strong>Rec-Despesa:</strong> <span id="e-tot-recdesp">0,00</span></span>
            <span><strong>Total baixado:</strong> <span id="e-tot-baixado">${(paidCents / 100).toFixed(2).replace('.', ',')}</span></span>
            <span class="fin-erp-tot-aberto"><strong>Total em aberto:</strong> <span id="e-tot-aberto">${(balance / 100).toFixed(2).replace('.', ',')}</span></span>
          </div>
          <div class="fin-erp-foot__actions">
            <button type="button" class="fin-btn fin-btn--ghost" data-close>Cancelar</button>
            <button type="button" class="fin-btn fin-btn--primary" id="e-save">
              ${isEdit ? 'Salvar alterações' : 'Criar título'}
            </button>
          </div>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelectorAll('.fin-tabs--erp .fin-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.fin-tabs--erp .fin-tab').forEach((t) => {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        modal.querySelectorAll('.fin-modal__body .fin-tabpane').forEach((p) => p.classList.remove('is-active'));
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');
        const pane = modal.querySelector(`.fin-modal__body .fin-tabpane[data-pane="${tab.dataset.tab}"]`);
        if (pane) pane.classList.add('is-active');
      });
    });

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    /* Provisão switch → status hidden */
    const provSwitch = modal.querySelector('#e-provisao');
    const statusHidden = modal.querySelector('#e-status');
    if (provSwitch && statusHidden) {
      provSwitch.addEventListener('change', () => {
        statusHidden.value = provSwitch.checked ? 'provisao' : 'pendente';
      });
    }
      /* =========================================================
     PICKER DE PARCEIRO (abre dentro do modal de título)
     ========================================================= */
  function openPartnerPicker(parentModal) {
    const picker = document.createElement('div');
    picker.className = 'fin-modal fin-modal--picker';
    picker.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog" style="max-width: 720px;">
        <header class="fin-modal__head">
          <h3 class="fin-modal__title">Selecionar parceiro</h3>
          <button class="fin-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </header>

        <div class="fin-modal__body" style="gap:10px">
          <div style="position:relative">
            <input type="search" id="pp-search" placeholder="Buscar por nome, CPF/CNPJ ou telefone…"
                   autocomplete="off" style="width:100%;height:42px;padding:0 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px" />
          </div>

          <div id="pp-results" style="max-height:380px;overflow-y:auto;border:1px solid var(--border);border-radius:10px">
            <div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13.5px">Digite para buscar…</div>
          </div>
        </div>

        <footer class="fin-modal__foot">
          <button type="button" class="fin-btn fin-btn--ghost" data-close>Fechar</button>
        </footer>
      </div>`;
    document.body.appendChild(picker);

    const close = () => picker.remove();
    picker.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    const input = picker.querySelector('#pp-search');
    const results = picker.querySelector('#pp-results');

    let debounce = null;

    async function runSearch(q) {
      results.innerHTML =
        '<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13.5px">Buscando…</div>';
      try {
        const { data, error } = await db().rpc('search_partners', {
          p_term: q || '',
          p_limit: 40
        });
        if (error) throw error;

        if (!data || data.length === 0) {
          results.innerHTML =
            '<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13.5px">Nenhum parceiro encontrado.</div>';
          return;
        }

        results.innerHTML = data.map((p) => {
          const tags = [];
          if (p.is_customer) tags.push('Cliente');
          if (p.is_supplier) tags.push('Fornecedor');
          if (p.is_carrier)  tags.push('Transportadora');

          return `
            <button type="button" data-id="${p.id}" data-name="${escapeHTML(p.name || '')}"
                    data-doc="${escapeHTML(p.cpf_cnpj || '')}"
                    style="display:flex;width:100%;gap:10px;align-items:center;padding:12px 14px;border:0;border-bottom:1px solid var(--border);background:transparent;text-align:left;cursor:pointer;font-family:inherit;color:inherit">
              <span style="flex:1;min-width:0">
                <span style="display:block;font-size:13.5px;font-weight:600;color:var(--text)">${escapeHTML(p.name || '—')}</span>
                <span style="display:block;font-size:12px;color:var(--text-muted);margin-top:2px">${escapeHTML(p.cpf_cnpj || '')}${p.city ? ' · ' + escapeHTML(p.city) + (p.state ? '/' + escapeHTML(p.state) : '') : ''}</span>
              </span>
              <span style="flex:none;display:flex;gap:4px">
                ${tags.map((t) => `<span style="padding:2px 8px;border-radius:999px;background:var(--surface-2);color:var(--text-muted);font-size:11px;font-weight:600">${t}</span>`).join('')}
              </span>
            </button>`;
        }).join('');

        results.querySelectorAll('button[data-id]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const partnerInput = parentModal.querySelector('#e-partner');
            const docInput = parentModal.querySelector('#e-doc');
            if (partnerInput) partnerInput.value = btn.dataset.name;
            if (docInput) docInput.value = btn.dataset.doc;
            close();
          });
        });
      } catch (e) {
        console.error('[fin] picker parceiro:', e);
        results.innerHTML =
          '<div style="padding:32px;text-align:center;color:var(--danger);font-size:13.5px">Erro ao buscar parceiros.</div>';
      }
    }

    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => runSearch(q), 220);
    });

    runSearch('');
    setTimeout(() => input.focus(), 50);
  }

        /* -------- Picker de parceiro -------- */
    const partnerSearchBtn = modal.querySelector('#e-partner-search');
    if (partnerSearchBtn) {
      partnerSearchBtn.addEventListener('click', () => openPartnerPicker(modal));
    }

    /* Totais dinâmicos do rodapé */
    const amountEl   = modal.querySelector('#e-amount');
    const kindEl     = modal.querySelector('#e-kind');
    const totReceita = modal.querySelector('#e-tot-receita');
    const totDespesa = modal.querySelector('#e-tot-despesa');
    const totRecDesp = modal.querySelector('#e-tot-recdesp');
    const totAberto  = modal.querySelector('#e-tot-aberto');
    const totBaixado = modal.querySelector('#e-tot-baixado');

    const fmtBR = (cents) => (cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });

    function recalcFooterTotals() {
      const amt = parseBRLToCents(amountEl ? amountEl.value : '0');
      const kind = kindEl ? kindEl.value : 'despesa';
      const rec = kind === 'receita' ? amt : 0;
      const desp = kind === 'despesa' ? amt : 0;
      const recdesp = rec - desp;
      const baixado = paidCents;
      const aberto = Math.max(0, amt - baixado);

      if (totReceita) totReceita.textContent = fmtBR(rec);
      if (totDespesa) totDespesa.textContent = fmtBR(desp);
      if (totRecDesp) totRecDesp.textContent = fmtBR(recdesp);
      if (totBaixado) totBaixado.textContent = fmtBR(baixado);
      if (totAberto)  totAberto.textContent  = fmtBR(aberto);

      const netEl = modal.querySelector('#e-net');
      if (netEl) netEl.value = fmtBR(Math.max(0, amt - baixado));
    }

    if (amountEl) amountEl.addEventListener('input', recalcFooterTotals);
    if (kindEl)   kindEl.addEventListener('change', recalcFooterTotals);
    recalcFooterTotals();

    /* ---------------------------------------------------------
       Salvar (criar / editar) — com resolução de organization_id
       --------------------------------------------------------- */
    modal.querySelector('#e-save').addEventListener('click', async () => {
      const err = modal.querySelector('#e-error');
      const btn = modal.querySelector('#e-save');

      const showErr = (msg) => {
        err.textContent = msg;
        err.hidden = false;
        try { err.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
        toast(msg, 'error');
        console.error('[fin] erro ao salvar título:', msg);
      };

      err.hidden = true;

      /* ---------- Monta payload base ---------- */
      const amountCents = parseBRLToCents(amountEl ? amountEl.value : '0');

      const payload = {
        kind:             kindEl.value,
        status:           statusHidden ? statusHidden.value : 'pendente',
        due_date:         modal.querySelector('#e-due').value || null,
        issue_date:       modal.querySelector('#e-issue').value || null,
        partner_name:     modal.querySelector('#e-partner').value.trim() || null,
        partner_doc:      modal.querySelector('#e-doc').value.trim() || null,
        doc_number:       modal.querySelector('#e-docnum').value.trim() || null,
        amount_cents:     amountCents,
        nature_name:      modal.querySelector('#e-nature').value.trim() || null,
        cost_center_name: modal.querySelector('#e-costcenter').value.trim() || null,
        company_name:     modal.querySelector('#e-company').value.trim() || null,
        nfse_number:      (modal.querySelector('#e-nfse') || {}).value || null,
        unique_number:    modal.querySelector('#e-unique').value.trim() || null,
        contract_number:  modal.querySelector('#e-contract').value.trim() || null,
        notes:            modal.querySelector('#e-notes').value.trim() || null,
        updated_by:       state.currentUser ? state.currentUser.id : null,
        updated_by_name:  state.currentUser ? state.currentUser.name : null
      };

      /* ---------- Validações ---------- */
      if (!payload.due_date) {
        showErr('Informe a data de vencimento.');
        return;
      }
      if (payload.amount_cents <= 0) {
        showErr('O valor do título precisa ser maior que zero. Preencha "Vlr. do Desdobramento".');
        return;
      }
      if (!payload.partner_name) {
        showErr('Informe o parceiro.');
        return;
      }

      btn.disabled = true;
      const oldLabel = btn.textContent;
      btn.textContent = isEdit ? 'Salvando…' : 'Criando…';

      try {
        if (!isEdit) {
          /* ---------- CRIAÇÃO ---------- */
          const orgId = await resolveOrgIdAsync();
          if (!orgId) {
            throw new Error(
              'Sua sessão não trouxe a empresa (organization_id). Faça logout e login novamente.'
            );
          }

          payload.organization_id = orgId;
          payload.current_balance_cents = payload.amount_cents;

          payload.title_code = await getNextTitleCode();

          payload.created_by      = state.currentUser ? state.currentUser.id : null;
          payload.created_by_name = state.currentUser ? state.currentUser.name : null;

          console.log('[fin] criando título:', payload);

          const { data, error } = await db()
            .from('financial_entries')
            .insert(payload)
            .select('id, title_code')
            .single();

          if (error) {
            console.error('[fin] insert error:', error);
            throw error;
          }

          console.log('[fin] criado com sucesso:', data);
          toast(`Título ${data && data.title_code ? data.title_code : ''} criado.`, 'success');
        } else {
          /* ---------- EDIÇÃO ---------- */
          delete payload.current_balance_cents;

          console.log('[fin] atualizando título:', e.id, payload);

          const { error } = await db()
            .from('financial_entries')
            .update(payload)
            .eq('id', e.id);

          if (error) {
            console.error('[fin] update error:', error);
            throw error;
          }

          toast('Título atualizado.', 'success');
        }

        close();
        await loadAll();
      } catch (ex) {
        console.error('[fin] falha ao salvar título:', ex);

        let msg = ex.message || 'Erro desconhecido.';
        const low = msg.toLowerCase();

        if (low.includes('row-level security') || low.includes('permission denied')) {
          msg = 'Sem permissão para gravar o título. Verifique se a sua empresa (organization_id) está correta.';
        } else if (low.includes('organization_id') && low.includes('null')) {
          msg = 'Faltou organization_id. Faça logout e login novamente.';
        } else if (low.includes('column') && low.includes('does not exist')) {
          msg = 'Coluna inexistente em financial_entries: ' + msg;
        } else if (low.includes('next_title_code') || low.includes('function')) {
          msg = 'A função next_title_code não está criada no banco. Rode o SQL de setup.';
        } else if (low.includes('duplicate') || low.includes('unique')) {
          msg = 'Já existe um título com esse código. Tente novamente.';
        }

        showErr(msg);
      } finally {
        btn.disabled = false;
        btn.textContent = oldLabel;
      }
    });
  }

  async function getNextTitleCode() {
    try {
      const { data, error } = await db().rpc('next_title_code');
      if (error) throw error;
      return data || ('TIT-' + Date.now());
    } catch (e) {
      console.warn('[fin] next_title_code falhou, usando fallback:', e);
      return 'TIT-' + Date.now();
    }
  }

  /* =========================================================
     BIND · filtros + ações
     ========================================================= */
  function bindFilters() {
    $$('.fin-side__acc').forEach((acc) => {
      acc.addEventListener('click', () => {
        const target = acc.dataset.target;
        const body = document.getElementById('acc-' + target);
        if (!body) return;
        const isOpen = acc.getAttribute('aria-expanded') === 'true';
        acc.setAttribute('aria-expanded', String(!isOpen));
        body.hidden = isOpen;
      });
    });

    $$('input[data-quick]').forEach((cb) => {
      cb.addEventListener('change', () => {
        state.filters.quick[cb.dataset.quick] = cb.checked;
        renderAll();
      });
    });

    const apply = $('#fin-apply');
    if (apply) {
      apply.addEventListener('click', () => {
        state.filters.dueFrom    = $('#f-due-from')    ? $('#f-due-from').value    : '';
        state.filters.dueTo      = $('#f-due-to')      ? $('#f-due-to').value      : '';
        state.filters.issueFrom  = $('#f-issue-from')  ? $('#f-issue-from').value  : '';
        state.filters.issueTo    = $('#f-issue-to')    ? $('#f-issue-to').value    : '';
        state.filters.settleFrom = $('#f-settle-from') ? $('#f-settle-from').value : '';
        state.filters.settleTo   = $('#f-settle-to')   ? $('#f-settle-to').value   : '';
        state.filters.company    = $('#f-company')     ? $('#f-company').value.trim()     : '';
        state.filters.nature     = $('#f-nature')      ? $('#f-nature').value.trim()      : '';
        state.filters.account    = $('#f-account')     ? $('#f-account').value            : '';
        renderAll();
      });
    }

    const clear = $('#fin-clear-filters');
    if (clear) {
      clear.addEventListener('click', () => {
        [
          'f-due-from','f-due-to','f-issue-from','f-issue-to',
          'f-settle-from','f-settle-to','f-company','f-nature'
        ].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
        if ($('#f-account')) $('#f-account').value = '';

        state.filters.dueFrom = state.filters.dueTo = '';
        state.filters.issueFrom = state.filters.issueTo = '';
        state.filters.settleFrom = state.filters.settleTo = '';
        state.filters.company = state.filters.nature = state.filters.account = '';
        renderAll();
      });
    }

    const customSwitch = $('#fin-custom-filter');
    if (customSwitch) {
      customSwitch.addEventListener('change', () => {
        const side = $('#fin-side');
        if (side) side.classList.toggle('has-custom', customSwitch.checked);
      });
    }

    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('.fin-actions [data-action]');
      if (!btn) return;
      const action = btn.dataset.action;

      const ids = Array.from(state.selected);
      const rows = ids.map((id) => state.entries.find((x) => x.id === id)).filter(Boolean);

      if (action === 'settle') {
        if (rows.length !== 1) { toast('Selecione 1 título para baixar.', 'error'); return; }
        if (rows[0].status !== 'pendente') { toast('Só é possível baixar títulos pendentes.', 'error'); return; }
        openSettleModal(rows[0]);
      }
      if (action === 'reverse') {
        if (rows.length !== 1) { toast('Selecione 1 título para estornar.', 'error'); return; }
        if (rows[0].status !== 'baixado') { toast('Só é possível estornar títulos baixados.', 'error'); return; }
        openReverseModal(rows[0]);
      }
      if (action === 'edit') {
        if (rows.length !== 1) { toast('Selecione 1 título.', 'error'); return; }
        openEntryModal(rows[0]);
      }
      if (action === 'delete') {
        if (rows.length !== 1) { toast('Selecione 1 título.', 'error'); return; }
        if (!confirm('Excluir este título? Esta ação não pode ser desfeita.')) return;
        try {
          const { error } = await db().from('financial_entries').delete().eq('id', rows[0].id);
          if (error) throw error;
          toast('Título excluído.');
          state.selected.clear();
          await loadAll();
        } catch (ex) {
          toast('Erro: ' + ex.message, 'error');
        }
      }
    });

    const checkAllPagar = $('#fin-check-all');
    if (checkAllPagar) {
      checkAllPagar.addEventListener('change', () => toggleCheckAll('pagar', checkAllPagar.checked));
    }
    const checkAllReceber = $('#fin-check-all-receber');
    if (checkAllReceber) {
      checkAllReceber.addEventListener('change', () => toggleCheckAll('receber', checkAllReceber.checked));
    }
  }

  function toggleCheckAll(tab, checked) {
    state.selected.clear();
    const tbody = $(`#fin-tbody-${tab}`);
    if (!tbody) return;
    tbody.querySelectorAll('[data-check]').forEach((cb) => {
      cb.checked = checked;
      if (checked) state.selected.add(cb.dataset.check);
      cb.closest('tr').classList.toggle('is-selected', checked);
    });
    updateActionButtons();
  }

  /* =========================================================
     BOOTSTRAP
     ========================================================= */
  document.addEventListener('DOMContentLoaded', async () => {
    if (document.body.dataset.page !== 'financeiro') return;

    bindFilters();
    setupTabs();
    setupViewToggles();

    applyTabContext(state.tab, false);

    $$('input[data-quick]').forEach((cb) => {
      const key = cb.dataset.quick;
      if (state.filters.quick[key] != null) cb.checked = state.filters.quick[key];
    });

    const refresh = $('#fin-refresh');
    if (refresh) refresh.addEventListener('click', loadAll);

    const newBtn = $('#fin-new');
    if (newBtn) newBtn.addEventListener('click', () => openEntryModal(null));

    const trBtn  = $('#fin-transfer');
    if (trBtn)   trBtn.addEventListener('click', openTransferModal);

    const trBtn2 = $('#fin-transfer-2');
    if (trBtn2)  trBtn2.addEventListener('click', openTransferModal);

    await loadUser();
    await loadAll();
  });

  window.Fin = { state, reload: loadAll, openSettle: openSettleModal, openEntry: openEntryModal };

})();