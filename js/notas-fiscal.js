/* =========================================================
   DEV HUB · Notas fiscais (interno)
   ---------------------------------------------------------
   Emissão de documento fiscal interno. NÃO envia para SEFAZ.
   ========================================================= */

(function () {
  'use strict';

  const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });

  const STATUS_INFO = {
    draft:    { label: 'Em digitação', modifier: 'badge--warning' },
    issued:   { label: 'Emitida',      modifier: 'badge--success' },
    canceled: { label: 'Cancelada',    modifier: 'badge--danger'  }
  };

  const state = {
    invoices: [],
    filtered: [],
    search: '',
    statusFilter: '',
    customers: [],
    products: [],
    items: [],
    editingId: null,
    submitting: false,
    perms: { view: true, create: true, cancel: true, remove: true }
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
    setupFilters();
    setupTabs();
    setupForm();
    setupItemModal();

    const session = await Auth.requireSession();
    if (!session) return;

    watchAuthChanges();

    const profile = await Auth.getProfile(session.user.id);
    renderUser(session.user, profile);

    if (window.Perms && typeof window.Perms.load === 'function') {
      try { await window.Perms.load(); } catch (e) { /* fallback */ }
    }
    state.perms.view   = hasPerm('invoices.view',   true);
    state.perms.create = hasPerm('invoices.create', true);
    state.perms.cancel = hasPerm('invoices.cancel', true);
    state.perms.remove = hasPerm('invoices.delete', true);

    if (!state.perms.view) {
      window.location.replace('dashboard.html');
      return;
    }

    applyPermissionsToUI();

    await Promise.all([loadInvoices(), loadCustomers(), loadProducts()]);
  }

  function hasPerm(cap, fallback) {
    if (window.Perms && typeof window.Perms.has === 'function') return window.Perms.has(cap);
    return fallback === true;
  }

  function applyPermissionsToUI() {
    const btn = document.getElementById('new-invoice-btn');
    if (btn && !state.perms.create) btn.hidden = true;
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
    }
    function close() {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }

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
     Carregar dados
     ========================================================= */
  async function loadInvoices() {
    showLoadingInvoices(true);

    const { data, error } = await window.db
      .from('invoices')
      .select('*, customers(name, cpf_cnpj)')
      .order('created_at', { ascending: false });

    showLoadingInvoices(false);

    if (error) {
      console.error('[DEV HUB] Falha ao carregar notas:', error);
      state.invoices = [];
      state.filtered = [];
      showEmptyInvoices('Não foi possível carregar as notas.', 'Tente novamente.');
      updateCountLabel();
      showToast('Não foi possível carregar as notas.', 'error');
      return;
    }

    state.invoices = data || [];
    applyFilter();
    recomputeStats();
  }

  async function loadCustomers() {
    const { data, error } = await window.db
      .from('customers')
      .select('id, name, cpf_cnpj, phone, email, address, customer_phones(phone, is_primary), customer_emails(email, is_primary), customer_addresses(city, state, street, number, is_primary)')
      .order('name');
    if (error) { console.warn(error); state.customers = []; }
    else state.customers = data || [];
    populateCustomerSelect();
  }

  async function loadProducts() {
    const { data, error } = await window.db
      .from('products')
      .select('id, name, code, barcode, price, stock, active')
      .eq('active', true)
      .order('name');
    if (error) { console.warn(error); state.products = []; }
    else state.products = data || [];
    populateProductSelect();
  }

  /* =========================================================
     Lista
     ========================================================= */
  function setupSearch() {
    const input = document.getElementById('invoices-search');
    if (!input) return;
    input.addEventListener('input', function () {
      state.search = input.value.trim().toLowerCase();
      applyFilter();
    });
  }

  function setupFilters() {
    const sel = document.getElementById('invoices-status-filter');
    if (!sel) return;
    sel.addEventListener('change', function () {
      state.statusFilter = sel.value;
      applyFilter();
    });
  }

  function applyFilter() {
    let list = state.invoices.slice();

    if (state.statusFilter) {
      list = list.filter(function (i) {
        return String(i.status || 'draft') === state.statusFilter;
      });
    }

    if (state.search) {
      const t = state.search;
      list = list.filter(function (i) {
        const cn = i.customers && i.customers.name ? i.customers.name : '';
        const doc = i.customers && i.customers.cpf_cnpj ? i.customers.cpf_cnpj : '';
        return String(i.number || '').includes(t) ||
               cn.toLowerCase().includes(t) ||
               doc.includes(t);
      });
    }

    state.filtered = list;
    renderInvoices();
    updateCountLabel();
  }

  function renderInvoices() {
    const tbody = document.getElementById('invoices-body');
    const wrap = document.getElementById('invoices-table-wrap');
    const empty = document.getElementById('invoices-empty');
    if (!tbody || !wrap || !empty) return;

    if (state.invoices.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      document.getElementById('invoices-empty-title').textContent = 'Nenhuma nota fiscal emitida ainda.';
      document.getElementById('invoices-empty-text').textContent = 'Use o botão acima para emitir a primeira.';
      return;
    }
    if (state.filtered.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      document.getElementById('invoices-empty-title').textContent = 'Nenhuma nota encontrada.';
      document.getElementById('invoices-empty-text').textContent = 'Ajuste os filtros ou a busca.';
      return;
    }

    empty.hidden = true;
    wrap.hidden = false;
    tbody.innerHTML = '';

    const frag = document.createDocumentFragment();
    state.filtered.forEach(function (inv) { frag.appendChild(buildRow(inv)); });
    tbody.appendChild(frag);
  }

  function buildRow(inv) {
    const tr = document.createElement('tr');
    const st = STATUS_INFO[inv.status] || STATUS_INFO.draft;
    const num = inv.number ? String(inv.number).padStart(6, '0') : '—';
    const cust = inv.customers && inv.customers.name ? inv.customers.name : '—';

    tr.appendChild(td(num, 'cell--mono'));
    tr.appendChild(td(inv.series || '1', 'cell--muted'));
    tr.appendChild(td(formatDate(inv.issued_at), 'cell--muted'));
    tr.appendChild(td(cust));
    tr.appendChild(td(formatMoney(inv.total), 'cell--num cell-price'));

    const stCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge ' + st.modifier;
    badge.textContent = st.label;
    stCell.appendChild(badge);
    tr.appendChild(stCell);

    const actCell = document.createElement('td');
    actCell.className = 'cell--num';
    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'row-action';
    viewBtn.title = 'Visualizar';
    viewBtn.setAttribute('aria-label', 'Visualizar nota');
    viewBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/>' +
      '<circle cx="12" cy="12" r="3"/></svg>';
    viewBtn.addEventListener('click', function () { openInvoiceDetail(inv); });
    wrap.appendChild(viewBtn);

    actCell.appendChild(wrap);
    tr.appendChild(actCell);

    return tr;
  }

  function openInvoiceDetail(inv) {
    const num = inv.number ? String(inv.number).padStart(6, '0') : '—';
    showToast('Nota #' + num + ' — detalhes ainda não implementados.', 'info');
  }

  function td(text, cls) {
    const c = document.createElement('td');
    c.textContent = text;
    if (cls) c.className = cls;
    return c;
  }

  function recomputeStats() {
    let issued = 0, canceled = 0, value = 0;
    state.invoices.forEach(function (i) {
      if (i.status === 'issued') { issued += 1; value += toNumber(i.total, 0); }
      if (i.status === 'canceled') canceled += 1;
    });
    setText('stat-total', String(state.invoices.length));
    setText('stat-issued', String(issued));
    setText('stat-canceled', String(canceled));
    setText('stat-value', formatMoney(value));
  }

  function updateCountLabel() {
    const total = state.invoices.length;
    const shown = state.filtered.length;
    const label = document.getElementById('invoices-count');
    if (!label) return;
    if (total === 0) { label.textContent = 'Nenhuma nota emitida'; return; }
    label.textContent = shown === total
      ? (total === 1 ? '1 nota' : total + ' notas')
      : shown + ' de ' + total + ' notas';
  }

  function showLoadingInvoices(b) {
    const l = document.getElementById('invoices-loading');
    const w = document.getElementById('invoices-table-wrap');
    const e = document.getElementById('invoices-empty');
    if (!l) return;
    if (b) {
      l.hidden = false;
      if (w) w.hidden = true;
      if (e) e.hidden = true;
    } else {
      l.hidden = true;
    }
  }

  function showEmptyInvoices(title, text) {
    const empty = document.getElementById('invoices-empty');
    const t = document.getElementById('invoices-empty-title');
    const x = document.getElementById('invoices-empty-text');
    if (!empty) return;
    if (t) t.textContent = title;
    if (x) x.textContent = text;
    empty.hidden = false;
  }

  /* =========================================================
     Tabs
     ========================================================= */
  function setupTabs() {
    document.querySelectorAll('.nf-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        const key = tab.dataset.tab;
        document.querySelectorAll('.nf-tab').forEach(function (t) {
          t.classList.toggle('is-active', t === tab);
        });
        document.querySelectorAll('.nf-panel').forEach(function (p) {
          p.classList.toggle('is-active', p.dataset.panel === key);
        });
      });
    });
  }

  /* =========================================================
     Form
     ========================================================= */
  function setupForm() {
    const backBtn = document.getElementById('back-to-list');
    const cancelBtn = document.getElementById('nf-cancel');
    if (backBtn) backBtn.addEventListener('click', closeForm);
    if (cancelBtn) cancelBtn.addEventListener('click', closeForm);

    const form = document.getElementById('invoice-form');
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); submitInvoice('issued'); });

    const saveDraftBtn = document.getElementById('nf-save-draft');
    if (saveDraftBtn) saveDraftBtn.addEventListener('click', function () { submitInvoice('draft'); });

    const addBtn = document.getElementById('nf-add-item');
    if (addBtn) addBtn.addEventListener('click', function () { openItemModal(null); });

    const addFromProdBtn = document.getElementById('nf-add-from-products');
    if (addFromProdBtn) addFromProdBtn.addEventListener('click', function () { openItemModal(null); });

    const custSel = document.getElementById('nf-customer');
    if (custSel) custSel.addEventListener('change', onCustomerChange);

    ['nf-freight','nf-insurance','nf-other','nf-discount'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', recalcTotals);
    });

    const issued = document.getElementById('nf-issued');
    if (issued && !issued.value) issued.value = new Date().toISOString().slice(0,10);

    // Botão "Emitir nota fiscal" da listagem
    const newBtn = document.getElementById('new-invoice-btn');
    if (newBtn) newBtn.addEventListener('click', openForm);
  }

  function openForm() {
    if (!state.perms.create) {
      showToast('Você não tem permissão para emitir notas.', 'error');
      return;
    }
    state.editingId = null;
    state.items = [];
    renderItems();
    recalcTotals();
    document.getElementById('form-title').textContent = 'Emitir nota fiscal';
    document.getElementById('nf-number').value = '';
    document.getElementById('nf-feedback').hidden = true;
    resetFormFields();
    showView('form');
  }

  function closeForm() {
    if (state.submitting) return;
    showView('list');
  }

  function resetFormFields() {
    ['nf-op','nf-responsible','nf-carrier','nf-carrier-doc','nf-carrier-plate',
     'nf-carrier-state','nf-volumes-species','nf-volumes-brand','nf-volumes-numbering',
     'nf-extra-tax','nf-extra-contrib'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['nf-freight','nf-insurance','nf-other','nf-discount','nf-gross','nf-net'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.value = '0';
    });
    const qty = document.getElementById('nf-volumes-qty');
    if (qty) qty.value = '';
    const cust = document.getElementById('nf-customer');
    if (cust) cust.value = '';
    const box = document.getElementById('nf-dest-summary');
    if (box) box.hidden = true;
    const empty = document.getElementById('nf-dest-empty');
    if (empty) empty.hidden = false;
  }

  function showView(name) {
    const list = document.getElementById('view-list');
    const form = document.getElementById('view-form');
    if (!list || !form) return;
    list.hidden = name === 'form';
    form.hidden = name !== 'form';
    if (name === 'form') window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function onCustomerChange() {
    const id = document.getElementById('nf-customer').value;
    const c = state.customers.find(function (x) { return x.id === id; });
    const box = document.getElementById('nf-dest-summary');
    const empty = document.getElementById('nf-dest-empty');
    if (!c) {
      if (box) box.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }

    const phones = c.customer_phones || [];
    const emails = c.customer_emails || [];
    const addrs = c.customer_addresses || [];
    const p = phones.find(function (x) { return x.is_primary; }) || phones[0];
    const e = emails.find(function (x) { return x.is_primary; }) || emails[0];
    const a = addrs.find(function (x) { return x.is_primary; }) || addrs[0];

    setText('dest-name', c.name || '—');
    setText('dest-doc', c.cpf_cnpj || '—');
    setText('dest-phone', (p && p.phone) || c.phone || '—');
    setText('dest-email', (e && e.email) || c.email || '—');
    setText('dest-address', a
      ? [a.street, a.number, a.city, a.state].filter(Boolean).join(', ')
      : (c.address || '—'));

    if (box) box.hidden = false;
    if (empty) empty.hidden = true;
  }

  function populateCustomerSelect() {
    const sel = document.getElementById('nf-customer');
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    state.customers.forEach(function (c) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name || '(sem nome)';
      sel.appendChild(opt);
    });
  }

  function populateProductSelect() {
    const sel = document.getElementById('item-product');
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    state.products.forEach(function (p) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = (p.name || '—') + (p.code ? ' · ' + p.code : '');
      sel.appendChild(opt);
    });
  }

  /* =========================================================
     Itens
     ========================================================= */
  function setupItemModal() {
    const modal = document.getElementById('item-modal');
    if (!modal) return;

    modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeItemModal);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeItemModal();
    });

    const form = document.getElementById('item-form');
    if (form) form.addEventListener('submit', onItemSubmit);

    const prodSel = document.getElementById('item-product');
    if (prodSel) prodSel.addEventListener('change', onItemProductChange);
  }

  function openItemModal() {
    const modal = document.getElementById('item-modal');
    if (!modal) return;
    const form = document.getElementById('item-form');
    form.reset();
    document.getElementById('item-unit').value = 'UN';
    document.getElementById('item-qty').value = '1';
    document.getElementById('item-unit-price').value = '0';
    document.getElementById('item-discount').value = '0';
    document.getElementById('item-icms-pct').value = '0';
    document.getElementById('item-ipi-pct').value = '0';
    const cfop = document.getElementById('nf-cfop-global');
    if (cfop) document.getElementById('item-cfop').value = cfop.value || '5102';
    document.getElementById('item-feedback').hidden = true;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () { document.getElementById('item-description').focus(); }, 60);
  }

  function closeItemModal() {
    const modal = document.getElementById('item-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  function onItemProductChange() {
    const id = document.getElementById('item-product').value;
    if (!id) return;
    const p = state.products.find(function (x) { return x.id === id; });
    if (!p) return;
    document.getElementById('item-code').value = p.code || '';
    document.getElementById('item-description').value = p.name || '';
    document.getElementById('item-unit-price').value = String(toNumber(p.price, 0));
  }

  function onItemSubmit(e) {
    e.preventDefault();

    const desc = document.getElementById('item-description').value.trim();
    if (!desc) { showItemFeedback('Informe a descrição.'); return; }

    const item = {
      product_id: document.getElementById('item-product').value || null,
      code: document.getElementById('item-code').value.trim() || null,
      description: desc,
      ncm: document.getElementById('item-ncm').value.trim() || null,
      cfop: document.getElementById('item-cfop').value.trim() || '5102',
      quantity: toNumber(document.getElementById('item-qty').value, 1),
      unit: document.getElementById('item-unit').value.trim() || 'UN',
      unit_price: toNumber(document.getElementById('item-unit-price').value, 0),
      discount: toNumber(document.getElementById('item-discount').value, 0),
      percent_icms: toNumber(document.getElementById('item-icms-pct').value, 0),
      percent_ipi: toNumber(document.getElementById('item-ipi-pct').value, 0)
    };
    item.subtotal = round2(item.quantity * item.unit_price - item.discount);
    item.base_icms = round2(item.subtotal);
    item.value_icms = round2(item.base_icms * item.percent_icms / 100);
    item.value_ipi = round2(item.subtotal * item.percent_ipi / 100);

    state.items.push(item);
    closeItemModal();
    renderItems();
    recalcTotals();
  }

  function renderItems() {
    const tbody = document.getElementById('nf-items-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (state.items.length === 0) {
      const tr = document.createElement('tr');
      tr.className = 'nf-items-empty';
      tr.innerHTML = '<td colspan="10">Nenhum item adicionado.</td>';
      tbody.appendChild(tr);
      return;
    }

    const frag = document.createDocumentFragment();
    state.items.forEach(function (it, idx) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + esc(it.code || '—') + '</td>' +
        '<td>' + esc(it.description) + '</td>' +
        '<td>' + esc(it.ncm || '—') + '</td>' +
        '<td>' + esc(it.cfop || '—') + '</td>' +
        '<td class="c">' + esc(String(it.quantity)) + '</td>' +
        '<td>' + esc(it.unit || 'UN') + '</td>' +
        '<td class="r">' + formatMoney(it.unit_price) + '</td>' +
        '<td class="r">' + formatMoney(it.discount) + '</td>' +
        '<td class="r">' + formatMoney(it.subtotal) + '</td>';

      const actCell = document.createElement('td');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nf-item-remove';
      btn.setAttribute('aria-label', 'Remover item');
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
        ' stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      btn.addEventListener('click', function () { removeItem(idx); });
      actCell.appendChild(btn);
      tr.appendChild(actCell);

      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  }

  function removeItem(idx) {
    state.items.splice(idx, 1);
    renderItems();
    recalcTotals();
  }

  function recalcTotals() {
    const sub = round2(state.items.reduce(function (s, i) { return s + toNumber(i.subtotal, 0); }, 0));
    const baseIcms = round2(state.items.reduce(function (s, i) { return s + toNumber(i.base_icms, 0); }, 0));
    const vlIcms = round2(state.items.reduce(function (s, i) { return s + toNumber(i.value_icms, 0); }, 0));
    const vlIpi = round2(state.items.reduce(function (s, i) { return s + toNumber(i.value_ipi, 0); }, 0));

    const freight   = toNumber(getVal('nf-freight'), 0);
    const insurance = toNumber(getVal('nf-insurance'), 0);
    const other     = toNumber(getVal('nf-other'), 0);
    const disc      = toNumber(getVal('nf-discount'), 0);

    const total = round2(sub + freight + insurance + other - disc);
    const acct = round2(sub - disc);

    setText('nf-total-products', formatMoney(sub));
    setText('nf-total-base-icms', formatMoney(baseIcms));
    setText('nf-total-icms', formatMoney(vlIcms));
    setText('nf-total-ipi', formatMoney(vlIpi));
    setText('nf-total-acct', formatMoney(acct));
    setText('nf-total-total', formatMoney(total));
  }

  /* =========================================================
     Submit
     ========================================================= */
  async function submitInvoice(status) {
    if (state.submitting) return;

    const customerId = getVal('nf-customer');
    if (!customerId) { showFormFeedback('Selecione o destinatário.'); return; }
    if (state.items.length === 0) { showFormFeedback('Adicione pelo menos um item.'); return; }

    state.submitting = true;
    setFormBusy(true);

    try {
      const sub = round2(state.items.reduce(function (s, i) { return s + toNumber(i.subtotal, 0); }, 0));
      const freight   = toNumber(getVal('nf-freight'), 0);
      const insurance = toNumber(getVal('nf-insurance'), 0);
      const other     = toNumber(getVal('nf-other'), 0);
      const disc      = toNumber(getVal('nf-discount'), 0);
      const total     = round2(sub + freight + insurance + other - disc);
      const vlIcms    = round2(state.items.reduce(function (s, i) { return s + toNumber(i.value_icms, 0); }, 0));
      const vlIpi     = round2(state.items.reduce(function (s, i) { return s + toNumber(i.value_ipi, 0); }, 0));
      const baseIcms  = round2(state.items.reduce(function (s, i) { return s + toNumber(i.base_icms, 0); }, 0));

      const session = await window.db.auth.getUser();
      const uid = session && session.data && session.data.user ? session.data.user.id : null;
      const ctx = window.Auth.getStoredUser();
      const orgId = ctx && ctx.organization_id ? ctx.organization_id : null;
      if (!orgId) throw new Error('Sessão sem empresa.');

      const invoiceRow = {
        organization_id: orgId,
        customer_id: customerId,
        series: getVal('nf-series') || '1',
        number: null,
        purpose: getVal('nf-purpose') || 'normal',
        status: status,
        issued_at: getVal('nf-issued') || null,
        departure_at: getVal('nf-departure') || null,
        fiscal_operation: getVal('nf-op') || null,
        fiscal_nature: getVal('nf-nature') || null,
        responsible_name: getVal('nf-responsible') || null,
        subtotal: sub,
        discount: disc,
        freight: freight,
        insurance: insurance,
        other_expenses: other,
        total: total,
        accounting_total: round2(sub - disc),
        base_icms: baseIcms,
        value_icms: vlIcms,
        value_ipi: vlIpi,
        payment_method: getVal('nf-payment') || null,
        freight_condition: getVal('nf-freight-cond') || null,
        carrier_name: getVal('nf-carrier') || null,
        carrier_document: getVal('nf-carrier-doc') || null,
        carrier_plate: getVal('nf-carrier-plate') || null,
        carrier_state: getVal('nf-carrier-state') || null,
        volumes_qty: toInt(getVal('nf-volumes-qty'), null),
        volumes_species: getVal('nf-volumes-species') || null,
        volumes_brand: getVal('nf-volumes-brand') || null,
        volumes_numbering: getVal('nf-volumes-numbering') || null,
        gross_weight: toNumNullable(getVal('nf-gross')),
        net_weight: toNumNullable(getVal('nf-net')),
        extra_info_tax: getVal('nf-extra-tax') || null,
        extra_info_contributor: getVal('nf-extra-contrib') || null,
        created_by: uid,
        created_by_name: (ctx && ctx.name) || null
      };

      if (status === 'issued') {
        const rpcNum = await window.db.rpc('next_invoice_number', { p_series: invoiceRow.series });
        if (!rpcNum.error && rpcNum.data) invoiceRow.number = rpcNum.data;
      }

      const ins = await window.db.from('invoices').insert(invoiceRow).select('id').single();
      if (ins.error) throw ins.error;

      const invoiceId = ins.data.id;

      const itemsPayload = state.items.map(function (it, idx) {
        return {
          invoice_id: invoiceId,
          product_id: it.product_id,
          code: it.code,
          description: it.description,
          ncm: it.ncm,
          cfop: it.cfop,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          discount: it.discount,
          subtotal: it.subtotal,
          base_icms: it.base_icms,
          value_icms: it.value_icms,
          percent_icms: it.percent_icms,
          value_ipi: it.value_ipi,
          percent_ipi: it.percent_ipi,
          sort_order: idx
        };
      });

      const insItems = await window.db.from('invoice_items').insert(itemsPayload);
      if (insItems.error) throw insItems.error;

      showToast(status === 'draft' ? 'Rascunho salvo.' : 'Nota fiscal emitida.', 'success');
      closeForm();
      await loadInvoices();
    } catch (err) {
      console.error('[DEV HUB] Falha ao salvar nota:', err);
      showFormFeedback('Não foi possível salvar: ' + (err.message || 'erro desconhecido'));
    } finally {
      state.submitting = false;
      setFormBusy(false);
    }
  }

  function setFormBusy(b) {
    ['nf-save-draft','nf-save-issue'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.disabled = b;
      el.classList.toggle('is-loading', b);
      el.setAttribute('aria-busy', String(b));
    });
  }

  function showFormFeedback(msg) {
    const el = document.getElementById('nf-feedback');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  function showItemFeedback(msg) {
    const el = document.getElementById('item-feedback');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  /* =========================================================
     Helpers
     ========================================================= */
  function getVal(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function formatMoney(v) { return currencyFormatter.format(toNumber(v, 0)); }

  function formatDate(v) {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '—' : dateFormatter.format(d);
  }

  function toNumber(v, fb) {
    if (v == null || v === '') return fb;
    const n = Number(String(v).replace(',', '.'));
    return isFinite(n) ? n : fb;
  }

  function toInt(v, fb) {
    if (v == null || v === '') return fb;
    const n = parseInt(v, 10);
    return isFinite(n) ? n : fb;
  }

  function toNumNullable(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    return isFinite(n) ? n : null;
  }

  function round2(v) {
    return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  function setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
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
     Alert global (fica por compatibilidade — alguns helpers usam)
     ========================================================= */
  function showGlobalAlert(message, type) {
    const alert = document.getElementById('global-alert');
    if (!alert) return;
    alert.textContent = message;
    alert.className = 'alert alert--' + (type || 'error');
    alert.hidden = false;
  }
})();