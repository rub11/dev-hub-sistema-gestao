/* =========================================================
   DEV HUB · Módulo de Clientes (completo)
   ---------------------------------------------------------
   - Lista com tipo PF/PJ, telefone/e-mail/cidade principais
   - Modal com abas + formulário dinâmico PF/PJ
   - Repetíveis: telefone, e-mail, endereço, contato
   - Persistência atômica via RPC upsert_customer_full
   - Carga completa via RPC get_customer_full
   - Permissões: customers.view / .create / .edit / .delete
   ---------------------------------------------------------
   CORREÇÕES APLICADAS:
   1. `openEditModal` respeita o tipo: PJ preenche
      `#customer-document-pj`; PF preenche `#customer-document`.
      Antes, CNPJ era escrito no campo de CPF.
   2. Race condition em `openEditModal`: token descarta respostas
      obsoletas quando o usuário abre outro cliente antes da
      primeira RPC terminar.
   3. Focus em `els.company` quando é PJ, `els.name` quando é PF.
   4. `numberOrNull` aceita "1.234,56" (BR) e "1234.56" (US).
   5. Guards de null em `els.type`, `els.modal` e pontos críticos.
   6. `setDeleting` seta `aria-busy` (consistente com outros
      módulos).
   ========================================================= */

(function () {
  'use strict';

  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const state = {
    all: [],
    filtered: [],
    search: '',
    editingId: null,
    deletingId: null,
    saving: false,
    deleting: false,
    phones: [],
    emails: [],
    addresses: [],
    contacts: [],
    perms: {
      view:   true,
      create: true,
      edit:   true,
      remove: true
    }
  };

  /* CORREÇÃO #2 (continuação): token de geração para o
     openEditModal descartar respostas obsoletas. */
  let editGeneration = 0;

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
    setupCustomerForm();
    setupConfirmModal();

    const session = await Auth.requireSession();
    if (!session) return;

    // ---------- Permissões ----------
    if (window.Perms && typeof window.Perms.load === 'function') {
      try { await window.Perms.load(); } catch (e) { /* fallback */ }
    }

    const hasPerm = function (cap) {
      if (window.Perms && typeof window.Perms.has === 'function') {
        return window.Perms.has(cap);
      }
      return true; // fallback
    };

    state.perms.view   = hasPerm('customers.view');
    state.perms.create = hasPerm('customers.create');
    state.perms.edit   = hasPerm('customers.edit');
    state.perms.remove = hasPerm('customers.delete');

    // Guard de página
    if (!state.perms.view) {
      window.location.replace('dashboard.html');
      return;
    }

    applyPermissionsToUI();

    watchAuthChanges();

    const profile = await Auth.getProfile(session.user.id);
    renderUser(session.user, profile);

    await loadCustomers();
  }

  function applyPermissionsToUI() {
    const newBtn = document.getElementById('new-customer-btn');
    if (newBtn && !state.perms.create) newBtn.hidden = true;
  }

  function watchAuthChanges() {
    window.db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT' && !window.Auth.isSigningOut()) {
        window.location.replace('index.html?expired=1');
      }
    });
  }

  /* =========================================================
     Topbar / sidebar / logout
     ========================================================= */
  function renderUser(user, profile) {
    const meta = user.user_metadata || {};
    const fullName = (profile && profile.name) || meta.name || meta.full_name ||
      (user.email ? user.email.split('@')[0] : '') || 'Usuário';
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

    trigger.addEventListener('click', function (e) {
      e.stopPropagation(); panel.hidden ? open() : close();
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
    document.querySelectorAll('[data-action="logout"]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (b.disabled) return;
        b.disabled = true;
        b.setAttribute('aria-busy', 'true');
        await window.Auth.signOut();
      });
    });
  }

  /* =========================================================
     Toolbar / busca
     ========================================================= */
  function setupToolbar() {
    const newBtn = document.getElementById('new-customer-btn');
    const emptyNewBtn = document.getElementById('empty-new-btn');

    if (newBtn && state.perms.create) {
      newBtn.addEventListener('click', openCreateModal);
    }
    if (emptyNewBtn && state.perms.create) {
      emptyNewBtn.addEventListener('click', openCreateModal);
    }
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
      state.filtered = state.all.slice();
    } else {
      const t = state.search;
      state.filtered = state.all.filter(function (c) {
        return matches(c.name, t) ||
               matches(c.company_name, t) ||
               matches(c.trade_name, t) ||
               matches(c.cpf_cnpj, t) ||
               matches(c.phone, t) ||
               matches(c.email, t);
      });
    }
    renderCustomers();
  }

  function matches(v, t) { return v && String(v).toLowerCase().includes(t); }

  /* =========================================================
     Carregar clientes
     ========================================================= */
  async function loadCustomers() {
    showLoading(true);

    const { data, error } = await window.db
      .from('customers')
      .select(`
        id, organization_id, type, name, company_name, trade_name, cpf_cnpj,
        phone, email, address, status, category, segment, created_at,
        customer_phones(phone, is_primary),
        customer_emails(email, is_primary),
        customer_addresses(city, state, is_primary)
      `)
      .order('created_at', { ascending: false });

    showLoading(false);

    if (error) {
      console.error('[DEV HUB] Falha ao carregar clientes:', error);
      state.all = [];
      state.filtered = [];
      showEmptyState('Não foi possível carregar os clientes.',
                     'Tente novamente em alguns instantes.', false);
      updateCountLabel();
      showToast('Não foi possível carregar os clientes.', 'error');
      return;
    }

    state.all = data || [];
    applyFilter();
    updateCountLabel();
  }

  function updateCountLabel() {
    const total = state.all.length;
    const label = document.getElementById('customers-count');
    if (!label) return;
    label.textContent = total === 0
      ? 'Nenhum cliente cadastrado'
      : (total === 1 ? '1 cliente cadastrado' : total + ' clientes cadastrados');
  }

  /* =========================================================
     Render da lista
     ========================================================= */
  function renderCustomers() {
    const tbody = document.getElementById('customers-body');
    const tableWrap = document.getElementById('customers-table-wrap');
    if (!tbody || !tableWrap) return;

    if (state.all.length === 0) {
      tableWrap.hidden = true;
      showEmptyState('Nenhum cliente cadastrado ainda.',
                     'Comece adicionando o primeiro cliente ao sistema.', true);
      return;
    }
    if (state.filtered.length === 0) {
      tableWrap.hidden = true;
      showEmptyState('Nenhum cliente encontrado.',
                     'Ajuste a busca para encontrar o cliente desejado.', false);
      return;
    }

    hideEmptyState();
    tableWrap.hidden = false;
    tbody.innerHTML = '';

    const frag = document.createDocumentFragment();
    state.filtered.forEach(function (c) { frag.appendChild(buildRow(c)); });
    tbody.appendChild(frag);
  }

  function buildRow(c) {
    const row = document.createElement('tr');
    row.dataset.id = c.id;

    const nameCell = document.createElement('td');
    nameCell.className = 'cell-customer';
    const name = document.createElement('span');
    name.className = 'cell-customer__name';
    name.textContent = c.name || c.company_name || '—';
    nameCell.appendChild(name);
    const sub = c.type === 'PJ'
      ? (c.trade_name || c.company_name || '')
      : '';
    if (sub && sub !== name.textContent) {
      const meta = document.createElement('span');
      meta.className = 'cell-customer__meta';
      meta.textContent = sub;
      nameCell.appendChild(meta);
    }
    row.appendChild(nameCell);

    row.appendChild(createCell(c.cpf_cnpj || '—', 'cell--muted'));

    const typeCell = document.createElement('td');
    const tag = document.createElement('span');
    tag.className = c.type === 'PJ' ? 'tag-pj' : 'tag-pf';
    tag.textContent = c.type || 'PF';
    typeCell.appendChild(tag);
    row.appendChild(typeCell);

    row.appendChild(createCell(primaryPhone(c), 'cell--muted'));
    row.appendChild(createCell(primaryEmail(c), 'cell--muted'));
    row.appendChild(createCell(primaryCity(c), 'cell--muted'));

    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    const st = String(c.status || 'active').toLowerCase();
    badge.className = 'badge ' + (st === 'active' ? 'badge--success' : 'badge--danger');
    badge.textContent = st === 'active' ? 'Ativo' : (st === 'blocked' ? 'Bloqueado' : 'Inativo');
    statusCell.appendChild(badge);
    row.appendChild(statusCell);

    row.appendChild(buildActionsCell(c));

    return row;
  }

  function buildActionsCell(c) {
    const actionsCell = document.createElement('td');
    actionsCell.className = 'cell--num';
    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    if (state.perms.edit) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'row-action';
      editBtn.setAttribute('aria-label', 'Editar cliente ' + (c.name || ''));
      editBtn.title = 'Editar';
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
      editBtn.addEventListener('click', function () { openEditModal(c); });
      wrap.appendChild(editBtn);
    }

    if (state.perms.remove) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'row-action row-action--danger';
      delBtn.setAttribute('aria-label', 'Excluir cliente ' + (c.name || ''));
      delBtn.title = 'Excluir';
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>';
      delBtn.addEventListener('click', function () { openConfirmModal(c); });
      wrap.appendChild(delBtn);
    }

    if (wrap.childNodes.length === 0) {
      const dash = document.createElement('span');
      dash.className = 'cell--muted';
      dash.textContent = '—';
      wrap.appendChild(dash);
    }

    actionsCell.appendChild(wrap);
    return actionsCell;
  }

  function createCell(text, className) {
    const c = document.createElement('td');
    c.textContent = text;
    if (className) c.className = className;
    return c;
  }

  function primaryPhone(c) {
    const list = c.customer_phones || [];
    const p = list.find(function (x) { return x.is_primary; }) || list[0];
    if (p && p.phone) return formatPhone(p.phone);
    return c.phone ? formatPhone(c.phone) : '—';
  }
  function primaryEmail(c) {
    const list = c.customer_emails || [];
    const e = list.find(function (x) { return x.is_primary; }) || list[0];
    return (e && e.email) || c.email || '—';
  }
  function primaryCity(c) {
    const list = c.customer_addresses || [];
    const a = list.find(function (x) { return x.is_primary; }) || list[0];
    if (!a || !a.city) return '—';
    return a.city + (a.state ? ' - ' + a.state : '');
  }

  /* =========================================================
     Estados visuais
     ========================================================= */
  function showLoading(isLoading) {
    const l = document.getElementById('customers-loading');
    const w = document.getElementById('customers-table-wrap');
    const e = document.getElementById('customers-empty');
    if (!l) return;
    if (isLoading) { l.hidden = false; if (w) w.hidden = true; if (e) e.hidden = true; }
    else { l.hidden = true; }
  }

  function showEmptyState(title, text, showCta) {
    const empty = document.getElementById('customers-empty');
    const t = document.getElementById('customers-empty-title');
    const x = document.getElementById('customers-empty-text');
    const cta = document.getElementById('empty-new-btn');
    if (!empty) return;
    if (t) t.textContent = title;
    if (x) x.textContent = text;
    if (cta) cta.hidden = !showCta || !state.perms.create;
    empty.hidden = false;
  }
  function hideEmptyState() {
    const e = document.getElementById('customers-empty');
    if (e) e.hidden = true;
  }

  function showGlobalAlert(message, type) {
    const el = document.getElementById('global-alert');
    if (!el) return;
    el.textContent = message;
    el.className = 'alert alert--' + (type || 'error');
    el.hidden = false;
  }

  /* =========================================================
     Modal: cliente (novo / editar)
     ========================================================= */
  const els = {};

  function setupCustomerForm() {
    els.modal = document.getElementById('customer-modal');
    els.form  = document.getElementById('customer-form');
    els.id    = document.getElementById('customer-id');
    els.title = document.getElementById('customer-modal-title');

    els.type   = document.getElementById('customer-type');
    els.status = document.getElementById('customer-status');

    els.name         = document.getElementById('customer-name');
    els.document     = document.getElementById('customer-document');
    els.rg           = document.getElementById('customer-rg');
    els.birth        = document.getElementById('customer-birth');
    els.profession   = document.getElementById('customer-profession');

    els.company      = document.getElementById('customer-company');
    els.trade        = document.getElementById('customer-trade');
    els.documentPJ   = document.getElementById('customer-document-pj');
    els.ie           = document.getElementById('customer-ie');
    els.im           = document.getElementById('customer-im');
    els.cnae         = document.getElementById('customer-cnae');
    els.taxRegime    = document.getElementById('customer-tax-regime');

    els.category     = document.getElementById('customer-category');
    els.segment      = document.getElementById('customer-segment');
    els.origin       = document.getElementById('customer-origin');
    els.priceTable   = document.getElementById('customer-price-table');
    els.payCondition = document.getElementById('customer-payment-condition');
    els.payPreferred = document.getElementById('customer-preferred-payment');
    els.creditLimit  = document.getElementById('customer-credit-limit');
    els.defaultDisc  = document.getElementById('customer-default-discount');

    els.delContact   = document.getElementById('customer-delivery-contact');
    els.delPhone     = document.getElementById('customer-delivery-phone');
    els.delHours     = document.getElementById('customer-delivery-hours');
    els.delCarrier   = document.getElementById('customer-delivery-carrier');
    els.delReference = document.getElementById('customer-delivery-reference');
    els.delNotes     = document.getElementById('customer-delivery-notes');

    els.commNotes    = document.getElementById('customer-commercial-notes');
    els.notes        = document.getElementById('customer-notes');

    els.feedback = document.getElementById('customer-form-feedback');
    els.saveBtn  = document.getElementById('customer-save-btn');

    if (!els.modal || !els.form) return;

    els.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeCustomerModal);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !els.modal.hidden) closeCustomerModal();
    });

    /* CORREÇÃO #2: guards de null */
    if (els.type) {
      els.type.addEventListener('change', onTypeChange);
    }

    els.modal.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const tab = btn.dataset.tab;
        els.modal.querySelectorAll('.tab-btn').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        els.modal.querySelectorAll('.tab-panel').forEach(function (p) {
          p.classList.toggle('is-active', p.dataset.panel === tab);
        });
      });
    });

    els.modal.querySelectorAll('[data-add-row]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const kind = btn.dataset.addRow;
        addRow(kind, {});
      });
    });

    bindMask(els.document, maskCPF);
    bindMask(els.documentPJ, maskCNPJ);
    bindMask(els.delPhone, maskPhone);

    els.form.addEventListener('submit', onSubmitCustomer);
  }

  function onTypeChange() {
    if (!els.type) return;
    const isPJ = els.type.value === 'PJ';
    els.modal.classList.toggle('customer-type-PJ', isPJ);

    const contactTab = els.modal.querySelector('.tab-btn[data-tab="contacts"]');
    if (contactTab) contactTab.hidden = !isPJ;

    if (els.name) els.name.required = !isPJ;
    if (els.company) els.company.required = isPJ;
  }

  /* =========================================================
     Linhas repetíveis
     ========================================================= */
  const FIELDS = {
    phones: {
      container: 'phones-rows',
      state: 'phones',
      template: function (d) {
        return { type: d.type || 'Celular', phone: d.phone || '', is_primary: d.is_primary === true };
      },
      render: renderPhoneRow
    },
    emails: {
      container: 'emails-rows',
      state: 'emails',
      template: function (d) {
        return { type: d.type || 'Principal', email: d.email || '', is_primary: d.is_primary === true };
      },
      render: renderEmailRow
    },
    addresses: {
      container: 'addresses-rows',
      state: 'addresses',
      template: function (d) {
        return {
          type: d.type || 'Residencial',
          zip_code: d.zip_code || '',
          state: d.state || '',
          city: d.city || '',
          neighborhood: d.neighborhood || '',
          street: d.street || '',
          number: d.number || '',
          complement: d.complement || '',
          reference: d.reference || '',
          is_primary: d.is_primary === true
        };
      },
      render: renderAddressRow
    },
    contacts: {
      container: 'contacts-rows',
      state: 'contacts',
      template: function (d) {
        return {
          name: d.name || '',
          department: d.department || '',
          position: d.position || '',
          phone: d.phone || '',
          email: d.email || '',
          is_primary: d.is_primary === true,
          notes: d.notes || ''
        };
      },
      render: renderContactRow
    }
  };

  function addRow(kind, data) {
    const cfg = FIELDS[kind];
    if (!cfg) return;
    const normalized = cfg.template(data);
    state[cfg.state].push(normalized);
    renderRows(kind);
  }

  function renderRows(kind) {
    const cfg = FIELDS[kind];
    const wrap = document.getElementById(cfg.container);
    if (!wrap) return;
    wrap.innerHTML = '';
    state[cfg.state].forEach(function (item, idx) {
      wrap.appendChild(cfg.render(item, idx, kind));
    });
    const block = wrap.closest('.repeatable');
    if (block) block.classList.toggle('repeatable--empty', state[cfg.state].length === 0);
  }

  function removeRow(kind, idx) {
    const cfg = FIELDS[kind];
    state[cfg.state].splice(idx, 1);
    renderRows(kind);
  }

  function updateRow(kind, idx, field, value) {
    const cfg = FIELDS[kind];
    state[cfg.state][idx][field] = value;
  }

  function renderPhoneRow(item, idx) {
    const row = document.createElement('div');
    row.className = 'repeatable-row repeatable-row--phone';
    row.appendChild(selectField(
      ['Celular','WhatsApp','Comercial','Residencial','Recado','Outro'],
      item.type, function (v) { updateRow('phones', idx, 'type', v); }
    ));
    row.appendChild(inputField('tel', item.phone, '(00) 00000-0000', function (v) {
      updateRow('phones', idx, 'phone', v);
    }, maskPhone));
    row.appendChild(primaryToggle(item.is_primary, function (v) {
      updateRow('phones', idx, 'is_primary', v);
    }));
    row.appendChild(removeBtn(function () { removeRow('phones', idx); }));
    return row;
  }

  function renderEmailRow(item, idx) {
    const row = document.createElement('div');
    row.className = 'repeatable-row repeatable-row--email';
    row.appendChild(selectField(
      ['Principal','Comercial','Financeiro','Pessoal','Outro'],
      item.type, function (v) { updateRow('emails', idx, 'type', v); }
    ));
    row.appendChild(inputField('email', item.email, 'cliente@empresa.com', function (v) {
      updateRow('emails', idx, 'email', v);
    }));
    row.appendChild(primaryToggle(item.is_primary, function (v) {
      updateRow('emails', idx, 'is_primary', v);
    }));
    row.appendChild(removeBtn(function () { removeRow('emails', idx); }));
    return row;
  }

  function renderAddressRow(item, idx) {
    const row = document.createElement('div');
    row.className = 'repeatable-row repeatable-row--address';
    row.appendChild(selectField(
      ['Residencial','Comercial','Entrega','Cobrança','Outro'],
      item.type, function (v) { updateRow('addresses', idx, 'type', v); }
    ));
    row.appendChild(inputField('text', item.zip_code, 'CEP', function (v) {
      updateRow('addresses', idx, 'zip_code', v);
    }, maskCEP));
    row.appendChild(inputField('text', item.city, 'Cidade', function (v) {
      updateRow('addresses', idx, 'city', v);
    }));
    row.appendChild(inputField('text', item.state, 'UF', function (v) {
      updateRow('addresses', idx, 'state', v.toUpperCase().slice(0,2));
    }));
    row.appendChild(removeBtn(function () { removeRow('addresses', idx); }));

    const line2 = document.createElement('div');
    line2.className = 'repeatable-row__line2';
    line2.appendChild(inputField('text', item.street, 'Rua', function (v) {
      updateRow('addresses', idx, 'street', v);
    }));
    line2.appendChild(inputField('text', item.number, 'Nº', function (v) {
      updateRow('addresses', idx, 'number', v);
    }));
    line2.appendChild(inputField('text', item.complement, 'Complemento', function (v) {
      updateRow('addresses', idx, 'complement', v);
    }));
    line2.appendChild(inputField('text', item.neighborhood, 'Bairro', function (v) {
      updateRow('addresses', idx, 'neighborhood', v);
    }));
    line2.appendChild(primaryToggle(item.is_primary, function (v) {
      updateRow('addresses', idx, 'is_primary', v);
    }));

    row.appendChild(line2);
    return row;
  }

  function renderContactRow(item, idx) {
    const row = document.createElement('div');
    row.className = 'repeatable-row repeatable-row--contact';
    row.appendChild(inputField('text', item.name, 'Nome *', function (v) {
      updateRow('contacts', idx, 'name', v);
    }));
    row.appendChild(inputField('text', item.department, 'Setor', function (v) {
      updateRow('contacts', idx, 'department', v);
    }));
    row.appendChild(inputField('text', item.position, 'Cargo', function (v) {
      updateRow('contacts', idx, 'position', v);
    }));
    row.appendChild(inputField('tel', item.phone, 'Telefone', function (v) {
      updateRow('contacts', idx, 'phone', v);
    }, maskPhone));
    row.appendChild(inputField('email', item.email, 'E-mail', function (v) {
      updateRow('contacts', idx, 'email', v);
    }));
    row.appendChild(primaryToggle(item.is_primary, function (v) {
      updateRow('contacts', idx, 'is_primary', v);
    }));
    row.appendChild(removeBtn(function () { removeRow('contacts', idx); }));
    return row;
  }

  /* ---------- Helpers de linha ---------- */
  function inputField(type, value, placeholder, onChange, mask) {
    const input = document.createElement('input');
    input.type = type;
    input.value = value || '';
    if (placeholder) input.placeholder = placeholder;
    if (mask) bindMask(input, mask);
    input.addEventListener('input', function () { onChange(input.value); });
    return input;
  }

  function selectField(options, value, onChange) {
    const select = document.createElement('select');
    options.forEach(function (opt) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    });
    select.value = value || options[0];
    select.addEventListener('change', function () { onChange(select.value); });
    return select;
  }

  function primaryToggle(checked, onChange) {
    const wrap = document.createElement('label');
    wrap.className = 'repeatable-row__primary';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!checked;
    cb.addEventListener('change', function () { onChange(cb.checked); });
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

  /* =========================================================
     Máscaras
     ========================================================= */
  function bindMask(input, maskFn) {
    if (!input) return;
    input.addEventListener('input', function () {
      input.value = maskFn(input.value);
    });
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

  function formatPhone(v) { return maskPhone(v); }

  /* =========================================================
     Abrir/fechar modal
     ========================================================= */
  function resetModal() {
    els.form.reset();
    if (els.id) els.id.value = '';
    if (els.type) els.type.value = 'PF';
    if (els.status) els.status.value = 'active';

    state.phones = [];
    state.emails = [];
    state.addresses = [];
    state.contacts = [];

    renderRows('phones');
    renderRows('emails');
    renderRows('addresses');
    renderRows('contacts');

    els.modal.querySelectorAll('.tab-btn').forEach(function (b, i) {
      b.classList.toggle('is-active', i === 0);
    });
    els.modal.querySelectorAll('.tab-panel').forEach(function (p, i) {
      p.classList.toggle('is-active', i === 0);
    });
    clearFeedback();
    onTypeChange();
  }

  function openCreateModal() {
    if (!state.perms.create) {
      showToast('Você não tem permissão para criar clientes.', 'error');
      return;
    }
    /* Invalida qualquer fetch em curso */
    editGeneration += 1;

    state.editingId = null;
    if (els.title) els.title.textContent = 'Novo cliente';
    resetModal();
    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    if (els.name) els.name.focus();
  }

  async function openEditModal(rowSummary) {
    if (!state.perms.edit) {
      showToast('Você não tem permissão para editar clientes.', 'error');
      return;
    }

    /* CORREÇÃO #2: geração + guard de modal */
    editGeneration += 1;
    const myGen = editGeneration;

    state.editingId = rowSummary.id;
    if (els.title) els.title.textContent = 'Editar cliente';

    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    clearFeedback();
    showFeedback('Carregando dados do cliente…', 'info');

    try {
      const { data, error } = await window.db.rpc('get_customer_full', {
        p_customer_id: rowSummary.id
      });
      if (error) throw error;

      /* Descarta se outra chamada começou */
      if (myGen !== editGeneration) return;

      const c = data && data.customer ? data.customer : {};
      const phones    = data && Array.isArray(data.phones)    ? data.phones    : [];
      const emails    = data && Array.isArray(data.emails)    ? data.emails    : [];
      const addresses = data && Array.isArray(data.addresses) ? data.addresses : [];
      const contacts  = data && Array.isArray(data.contacts)  ? data.contacts  : [];

      state.phones    = phones.map(function (p) { return {
        type: p.type, phone: p.phone, is_primary: !!p.is_primary
      }; });
      state.emails    = emails.map(function (e) { return {
        type: e.type, email: e.email, is_primary: !!e.is_primary
      }; });
      state.addresses = addresses.map(function (a) { return {
        type: a.type, zip_code: a.zip_code || '', state: a.state || '',
        city: a.city || '', neighborhood: a.neighborhood || '',
        street: a.street || '', number: a.number || '',
        complement: a.complement || '', reference: a.reference || '',
        is_primary: !!a.is_primary
      }; });
      state.contacts  = contacts.map(function (k) { return {
        name: k.name || '', department: k.department || '',
        position: k.position || '', phone: k.phone || '',
        email: k.email || '', is_primary: !!k.is_primary, notes: k.notes || ''
      }; });

      if (els.id) els.id.value = c.id || '';
      if (els.type) els.type.value = c.type || 'PF';
      if (els.status) els.status.value = c.status || 'active';

      /* CORREÇÃO #1: escreve o documento no campo certo */
      const isPJ = c.type === 'PJ';
      if (isPJ) {
        if (els.documentPJ) els.documentPJ.value = c.cpf_cnpj || '';
        if (els.document)   els.document.value = '';
      } else {
        if (els.document)   els.document.value = c.cpf_cnpj || '';
        if (els.documentPJ) els.documentPJ.value = '';
      }

      if (els.name)       els.name.value = c.name || '';
      if (els.rg)         els.rg.value = c.rg || '';
      if (els.birth)      els.birth.value = c.birth_date ? String(c.birth_date).slice(0,10) : '';
      if (els.profession) els.profession.value = c.profession || '';

      if (els.company)    els.company.value = c.company_name || '';
      if (els.trade)      els.trade.value = c.trade_name || '';
      if (els.ie)         els.ie.value = c.state_registration || '';
      if (els.im)         els.im.value = c.municipal_registration || '';
      if (els.cnae)       els.cnae.value = c.cnae || '';
      if (els.taxRegime)  els.taxRegime.value = c.tax_regime || '';

      if (els.category)     els.category.value = c.category || '';
      if (els.segment)      els.segment.value = c.segment || '';
      if (els.origin)       els.origin.value = c.origin || '';
      if (els.priceTable)   els.priceTable.value = c.price_table || '';
      if (els.payCondition) els.payCondition.value = c.payment_condition || '';
      if (els.payPreferred) els.payPreferred.value = c.preferred_payment_method || '';
      if (els.creditLimit)  els.creditLimit.value = c.credit_limit != null ? c.credit_limit : 0;
      if (els.defaultDisc)  els.defaultDisc.value = c.default_discount != null ? c.default_discount : 0;

      if (els.delContact)   els.delContact.value = c.delivery_contact || '';
      if (els.delPhone)     els.delPhone.value = c.delivery_phone || '';
      if (els.delHours)     els.delHours.value = c.delivery_hours || '';
      if (els.delCarrier)   els.delCarrier.value = c.delivery_carrier || '';
      if (els.delReference) els.delReference.value = c.delivery_reference || '';
      if (els.delNotes)     els.delNotes.value = c.delivery_notes || '';

      if (els.commNotes) els.commNotes.value = c.commercial_notes || '';
      if (els.notes)     els.notes.value = c.notes || '';

      renderRows('phones');
      renderRows('emails');
      renderRows('addresses');
      renderRows('contacts');

      onTypeChange();
      clearFeedback();

      /* CORREÇÃO #3: focus no campo certo */
      if (isPJ && els.company) els.company.focus();
      else if (!isPJ && els.name) els.name.focus();
    } catch (error) {
      if (myGen !== editGeneration) return;
      console.error('[DEV HUB] Falha ao carregar cliente:', error);
      showFeedback(mapDbError(error));
    }
  }

  function closeCustomerModal() {
    if (state.saving) return;
    els.modal.hidden = true;
    document.body.style.overflow = '';
  }

  /* =========================================================
     Submit
     ========================================================= */
  async function onSubmitCustomer(event) {
    event.preventDefault();
    if (state.saving) return;

    if (state.editingId && !state.perms.edit) {
      showFeedback('Você não tem permissão para editar clientes.');
      return;
    }
    if (!state.editingId && !state.perms.create) {
      showFeedback('Você não tem permissão para criar clientes.');
      return;
    }

    clearFeedback();

    const isPJ = els.type && els.type.value === 'PJ';

    const name = isPJ
      ? (els.company.value.trim() || els.name.value.trim())
      : els.name.value.trim();

    if (!name) {
      showFeedback(isPJ ? 'Informe a Razão Social.' : 'Informe o nome do cliente.');
      (isPJ ? els.company : els.name).focus();
      return;
    }

    const documentValue = isPJ ? els.documentPJ.value : els.document.value;
    const documentClean = String(documentValue || '').replace(/\D/g, '');

    if (isPJ && documentClean && documentClean.length !== 14) {
      showFeedback('CNPJ incompleto.'); els.documentPJ.focus(); return;
    }
    if (!isPJ && documentClean && documentClean.length !== 11) {
      showFeedback('CPF incompleto.'); els.document.focus(); return;
    }

    const phones = state.phones.filter(function (p) { return p.phone && p.phone.replace(/\D/g,'') !== ''; });
    const emails = state.emails.filter(function (e) { return e.email && e.email.trim() !== ''; });
    const addresses = state.addresses.filter(function (a) {
      return (a.street && a.street.trim()) || (a.zip_code && a.zip_code.trim()) || (a.city && a.city.trim());
    });
    const contacts = isPJ ? state.contacts.filter(function (k) { return k.name && k.name.trim() !== ''; }) : [];

    for (let i = 0; i < emails.length; i++) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emails[i].email)) {
        showFeedback('E-mail inválido: ' + emails[i].email); return;
      }
    }

    const customer = {
      type: isPJ ? 'PJ' : 'PF',
      name: isPJ ? (els.name.value.trim() || els.company.value.trim()) : name,
      cpf_cnpj: documentValue || null,
      rg: els.rg.value.trim() || null,
      birth_date: els.birth.value || null,
      profession: els.profession.value.trim() || null,
      company_name: isPJ ? (els.company.value.trim() || null) : null,
      trade_name: isPJ ? (els.trade.value.trim() || null) : null,
      state_registration: isPJ ? (els.ie.value.trim() || null) : null,
      municipal_registration: isPJ ? (els.im.value.trim() || null) : null,
      cnae: isPJ ? (els.cnae.value.trim() || null) : null,
      tax_regime: isPJ ? (els.taxRegime.value || null) : null,
      category: els.category.value.trim() || null,
      segment: els.segment.value.trim() || null,
      origin: els.origin.value || null,
      price_table: els.priceTable.value.trim() || null,
      payment_condition: els.payCondition.value.trim() || null,
      preferred_payment_method: els.payPreferred.value || null,
      credit_limit: numberOrNull(els.creditLimit.value),
      default_discount: numberOrNull(els.defaultDisc.value),
      delivery_contact: els.delContact.value.trim() || null,
      delivery_phone: els.delPhone.value.trim() || null,
      delivery_hours: els.delHours.value.trim() || null,
      delivery_carrier: els.delCarrier.value.trim() || null,
      delivery_reference: els.delReference.value.trim() || null,
      delivery_notes: els.delNotes.value.trim() || null,
      commercial_notes: els.commNotes.value.trim() || null,
      notes: els.notes.value.trim() || null,
      status: els.status.value || 'active',
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

      closeCustomerModal();
      showToast(state.editingId ? 'Cliente atualizado com sucesso.' : 'Cliente cadastrado com sucesso.', 'success');
      await loadCustomers();
    } catch (error) {
      console.error('[DEV HUB] Falha ao salvar cliente:', error);
      showFeedback(mapDbError(error));
    } finally {
      setSaving(false);
    }
  }

  /* CORREÇÃO #4: aceita "1.234,56" (BR) e "1234.56" (US) */
  function numberOrNull(v) {
    if (v === '' || v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;

    let str = String(v).trim();
    if (str.indexOf(',') !== -1 && str.indexOf('.') !== -1) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.indexOf(',') !== -1) {
      str = str.replace(',', '.');
    }
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
  }

  function setSaving(isSaving) {
    state.saving = isSaving;
    if (els.saveBtn) {
      els.saveBtn.disabled = isSaving;
      els.saveBtn.classList.toggle('is-loading', isSaving);
      els.saveBtn.setAttribute('aria-busy', String(isSaving));
      const l = els.saveBtn.querySelector('.btn__label');
      if (l) l.textContent = isSaving ? 'Salvando…' : 'Salvar';
    }
  }

  function showFeedback(msg, type) {
    if (!els.feedback) return;
    els.feedback.textContent = msg;
    els.feedback.className = 'feedback feedback--' + (type || 'error');
    els.feedback.hidden = false;
  }
  function clearFeedback() {
    if (!els.feedback) return;
    els.feedback.textContent = '';
    els.feedback.className = 'feedback feedback--error';
    els.feedback.hidden = true;
  }

  /* =========================================================
     Modal: confirmar exclusão
     ========================================================= */
  const confirmEls = {};

  function setupConfirmModal() {
    confirmEls.modal = document.getElementById('confirm-modal');
    confirmEls.text  = document.getElementById('confirm-text');
    confirmEls.btn   = document.getElementById('confirm-delete-btn');
    if (!confirmEls.modal || !confirmEls.btn) return;

    confirmEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeConfirmModal);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !confirmEls.modal.hidden) closeConfirmModal();
    });
    confirmEls.btn.addEventListener('click', onConfirmDelete);
  }

  function openConfirmModal(customer) {
    if (!state.perms.remove) {
      showToast('Você não tem permissão para excluir clientes.', 'error');
      return;
    }
    state.deletingId = customer.id;
    if (confirmEls.text) {
      confirmEls.text.textContent =
        'Excluir "' + (customer.name || customer.company_name || 'este cliente') +
        '"? Os telefones, e-mails, endereços e contatos vinculados também serão removidos. ' +
        'Esta ação não pode ser desfeita.';
    }
    confirmEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    if (confirmEls.btn) confirmEls.btn.focus();
  }

  function closeConfirmModal() {
    if (state.deleting) return;
    if (!confirmEls.modal) return;
    confirmEls.modal.hidden = true;
    document.body.style.overflow = '';
    state.deletingId = null;
  }

  async function onConfirmDelete() {
    if (state.deleting || !state.deletingId) return;
    setDeleting(true);

    try {
      const { error } = await window.db
        .from('customers').delete().eq('id', state.deletingId);
      if (error) throw error;

      closeConfirmModal();
      state.deletingId = null;
      showToast('Cliente excluído com sucesso.', 'success');
      await loadCustomers();
    } catch (error) {
      console.error('[DEV HUB] Falha ao excluir cliente:', error);
      showToast(mapDbError(error), 'error');
    } finally {
      setDeleting(false);
    }
  }

  /* CORREÇÃO #6: aria-busy consistente com outros módulos. */
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
     Erros amigáveis
     ========================================================= */
  function mapDbError(error) {
    if (!error) return 'Não foi possível concluir. Tente novamente.';
    const msg = String(error.message || '').toLowerCase();

    if (msg.includes('failed to fetch') || msg.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    if (msg.includes('row-level security') || msg.includes('permission denied')) {
      return 'Você não tem permissão para executar esta ação.';
    }
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return 'Já existe um cliente com esse documento.';
    }
    if (msg.includes('cliente não pertence')) return 'Cliente não encontrado.';
    if (msg.includes('function') && msg.includes('does not exist')) {
      return 'Recurso indisponível. Verifique se o SQL foi aplicado.';
    }
    if (msg.includes('violates not-null')) return 'Preencha os campos obrigatórios.';
    return 'Não foi possível concluir. Tente novamente.';
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
    close.setAttribute('aria-label', 'Fechar notificação');
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    close.addEventListener('click', function () { dismissToast(toast); });

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(close);
    region.appendChild(toast);

    const t = setTimeout(function () { dismissToast(toast); }, 4200);
    toast.addEventListener('mouseenter', function () { clearTimeout(t); });
  }

  function dismissToast(t) {
    if (!t || t.classList.contains('is-leaving')) return;
    t.classList.add('is-leaving');
    t.addEventListener('animationend', function () {
      if (t.parentNode) t.parentNode.removeChild(t);
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