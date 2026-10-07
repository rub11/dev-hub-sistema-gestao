(function () {
  'use strict';
  const DH = window.DH;
  const { state, utils } = DH;

  const formEls = {};

  function els() { return formEls; }

  /* =========================================================
     SETUP
     ========================================================= */
  function setupFormView() {
    const back = document.getElementById('back-to-list');
    const cancel = document.getElementById('cancel-sale');
    if (back) back.addEventListener('click', closeFormView);
    if (cancel) cancel.addEventListener('click', closeFormView);
  }

  function setupSaleForm() {
    formEls.form        = document.getElementById('sale-form');
    formEls.customer    = document.getElementById('sale-customer');
    formEls.cartBody    = document.getElementById('cart-body');
    formEls.cartWrap    = document.getElementById('cart-wrap');
    formEls.cartEmpty   = document.getElementById('cart-empty');
    formEls.discount    = document.getElementById('sale-discount');
    formEls.discountPct = document.getElementById('sale-discount-pct');
    formEls.deposit     = document.getElementById('sale-deposit');
    formEls.totalSub    = document.getElementById('total-subtotal');
    formEls.totalTotal  = document.getElementById('total-total');
    formEls.payment     = document.getElementById('sale-payment');
    formEls.notes       = document.getElementById('sale-notes');
    formEls.noStock     = document.getElementById('sale-no-stock');
    formEls.validUntil  = document.getElementById('sale-valid-until');
    formEls.feedback    = document.getElementById('sale-form-feedback');
    formEls.submitBtn   = document.getElementById('submit-sale-btn');

    if (!formEls.form) return;

    if (formEls.discount) {
      formEls.discount.addEventListener('input', () => {
        state.lastDiscountEdit = 'brl';
        state.appliedMethodDiscount = null;  // desconto manual cancela o do método
        DH.cart.recalc();
      });
    }
    if (formEls.discountPct) {
      formEls.discountPct.addEventListener('input', () => {
        state.lastDiscountEdit = 'pct';
        state.appliedMethodDiscount = null;
        DH.cart.recalc();
      });
    }
    if (formEls.deposit) {
      formEls.deposit.addEventListener('input', () => DH.cart.recalc());
    }
    if (formEls.noStock) {
      formEls.noStock.addEventListener('change', () => {
        state.noStock = formEls.noStock.checked;
        DH.cart.render();
        DH.cart.recalc();
        if (DH.productSearch.onToggleNoStock) DH.productSearch.onToggleNoStock();
        if (DH.draft && DH.draft.saveDebounced) DH.draft.saveDebounced();
      });
    }

    if (formEls.payment) {
      formEls.payment.addEventListener('change', () => {
        applyMethodDiscount();
        refreshSubmitEnabled();
      });
    }

    const newCustomerBtn = document.getElementById('new-customer-btn');
    if (newCustomerBtn) {
      newCustomerBtn.addEventListener('click', () => {
        if (DH.customerModal && typeof DH.customerModal.open === 'function') {
          DH.customerModal.open();
        } else {
          DH.toast('Módulo de cadastro de parceiro não carregado.', 'error');
        }
      });
    }

    if (DH.installments) DH.installments.setup();

    formEls.form.addEventListener('submit', onSubmit);

    refreshSubmitEnabled();
  }

  /* =========================================================
     FORMAS DE PAGAMENTO
     ========================================================= */
  async function loadPaymentMethods() {
    try {
      const { data, error } = await window.db
        .from('payment_methods')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      state.paymentMethods = data || [];
    } catch (e) {
      console.warn('[DEV HUB] loadPaymentMethods:', e);
      state.paymentMethods = [
        { code:'cash', label:'Dinheiro', category:'cash', active:true, discount_type:'none' },
        { code:'pix',  label:'Pix',      category:'pix',  active:true, discount_type:'none' },
        { code:'debit_card', label:'Cartão de Débito',  category:'debit',  active:true, discount_type:'none' },
        { code:'credit_card',label:'Cartão de Crédito', category:'credit', active:true, discount_type:'none' },
        { code:'check',label:'Cheque',   category:'check',active:true, discount_type:'none' },
        { code:'meal_voucher',label:'Vale Alimentação (VA)',category:'voucher',active:true,discount_type:'none' },
        { code:'food_voucher',label:'Vale Refeição (VR)',   category:'voucher',active:true,discount_type:'none' },
        { code:'boleto',label:'Boleto',  category:'other',active:true, discount_type:'none' },
        { code:'transfer',label:'Transferência',category:'transfer',active:true,discount_type:'none' },
        { code:'other',label:'Outro',    category:'other',active:true, discount_type:'none' }
      ];
    }
    populatePaymentSelect();
  }

  function populatePaymentSelect() {
    const select = document.getElementById('sale-payment');
    if (!select) return;
    const cur = select.value;
    const methods = (state.paymentMethods || []).filter(m => m.active);

    select.innerHTML = '<option value="">Selecione…</option>' + methods.map(m =>
      '<option value="' + m.code + '">' + m.label + '</option>'
    ).join('');

    if (cur) select.value = cur;
  }

  function applyMethodDiscount() {
    if (!formEls.payment) return;
    const code = formEls.payment.value;
    const method = (state.paymentMethods || []).find(m => m.code === code);

    if (!method || method.discount_type === 'none' || !method.discount_amount) {
      if (state.appliedMethodDiscount) {
        state.appliedMethodDiscount = null;
      }
      return;
    }

    const subtotal = state.cart.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
    if (subtotal <= 0) return;

    if (method.discount_type === 'percent') {
      const pct = Number(method.discount_amount) || 0;
      if (formEls.discountPct) formEls.discountPct.value = String(pct);
      state.lastDiscountEdit = 'pct';
    } else {
      const val = Number(method.discount_amount) || 0;
      if (formEls.discount) formEls.discount.value = String(val);
      state.lastDiscountEdit = 'brl';
    }

    state.appliedMethodDiscount = {
      type: method.discount_type,
      value: method.discount_amount
    };

    DH.cart.recalc();

    DH.toast(
      'Desconto de ' + (method.discount_type === 'percent'
        ? method.discount_amount + '%'
        : DH.utils.formatMoney(method.discount_amount)) +
      ' aplicado por ' + method.label + '.',
      'info'
    );
  }

  /* =========================================================
     Habilita/desabilita botão Finalizar
     ========================================================= */
  function refreshSubmitEnabled() {
    if (!formEls.submitBtn) return;
    if (state.submitting) return;

    const hasPayment = !!(formEls.payment && formEls.payment.value);
    const hasItems   = Array.isArray(state.cart) && state.cart.length > 0;

    formEls.submitBtn.disabled = !(hasPayment && hasItems);
    formEls.submitBtn.classList.toggle('is-disabled', !(hasPayment && hasItems));
  }

  function showView(name) {
    const list = document.getElementById('view-list');
    const form = document.getElementById('view-form');
    if (!list || !form) return;
    const isForm = name === 'form';
    list.hidden = isForm;
    form.hidden = !isForm;
    if (isForm) window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* =========================================================
     NOVA VENDA
     ========================================================= */
  async function openFormView() {
    if (!state.perms.create) {
      DH.toast('Você não tem permissão para criar vendas.', 'error');
      return;
    }
    state.editingSaleId = null;
    state.editingSale = null;
    state.correctingSaleId = null;
    state.correctingSale = null;
    state.convertingFromQuote = null;
    state.noStock = false;
    state.appliedMethodDiscount = null;

    if (formEls.noStock) formEls.noStock.checked = false;

    setFormMode('create');
    showView('form');

    document.getElementById('quote-valid-field').hidden = true;
    document.getElementById('no-stock-field').hidden = false;

    if (DH.installments) DH.installments.reset();

    if (!state.formDataLoaded) await loadFormData();
    refreshSubmitEnabled();
  }

  /* =========================================================
     EDITAR
     ========================================================= */
  async function openEditSale(sale) {
    if (!state.perms.edit) {
      DH.toast('Você não tem permissão para editar vendas.', 'error');
      return;
    }
    state.editingSaleId = sale.id;
    state.editingSale = sale;
    state.correctingSaleId = null;
    state.correctingSale = null;
    state.convertingFromQuote = null;
    state.noStock = false;
    state.appliedMethodDiscount = null;
    if (formEls.noStock) formEls.noStock.checked = false;

    showView('form');
    document.getElementById('quote-valid-field').hidden = true;
    document.getElementById('no-stock-field').hidden = false;

    if (DH.installments) DH.installments.reset();
    if (!state.formDataLoaded) await loadFormData();

    const items = await fetchSaleItems(sale.id);
    state.cart = items.map(it => ({
      product_id: it.product_id,
      product_name: it.product_name,
      unit_price: utils.toNumber(it.unit_price, 0),
      quantity: utils.toInteger(it.quantity, 0),
      subtotal: utils.toNumber(it.subtotal, 0),
      stock_available: (utils.findProduct(it.product_id) || {}).stock || 0
    }));

    formEls.customer.value = sale.customer_id || '';
    formEls.discount.value = String(utils.toNumber(sale.discount, 0));
    if (formEls.deposit) formEls.deposit.value = String(utils.toNumber(sale.deposit_amount, 0));

    const subSaved = utils.toNumber(sale.subtotal, 0);
    const dscSaved = utils.toNumber(sale.discount, 0);
    if (formEls.discountPct) {
      formEls.discountPct.value = subSaved > 0
        ? String(utils.round2(dscSaved / subSaved * 100)) : '0';
    }
    state.lastDiscountEdit = 'brl';

    formEls.payment.value = sale.payment_method || '';
    formEls.notes.value = sale.notes || '';

    setFormMode('edit', sale);
    DH.cart.render();
    DH.cart.recalc();
    refreshSubmitEnabled();
  }

  /* =========================================================
     CORRIGIR
     ========================================================= */
  async function openCorrectSale(sale) {
    if (!state.perms.correct) {
      DH.toast('Apenas supervisores podem corrigir vendas.', 'error');
      return;
    }
    if (sale.status === 'corrected' || sale.status === 'replaced' || sale.corrected_at) {
      DH.toast('Esta venda já foi corrigida.', 'info');
      return;
    }
    state.correctingSaleId = sale.id;
    state.correctingSale = sale;
    state.editingSaleId = null;
    state.editingSale = null;
    state.convertingFromQuote = null;
    state.noStock = false;
    state.appliedMethodDiscount = null;
    if (formEls.noStock) formEls.noStock.checked = false;

    showView('form');
    document.getElementById('quote-valid-field').hidden = true;
    document.getElementById('no-stock-field').hidden = false;

    if (DH.installments) DH.installments.reset();
    if (!state.formDataLoaded) await loadFormData();

    const items = await fetchSaleItems(sale.id);
    state.cart = items.map(it => ({
      product_id: it.product_id,
      product_name: it.product_name,
      unit_price: utils.toNumber(it.unit_price, 0),
      quantity: utils.toInteger(it.quantity, 0),
      subtotal: utils.toNumber(it.subtotal, 0),
      stock_available: (utils.findProduct(it.product_id) || {}).stock || 0
    }));

    formEls.customer.value = sale.customer_id || '';
    formEls.discount.value = String(utils.toNumber(sale.discount, 0));
    if (formEls.deposit) formEls.deposit.value = String(utils.toNumber(sale.deposit_amount, 0));

    const subSaved = utils.toNumber(sale.subtotal, 0);
    const dscSaved = utils.toNumber(sale.discount, 0);
    if (formEls.discountPct) {
      formEls.discountPct.value = subSaved > 0
        ? String(utils.round2(dscSaved / subSaved * 100)) : '0';
    }
    state.lastDiscountEdit = 'brl';

    formEls.payment.value = sale.payment_method || '';
    formEls.notes.value = sale.notes || '';

    setFormMode('correct', sale);
    DH.cart.render();
    DH.cart.recalc();
    refreshSubmitEnabled();
  }

  /* =========================================================
     MODOS
     ========================================================= */
  function setFormMode(mode, sale) {
    state.formMode = mode;
    const title = document.querySelector('#view-form .page-head__title');
    const sub = document.querySelector('#view-form .page-head__sub');
    const submitLabel = formEls.submitBtn ? formEls.submitBtn.querySelector('.btn__label') : null;

    if (mode === 'edit') {
      if (title) title.textContent = 'Editar venda ' + utils.formatSaleNumber(sale);
      if (sub) sub.textContent = 'Alterações serão registradas no histórico com seu nome e horário.';
      if (submitLabel) submitLabel.textContent = 'Salvar alterações';
      return;
    }
    if (mode === 'correct') {
      if (title) title.textContent = 'Corrigir venda ' + utils.formatSaleNumber(sale);
      if (sub) sub.textContent = 'A venda original ficará marcada como "Corrigida". Uma nova venda será criada.';
      if (submitLabel) submitLabel.textContent = 'Salvar correção';
      return;
    }
    if (mode === 'quote') {
      if (title) title.textContent = 'Novo orçamento';
      if (sub) sub.textContent = 'Orçamentos podem incluir itens sem estoque — a falta será tratada na hora de virar venda.';
      if (submitLabel) submitLabel.textContent = 'Salvar orçamento';
      return;
    }
    if (mode === 'from_quote') {
      if (title) title.textContent = 'Converter orçamento ' + (DH.quotes ? DH.quotes.fmtQuoteNumber(sale) : '');
      if (sub) sub.textContent = 'Confira os itens e finalize a venda. O orçamento será marcado como convertido.';
      if (submitLabel) submitLabel.textContent = 'Finalizar venda';
      return;
    }
    if (title) title.textContent = 'Nova venda';
    if (sub) sub.textContent = 'Selecione o cliente, adicione produtos e finalize.';
    if (submitLabel) submitLabel.textContent = 'Finalizar venda';
  }

  function closeFormView() {
    if (state.submitting) return;
    DH.cart.reset();
    state.editingSaleId = null;
    state.editingSale = null;
    state.correctingSaleId = null;
    state.correctingSale = null;
    state.convertingFromQuote = null;
    state.noStock = false;
    state.formMode = null;
    state.appliedMethodDiscount = null;

    if (DH.installments) DH.installments.reset();

    document.getElementById('quote-valid-field').hidden = true;
    document.getElementById('no-stock-field').hidden = false;

    showView('list');
  }

  /* =========================================================
     CARREGAR DADOS
     ========================================================= */
  async function loadFormData() {
    state.formDataLoaded = false;
    const [customersRes, productsRes] = await Promise.all([
      window.db.from('customers')
        .select('id, name, phone, email, cpf_cnpj')
        .order('name', { ascending: true }),
      window.db.from('products')
        .select('id, name, code, barcode, description, image_url, price, stock, minimum_stock, active')
        .eq('active', true).order('name', { ascending: true })
    ]);

    if (customersRes.error) console.error('[DEV HUB] loadCustomers:', customersRes.error);
    if (productsRes.error) console.error('[DEV HUB] loadProducts:', productsRes.error);

    state.customers = customersRes.data || [];
    state.products = productsRes.data || [];
    populateCustomerSelect();

    /* Carrega métodos de pagamento */
    await loadPaymentMethods();

    state.formDataLoaded = true;
  }

  function populateCustomerSelect() {
    const select = document.getElementById('sale-customer');
    if (!select) return;
    const currentValue = select.value;
    while (select.options.length > 1) select.remove(1);
    (state.customers || []).forEach(c => {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.name || '(sem nome)';
      select.appendChild(option);
    });
    if (currentValue) select.value = currentValue;
  }

  function addCustomerToSelect(customer) {
    if (!customer || !customer.id) return;
    if (!Array.isArray(state.customers)) state.customers = [];
    const idx = state.customers.findIndex(c => c.id === customer.id);
    if (idx >= 0) state.customers[idx] = customer;
    else state.customers.push(customer);
    state.customers.sort((a, b) =>
      (a.name || '').localeCompare((b.name || ''), 'pt-BR')
    );
    populateCustomerSelect();
  }

  /* =========================================================
     SUBMIT
     ========================================================= */
  async function onSubmit(event) {
    event.preventDefault();
    if (state.submitting) return;
    DH.cart.clearFeedback();

    const mode = state.formMode;

    if (!formEls.payment.value) {
      formEls.payment.classList.add('is-invalid');
      const warn = document.getElementById('payment-warn');
      if (warn) warn.hidden = false;
      DH.cart.showFeedback('Selecione a forma de pagamento.');
      formEls.payment.focus();
      return;
    }
    formEls.payment.classList.remove('is-invalid');
    const warnEl = document.getElementById('payment-warn');
    if (warnEl) warnEl.hidden = true;

    if (mode === 'correct') {
      if (!state.perms.correct) { DH.cart.showFeedback('Apenas supervisores podem corrigir vendas.'); return; }
    } else if (mode === 'edit') {
      if (!state.perms.edit) { DH.cart.showFeedback('Você não tem permissão para editar vendas.'); return; }
    } else {
      if (!state.perms.create) { DH.cart.showFeedback('Você não tem permissão para criar.'); return; }
    }

    if (state.cart.length === 0) {
      DH.cart.showFeedback('Adicione pelo menos um produto.');
      return;
    }

    for (let i = 0; i < state.cart.length; i += 1) {
      const item = state.cart[i];
      if (item.quantity <= 0) {
        DH.cart.showFeedback('Quantidade inválida.');
        return;
      }
    }

    const temSemEstoque = state.cart.some(it => it.quantity > it.stock_available);

    if (mode !== 'quote') {
      const allowNoStock = !!state.noStock;
      if (temSemEstoque && !allowNoStock) {
        if (mode === 'from_quote') {
          state.noStock = true;
          if (formEls.noStock) formEls.noStock.checked = true;
          DH.toast('Itens sem estoque detectados — a venda seguirá para aprovação do gestor.', 'info');
        } else {
          DH.cart.showFeedback(
            'Há itens sem estoque no carrinho. Marque "Vender sem estoque" para que a venda vá para aprovação do gestor.'
          );
          return;
        }
      }
    }

    const subtotal = utils.round2(state.cart.reduce((sum, item) =>
      sum + utils.toNumber(item.subtotal, 0), 0));

    let discount = utils.toNumber(formEls.discount.value, 0);
    if (!Number.isFinite(discount) || discount < 0) discount = 0;
    if (discount > subtotal) discount = subtotal;

    const total = utils.round2(subtotal - discount);
    if (total < 0) { DH.cart.showFeedback('O total não pode ser negativo.'); return; }

    let depositAmount = formEls.deposit ? utils.toNumber(formEls.deposit.value, 0) : 0;
    if (!Number.isFinite(depositAmount) || depositAmount < 0) depositAmount = 0;
    if (depositAmount > total) depositAmount = total;

    const installment = DH.installments ? DH.installments.getSelection() : { count: null, value: null };

    /* Método exige aprovação? */
    const method = (state.paymentMethods || []).find(m => m.code === formEls.payment.value);
    const methodRequiresApproval = !!(method && method.requires_approval);

    const payload = {
      customer_id: formEls.customer.value || null,
      subtotal,
      discount: utils.round2(discount),
      total,
      deposit_amount: utils.round2(depositAmount),
      payment_method: formEls.payment.value || '',
      notes: formEls.notes.value.trim() || '',
      allow_no_stock: !!state.noStock,
      method_requires_approval: methodRequiresApproval,
      installment_count: installment.count,
      installment_value: installment.value,
      items: state.cart.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: utils.round2(item.unit_price),
        subtotal: utils.round2(item.subtotal)
      }))
    };

    if (mode === 'quote') { await submitQuote(payload); return; }

    if (mode === 'correct') {
      const saleLabel = state.correctingSale ? utils.formatSaleNumber(state.correctingSale) : '#—';
      DH.modalPassword.request(
        'Para corrigir a venda ' + saleLabel + ', confirme sua senha.',
        async pwd => { await submitCorrection(payload, pwd); }
      );
      return;
    }

    if (mode === 'edit') {
      const saleLabel = state.editingSale ? utils.formatSaleNumber(state.editingSale) : '#—';
      DH.modalPassword.request(
        'Para salvar as alterações da venda ' + saleLabel + ', confirme sua senha.',
        async pwd => { await submitEdit(payload, pwd); }
      );
      return;
    }

    await submitCreate(payload);
  }

  /* =========================================================
     RPCs
     ========================================================= */
  async function submitCreate(payload) {
    setSubmitting(true);
    try {
      const { data, error } = await window.db.rpc('create_sale', {
        p_customer_id: payload.customer_id,
        p_subtotal: payload.subtotal,
        p_discount: payload.discount,
        p_total: payload.total,
        p_payment_method: payload.payment_method,
        p_notes: payload.notes,
        p_items: payload.items,
        p_allow_no_stock: payload.allow_no_stock,
        p_deposit_amount: payload.deposit_amount,
        p_installment_count: payload.installment_count,
        p_installment_value: payload.installment_value,
        p_method_requires_appr: payload.method_requires_approval
      });
      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      const saleNumber = result && result.sale_number;
      const requiresApproval = result && result.requires_approval;

      if (state.convertingFromQuote && DH.quotes && result && result.sale_id) {
        await DH.quotes.markQuoteConverted(result.sale_id);
        state.convertingFromQuote = null;
      }

      DH.cart.reset();
      state.editingSaleId = null;
      state.editingSale = null;
      state.formMode = null;
      state.appliedMethodDiscount = null;
      showView('list');
      state.formDataLoaded = false;

      if (DH.installments) DH.installments.reset();
      document.getElementById('quote-valid-field').hidden = true;
      document.getElementById('no-stock-field').hidden = false;

      await DH.list.loadSales();
      if (DH.quotes) { await DH.quotes.loadQuotes(); DH.quotes.switchTab('sales'); }
      if (state.perms.approve && DH.modalApprovals) {
        try { await DH.modalApprovals.refreshCount(); } catch (e) {}
      }

      if (requiresApproval) {
        DH.toast('Venda #' + utils.padNumber(saleNumber) + ' registrada e aguardando aprovação.', 'info');
      } else {
        DH.toast(saleNumber ? 'Venda #' + utils.padNumber(saleNumber) + ' registrada.' : 'Venda registrada.', 'success');
      }
    } catch (error) {
      console.error('[DEV HUB] submitCreate:', error);
      DH.cart.showFeedback(DH.mapSaleError(error));
    } finally {
      setSubmitting(false);
      refreshSubmitEnabled();
    }
  }

  async function submitEdit(payload, password) {
    setSubmitting(true);
    try {
      const { error } = await window.db.rpc('update_sale', {
        p_sale_id: state.editingSaleId,
        p_password: password,
        p_customer_id: payload.customer_id,
        p_subtotal: payload.subtotal,
        p_discount: payload.discount,
        p_total: payload.total,
        p_payment_method: payload.payment_method,
        p_notes: payload.notes,
        p_items: payload.items
      });
      if (error) throw error;

      DH.cart.reset();
      state.editingSaleId = null;
      state.editingSale = null;
      state.formMode = null;
      state.appliedMethodDiscount = null;
      showView('list');
      state.formDataLoaded = false;
      if (DH.installments) DH.installments.reset();
      await DH.list.loadSales();
      DH.toast('Venda atualizada com sucesso.', 'success');
    } catch (error) {
      console.error('[DEV HUB] submitEdit:', error);
      DH.cart.showFeedback(DH.mapSaleError(error));
    } finally {
      setSubmitting(false);
      refreshSubmitEnabled();
    }
  }

  async function submitCorrection(payload, password) {
    setSubmitting(true);
    try {
      const { data, error } = await window.db.rpc('correct_sale', {
        p_sale_id: state.correctingSaleId,
        p_password: password,
        p_customer_id: payload.customer_id,
        p_subtotal: payload.subtotal,
        p_discount: payload.discount,
        p_total: payload.total,
        p_payment_method: payload.payment_method,
        p_notes: payload.notes,
        p_items: payload.items,
        p_allow_no_stock: payload.allow_no_stock
      });
      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      const newNumber = result && result.new_sale_number;
      const requiresApproval = result && result.requires_approval;

      DH.cart.reset();
      state.correctingSaleId = null;
      state.correctingSale = null;
      state.formMode = null;
      state.appliedMethodDiscount = null;
      showView('list');
      state.formDataLoaded = false;
      if (DH.installments) DH.installments.reset();
      await DH.list.loadSales();
      if (state.perms.approve && DH.modalApprovals) {
        try { await DH.modalApprovals.refreshCount(); } catch (e) {}
      }

      if (requiresApproval) {
        DH.toast('Venda corrigida. Nova venda #' + utils.padNumber(newNumber) + ' aguardando aprovação.', 'info');
      } else {
        DH.toast(newNumber ? 'Venda corrigida. Nova venda #' + utils.padNumber(newNumber) + ' criada.' : 'Venda corrigida.', 'success');
      }
    } catch (error) {
      console.error('[DEV HUB] submitCorrection:', error);
      DH.cart.showFeedback(DH.mapSaleError(error));
    } finally {
      setSubmitting(false);
      refreshSubmitEnabled();
    }
  }

  async function submitQuote(payload) {
    setSubmitting(true);
    try {
      const result = await DH.quotes.saveQuote(payload);
      const num = result && result.quote_number;

      DH.cart.reset();
      state.formMode = null;
      state.appliedMethodDiscount = null;
      showView('list');
      state.formDataLoaded = false;

      if (DH.installments) DH.installments.reset();
      document.getElementById('quote-valid-field').hidden = true;
      document.getElementById('no-stock-field').hidden = false;

      await DH.quotes.loadQuotes();
      DH.quotes.switchTab('quotes');

      DH.toast(num ? 'Orçamento ORC-' + utils.padNumber(num) + ' salvo.' : 'Orçamento salvo.', 'success');
    } catch (e) {
      console.error('[DEV HUB] submitQuote:', e);
      DH.cart.showFeedback(DH.mapSaleError(e));
    } finally {
      setSubmitting(false);
      refreshSubmitEnabled();
    }
  }

  /* =========================================================
     HELPERS
     ========================================================= */
  function setSubmitting(isSubmitting) {
    state.submitting = isSubmitting;
    if (formEls.submitBtn) {
      formEls.submitBtn.disabled = isSubmitting;
      formEls.submitBtn.classList.toggle('is-loading', isSubmitting);
      formEls.submitBtn.setAttribute('aria-busy', String(isSubmitting));
      const label = formEls.submitBtn.querySelector('.btn__label');
      if (label) {
        const mode = state.formMode;
        if (isSubmitting) {
          label.textContent = mode === 'correct' ? 'Corrigindo...'
                            : mode === 'edit'    ? 'Salvando...'
                            : mode === 'quote'   ? 'Salvando orçamento...'
                            : 'Finalizando...';
        } else {
          label.textContent = mode === 'correct' ? 'Salvar correção'
                            : mode === 'edit'    ? 'Salvar alterações'
                            : mode === 'quote'   ? 'Salvar orçamento'
                            : 'Finalizar venda';
        }
      }
    }
  }

  async function fetchSaleItems(saleId) {
    if (!saleId) return [];
    const { data, error } = await window.db
      .from('sale_items').select('*').eq('sale_id', saleId)
      .order('created_at', { ascending: true });
    if (error) return [];
    return data || [];
  }

  DH.form = {
    els,
    setupFormView, setupSaleForm,
    openFormView, openEditSale, openCorrectSale, closeFormView, showView,
    setFormMode,
    fetchSaleItems,
    loadFormData,
    populateCustomerSelect,
    addCustomerToSelect,
    refreshSubmitEnabled,
    loadPaymentMethods,
    populatePaymentSelect,
    applyMethodDiscount
  };
})();