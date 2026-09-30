/* =========================================================
   DEV HUB · Módulo de Parceiros (layout ERP · Sankhya-like)
   ---------------------------------------------------------
   - Topbar "O que deseja fazer?" + busca + filtros
   - Grade densa estilo Sankhya
   - Modal fullscreen com 10 abas
   - Menu de contexto (right-click) com ações SEFAZ/ReceitaWS
   - Exportação: PDF, XLS, XLSX, Cubo (CSV)
   ========================================================= */

(function () {
  'use strict';

  const state = {
    all: [],
    filtered: [],
    search: '',
    kind: 'all',
    filterType: '',
    filterStatus: '',
    filterKind: '',
    editingId: null,
    deletingId: null,
    saving: false,
    deleting: false,
    phones: [],
    emails: [],
    addresses: [],
    contacts: [],
    perms: { view: true, create: true, edit: true, remove: true }
  };

  let editGeneration = 0;

  document.addEventListener('DOMContentLoaded', init);

  /* =========================================================
     INIT
     ========================================================= */
  async function init() {
    const Auth = window.Auth;
    if (!Auth || !Auth.isConfigured() || !window.db) {
      showGlobalAlert('Não foi possível conectar ao Supabase.', 'error');
      return;
    }

    const urlKind = new URLSearchParams(location.search).get('kind');
    if (urlKind && ['all','customer','supplier','carrier'].includes(urlKind)) {
      state.kind = urlKind;
    }

    setupTopbar();
    setupFilters();
    setupSearch();
    setupKindChips();
    setupPartnerForm();
    setupConfirmModal();
    setupCtxMenu();
    setupExportButton();

    document.querySelectorAll('.parn-chip').forEach((c) => {
      const on = c.dataset.kind === state.kind;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-selected', String(on));
    });

    const session = await Auth.requireSession();
    if (!session) return;

    if (window.Perms && typeof window.Perms.load === 'function') {
      try { await window.Perms.load(); } catch (e) { /* fallback */ }
    }

    state.perms.view   = hasPerm('customers.view',   true);
    state.perms.create = hasPerm('customers.create', true);
    state.perms.edit   = hasPerm('customers.edit',   true);
    state.perms.remove = hasPerm('customers.delete', true);

    if (!state.perms.view) {
      window.location.replace('dashboard.html');
      return;
    }

    if (!state.perms.create) {
      const btn = document.getElementById('tb-new');
      if (btn) btn.hidden = true;
    }

    await loadPartners();
  }

  function hasPerm(cap, fallback) {
    if (window.Perms && typeof window.Perms.has === 'function') return window.Perms.has(cap);
    return fallback !== false;
  }

  /* =========================================================
     TOPBAR / FILTROS
     ========================================================= */
  function setupTopbar() {
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('#tb-new, #empty-new-btn, [data-new-partner]');
      if (!trigger) return;
      e.preventDefault();
      openCreateModal();
    });

    document.getElementById('tb-view')?.addEventListener('click', () => {
      const wrap = document.getElementById('partners-table-wrap');
      const empty = document.getElementById('partners-empty');
      if (wrap) wrap.hidden = !wrap.hidden;
      if (empty) empty.hidden = true;
    });

    document.getElementById('tb-filter')?.addEventListener('click', () => {
      const box = document.getElementById('parn-filters');
      if (box) box.hidden = !box.hidden;
    });

    document.getElementById('tb-help')?.addEventListener('click', () => {
      showToast('Em breve: ajuda contextual da tela de Parceiros.', 'info');
    });
  }

  function setupFilters() {
    document.getElementById('filter-type')?.addEventListener('change', (e) => {
      state.filterType = e.target.value;
      applyFilter();
    });
    document.getElementById('filter-status')?.addEventListener('change', (e) => {
      state.filterStatus = e.target.value;
      applyFilter();
    });
    document.getElementById('filter-kind')?.addEventListener('change', (e) => {
      state.filterKind = e.target.value;
      state.kind = e.target.value || 'all';
      document.querySelectorAll('.parn-chip').forEach((c) => {
        const on = c.dataset.kind === state.kind;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-selected', String(on));
      });
      applyFilter();
    });
    document.getElementById('filter-clear')?.addEventListener('click', () => {
      state.filterType = '';
      state.filterStatus = '';
      state.filterKind = '';
      state.kind = 'all';
      const t = document.getElementById('filter-type'); if (t) t.value = '';
      const s = document.getElementById('filter-status'); if (s) s.value = '';
      const k = document.getElementById('filter-kind'); if (k) k.value = '';
      document.querySelectorAll('.parn-chip').forEach((c) => {
        const on = c.dataset.kind === 'all';
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-selected', String(on));
      });
      applyFilter();
    });
  }

  function setupSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    input.addEventListener('input', () => {
      state.search = input.value.trim().toLowerCase();
      applyFilter();
    });
  }

  function setupKindChips() {
    document.querySelectorAll('.parn-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.parn-chip').forEach((c) => {
          c.classList.toggle('is-active', c === chip);
          c.setAttribute('aria-selected', String(c === chip));
        });
        state.kind = chip.dataset.kind || 'all';
        const kSel = document.getElementById('filter-kind');
        if (kSel) kSel.value = state.kind === 'all' ? '' : state.kind;
        applyFilter();
      });
    });
  }

  /* =========================================================
     FILTRO
     ========================================================= */
  function applyFilter() {
    let list = state.all.slice();

    if (state.kind === 'customer') list = list.filter((p) => p.is_customer);
    if (state.kind === 'supplier') list = list.filter((p) => p.is_supplier);
    if (state.kind === 'carrier')  list = list.filter((p) => p.is_carrier);

    if (state.filterType)   list = list.filter((p) => String(p.type || '').toUpperCase() === state.filterType);
    if (state.filterStatus) list = list.filter((p) => String(p.status || 'active').toLowerCase() === state.filterStatus);

    if (state.search) {
      const t = state.search;
      list = list.filter((p) =>
        matches(p.name, t) ||
        matches(p.company_name, t) ||
        matches(p.trade_name, t) ||
        matches(p.cpf_cnpj, t) ||
        matches(p.phone, t) ||
        matches(p.email, t)
      );
    }

    state.filtered = list;
    renderPartners();
    updateCountLabel();
  }

  function matches(v, t) { return v && String(v).toLowerCase().includes(t); }

  /* =========================================================
     CARREGAMENTO
     ========================================================= */
  async function loadPartners() {
    showLoading(true);

    const { data, error } = await window.db
      .from('customers')
      .select(`
        id, organization_id, type, name, company_name, trade_name, cpf_cnpj,
        phone, email, address, status, category, segment, created_at,
        state_registration, tax_regime,
        is_customer, is_supplier, is_carrier, is_other,
        customer_phones(phone, is_primary),
        customer_emails(email, is_primary),
        customer_addresses(street, number, city, state, is_primary)
      `)
      .order('created_at', { ascending: false });

    showLoading(false);

    if (error) {
      console.error('[parceiros] load:', error);
      state.all = [];
      state.filtered = [];
      showEmptyState('Não foi possível carregar os parceiros.',
                     'Tente novamente em alguns instantes.', false);
      updateCountLabel();
      showToast('Não foi possível carregar os parceiros.', 'error');
      return;
    }

    state.all = data || [];
    applyFilter();
  }

  function updateCountLabel() {
    const total = state.all.length;
    const shown = state.filtered.length;
    const label = document.getElementById('partners-count');
    if (!label) return;
    if (total === 0) { label.textContent = 'Nenhum parceiro cadastrado'; return; }
    label.textContent = shown === total
      ? (total === 1 ? '1 parceiro' : total + ' parceiros')
      : shown + ' de ' + total + ' parceiros';
  }

  /* =========================================================
     RENDER GRADE
     ========================================================= */
  function renderPartners() {
    const tbody = document.getElementById('partners-body');
    const tableWrap = document.getElementById('partners-table-wrap');
    if (!tbody || !tableWrap) return;

    if (state.filtered.length === 0) {
      tableWrap.hidden = true;
      showEmptyState(
        state.all.length === 0
          ? 'Nenhum parceiro cadastrado ainda.'
          : 'Nenhum parceiro encontrado.',
        state.all.length === 0
          ? 'Comece adicionando o primeiro parceiro ao sistema.'
          : 'Ajuste o filtro ou a busca para encontrar o parceiro desejado.',
        state.all.length === 0 && state.perms.create
      );
      return;
    }

    hideEmptyState();
    tableWrap.hidden = false;
    tbody.innerHTML = '';

    const frag = document.createDocumentFragment();
    state.filtered.forEach((p) => frag.appendChild(buildRow(p)));
    tbody.appendChild(frag);
  }

  function buildRow(p) {
    const tr = document.createElement('tr');
    tr.dataset.id = p.id;
    tr.classList.add('parn-row-clickable');

    tr.appendChild(cell(String(shortCode(p)), 'parn-td--cod'));
    tr.appendChild(cell(p.name || '—'));
    tr.appendChild(cell(primaryAddressLine(p), 'cell--muted'));
    tr.appendChild(cell(p.company_name || '—', 'cell--muted'));
    tr.appendChild(cell(typeLabel(p.type), 'cell--muted'));
    tr.appendChild(cell(p.cpf_cnpj || '—', 'cell--muted'));
    tr.appendChild(cell(p.state_registration || '—', 'cell--muted'));
    tr.appendChild(boolCell(p.status !== 'inactive' && p.status !== 'blocked'));
    tr.appendChild(boolCell(!!p.is_customer));
    tr.appendChild(boolCell(!!p.is_supplier));
    tr.appendChild(boolCell(String(p.tax_regime || '').toLowerCase().includes('simples')));
    tr.appendChild(buildActionsCell(p));

    tr.addEventListener('click', (e) => {
      if (e.target.closest('button, a, input, select, label')) return;
      const row = state.all.find((x) => x.id === p.id);
      if (row) openEditModal(row);
    });

    tr.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const row = state.all.find((x) => x.id === p.id);
      if (!row) return;
      openCtxMenu(e.clientX, e.clientY, row, tr);
    });

    return tr;
  }

  function shortCode(p) {
    if (!p.id) return '—';
    const str = String(p.id).replace(/\D/g, '');
    return str ? str.slice(0, 4) : String(p.id).slice(0, 4);
  }

  function typeLabel(t) {
    const k = String(t || '').toUpperCase();
    if (k === 'PF') return 'Física';
    if (k === 'PJ') return 'Jurídica';
    return t || '—';
  }

  function primaryAddressLine(p) {
    const list = p.customer_addresses || [];
    const x = list.find((a) => a.is_primary) || list[0];
    if (!x) return '—';
    const parts = [x.street, x.number].filter(Boolean);
    return parts.length ? parts.join(', ') : (x.city || '—');
  }

  function cell(text, className) {
    const td = document.createElement('td');
    td.textContent = text;
    if (className) td.className = className;
    return td;
  }

  function boolCell(v) {
    const td = document.createElement('td');
    td.className = 'parn-td--bool';
    td.textContent = v ? 'Sim' : 'Não';
    if (!v) td.classList.add('cell--muted');
    return td;
  }

  function buildActionsCell(p) {
    const cell = document.createElement('td');
    cell.className = 'parn-td--actions';
    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    if (state.perms.edit) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'row-action';
      btn.title = 'Abrir / editar';
      btn.setAttribute('aria-label', 'Editar ' + (p.name || ''));
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
      btn.addEventListener('click', () => openEditModal(p));
      wrap.appendChild(btn);
    }

    if (state.perms.remove) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'row-action row-action--danger';
      btn.title = 'Excluir';
      btn.setAttribute('aria-label', 'Excluir ' + (p.name || ''));
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>';
      btn.addEventListener('click', () => openConfirmModal(p));
      wrap.appendChild(btn);
    }

    cell.appendChild(wrap);
    return cell;
  }

  /* =========================================================
     ESTADOS
     ========================================================= */
  function showLoading(isLoading) {
    const l = document.getElementById('partners-loading');
    const w = document.getElementById('partners-table-wrap');
    const e = document.getElementById('partners-empty');
    if (!l) return;
    if (isLoading) { l.hidden = false; if (w) w.hidden = true; if (e) e.hidden = true; }
    else l.hidden = true;
  }

  function showEmptyState(title, text, showCta) {
    const empty = document.getElementById('partners-empty');
    const t = document.getElementById('partners-empty-title');
    const x = document.getElementById('partners-empty-text');
    const cta = document.getElementById('empty-new-btn');
    if (!empty) return;
    if (t) t.textContent = title;
    if (x) x.textContent = text;
    if (cta) cta.hidden = !showCta;
    empty.hidden = false;
  }

  function hideEmptyState() {
    const e = document.getElementById('partners-empty');
    if (e) e.hidden = true;
  }

  function showGlobalAlert(msg, type) {
    const el = document.getElementById('global-alert');
    if (!el) return;
    el.textContent = msg;
    el.className = 'alert alert--' + (type || 'error');
    el.hidden = false;
  }

  /* =========================================================
     MODAL: PARCEIRO
     ========================================================= */
  const els = {};

  function setupPartnerForm() {
    els.modal = document.getElementById('partner-modal');
    els.form  = document.getElementById('partner-form');
    els.id    = document.getElementById('partner-id');
    els.title = document.getElementById('partner-modal-title');
    els.code  = document.getElementById('partner-modal-code');

    els.type   = document.getElementById('partner-type');
    els.status = document.getElementById('partner-status');
    els.active = document.getElementById('partner-active');

    els.name         = document.getElementById('partner-name');
    els.document     = document.getElementById('partner-document');
    els.documentPJ   = document.getElementById('partner-document-pj');
    els.birth        = document.getElementById('partner-birth');

    els.company      = document.getElementById('partner-company');
    els.trade        = document.getElementById('partner-trade');
    els.ie           = document.getElementById('partner-ie');
    els.im           = document.getElementById('partner-im');

    els.category     = document.getElementById('partner-category');
    els.segment      = document.getElementById('partner-segment');
    els.origin       = document.getElementById('partner-origin');
    els.priceTable   = document.getElementById('partner-price-table');
    els.payCondition = document.getElementById('partner-payment-condition');
    els.payPreferred = document.getElementById('partner-preferred-payment');
    els.creditLimit  = document.getElementById('partner-credit-limit');
    els.defaultDisc  = document.getElementById('partner-default-discount');

    els.cnae         = document.getElementById('partner-cnae');
    els.taxRegime    = document.getElementById('partner-tax-regime');
    els.simplesPill  = document.getElementById('partner-simples-pill');

    els.bankName     = document.getElementById('partner-bank-name');
    els.bankAgency   = document.getElementById('partner-bank-agency');
    els.bankAccount  = document.getElementById('partner-bank-account');
    els.pixKey       = document.getElementById('partner-pix-key');

    els.notes        = document.getElementById('partner-notes');
    els.notesInfo    = document.getElementById('partner-notes-info');

    els.kindCustomer = document.getElementById('kind-customer');
    els.kindSupplier = document.getElementById('kind-supplier');
    els.kindCarrier  = document.getElementById('kind-carrier');
    els.kindOther    = document.getElementById('kind-other');

    els.feedback = document.getElementById('partner-form-feedback');
    els.saveBtn  = document.getElementById('partner-save-btn');
    els.footMeta = document.getElementById('partner-foot-meta');

    if (!els.modal || !els.form) return;

    els.modal.querySelectorAll('[data-close-modal]').forEach((el) => {
      el.addEventListener('click', closePartnerModal);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.modal.hidden) closePartnerModal();
    });

    if (els.type) els.type.addEventListener('change', onTypeChange);
    if (els.active) {
      els.active.addEventListener('change', () => {
        if (!els.status) return;
        els.status.value = els.active.checked ? 'active' : 'inactive';
      });
    }
    if (els.taxRegime) {
      els.taxRegime.addEventListener('change', updateSimplesPill);
    }

    els.modal.querySelectorAll('.parn-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        els.modal.querySelectorAll('.parn-tab').forEach((b) =>
          b.classList.toggle('is-active', b === btn)
        );
        els.modal.querySelectorAll('.parn-panel-tab').forEach((p) =>
          p.classList.toggle('is-active', p.dataset.panel === tab)
        );
      });
    });

    els.modal.querySelectorAll('[data-add-row]').forEach((btn) => {
      btn.addEventListener('click', () => addRow(btn.dataset.addRow, {}));
    });

    bindMask(els.document, maskCPF);
    bindMask(els.documentPJ, maskCNPJ);

    els.form.addEventListener('submit', onSubmitPartner);
  }

  function updateSimplesPill() {
    if (!els.simplesPill) return;
    const v = String(els.taxRegime?.value || '');
    const isSimples = v.toLowerCase().includes('simples') || v.toLowerCase().includes('mei');
    els.simplesPill.textContent = isSimples ? 'Sim' : 'Não';
    els.simplesPill.classList.toggle('is-on', isSimples);
  }

  function onTypeChange() {
    if (!els.type) return;
    const isPJ = els.type.value === 'PJ';
    els.modal.classList.toggle('is-pj', isPJ);
    if (els.name) els.name.required = !isPJ;
    if (els.company) els.company.required = isPJ;
  }

  /* =========================================================
     REPETÍVEIS
     ========================================================= */
  const FIELDS = {
    phones: {
      container: 'phones-rows', state: 'phones',
      template: (d) => ({ type: d.type || 'Celular', phone: d.phone || '', is_primary: d.is_primary === true }),
      render: renderPhoneRow
    },
    emails: {
      container: 'emails-rows', state: 'emails',
      template: (d) => ({ type: d.type || 'Principal', email: d.email || '', is_primary: d.is_primary === true }),
      render: renderEmailRow
    },
    addresses: {
      container: 'addresses-rows', state: 'addresses',
      template: (d) => ({
        type: d.type || 'Residencial',
        zip_code: d.zip_code || '', state: d.state || '', city: d.city || '',
        neighborhood: d.neighborhood || '', street: d.street || '', number: d.number || '',
        complement: d.complement || '', reference: d.reference || '', is_primary: d.is_primary === true
      }),
      render: renderAddressRow
    },
    contacts: {
      container: 'contacts-rows', state: 'contacts',
      template: (d) => ({
        name: d.name || '', department: d.department || '', position: d.position || '',
        phone: d.phone || '', email: d.email || '', is_primary: d.is_primary === true, notes: d.notes || ''
      }),
      render: renderContactRow
    }
  };

  function addRow(kind, data) {
    const cfg = FIELDS[kind]; if (!cfg) return;
    state[cfg.state].push(cfg.template(data));
    renderRows(kind);
  }

  function renderRows(kind) {
    const cfg = FIELDS[kind];
    const wrap = document.getElementById(cfg.container);
    if (!wrap) return;
    wrap.innerHTML = '';
    state[cfg.state].forEach((item, idx) => wrap.appendChild(cfg.render(item, idx, kind)));
    const block = wrap.closest('.repeatable');
    if (block) block.classList.toggle('repeatable--empty', state[cfg.state].length === 0);
  }

  function removeRow(kind, idx) { state[FIELDS[kind].state].splice(idx, 1); renderRows(kind); }
  function updateRow(kind, idx, field, value) { state[FIELDS[kind].state][idx][field] = value; }

  function renderPhoneRow(item, idx) {
    const row = document.createElement('div');
    row.className = 'repeatable-row repeatable-row--phone';
    row.appendChild(selectField(['Celular','WhatsApp','Comercial','Residencial','Recado','Outro'],
      item.type, (v) => updateRow('phones', idx, 'type', v)));
    row.appendChild(inputField('tel', item.phone, '(00) 00000-0000',
      (v) => updateRow('phones', idx, 'phone', v), maskPhone));
    row.appendChild(primaryToggle(item.is_primary, (v) => updateRow('phones', idx, 'is_primary', v)));
    row.appendChild(removeBtn(() => removeRow('phones', idx)));
    return row;
  }

  function renderEmailRow(item, idx) {
    const row = document.createElement('div');
    row.className = 'repeatable-row repeatable-row--email';
    row.appendChild(selectField(['Principal','Comercial','Financeiro','Pessoal','Outro'],
      item.type, (v) => updateRow('emails', idx, 'type', v)));
    row.appendChild(inputField('email', item.email, 'parceiro@empresa.com',
      (v) => updateRow('emails', idx, 'email', v)));
    row.appendChild(primaryToggle(item.is_primary, (v) => updateRow('emails', idx, 'is_primary', v)));
    row.appendChild(removeBtn(() => removeRow('emails', idx)));
    return row;
  }

  function renderAddressRow(item, idx) {
    const row = document.createElement('div');
    row.className = 'repeatable-row repeatable-row--address';
    row.appendChild(selectField(['Residencial','Comercial','Entrega','Cobrança','Outro'],
      item.type, (v) => updateRow('addresses', idx, 'type', v)));
    row.appendChild(inputField('text', item.zip_code, 'CEP',
      (v) => updateRow('addresses', idx, 'zip_code', v), maskCEP));
    row.appendChild(inputField('text', item.city, 'Cidade',
      (v) => updateRow('addresses', idx, 'city', v)));
    row.appendChild(inputField('text', item.state, 'UF',
      (v) => updateRow('addresses', idx, 'state', v.toUpperCase().slice(0, 2))));
    row.appendChild(removeBtn(() => removeRow('addresses', idx)));

    const line2 = document.createElement('div');
    line2.className = 'repeatable-row__line2';
    line2.appendChild(inputField('text', item.street, 'Rua',
      (v) => updateRow('addresses', idx, 'street', v)));
    line2.appendChild(inputField('text', item.number, 'Nº',
      (v) => updateRow('addresses', idx, 'number', v)));
    line2.appendChild(inputField('text', item.complement, 'Complemento',
      (v) => updateRow('addresses', idx, 'complement', v)));
    line2.appendChild(inputField('text', item.neighborhood, 'Bairro',
      (v) => updateRow('addresses', idx, 'neighborhood', v)));
    line2.appendChild(primaryToggle(item.is_primary, (v) => updateRow('addresses', idx, 'is_primary', v)));
    row.appendChild(line2);
    return row;
  }

  function renderContactRow(item, idx) {
    const row = document.createElement('div');
    row.className = 'repeatable-row repeatable-row--contact';
    row.appendChild(inputField('text', item.name, 'Nome *',
      (v) => updateRow('contacts', idx, 'name', v)));
    row.appendChild(inputField('text', item.department, 'Setor',
      (v) => updateRow('contacts', idx, 'department', v)));
    row.appendChild(inputField('text', item.position, 'Cargo',
      (v) => updateRow('contacts', idx, 'position', v)));
    row.appendChild(inputField('tel', item.phone, 'Telefone',
      (v) => updateRow('contacts', idx, 'phone', v), maskPhone));
    row.appendChild(inputField('email', item.email, 'E-mail',
      (v) => updateRow('contacts', idx, 'email', v)));
    row.appendChild(primaryToggle(item.is_primary, (v) => updateRow('contacts', idx, 'is_primary', v)));
    row.appendChild(removeBtn(() => removeRow('contacts', idx)));
    return row;
  }

  function inputField(type, value, placeholder, onChange, mask) {
    const input = document.createElement('input');
    input.type = type;
    input.value = value || '';
    if (placeholder) input.placeholder = placeholder;
    if (mask) bindMask(input, mask);
    input.addEventListener('input', () => onChange(input.value));
    return input;
  }

  function selectField(options, value, onChange) {
    const select = document.createElement('select');
    options.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt; o.textContent = opt;
      select.appendChild(o);
    });
    select.value = value || options[0];
    select.addEventListener('change', () => onChange(select.value));
    return select;
  }

  function primaryToggle(checked, onChange) {
    const wrap = document.createElement('label');
    wrap.className = 'repeatable-row__primary';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!checked;
    cb.addEventListener('change', () => onChange(cb.checked));
    const txt = document.createElement('span');
    txt.textContent = 'Principal';
    wrap.appendChild(cb);
    wrap.appendChild(txt);
    return wrap;
  }

  function removeBtn(onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'repeatable-row__remove';
    b.setAttribute('aria-label', 'Remover linha');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    b.addEventListener('click', onClick);
    return b;
  }

  function bindMask(input, maskFn) {
    if (!input) return;
    input.addEventListener('input', () => { input.value = maskFn(input.value); });
  }
  function maskCPF(v) {
    return String(v || '').replace(/\D/g, '').slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  function maskCNPJ(v) {
    return String(v || '').replace(/\D/g, '').slice(0, 14)
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
  function maskCEP(v) {
    return String(v || '').replace(/\D/g, '').slice(0, 8)
      .replace(/(\d{5})(\d)/, '$1-$2');
  }
  function maskPhone(v) {
    const d = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return '(' + d;
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  /* =========================================================
     RESET / ABRIR MODAL
     ========================================================= */
  function resetModal() {
    els.form.reset();
    if (els.id) els.id.value = '';
    if (els.type) els.type.value = 'PJ';
    if (els.status) els.status.value = 'active';
    if (els.active) els.active.checked = true;
    if (els.kindCustomer) els.kindCustomer.checked = true;
    if (els.kindSupplier) els.kindSupplier.checked = false;
    if (els.kindCarrier)  els.kindCarrier.checked = false;
    if (els.kindOther)    els.kindOther.checked = false;

    state.phones = [];
    state.emails = [];
    state.addresses = [];
    state.contacts = [];
    renderRows('phones');
    renderRows('emails');
    renderRows('addresses');
    renderRows('contacts');

    els.modal.querySelectorAll('.parn-tab').forEach((b, i) => {
      b.classList.toggle('is-active', i === 0);
    });
    els.modal.querySelectorAll('.parn-panel-tab').forEach((p, i) => {
      p.classList.toggle('is-active', i === 0);
    });

    if (els.code) els.code.textContent = '—';
    if (els.footMeta) els.footMeta.textContent = '';

    updateSimplesPill();
    clearFeedback();
    onTypeChange();
  }

  function openCreateModal() {
    if (!state.perms.create) {
      showToast('Você não tem permissão para criar parceiros.', 'error');
      return;
    }
    editGeneration += 1;
    state.editingId = null;
    if (els.title) els.title.textContent = 'Novo parceiro';
    resetModal();
    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    if (els.name) els.name.focus();
  }

  async function openEditModal(rowSummary) {
    if (!state.perms.edit) {
      showToast('Você não tem permissão para editar parceiros.', 'error');
      return;
    }

    editGeneration += 1;
    const myGen = editGeneration;

    state.editingId = rowSummary.id;
    if (els.title) els.title.textContent = 'Parceiro';
    if (els.code) els.code.textContent = 'Cód. ' + shortCode(rowSummary);

    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    clearFeedback();
    showFeedback('Carregando dados do parceiro…', 'info');

    try {
      const { data, error } = await window.db.rpc('get_customer_full', {
        p_customer_id: rowSummary.id
      });
      if (error) throw error;
      if (myGen !== editGeneration) return;

      const c = data && data.customer ? data.customer : {};
      const phones    = data && Array.isArray(data.phones)    ? data.phones    : [];
      const emails    = data && Array.isArray(data.emails)    ? data.emails    : [];
      const addresses = data && Array.isArray(data.addresses) ? data.addresses : [];
      const contacts  = data && Array.isArray(data.contacts)  ? data.contacts  : [];

      state.phones    = phones.map((p) => ({ type: p.type, phone: p.phone, is_primary: !!p.is_primary }));
      state.emails    = emails.map((e) => ({ type: e.type, email: e.email, is_primary: !!e.is_primary }));
      state.addresses = addresses.map((a) => ({
        type: a.type, zip_code: a.zip_code || '', state: a.state || '', city: a.city || '',
        neighborhood: a.neighborhood || '', street: a.street || '', number: a.number || '',
        complement: a.complement || '', reference: a.reference || '', is_primary: !!a.is_primary
      }));
      state.contacts  = contacts.map((k) => ({
        name: k.name || '', department: k.department || '', position: k.position || '',
        phone: k.phone || '', email: k.email || '', is_primary: !!k.is_primary, notes: k.notes || ''
      }));

      if (els.id) els.id.value = c.id || '';
      if (els.type) els.type.value = c.type || 'PJ';
      if (els.status) els.status.value = c.status || 'active';
      if (els.active) els.active.checked = (c.status || 'active') === 'active';

      const isPJ = c.type === 'PJ';
      if (isPJ) {
        if (els.documentPJ) els.documentPJ.value = c.cpf_cnpj || '';
        if (els.document)   els.document.value = '';
      } else {
        if (els.document)   els.document.value = c.cpf_cnpj || '';
        if (els.documentPJ) els.documentPJ.value = '';
      }

      if (els.name)         els.name.value = c.name || '';
      if (els.company)      els.company.value = c.company_name || '';
      if (els.trade)        els.trade.value = c.trade_name || '';
      if (els.ie)           els.ie.value = c.state_registration || '';
      if (els.im)           els.im.value = c.municipal_registration || '';
      if (els.birth)        els.birth.value = c.birth_date ? String(c.birth_date).slice(0, 10) : '';
      if (els.category)     els.category.value = c.category || '';
      if (els.segment)      els.segment.value = c.segment || '';
      if (els.origin)       els.origin.value = c.origin || '';
      if (els.priceTable)   els.priceTable.value = c.price_table || '';
      if (els.payCondition) els.payCondition.value = c.payment_condition || '';
      if (els.payPreferred) els.payPreferred.value = c.preferred_payment_method || '';
      if (els.creditLimit)  els.creditLimit.value = c.credit_limit != null ? c.credit_limit : 0;
      if (els.defaultDisc)  els.defaultDisc.value = c.default_discount != null ? c.default_discount : 0;
      if (els.cnae)         els.cnae.value = c.cnae || '';
      if (els.taxRegime)    els.taxRegime.value = c.tax_regime || '';
      if (els.notes)        els.notes.value = c.commercial_notes || '';
      if (els.notesInfo)    els.notesInfo.value = c.notes || '';

      const bankInfo = parseBankFromNotes(c.commercial_notes || '');
      if (els.bankName)    els.bankName.value    = bankInfo.bank    || '';
      if (els.bankAgency)  els.bankAgency.value  = bankInfo.agency  || '';
      if (els.bankAccount) els.bankAccount.value = bankInfo.account || '';
      if (els.pixKey)      els.pixKey.value      = bankInfo.pix     || '';

      if (els.kindCustomer) els.kindCustomer.checked = c.is_customer === true;
      if (els.kindSupplier) els.kindSupplier.checked = c.is_supplier === true;
      if (els.kindCarrier)  els.kindCarrier.checked  = c.is_carrier  === true;
      if (els.kindOther)    els.kindOther.checked    = c.is_other    === true;

      renderRows('phones');
      renderRows('emails');
      renderRows('addresses');
      renderRows('contacts');

      updateSimplesPill();
      onTypeChange();
      clearFeedback();

      if (els.footMeta) {
        els.footMeta.textContent = c.created_at
          ? 'Cadastrado em ' + new Date(c.created_at).toLocaleDateString('pt-BR')
          : '';
      }

      if (isPJ && els.company) els.company.focus();
      else if (!isPJ && els.name) els.name.focus();
    } catch (error) {
      if (myGen !== editGeneration) return;
      console.error('[parceiros] load:', error);
      showFeedback(mapDbError(error));
    }
  }

  function parseBankFromNotes(raw) {
    const out = { bank: '', agency: '', account: '', pix: '' };
    String(raw).split('\n').forEach((line) => {
      const m = line.match(/^(Banco|Ag[eê]ncia|Conta|Pix):\s*(.+)$/i);
      if (!m) return;
      const k = m[1].toLowerCase();
      if (k.startsWith('banco')) out.bank = m[2].trim();
      else if (k.startsWith('ag')) out.agency = m[2].trim();
      else if (k.startsWith('conta')) out.account = m[2].trim();
      else if (k.startsWith('pix')) out.pix = m[2].trim();
    });
    return out;
  }

  function closePartnerModal() {
    if (state.saving) return;
    els.modal.hidden = true;
    document.body.style.overflow = '';
  }

  /* =========================================================
     SUBMIT
     ========================================================= */
  async function onSubmitPartner(event) {
    event.preventDefault();
    if (state.saving) return;

    if (state.editingId && !state.perms.edit) { showFeedback('Sem permissão para editar.'); return; }
    if (!state.editingId && !state.perms.create) { showFeedback('Sem permissão para criar.'); return; }

    clearFeedback();

    const isPJ = els.type && els.type.value === 'PJ';
    const name = isPJ
      ? (els.company.value.trim() || els.name.value.trim())
      : els.name.value.trim();

    if (!name) {
      showFeedback(isPJ ? 'Informe a Razão Social.' : 'Informe o nome do parceiro.');
      (isPJ ? els.company : els.name).focus();
      return;
    }

    const isCustomer = els.kindCustomer && els.kindCustomer.checked;
    const isSupplier = els.kindSupplier && els.kindSupplier.checked;
    const isCarrier  = els.kindCarrier  && els.kindCarrier.checked;
    const isOther    = els.kindOther    && els.kindOther.checked;

    if (!isCustomer && !isSupplier && !isCarrier && !isOther) {
      showFeedback('Marque pelo menos um papel.');
      return;
    }

    const documentValue = isPJ ? els.documentPJ.value : els.document.value;
    const documentClean = String(documentValue || '').replace(/\D/g, '');
    if (isPJ && documentClean && documentClean.length !== 14) { showFeedback('CNPJ incompleto.'); els.documentPJ.focus(); return; }
    if (!isPJ && documentClean && documentClean.length !== 11) { showFeedback('CPF incompleto.'); els.document.focus(); return; }

    const phones    = state.phones.filter((p) => p.phone && p.phone.replace(/\D/g,'') !== '');
    const emails    = state.emails.filter((e) => e.email && e.email.trim() !== '');
    const addresses = state.addresses.filter((a) =>
      (a.street && a.street.trim()) || (a.zip_code && a.zip_code.trim()) || (a.city && a.city.trim()));
    const contacts  = state.contacts.filter((k) => k.name && k.name.trim() !== '');

    for (let i = 0; i < emails.length; i++) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emails[i].email)) {
        showFeedback('E-mail inválido: ' + emails[i].email); return;
      }
    }

    const bankLines = [];
    const bankName    = (els.bankName?.value || '').trim();
    const bankAgency  = (els.bankAgency?.value || '').trim();
    const bankAccount = (els.bankAccount?.value || '').trim();
    const pixKey      = (els.pixKey?.value || '').trim();
    if (bankName)    bankLines.push('Banco: ' + bankName);
    if (bankAgency)  bankLines.push('Agência: ' + bankAgency);
    if (bankAccount) bankLines.push('Conta: ' + bankAccount);
    if (pixKey)      bankLines.push('Pix: ' + pixKey);

    const rawNotes = els.notes.value.trim();
    const keptNotes = rawNotes.split('\n')
      .filter((l) => !/^(Banco|Ag[eê]ncia|Conta|Pix):/i.test(l))
      .join('\n')
      .trim();

    const finalNotes = [keptNotes, bankLines.join('\n')].filter(Boolean).join('\n\n');

    const customer = {
      type: isPJ ? 'PJ' : 'PF',
      name: isPJ ? (els.name.value.trim() || els.company.value.trim()) : name,
      cpf_cnpj: documentValue || null,
      company_name: isPJ ? (els.company.value.trim() || null) : null,
      trade_name: isPJ ? (els.trade.value.trim() || null) : null,
      state_registration: isPJ ? (els.ie.value.trim() || null) : null,
      municipal_registration: isPJ ? (els.im.value.trim() || null) : null,
      birth_date: !isPJ && els.birth.value ? els.birth.value : null,
      category: els.category.value.trim() || null,
      segment: els.segment.value.trim() || null,
      origin: els.origin.value || null,
      price_table: els.priceTable.value.trim() || null,
      payment_condition: els.payCondition.value.trim() || null,
      preferred_payment_method: els.payPreferred.value || null,
      credit_limit: numberOrNull(els.creditLimit.value),
      default_discount: numberOrNull(els.defaultDisc.value),
      cnae: isPJ ? (els.cnae.value.trim() || null) : null,
      tax_regime: isPJ ? (els.taxRegime.value || null) : null,
      commercial_notes: finalNotes || null,
      notes: els.notesInfo?.value.trim() || null,
      status: els.status.value || 'active',
      is_customer: isCustomer,
      is_supplier: isSupplier,
      is_carrier: isCarrier,
      is_other: isOther,
      phone: phones[0] ? phones[0].phone : null,
      email: emails[0] ? emails[0].email : null,
      address: addresses[0] ? [addresses[0].street, addresses[0].number].filter(Boolean).join(', ') : null
    };

    setSaving(true);

    try {
      const { error } = await window.db.rpc('upsert_customer_full', {
        p_customer_id: state.editingId,
        p_organization_id: null,
        p_customer: customer,
        p_phones: phones,
        p_emails: emails,
        p_addresses: addresses,
        p_contacts: contacts
      });
      if (error) throw error;

      closePartnerModal();
      showToast(state.editingId ? 'Parceiro atualizado.' : 'Parceiro cadastrado.', 'success');
      await loadPartners();
    } catch (error) {
      console.error('[parceiros] save:', error);
      showFeedback(mapDbError(error));
    } finally {
      setSaving(false);
    }
  }

  function numberOrNull(v) {
    if (v === '' || v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    let str = String(v).trim();
    if (str.indexOf(',') !== -1 && str.indexOf('.') !== -1) str = str.replace(/\./g, '').replace(',', '.');
    else if (str.indexOf(',') !== -1) str = str.replace(',', '.');
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
  }

  function setSaving(v) {
    state.saving = v;
    if (els.saveBtn) {
      els.saveBtn.disabled = v;
      els.saveBtn.classList.toggle('is-loading', v);
      els.saveBtn.setAttribute('aria-busy', String(v));
      const l = els.saveBtn.querySelector('.btn__label');
      if (l) l.textContent = v ? 'Salvando…' : 'Salvar';
    }
  }

  function showFeedback(msg, type) {
    if (!els.feedback) return;
    els.feedback.textContent = msg;
    els.feedback.className = 'feedback feedback--' + (type || 'error');
    els.feedback.hidden = false;
    try { els.feedback.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
  }
  function clearFeedback() {
    if (!els.feedback) return;
    els.feedback.textContent = '';
    els.feedback.className = 'feedback feedback--error';
    els.feedback.hidden = true;
  }

  /* =========================================================
     CONFIRMAR EXCLUSÃO
     ========================================================= */
  const confirmEls = {};

  function setupConfirmModal() {
    confirmEls.modal = document.getElementById('confirm-modal');
    confirmEls.text  = document.getElementById('confirm-text');
    confirmEls.btn   = document.getElementById('confirm-delete-btn');
    if (!confirmEls.modal || !confirmEls.btn) return;

    confirmEls.modal.querySelectorAll('[data-close-modal]').forEach((el) => {
      el.addEventListener('click', closeConfirmModal);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !confirmEls.modal.hidden) closeConfirmModal();
    });
    confirmEls.btn.addEventListener('click', onConfirmDelete);
  }

  function openConfirmModal(partner) {
    if (!state.perms.remove) { showToast('Sem permissão para excluir.', 'error'); return; }
    state.deletingId = partner.id;
    if (confirmEls.text) {
      confirmEls.text.textContent =
        'Excluir "' + (partner.name || partner.company_name || 'este parceiro') +
        '"? Os dados vinculados também serão removidos. Esta ação não pode ser desfeita.';
    }
    confirmEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    confirmEls.btn.focus();
  }

  function closeConfirmModal(force) {
    if (state.deleting && !force) return;
    if (!confirmEls.modal) return;
    confirmEls.modal.hidden = true;
    document.body.style.overflow = '';
    state.deletingId = null;
  }

  async function onConfirmDelete() {
    if (state.deleting || !state.deletingId) return;
    setDeleting(true);
    try {
      const { error } = await window.db.from('customers').delete().eq('id', state.deletingId);
      if (error) throw error;

      state.deleting = false;
      closeConfirmModal(true);
      state.deletingId = null;

      showToast('Parceiro excluído.', 'success');
      await loadPartners();
    } catch (error) {
      console.error('[parceiros] delete:', error);
      showToast(mapDbError(error), 'error');
    } finally {
      setDeleting(false);
    }
  }

  function setDeleting(v) {
    state.deleting = v;
    if (!confirmEls.btn) return;
    confirmEls.btn.disabled = v;
    confirmEls.btn.classList.toggle('is-loading', v);
    confirmEls.btn.setAttribute('aria-busy', String(v));
    const l = confirmEls.btn.querySelector('.btn__label');
    if (l) l.textContent = v ? 'Excluindo…' : 'Excluir';
  }

  /* =========================================================
     MENU DE CONTEXTO (right-click na grade)
     ========================================================= */
  let ctxMenuEl = null;
  let ctxTargetPartner = null;

  function setupCtxMenu() {
    document.addEventListener('click', (e) => {
      if (!ctxMenuEl || ctxMenuEl.hidden) return;
      if (ctxMenuEl.contains(e.target)) return;
      closeCtxMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && ctxMenuEl && !ctxMenuEl.hidden) closeCtxMenu();
    });
    window.addEventListener('resize', closeCtxMenu);
    window.addEventListener('scroll', closeCtxMenu, true);
  }

  function buildCtxMenu() {
    const menu = document.createElement('div');
    menu.className = 'parn-ctx';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    const items = [
      { group: 'Validação / Situação' },
      { id: 'validate', label: 'Validar CNPJ/CPF',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' },
      { id: 'update-receitaws', label: 'Atualizar situação cadastral (ReceitaWS)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>' },
      { id: 'update-sefaz', label: 'Atualizar situação cadastral SEFAZ/SUFRAMA',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
        badge: 'Requer certificado' },
      { id: 'suspend-sefaz', label: 'Suspender validação SEFAZ',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
        badge: 'Requer certificado' },

      { sep: true },
      { group: 'Importação' },
      { id: 'import-receitaws', label: 'Importar dados cadastrais (ReceitaWS)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>' },
      { id: 'import-sefaz', label: 'Importar dados cadastrais (SEFAZ)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
        badge: 'Requer certificado' },

      { sep: true },
      { group: 'Endereço' },
      { id: 'copy-addr', label: 'Copiar Endereço Principal p/ End. de Entrega…',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>' },

      { sep: true },
      { group: 'Grade (ação em massa)' },
      { id: 'bulk-selection', label: 'Alterar o campo "Seleção" de TODOS os parceiros na grade…',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M21 12a9 9 0 1 1-9-9"/></svg>' },

      { sep: true },
      { group: 'Cadastro' },
      { id: 'copy-doc', label: 'Copiar CNPJ/CPF para a área de transferência',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>' },
      { id: 'toggle-active', label: 'Ativar/Inativar parceiro',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/><path d="M12 2v10"/></svg>' },
      { id: 'labels', label: 'Impressão de Etiquetas',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>' },

      { sep: true },
      { group: 'Consulta externa' },
      { id: 'open-sefaz', label: 'Consultar no SEFAZ (abre navegador)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>' },
      { id: 'open-receitaws', label: 'Consultar no ReceitaWS (abre navegador)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>' },
      { id: 'risk-analysis', label: 'Consultar análise de risco',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>' },

      { sep: true },
      { id: 'delete', label: 'Excluir parceiro…', danger: true,
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>' }
    ];

    menu.innerHTML = items.map((it) => {
      if (it.sep) return '<div class="parn-ctx__sep" role="separator"></div>';
      if (it.group) return `<div class="parn-ctx__group">${it.group}</div>`;

      const badge = it.badge
        ? `<span class="parn-ctx__badge">${it.badge}</span>`
        : '';

      return `
        <button type="button" class="parn-ctx__item ${it.danger ? 'parn-ctx__item--danger' : ''} ${it.badge ? 'parn-ctx__item--with-badge' : ''}"
                role="menuitem" data-action="${it.id}">
          ${it.icon}<span class="parn-ctx__label">${it.label}</span>${badge}
        </button>`;
    }).join('');

    document.body.appendChild(menu);

    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      handleCtxAction(btn.dataset.action, ctxTargetPartner);
      closeCtxMenu();
    });

    return menu;
  }

  function ensureCtxMenu() {
    if (!ctxMenuEl) ctxMenuEl = buildCtxMenu();
    return ctxMenuEl;
  }

  function openCtxMenu(x, y, partner, rowEl) {
    const menu = ensureCtxMenu();
    ctxTargetPartner = partner;

    document.querySelectorAll('.parn-ctx-target').forEach((tr) => tr.classList.remove('parn-ctx-target'));
    if (rowEl) rowEl.classList.add('parn-ctx-target');

    const hasDoc = !!(partner && partner.cpf_cnpj);
    const isPJ = String(partner && partner.type || '').toUpperCase() === 'PJ';
    const canExternal = hasDoc && isPJ;

    menu.querySelectorAll('[data-action]').forEach((btn) => {
      const a = btn.dataset.action;
      if (a === 'validate' || a === 'copy-doc') btn.disabled = !hasDoc;
      if (a === 'import-receitaws' || a === 'open-receitaws' ||
          a === 'update-receitaws' ||
          a === 'open-sefaz' || a === 'import-sefaz' ||
          a === 'update-sefaz' || a === 'risk-analysis') {
        btn.disabled = !canExternal;
      }
      if (a === 'delete') btn.disabled = !state.perms.remove;
      if (a === 'bulk-selection') btn.disabled = !state.perms.edit;
    });

    menu.hidden = false;

    const rect = menu.getBoundingClientRect();
    const margin = 8;
    let left = x, top = y;

    if (left + rect.width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - rect.width - margin);
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - rect.height - margin);
    }

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }

  function closeCtxMenu() {
    if (ctxMenuEl) ctxMenuEl.hidden = true;
    document.querySelectorAll('.parn-ctx-target').forEach((tr) => tr.classList.remove('parn-ctx-target'));
    ctxTargetPartner = null;
  }

  async function handleCtxAction(action, partner) {
    if (!partner) return;
    switch (action) {
      case 'validate':          return ctxValidateDoc(partner);
      case 'update-receitaws':  return ctxUpdateFromReceitaWS(partner);
      case 'update-sefaz':      return ctxUpdateFromSefaz(partner);
      case 'suspend-sefaz':     return ctxSuspendSefaz(partner);
      case 'import-receitaws':  return ctxImportFromReceitaWS(partner);
      case 'import-sefaz':      return ctxImportFromSefaz(partner);
      case 'copy-addr':         return ctxCopyAddressToDelivery(partner);
      case 'bulk-selection':    return ctxBulkSelection();
      case 'copy-doc':          return ctxCopyDoc(partner);
      case 'toggle-active':     return ctxToggleActive(partner);
      case 'labels':            return ctxPrintLabels(partner);
      case 'open-sefaz':        return ctxOpenSefaz(partner);
      case 'open-receitaws':    return ctxOpenReceitaWS(partner);
      case 'risk-analysis':     return ctxRiskAnalysis(partner);
      case 'delete':            return ctxDelete(partner);
    }
  }

  function ctxValidateDoc(partner) {
    const doc = String(partner.cpf_cnpj || '').replace(/\D/g, '');
    if (!doc) { showToast('Parceiro sem CNPJ/CPF cadastrado.', 'error'); return; }

    const isCNPJ = doc.length === 14;
    const isCPF  = doc.length === 11;

    if (!isCNPJ && !isCPF) {
      showToast('Documento com tamanho inválido.', 'error');
      return;
    }

    const valid = isCNPJ ? validateCNPJ(doc) : validateCPF(doc);

    if (valid) {
      showToast((isCNPJ ? 'CNPJ' : 'CPF') + ' válido: ' + partner.cpf_cnpj, 'success');
    } else {
      showToast((isCNPJ ? 'CNPJ' : 'CPF') + ' INVÁLIDO: ' + partner.cpf_cnpj, 'error');
    }
  }

  function validateCPF(cpf) {
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0, r;
    for (let i = 1; i <= 9; i++) sum += parseInt(cpf[i - 1]) * (11 - i);
    r = (sum * 10) % 11;
    if (r === 10 || r === 11) r = 0;
    if (r !== parseInt(cpf[9])) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(cpf[i - 1]) * (12 - i);
    r = (sum * 10) % 11;
    if (r === 10 || r === 11) r = 0;
    return r === parseInt(cpf[10]);
  }

  function validateCNPJ(cnpj) {
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cnpj)) return false;
    const calc = (base) => {
      let sum = 0, pos = base.length - 7;
      for (let i = 0; i < base.length; i++) {
        sum += parseInt(base[i]) * pos--;
        if (pos < 2) pos = 9;
      }
      const r = sum % 11;
      return r < 2 ? 0 : 11 - r;
    };
    const d1 = calc(cnpj.slice(0, 12));
    const d2 = calc(cnpj.slice(0, 12) + d1);
    return cnpj.endsWith(String(d1) + String(d2));
  }

  async function ctxUpdateFromReceitaWS(partner) {
    const cnpj = String(partner.cpf_cnpj || '').replace(/\D/g, '');
    if (cnpj.length !== 14) { showToast('Só funciona para CNPJ.', 'error'); return; }

    showToast('Consultando situação cadastral…', 'info');

    try {
      const data = await lookupCNPJ(cnpj);
      if (!data) throw new Error('CNPJ não encontrado.');

      const patch = {};
      if (data.name)    patch.company_name = data.name;
      if (data.fantasy) patch.trade_name   = data.fantasy;
      if (data.email)   patch.email        = data.email;
      if (data.phone)   patch.phone        = data.phone;
      if (data.address) patch.address      = data.address;

      if (Object.keys(patch).length === 0) {
        showToast('Nada novo para atualizar.', 'info');
        return;
      }

      const { error } = await window.db.from('customers').update(patch).eq('id', partner.id);
      if (error) throw error;

      showToast('Situação atualizada com sucesso.', 'success');
      await loadPartners();
    } catch (e) {
      console.error('[ctxUpdateFromReceitaWS]', e);
      showToast('Não foi possível atualizar. ' + (e.message || ''), 'error');
    }
  }

  function ctxUpdateFromSefaz(partner) {
    showToast(
      'A consulta SEFAZ/SUFRAMA exige certificado digital A1/A3 configurado no servidor. ' +
      'Configure a integração para habilitar esta ação.',
      'info'
    );
  }

  function ctxSuspendSefaz(partner) {
    const key = 'devhub_suspend_sefaz';
    const current = localStorage.getItem(key) === '1';
    if (!window.confirm(
      current
        ? 'Reativar a validação SEFAZ automática para todos os parceiros?'
        : 'Suspender a validação SEFAZ automática para todos os parceiros?'
    )) return;

    localStorage.setItem(key, current ? '0' : '1');
    showToast(
      current ? 'Validação SEFAZ reativada.' : 'Validação SEFAZ suspensa.',
      'success'
    );
  }

  async function ctxImportFromReceitaWS(partner) {
    const cnpj = String(partner.cpf_cnpj || '').replace(/\D/g, '');
    if (cnpj.length !== 14) { showToast('A importação só funciona para CNPJ.', 'error'); return; }

    showToast('Consultando Receita Federal…', 'info');

    try {
      const data = await lookupCNPJ(cnpj);
      if (!data) throw new Error('CNPJ não encontrado.');

      const merged = Object.assign({}, partner, {
        company_name: data.name || partner.company_name,
        trade_name:   data.fantasy || partner.trade_name,
        email:        data.email || partner.email,
        phone:        data.phone || partner.phone,
        address:      data.address || partner.address
      });

      showToast('Dados obtidos. Revise e salve.', 'success');
      openEditModal(merged);
    } catch (e) {
      console.error('[ctxImportFromReceitaWS]', e);
      showToast('Não foi possível consultar agora. ' + (e.message || ''), 'error');
    }
  }

  function ctxImportFromSefaz(partner) {
    showToast(
      'A importação SEFAZ exige certificado digital A1/A3 configurado no servidor. ' +
      'Use a opção ReceitaWS enquanto a integração não estiver disponível.',
      'info'
    );
  }

  async function lookupCNPJ(cnpj) {
    const providers = [
      {
        name: 'BrasilAPI',
        url: `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
        parse: (d) => ({
          name: d.razao_social || d.nome_fantasia || '',
          fantasy: d.nome_fantasia || '',
          email: d.email || '',
          phone: (d.ddd_telefone_1 || '').replace(/\D/g, ''),
          address: buildAddressFromAPI(d)
        })
      },
      {
        name: 'ReceitaWS',
        url: `https://receitaws.com.br/v1/cnpj/${cnpj}`,
        parse: (d) => {
          if (d.status === 'ERROR') throw new Error(d.message || 'CNPJ não encontrado');
          return {
            name: d.nome || '',
            fantasy: d.fantasia || '',
            email: d.email || '',
            phone: (d.telefone || '').replace(/\D/g, ''),
            address: buildAddressFromAPI({
              logradouro: d.logradouro, numero: d.numero, complemento: d.complemento,
              bairro: d.bairro, municipio: d.municipio, uf: d.uf, cep: d.cep
            })
          };
        }
      }
    ];

    let lastErr = null;
    for (const p of providers) {
      try {
        const res = await fetch(p.url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`${p.name} ${res.status}`);
        const data = await res.json();
        return p.parse(data);
      } catch (e) {
        console.warn(`[lookupCNPJ] ${p.name} falhou:`, e.message);
        lastErr = e;
      }
    }
    throw lastErr || new Error('Falha ao consultar CNPJ.');
  }

  function buildAddressFromAPI(d) {
    const parts = [];
    if (d.logradouro) parts.push(d.logradouro + (d.numero ? ', ' + d.numero : ''));
    if (d.complemento) parts.push(d.complemento);
    if (d.bairro) parts.push(d.bairro);
    if (d.municipio && d.uf) parts.push(`${d.municipio}/${d.uf}`);
    else if (d.municipio) parts.push(d.municipio);
    if (d.cep) parts.push('CEP ' + String(d.cep).replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2'));
    return parts.filter(Boolean).join(' · ');
  }

  async function ctxCopyAddressToDelivery(partner) {
    if (!window.confirm('Copiar o endereço principal do parceiro para um novo endereço do tipo "Entrega"?')) return;

    try {
      const { data, error } = await window.db.rpc('get_customer_full', { p_customer_id: partner.id });
      if (error) throw error;

      const addresses = data && Array.isArray(data.addresses) ? data.addresses : [];
      const primary = addresses.find((a) => a.is_primary) || addresses[0];

      if (!primary) {
        showToast('Este parceiro não possui endereço cadastrado.', 'error');
        return;
      }

      const cloned = Object.assign({}, primary, { type: 'Entrega', is_primary: false });
      delete cloned.id;

      const merged = addresses.concat([cloned]).map((a) => ({
        type: a.type, zip_code: a.zip_code || '', state: a.state || '',
        city: a.city || '', neighborhood: a.neighborhood || '',
        street: a.street || '', number: a.number || '',
        complement: a.complement || '', reference: a.reference || '',
        is_primary: !!a.is_primary
      }));

      const { error: e2 } = await window.db.rpc('upsert_customer_full', {
        p_customer_id: partner.id,
        p_organization_id: null,
        p_customer: data.customer || {},
        p_phones:    data.phones    || [],
        p_emails:    data.emails    || [],
        p_addresses: merged,
        p_contacts:  data.contacts  || []
      });
      if (e2) throw e2;

      showToast('Endereço de entrega criado.', 'success');
      await loadPartners();
    } catch (e) {
      console.error('[ctxCopyAddressToDelivery]', e);
      showToast('Não foi possível copiar o endereço.', 'error');
    }
  }

  function ctxBulkSelection() {
    if (!state.perms.edit) { showToast('Sem permissão para alterar parceiros.', 'error'); return; }

    const total = state.filtered.length;
    if (total === 0) { showToast('Nenhum parceiro na grade.', 'error'); return; }

    const choice = window.prompt(
      `Aplicar em TODOS os ${total} parceiros visíveis na grade.\n\n` +
      `Escolha uma opção:\n` +
      `  1 - Marcar como CLIENTE\n` +
      `  2 - Marcar como FORNECEDOR\n` +
      `  3 - Marcar como TRANSPORTADORA\n` +
      `  4 - Desmarcar todos os papéis\n\n` +
      `Digite 1, 2, 3 ou 4:`,
      '1'
    );
    if (!choice) return;

    const patch = {};
    if (choice === '1') { patch.is_customer = true; }
    else if (choice === '2') { patch.is_supplier = true; }
    else if (choice === '3') { patch.is_carrier = true; }
    else if (choice === '4') {
      patch.is_customer = false;
      patch.is_supplier = false;
      patch.is_carrier  = false;
      patch.is_other    = false;
    } else {
      showToast('Opção inválida.', 'error');
      return;
    }

    const ids = state.filtered.map((p) => p.id);
    const label = choice === '1' ? 'Cliente'
                : choice === '2' ? 'Fornecedor'
                : choice === '3' ? 'Transportadora'
                : 'desmarcar papéis';

    if (!window.confirm(`Confirma aplicar "${label}" em ${total} parceiros?`)) return;

    bulkUpdate(ids, patch, label);
  }

  async function bulkUpdate(ids, patch, label) {
    showToast('Aplicando em ' + ids.length + ' parceiros…', 'info');

    const { error } = await window.db
      .from('customers')
      .update(patch)
      .in('id', ids);

    if (error) {
      console.error('[bulkUpdate]', error);
      showToast('Erro ao aplicar em massa. ' + error.message, 'error');
      return;
    }

    showToast(`Aplicado "${label}" em ${ids.length} parceiros.`, 'success');
    await loadPartners();
  }

  async function ctxCopyDoc(partner) {
    const doc = partner.cpf_cnpj || '';
    if (!doc) { showToast('Sem documento para copiar.', 'error'); return; }
    try {
      await navigator.clipboard.writeText(doc);
      showToast('Documento copiado: ' + doc, 'success');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = doc; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Documento copiado.', 'success');
    }
  }

  async function ctxToggleActive(partner) {
    const isActive = String(partner.status || 'active') === 'active';
    const next = isActive ? 'inactive' : 'active';

    if (!window.confirm((isActive ? 'Inativar' : 'Ativar') + ' "' + (partner.name || '') + '"?')) return;

    try {
      const { error } = await window.db
        .from('customers')
        .update({ status: next })
        .eq('id', partner.id);
      if (error) throw error;

      showToast(isActive ? 'Parceiro inativado.' : 'Parceiro ativado.', 'success');
      await loadPartners();
    } catch (e) {
      console.error('[ctxToggleActive]', e);
      showToast('Não foi possível alterar o status.', 'error');
    }
  }

  function ctxPrintLabels(partner) {
    const name = partner.name || partner.company_name || '';
    const doc  = partner.cpf_cnpj || '';
    const addrList = partner.customer_addresses || [];
    const a = addrList.find((x) => x.is_primary) || addrList[0] || {};
    const addr = [a.street, a.number, a.neighborhood, a.city && a.state ? a.city + '/' + a.state : a.city]
      .filter(Boolean).join(', ');

    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) { showToast('Bloqueado pelo navegador. Habilite pop-ups.', 'error'); return; }

    w.document.write(`
      <html><head><title>Etiqueta · ${name}</title>
      <style>
        @page { margin: 8mm; }
        body { font-family: Inter, Arial, sans-serif; padding: 16px; }
        .label {
          border: 2px dashed #333; border-radius: 10px;
          padding: 22px; max-width: 420px; margin: 0 auto;
        }
        .name { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
        .doc  { font-size: 13px; color: #555; margin-bottom: 14px; }
        .addr { font-size: 15px; line-height: 1.4; }
        .foot { margin-top: 18px; font-size: 11px; color: #999; text-align: right; }
      </style></head>
      <body onload="window.print()">
        <div class="label">
          <div class="name">${escapeHtml(name)}</div>
          <div class="doc">${escapeHtml(doc)}</div>
          <div class="addr">${escapeHtml(addr || 'Sem endereço')}</div>
          <div class="foot">DEV HUB · ${new Date().toLocaleDateString('pt-BR')}</div>
        </div>
      </body></html>
    `);
    w.document.close();
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function ctxOpenSefaz(partner) {
    window.open('https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo=7PhJ+gAVw2g=', '_blank');
  }

  function ctxOpenReceitaWS(partner) {
    const cnpj = String(partner.cpf_cnpj || '').replace(/\D/g, '');
    if (!cnpj) { showToast('Sem CNPJ.', 'error'); return; }
    window.open('https://www.receitaws.com.br/v1/cnpj/' + cnpj, '_blank');
  }

  function ctxRiskAnalysis(partner) {
    const cnpj = String(partner.cpf_cnpj || '').replace(/\D/g, '');
    if (!cnpj) { showToast('Sem CNPJ para consultar.', 'error'); return; }
    window.open('https://cnpj.ws/' + cnpj, '_blank');
  }

  function ctxDelete(partner) {
    openConfirmModal(partner);
  }

  /* =========================================================
     EXPORTAÇÃO (PDF · XLS · XLSX · Cubo CSV)
     ========================================================= */
  let exportMenuEl = null;

  function setupExportButton() {
    document.getElementById('tb-export')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openExportMenu(e.currentTarget);
    });

    document.addEventListener('click', (e) => {
      if (!exportMenuEl || exportMenuEl.hidden) return;
      if (exportMenuEl.contains(e.target)) return;
      if (e.target.closest('#tb-export')) return;
      closeExportMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && exportMenuEl && !exportMenuEl.hidden) closeExportMenu();
    });
    window.addEventListener('resize', closeExportMenu);
    window.addEventListener('scroll', closeExportMenu, true);
  }

  function iconPDF() {
    return `
      <svg viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 3h24l12 12v38a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"
              fill="#ffffff" stroke="#e53935" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M30 3v12h12" fill="none" stroke="#e53935" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="4" y="27" width="40" height="18" rx="2.5" fill="#e53935"/>
        <text x="24" y="40.5" text-anchor="middle"
              font-family="Inter, Arial, sans-serif" font-size="11.5"
              font-weight="800" fill="#ffffff" letter-spacing="0.5">PDF</text>
      </svg>`;
  }
  function iconXLS(color) {
    return `
      <svg viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 3h24l12 12v38a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"
              fill="#ffffff" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M30 3v12h12" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="4" y="27" width="40" height="18" rx="2.5" fill="${color}"/>
        <text x="24" y="40.5" text-anchor="middle"
              font-family="Inter, Arial, sans-serif" font-size="11.5"
              font-weight="800" fill="#ffffff" letter-spacing="0.5">XLS</text>
      </svg>`;
  }
  function iconCube() {
    return `
      <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M28 6 48 17v22L28 50 8 39V17z"
              fill="none" stroke="#8b95a3" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M8 17l20 11 20-11" fill="none"
              stroke="#8b95a3" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M28 28v22" fill="none" stroke="#8b95a3" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M28 6v22" fill="none" stroke="#8b95a3" stroke-width="2.2" stroke-linejoin="round"/>
      </svg>`;
  }

  function buildExportMenu() {
    const menu = document.createElement('div');
    menu.className = 'parn-export';
    menu.hidden = true;
    menu.innerHTML = `
      <div class="parn-export__grid">
        <button type="button" class="parn-export__item" data-export="pdf">
          <span class="parn-export__icon">${iconPDF()}</span>
          <span class="parn-export__label">Exportar para PDF</span>
        </button>

        <button type="button" class="parn-export__item" data-export="xls">
          <span class="parn-export__icon">${iconXLS('#43a047')}</span>
          <span class="parn-export__label">Exportar para planilha (xls)</span>
        </button>

        <button type="button" class="parn-export__item" data-export="xlsx">
          <span class="parn-export__icon">${iconXLS('#1f3a5f')}</span>
          <span class="parn-export__label">Exportar para planilha (xlsx)</span>
        </button>

        <button type="button" class="parn-export__item" data-export="cube">
          <span class="parn-export__icon">${iconCube()}</span>
          <span class="parn-export__label">Exportar para cubo</span>
        </button>
      </div>`;

    document.body.appendChild(menu);

    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-export]');
      if (!btn) return;
      e.stopPropagation();
      const kind = btn.dataset.export;
      closeExportMenu();
      runExport(kind);
    });

    return menu;
  }

  function openExportMenu(anchor) {
    if (!exportMenuEl) exportMenuEl = buildExportMenu();
    exportMenuEl.hidden = false;

    const rect = anchor.getBoundingClientRect();
    const mRect = exportMenuEl.getBoundingClientRect();
    const margin = 8;

    let left = rect.left + rect.width / 2 - mRect.width / 2;
    let top = rect.bottom + 6;

    if (left < margin) left = margin;
    if (left + mRect.width > window.innerWidth - margin) {
      left = window.innerWidth - mRect.width - margin;
    }
    if (top + mRect.height > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - mRect.height - 6);
    }

    exportMenuEl.style.left = left + 'px';
    exportMenuEl.style.top = top + 'px';
  }

  function closeExportMenu() {
    if (exportMenuEl) exportMenuEl.hidden = true;
  }

  function getExportRows() {
    return state.filtered.map((p) => {
      const addrList = p.customer_addresses || [];
      const a = addrList.find((x) => x.is_primary) || addrList[0] || {};
      const addr = [a.street, a.number].filter(Boolean).join(', ')
        + (a.city ? (a.street ? ' · ' : '') + a.city + (a.state ? '/' + a.state : '') : '');

      const phoneList = p.customer_phones || [];
      const ph = phoneList.find((x) => x.is_primary) || phoneList[0] || {};
      const emList = p.customer_emails || [];
      const em = emList.find((x) => x.is_primary) || emList[0] || {};

      return {
        'Código': shortCode(p),
        'Nome Parceiro': p.name || '',
        'Nome (Endereço)': addr || '',
        'Razão social': p.company_name || '',
        'Tipo': typeLabel(p.type),
        'CNPJ/CPF': p.cpf_cnpj || '',
        'Insc. Estadual': p.state_registration || '',
        'Ativo': (p.status !== 'inactive' && p.status !== 'blocked') ? 'Sim' : 'Não',
        'Cliente': p.is_customer ? 'Sim' : 'Não',
        'Fornecedor': p.is_supplier ? 'Sim' : 'Não',
        'Transportadora': p.is_carrier ? 'Sim' : 'Não',
        'Simples Nacional': String(p.tax_regime || '').toLowerCase().includes('simples') ? 'Sim' : 'Não',
        'Telefone': (ph && ph.phone) || p.phone || '',
        'E-mail': (em && em.email) || p.email || '',
        'Cidade': a.city || '',
        'UF': a.state || '',
      };
    });
  }

  function getExportFileName(ext) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `parceiros_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`;
  }

  async function runExport(kind) {
    if (state.filtered.length === 0) {
      showToast('Nada para exportar. Ajuste os filtros.', 'error');
      return;
    }

    try {
      switch (kind) {
        case 'pdf':  return exportPDF();
        case 'xls':  return exportXLS('xls');
        case 'xlsx': return exportXLS('xlsx');
        case 'cube': return exportCubeCSV();
      }
    } catch (e) {
      console.error('[parceiros] export erro:', e);
      showToast('Falha na exportação: ' + (e.message || 'erro desconhecido'), 'error');
    }
  }

  function exportPDF() {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { showToast('Biblioteca de PDF não carregada.', 'error'); return; }

    const rows = getExportRows();
    const headers = Object.keys(rows[0] || {});

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Parceiros — DEV HUB', 40, 40);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(
      `Gerado em ${new Date().toLocaleString('pt-BR')}  ·  ${rows.length} registro(s)`,
      40, 56
    );
    doc.setTextColor(0);

    doc.autoTable({
      head: [headers],
      body: rows.map((r) => headers.map((h) => r[h])),
      startY: 72,
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 4,
        overflow: 'linebreak',
        textColor: [30, 30, 30],
        lineColor: [220, 220, 220],
        lineWidth: 0.4,
      },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left',
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 30, right: 30 },
      didDrawPage: () => {
        const total = doc.internal.getNumberOfPages();
        const page = doc.internal.getCurrentPageInfo().pageNumber;
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Página ${page} de ${total}`,
          doc.internal.pageSize.getWidth() - 60,
          doc.internal.pageSize.getHeight() - 20
        );
      },
    });

    doc.save(getExportFileName('pdf'));
    showToast(`Exportado: ${rows.length} parceiros em PDF.`, 'success');
  }

  function exportXLS(bookType) {
    if (!window.XLSX || !window.XLSX.utils) {
      showToast('Biblioteca de planilha não carregada.', 'error');
      return;
    }

    const rows = getExportRows();
    const ws = window.XLSX.utils.json_to_sheet(rows);

    const headers = Object.keys(rows[0] || {});
    ws['!cols'] = headers.map((h) => {
      const max = rows.reduce(
        (m, r) => Math.max(m, String(r[h] || '').length),
        h.length
      );
      return { wch: Math.min(Math.max(10, max + 2), 42) };
    });
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Parceiros');

    window.XLSX.writeFile(wb, getExportFileName(bookType), {
      bookType: bookType,
      compression: true,
    });

    showToast(`Exportado: ${rows.length} parceiros em ${bookType.toUpperCase()}.`, 'success');
  }

  function exportCubeCSV() {
    const rows = getExportRows();
    if (rows.length === 0) { showToast('Nada para exportar.', 'error'); return; }

    const headers = Object.keys(rows[0]);
    const esc = (v) => {
      const s = String(v == null ? '' : v);
      return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    const lines = [headers.map(esc).join(';')];
    rows.forEach((r) => lines.push(headers.map((h) => esc(r[h])).join(';')));

    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExportFileName('csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Cubo exportado: ${rows.length} linhas em CSV.`, 'success');
  }

  /* =========================================================
     ERROS
     ========================================================= */
  function mapDbError(error) {
    if (!error) return 'Não foi possível concluir. Tente novamente.';
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('network')) return 'Não foi possível conectar ao servidor.';
    if (msg.includes('row-level security') || msg.includes('permission denied')) return 'Sem permissão para esta ação.';
    if (msg.includes('duplicate') || msg.includes('unique')) return 'Já existe um parceiro com esse documento.';
    if (msg.includes('function') && msg.includes('does not exist')) return 'Recurso indisponível. Verifique se o SQL foi aplicado.';
    if (msg.includes('violates not-null')) return 'Preencha os campos obrigatórios.';
    return 'Não foi possível concluir. Tente novamente.';
  }

  /* =========================================================
     TOASTS
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
    close.addEventListener('click', () => dismissToast(toast));

    toast.appendChild(icon); toast.appendChild(text); toast.appendChild(close);
    region.appendChild(toast);
    const t = setTimeout(() => dismissToast(toast), 4200);
    toast.addEventListener('mouseenter', () => clearTimeout(t));
  }

  function dismissToast(t) {
    if (!t || t.classList.contains('is-leaving')) return;
    t.classList.add('is-leaving');
    t.addEventListener('animationend', () => {
      if (t.parentNode) t.parentNode.removeChild(t);
    });
  }
})();