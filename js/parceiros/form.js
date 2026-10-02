/* =========================================================
   DEV HUB · Parceiros · form
   ---------------------------------------------------------
   Modal de cadastro/edição (abas + repetíveis + submit).
   Só parceiros.
   ========================================================= */

(function () {
  'use strict';

  const {
    numberOrNull,
    bindMask, maskCPF, maskCNPJ, maskCEP, maskPhone,
    showToast,
    state
  } = window.Parn;

  const els = {};

  /* =========================================================
     SETUP
     ========================================================= */
  function setupForm() {
    els.modal    = document.getElementById('partner-modal');
    els.form     = document.getElementById('partner-form');
    els.id       = document.getElementById('partner-id');
    els.title    = document.getElementById('partner-modal-title');
    els.feedback = document.getElementById('partner-form-feedback');
    els.saveBtn  = document.getElementById('partner-save-btn');

    if (!els.modal || !els.form) return;

    /* ---------- Campos ---------- */
    els.type         = document.getElementById('partner-type');
    els.status       = document.getElementById('partner-status');
    els.active       = document.getElementById('partner-active');

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

    els.code         = document.getElementById('partner-modal-code');
    els.footMeta     = document.getElementById('partner-foot-meta');

    /* ---------- Binds ---------- */
    els.modal.querySelectorAll('[data-close-modal]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.modal.hidden) closeModal();
    });

    if (els.type) els.type.addEventListener('change', onTypeChange);
    if (els.active) {
      els.active.addEventListener('change', () => {
        if (els.status) els.status.value = els.active.checked ? 'active' : 'inactive';
      });
    }
    if (els.taxRegime) els.taxRegime.addEventListener('change', updateSimplesPill);

    /* Tabs */
    els.modal.querySelectorAll('.parn-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        els.modal.querySelectorAll('.parn-tab').forEach((b) =>
          b.classList.toggle('is-active', b === btn));
        els.modal.querySelectorAll('.parn-panel-tab').forEach((p) =>
          p.classList.toggle('is-active', p.dataset.panel === tab));
      });
    });

    /* Repetíveis */
    els.modal.querySelectorAll('[data-add-row]').forEach((btn) => {
      btn.addEventListener('click', () => addRow(btn.dataset.addRow, {}));
    });

    /* Máscaras */
    bindMask(els.document, maskCPF);
    bindMask(els.documentPJ, maskCNPJ);

    els.form.addEventListener('submit', onSubmitForm);
  }

  /* =========================================================
     TIPO PF / PJ
     ========================================================= */
  function onTypeChange() {
    if (!els.type) return;
    const isPJ = els.type.value === 'PJ';

    els.modal.classList.toggle('is-pj', isPJ);

    if (els.name)    els.name.required    = !isPJ;
    if (els.company) els.company.required = isPJ;
  }

  function updateSimplesPill() {
    if (!els.simplesPill) return;
    const v = String(els.taxRegime?.value || '');
    const isSimples = v.toLowerCase().includes('simples') || v.toLowerCase().includes('mei');
    els.simplesPill.textContent = isSimples ? 'Sim' : 'Não';
    els.simplesPill.classList.toggle('is-on', isSimples);
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

  /* =========================================================
     RESET / ABRIR / FECHAR
     ========================================================= */
  function resetModal() {
    els.form.reset();
    if (els.id) els.id.value = '';
    if (els.type) els.type.value = 'PJ';
    if (els.status) els.status.value = 'active';
    if (els.active) els.active.checked = true;
    if (els.kindCustomer) els.kindCustomer.checked = true;
    if (els.kindSupplier) els.kindSupplier.checked = false;
    if (els.kindCarrier)  els.kindCarrier.checked  = false;
    if (els.kindOther)    els.kindOther.checked    = false;

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

    if (els.code)     els.code.textContent = '—';
    if (els.footMeta) els.footMeta.textContent = '';

    updateSimplesPill();
    clearFeedback();
    onTypeChange();
  }

  function openCreateModal() {
    if (!state.perms.create) { showToast('Você não tem permissão para criar parceiros.', 'error'); return; }
    state.editGeneration += 1;
    state.editingId = null;
    if (els.title) els.title.textContent = 'Novo parceiro';
    resetModal();
    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    if (els.name) els.name.focus();
  }

  async function openEditModal(rowSummary) {
    if (!state.perms.edit) { showToast('Você não tem permissão para editar parceiros.', 'error'); return; }

    state.editGeneration += 1;
    const myGen = state.editGeneration;

    state.editingId = rowSummary.id;
    if (els.title) els.title.textContent = 'Parceiro';
    if (els.code)  els.code.textContent  = 'Cód. ' + rowSummary.id.slice(0, 4);

    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    clearFeedback();
    showFeedback('Carregando dados do parceiro…', 'info');

    try {
      const data = await window.Parn.getPartnerFull(rowSummary.id);
      if (myGen !== state.editGeneration) return;

      const c = data.customer;

      state.phones    = data.phones.map(p    => ({ type: p.type, phone: p.phone, is_primary: !!p.is_primary }));
      state.emails    = data.emails.map(e    => ({ type: e.type, email: e.email, is_primary: !!e.is_primary }));
      state.addresses = data.addresses.map(a => ({
        type: a.type, zip_code: a.zip_code || '', state: a.state || '', city: a.city || '',
        neighborhood: a.neighborhood || '', street: a.street || '', number: a.number || '',
        complement: a.complement || '', reference: a.reference || '', is_primary: !!a.is_primary
      }));
      state.contacts  = data.contacts.map(k  => ({
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

      if (els.name)         els.name.value         = c.name || '';
      if (els.birth)        els.birth.value        = c.birth_date ? String(c.birth_date).slice(0, 10) : '';
      if (els.company)      els.company.value      = c.company_name || '';
      if (els.trade)        els.trade.value        = c.trade_name || '';
      if (els.ie)           els.ie.value           = c.state_registration || '';
      if (els.im)           els.im.value           = c.municipal_registration || '';
      if (els.cnae)         els.cnae.value         = c.cnae || '';
      if (els.taxRegime)    els.taxRegime.value    = c.tax_regime || '';
      if (els.category)     els.category.value     = c.category || '';
      if (els.segment)      els.segment.value      = c.segment || '';
      if (els.origin)       els.origin.value       = c.origin || '';
      if (els.priceTable)   els.priceTable.value   = c.price_table || '';
      if (els.payCondition) els.payCondition.value = c.payment_condition || '';
      if (els.payPreferred) els.payPreferred.value = c.preferred_payment_method || '';
      if (els.creditLimit)  els.creditLimit.value  = c.credit_limit != null ? c.credit_limit : 0;
      if (els.defaultDisc)  els.defaultDisc.value  = c.default_discount != null ? c.default_discount : 0;
      if (els.notes)        els.notes.value        = c.commercial_notes || '';
      if (els.notesInfo)    els.notesInfo.value    = c.notes || '';

      const bankInfo = window.Parn.parseBankFromNotes(c.commercial_notes || '');
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
      if (myGen !== state.editGeneration) return;
      console.error('[parceiros] openEditModal:', error);
      showFeedback(mapDbError(error));
    }
  }

  function closeModal() {
    if (state.saving) return;
    els.modal.hidden = true;
    document.body.style.overflow = '';
  }

  /* =========================================================
     SUBMIT
     ========================================================= */
  async function onSubmitForm(event) {
    event.preventDefault();
    if (state.saving) return;

    if (state.editingId && !state.perms.edit) { showFeedback('Sem permissão para editar.'); return; }
    if (!state.editingId && !state.perms.create) { showFeedback('Sem permissão para criar.'); return; }

    clearFeedback();

    const isPJ = els.type && els.type.value === 'PJ';
    const name = isPJ
      ? ((els.company?.value || '').trim() || (els.name?.value || '').trim())
      : (els.name?.value || '').trim();

    if (!name) {
      showFeedback(isPJ ? 'Informe a Razão Social.' : 'Informe o nome do parceiro.');
      (isPJ ? els.company : els.name)?.focus();
      return;
    }

    /* ---------- Papéis ---------- */
    const isCustomer = els.kindCustomer?.checked || false;
    const isSupplier = els.kindSupplier?.checked || false;
    const isCarrier  = els.kindCarrier?.checked  || false;
    const isOther    = els.kindOther?.checked    || false;

    if (!isCustomer && !isSupplier && !isCarrier && !isOther) {
      showFeedback('Marque pelo menos um papel.');
      return;
    }

    /* ---------- Documento ---------- */
    const documentValue = isPJ ? (els.documentPJ?.value || '') : (els.document?.value || '');
    const documentClean = String(documentValue || '').replace(/\D/g, '');
    if (isPJ && documentClean && documentClean.length !== 14) { showFeedback('CNPJ incompleto.'); els.documentPJ.focus(); return; }
    if (!isPJ && documentClean && documentClean.length !== 11) { showFeedback('CPF incompleto.'); els.document.focus(); return; }

    /* ---------- Repetíveis ---------- */
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

    /* ---------- Notas + banco ---------- */
    const bankLines = [];
    const bankName    = (els.bankName?.value || '').trim();
    const bankAgency  = (els.bankAgency?.value || '').trim();
    const bankAccount = (els.bankAccount?.value || '').trim();
    const pixKey      = (els.pixKey?.value || '').trim();
    if (bankName)    bankLines.push('Banco: ' + bankName);
    if (bankAgency)  bankLines.push('Agência: ' + bankAgency);
    if (bankAccount) bankLines.push('Conta: ' + bankAccount);
    if (pixKey)      bankLines.push('Pix: ' + pixKey);

    const rawNotes = (els.notes?.value || '').trim();
    const keptNotes = rawNotes.split('\n')
      .filter((l) => !/^(Banco|Ag[eê]ncia|Conta|Pix):/i.test(l))
      .join('\n')
      .trim();

    const finalNotes = [keptNotes, bankLines.join('\n')].filter(Boolean).join('\n\n');

    /* ---------- Payload ---------- */
    const customer = {
      type: isPJ ? 'PJ' : 'PF',
      name: isPJ ? ((els.name?.value || '').trim() || (els.company?.value || '').trim()) : name,
      cpf_cnpj: documentValue || null,

      birth_date:   els.birth ? (els.birth.value || null) : null,

      company_name: isPJ ? (els.company?.value.trim() || null) : null,
      trade_name:   isPJ ? (els.trade?.value.trim() || null) : null,
      state_registration: isPJ ? (els.ie?.value.trim() || null) : null,
      municipal_registration: isPJ ? (els.im?.value.trim() || null) : null,
      cnae:         isPJ ? (els.cnae?.value.trim() || null) : null,
      tax_regime:   isPJ ? (els.taxRegime?.value || null) : null,

      category:     els.category ? (els.category.value.trim() || null) : null,
      segment:      els.segment ? (els.segment.value.trim() || null) : null,
      origin:       els.origin ? (els.origin.value || null) : null,
      price_table:  els.priceTable ? (els.priceTable.value.trim() || null) : null,
      payment_condition: els.payCondition ? (els.payCondition.value.trim() || null) : null,
      preferred_payment_method: els.payPreferred ? (els.payPreferred.value || null) : null,
      credit_limit: els.creditLimit ? numberOrNull(els.creditLimit.value) : null,
      default_discount: els.defaultDisc ? numberOrNull(els.defaultDisc.value) : null,

      commercial_notes: finalNotes || null,
      notes: (els.notesInfo?.value || '').trim() || null,

      status: els.status ? (els.status.value || 'active') : 'active',
      is_customer: isCustomer,
      is_supplier: isSupplier,
      is_carrier:  isCarrier,
      is_other:    isOther,

      phone:   phones[0] ? phones[0].phone : null,
      email:   emails[0] ? emails[0].email : null,
      address: addresses[0] ? [addresses[0].street, addresses[0].number].filter(Boolean).join(', ') : null
    };

    setSaving(true);

    try {
      await window.Parn.upsertPartnerFull({
        customerId: state.editingId,
        customer,
        phones,
        emails,
        addresses,
        contacts
      });

      closeModal();
      showToast(state.editingId ? 'Parceiro atualizado.' : 'Parceiro cadastrado.', 'success');
      await window.Parn.reload?.();
    } catch (error) {
      console.error('[parceiros] save:', error);
      showFeedback(mapDbError(error));
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     FEEDBACK / SAVING
     ========================================================= */
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
     CONFIRM (exclusão)
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
      await window.Parn.deletePartner(state.deletingId);
      state.deleting = false;
      closeConfirmModal(true);
      state.deletingId = null;
      showToast('Parceiro excluído.', 'success');
      await window.Parn.reload?.();
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

  Object.assign(window.Parn, {
    setupForm,
    setupConfirmModal,
    openCreateModal,
    openEditModal,
    closeModal,
    openConfirmModal,
    closeConfirmModal
  });

})();