(function () {
  'use strict';
  const DH = window.DH;
  const { state, utils } = DH;

  const formEls = {};

  function els() { return formEls; }

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
    formEls.totalSub    = document.getElementById('total-subtotal');
    formEls.totalTotal  = document.getElementById('total-total');
    formEls.payment     = document.getElementById('sale-payment');
    formEls.notes       = document.getElementById('sale-notes');
    formEls.feedback    = document.getElementById('sale-form-feedback');
    formEls.submitBtn   = document.getElementById('submit-sale-btn');

    if (!formEls.form) return;

    if (formEls.discount) {
      formEls.discount.addEventListener('input', () => {
        state.lastDiscountEdit = 'brl';
        DH.cart.recalc();
      });
    }
    if (formEls.discountPct) {
      formEls.discountPct.addEventListener('input', () => {
        state.lastDiscountEdit = 'pct';
        DH.cart.recalc();
      });
    }
    formEls.form.addEventListener('submit', onSubmit);
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

  async function openFormView() {
    if (!state.perms.create) {
      DH.toast('Você não tem permissão para criar vendas.', 'error');
      return;
    }
    state.editingSaleId = null;
    state.editingSale = null;
    setFormMode('create');
    showView('form');
    if (!state.formDataLoaded) await loadFormData();
  }

  async function openEditSale(sale) {
    if (!state.perms.edit) {
      DH.toast('Você não tem permissão para editar vendas.', 'error');
      return;
    }
    state.editingSaleId = sale.id;
    state.editingSale = sale;
    showView('form');
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
  }

  function setFormMode(mode, sale) {
    const isEdit = mode === 'edit';
    const title = document.querySelector('#view-form .page-head__title');
    const sub = document.querySelector('#view-form .page-head__sub');
    const submitLabel = formEls.submitBtn ? formEls.submitBtn.querySelector('.btn__label') : null;

    if (title) title.textContent = isEdit
      ? 'Editar venda ' + utils.formatSaleNumber(sale) : 'Nova venda';
    if (sub) sub.textContent = isEdit
      ? 'Alterações serão registradas no histórico com seu nome e horário.'
      : 'Selecione o cliente, adicione produtos e finalize.';
    if (submitLabel) submitLabel.textContent = isEdit ? 'Salvar alterações' : 'Finalizar venda';
  }

  function closeFormView() {
    if (state.submitting) return;
    DH.cart.reset();
    state.editingSaleId = null;
    state.editingSale = null;
    showView('list');
  }

  async function loadFormData() {
    state.formDataLoaded = false;
    const [customersRes, productsRes] = await Promise.all([
      window.db.from('customers').select('id, name').order('name', { ascending: true }),
      window.db.from('products')
        .select('id, name, code, barcode, description, image_url, price, stock, minimum_stock, active')
        .eq('active', true).order('name', { ascending: true })
    ]);

    if (customersRes.error) {
      console.error('[DEV HUB] Falha ao carregar clientes:', customersRes.error);
      DH.toast('Não foi possível carregar os clientes.', 'error');
    }
    if (productsRes.error) {
      console.error('[DEV HUB] Falha ao carregar produtos:', productsRes.error);
      DH.toast('Não foi possível carregar os produtos.', 'error');
    }

    state.customers = customersRes.data || [];
    state.products = productsRes.data || [];
    populateCustomerSelect();
    state.formDataLoaded = true;
  }

  function populateCustomerSelect() {
    const select = document.getElementById('sale-customer');
    if (!select) return;
    while (select.options.length > 1) select.remove(1);
    state.customers.forEach(c => {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.name || '(sem nome)';
      select.appendChild(option);
    });
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (state.submitting) return;
    DH.cart.clearFeedback();

    if (state.editingSaleId && !state.perms.edit) {
      DH.cart.showFeedback('Você não tem permissão para editar vendas.'); return;
    }
    if (!state.editingSaleId && !state.perms.create) {
      DH.cart.showFeedback('Você não tem permissão para criar vendas.'); return;
    }
    if (state.cart.length === 0) {
      DH.cart.showFeedback('Adicione pelo menos um produto à venda.'); return;
    }

    for (let i = 0; i < state.cart.length; i += 1) {
      const item = state.cart[i];
      if (item.quantity <= 0) { DH.cart.showFeedback('Quantidade inválida.'); return; }
      if (item.quantity > item.stock_available) {
        DH.cart.showFeedback('Estoque insuficiente para "' + item.product_name + '".'); return;
      }
    }

    const subtotal = utils.round2(state.cart.reduce((sum, item) =>
      sum + utils.toNumber(item.subtotal, 0), 0));

    let discount = utils.toNumber(formEls.discount.value, 0);
    if (!Number.isFinite(discount) || discount < 0) discount = 0;
    if (discount > subtotal) discount = subtotal;

    const total = utils.round2(subtotal - discount);
    if (total < 0) { DH.cart.showFeedback('O total não pode ser negativo.'); return; }

    const payload = {
      customer_id: formEls.customer.value || null,
      subtotal,
      discount: utils.round2(discount),
      total,
      payment_method: formEls.payment.value || '',
      notes: formEls.notes.value.trim() || '',
      items: state.cart.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: utils.round2(item.unit_price),
        subtotal: utils.round2(item.subtotal)
      }))
    };

    if (state.editingSaleId) {
      const saleLabel = state.editingSale ? utils.formatSaleNumber(state.editingSale) : '#—';
      DH.modalPassword.request(
        'Para salvar as alterações da venda ' + saleLabel +
        ', confirme sua senha. A alteração fica registrada no histórico.',
        async pwd => { await submitEdit(payload, pwd); }
      );
      return;
    }
    await submitCreate(payload);
  }

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
        p_items: payload.items
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      const saleNumber = result && result.sale_number;

      DH.cart.reset();
      state.editingSaleId = null;
      state.editingSale = null;
      showView('list');
      state.formDataLoaded = false;
      await DH.list.loadSales();

      DH.toast(saleNumber
        ? 'Venda #' + utils.padNumber(saleNumber) + ' registrada.'
        : 'Venda registrada com sucesso.', 'success');
    } catch (error) {
      console.error('[DEV HUB] Falha ao finalizar venda:', error);
      DH.cart.showFeedback(DH.mapSaleError(error));
    } finally {
      setSubmitting(false);
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
      showView('list');
      state.formDataLoaded = false;
      await DH.list.loadSales();
      DH.toast('Venda atualizada com sucesso.', 'success');
    } catch (error) {
      console.error('[DEV HUB] Falha ao atualizar venda:', error);
      DH.cart.showFeedback(DH.mapSaleError(error));
    } finally {
      setSubmitting(false);
    }
  }

  function setSubmitting(isSubmitting) {
    state.submitting = isSubmitting;
    if (formEls.submitBtn) {
      formEls.submitBtn.disabled = isSubmitting;
      formEls.submitBtn.classList.toggle('is-loading', isSubmitting);
      formEls.submitBtn.setAttribute('aria-busy', String(isSubmitting));
      const label = formEls.submitBtn.querySelector('.btn__label');
      if (label) {
        label.textContent = isSubmitting
          ? (state.editingSaleId ? 'Salvando...' : 'Finalizando...')
          : (state.editingSaleId ? 'Salvar alterações' : 'Finalizar venda');
      }
    }
  }

  async function fetchSaleItems(saleId) {
    if (!saleId) return [];
    const { data, error } = await window.db
      .from('sale_items').select('*').eq('sale_id', saleId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[DEV HUB] Erro ao carregar itens:', error);
      return [];
    }
    return data || [];
  }

  DH.form = {
    els,
    setupFormView, setupSaleForm,
    openFormView, openEditSale, closeFormView, showView,
    fetchSaleItems
  };
})();