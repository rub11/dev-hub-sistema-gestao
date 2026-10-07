/* =========================================================
   DEV HUB · Vendas · customer-modal.js
   Cadastro rápido de parceiro/cliente dentro da tela de venda/orçamento.
   Mapeia corretamente para o schema de `customers`.
   ========================================================= */
(function () {
  'use strict';
  const DH = window.DH = window.DH || {};
  const els = {};
  let busy = false;
  let ready = false;

  /* =========================================================
     SETUP
     ========================================================= */
  function setup() {
    if (ready) return;

    els.modal    = document.getElementById('customer-modal');
    els.form     = document.getElementById('customer-form');
    els.name     = document.getElementById('customer-name');
    els.type     = document.getElementById('customer-type');
    els.document = document.getElementById('customer-document');
    els.phone    = document.getElementById('customer-phone');
    els.email    = document.getElementById('customer-email');
    els.address  = document.getElementById('customer-address');
    els.notes    = document.getElementById('customer-notes');
    els.feedback = document.getElementById('customer-feedback');
    els.saveBtn  = document.getElementById('customer-save-btn');
    els.openBtn  = document.getElementById('new-customer-btn');

    if (!els.modal || !els.form) return;

    if (els.openBtn && !els.openBtn.__bound) {
      els.openBtn.addEventListener('click', open);
      els.openBtn.__bound = true;
    }

    els.modal.querySelectorAll('[data-close-customer]').forEach(el => {
      if (el.__bound) return;
      el.addEventListener('click', close);
      el.__bound = true;
    });
    if (!document.__customerModalEsc) {
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && els.modal && !els.modal.hidden) close();
      });
      document.__customerModalEsc = true;
    }

    if (!els.form.__bound) {
      els.form.addEventListener('submit', onSubmit);
      els.form.__bound = true;
    }

    /* Máscara de CPF/CNPJ */
    if (els.document && !els.document.__bound) {
      els.document.addEventListener('input', () => {
        els.document.value = formatDoc(els.document.value, els.type ? els.type.value : 'PF');
      });
      els.document.__bound = true;
    }

    /* Máscara de telefone */
    if (els.phone && !els.phone.__bound) {
      els.phone.addEventListener('input', () => {
        const d = els.phone.value.replace(/\D/g, '').slice(0, 11);
        let out = d;
        if (d.length > 6)      out = `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
        else if (d.length > 2) out = `(${d.slice(0,2)}) ${d.slice(2)}`;
        else if (d.length > 0) out = `(${d}`;
        els.phone.value = out;
      });
      els.phone.__bound = true;
    }

    /* Troca de tipo reformata o documento */
    if (els.type && !els.type.__bound) {
      els.type.addEventListener('change', () => {
        if (els.document && els.document.value) {
          els.document.value = formatDoc(els.document.value, els.type.value);
        }
      });
      els.type.__bound = true;
    }

    ready = true;
    console.log('[DEV HUB] customer-modal: setup ok');
  }

  /* ---------- Máscara CPF/CNPJ ---------- */
  function formatDoc(v, type) {
    const digits = String(v || '').replace(/\D+/g, '');
    if (type === 'PJ' || digits.length > 11) {
      return digits.slice(0, 14)
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return digits.slice(0, 11)
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }

  /* =========================================================
     OPEN / CLOSE
     ========================================================= */
  function open() {
    setup();
    if (!els.modal || !els.form) {
      if (DH.toast) DH.toast('Não foi possível abrir o cadastro.', 'error');
      return;
    }
    if (busy) return;

    els.form.reset();
    clearFeedback();
    setBusy(false);
    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => els.name && els.name.focus(), 40);
  }

  function close() {
    if (!els.modal) return;
    els.modal.hidden = true;
    document.body.style.overflow = '';
  }

  /* =========================================================
     SUBMIT
     ========================================================= */
  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;

    const name = (els.name.value || '').trim();
    if (!name) {
      showFeedback('Informe o nome do parceiro.');
      els.name.focus();
      return;
    }

    const email = (els.email.value || '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFeedback('E-mail inválido.');
      els.email.focus();
      return;
    }

    clearFeedback();
    setBusy(true);

    /* Payload — só colunas que existem na tabela */
    const payload = {
      name,
      is_customer: true
    };

    const type     = els.type     ? els.type.value          : 'PF';
    const cpfCnpj  = els.document ? els.document.value.trim() : '';
    const phone    = els.phone    ? els.phone.value.trim()    : '';
    const address  = els.address  ? els.address.value.trim()  : '';
    const notes    = els.notes    ? els.notes.value.trim()    : '';

    if (type)     payload.type     = type;
    if (cpfCnpj)  payload.cpf_cnpj = cpfCnpj;
    if (phone)    payload.phone    = phone;
    if (email)    payload.email    = email;
    if (address)  payload.address  = address;
    if (notes)    payload.notes    = notes;

    try {
      const { data, error } = await window.db
        .from('customers')
        .insert(payload)
        .select('id, name, phone, email, cpf_cnpj, type')
        .single();

      if (error) throw error;

      /* Adiciona em state.customers */
      const state = DH.state || {};
      if (Array.isArray(state.customers)) {
        state.customers.push(data);
        state.customers.sort((a, b) =>
          (a.name || '').localeCompare((b.name || ''), 'pt-BR')
        );
      } else {
        state.customers = [data];
      }

      if (DH.form && typeof DH.form.addCustomerToSelect === 'function') {
        DH.form.addCustomerToSelect(data);
      }
      if (DH.form && typeof DH.form.populateCustomerSelect === 'function') {
        DH.form.populateCustomerSelect();
      }

      const select = document.getElementById('sale-customer');
      if (select) {
        select.value = data.id;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (DH.draft && DH.draft.saveDebounced) DH.draft.saveDebounced();

      close();
      if (DH.toast) DH.toast('Parceiro cadastrado e selecionado.', 'success');
    } catch (err) {
      console.error('[DEV HUB] customer-modal:', err);
      const msg = String(err && err.message || '').toLowerCase();
      let friendly = err && err.message || 'Erro ao cadastrar.';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        friendly = 'Já existe um parceiro com esse CPF/CNPJ.';
      } else if (msg.includes('row-level security') || msg.includes('permission denied')) {
        friendly = 'Você não tem permissão para cadastrar parceiros.';
      } else if (msg.includes('violates not-null')) {
        friendly = 'Algum campo obrigatório não foi preenchido.';
      }
      showFeedback(friendly);
    } finally {
      setBusy(false);
    }
  }

  /* =========================================================
     HELPERS
     ========================================================= */
  function setBusy(b) {
    busy = b;
    if (els.saveBtn) {
      els.saveBtn.disabled = b;
      els.saveBtn.classList.toggle('is-loading', b);
      const label = els.saveBtn.querySelector('.btn__label');
      if (label) label.textContent = b ? 'Salvando...' : 'Cadastrar parceiro';
    }
  }

  function showFeedback(msg) {
    if (!els.feedback) return;
    els.feedback.textContent = msg;
    els.feedback.hidden = false;
  }
  function clearFeedback() {
    if (!els.feedback) return;
    els.feedback.textContent = '';
    els.feedback.hidden = true;
  }

  /* =========================================================
     AUTO-INIT
     ========================================================= */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

  DH.customerModal = { setup, open, close };
})();