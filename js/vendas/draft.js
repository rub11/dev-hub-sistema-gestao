/* =========================================================
   DEV HUB · Vendas · draft.js
   Salva o rascunho da venda em sessionStorage.
   v3: inclui deposit_amount, formMode, convertingFromQuote.
   ========================================================= */
(function () {
  'use strict';

  const DH = window.DH;
  if (!DH) {
    console.error('[DEV HUB] draft.js: window.DH não existe. Carregue state.js antes.');
    return;
  }

  const KEY = 'dh:vendas:draft:v3';
  const MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const DEBUG = false;

  let saveTimer = null;
  let restoring = false;

  function S() { return DH.state; }
  function U() { return DH.utils; }

  function log() {
    if (!DEBUG) return;
    console.log.apply(console, ['[draft]'].concat(Array.from(arguments)));
  }

  function capture() {
    const st = S();
    const f = (DH.form && DH.form.els) ? DH.form.els() : {};

    const depositEl = document.getElementById('sale-deposit');
    const validEl   = document.getElementById('sale-valid-until');

    return {
      v: 3,
      savedAt: Date.now(),

      formMode: st.formMode || null,

      editingSaleId: st.editingSaleId || null,
      editingSale: st.editingSale
        ? { id: st.editingSale.id, sale_number: st.editingSale.sale_number } : null,

      correctingSaleId: st.correctingSaleId || null,
      correctingSale: st.correctingSale
        ? { id: st.correctingSale.id, sale_number: st.correctingSale.sale_number } : null,

      convertingFromQuote: st.convertingFromQuote
        ? {
            id: st.convertingFromQuote.id,
            quote_number: st.convertingFromQuote.quote_number,
            customer_id: st.convertingFromQuote.customer_id,
            subtotal: st.convertingFromQuote.subtotal,
            discount: st.convertingFromQuote.discount,
            total: st.convertingFromQuote.total,
            deposit_amount: st.convertingFromQuote.deposit_amount,
            payment_method: st.convertingFromQuote.payment_method,
            notes: st.convertingFromQuote.notes
          }
        : null,

      noStock: !!st.noStock,

      customerId:  f.customer    ? f.customer.value    : '',
      discount:    f.discount    ? f.discount.value    : '0',
      discountPct: f.discountPct ? f.discountPct.value : '0',
      depositAmount: depositEl ? depositEl.value : '0',
      validUntil:  validEl ? validEl.value : '',
      lastDiscountEdit: st.lastDiscountEdit || 'brl',
      payment:     f.payment     ? f.payment.value     : '',
      notes:       f.notes       ? f.notes.value       : '',

      cart: (st.cart || []).map(it => ({
        product_id: it.product_id,
        product_name: it.product_name,
        unit_price: it.unit_price,
        quantity: it.quantity,
        subtotal: it.subtotal,
        stock_available: it.stock_available
      }))
    };
  }

  function isMeaningful(d) {
    if (!d) return false;
    if (d.cart && d.cart.length > 0) return true;
    if (d.customerId) return true;
    if (d.notes && String(d.notes).trim()) return true;
    if (U().toNumber(d.discount, 0) > 0) return true;
    if (U().toNumber(d.depositAmount, 0) > 0) return true;
    if (d.payment) return true;
    if (d.noStock) return true;
    if (d.editingSaleId || d.correctingSaleId || d.convertingFromQuote) return true;
    return false;
  }

  function saveNow() {
    if (restoring) return;
    try {
      const data = capture();
      if (!isMeaningful(data)) {
        sessionStorage.removeItem(KEY);
        log('vazio, limpei');
        return;
      }
      sessionStorage.setItem(KEY, JSON.stringify(data));
      log('salvo:', data.cart.length, 'itens · modo:', data.formMode);
    } catch (e) {
      console.warn('[DEV HUB] Falha ao salvar rascunho:', e);
    }
  }

  function saveDebounced() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 200);
  }

  function load() {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.v !== 3) return null;
      if (Date.now() - (data.savedAt || 0) > MAX_AGE_MS) {
        sessionStorage.removeItem(KEY);
        log('rascunho antigo, descartei');
        return null;
      }
      return data;
    } catch (e) {
      console.warn('[DEV HUB] Erro ao ler rascunho:', e);
      return null;
    }
  }

  function clear() {
    try {
      sessionStorage.removeItem(KEY);
      log('rascunho apagado');
    } catch (e) {}
  }

  async function tryRestore() {
    const data = load();
    log('tentando restaurar:', data ? (data.cart || []).length + ' itens' : 'nada');
    if (!data) return false;

    restoring = true;
    try {
      const st = S();
      const ut = U();

      if (!st.formDataLoaded && DH.form.loadFormData) {
        await DH.form.loadFormData();
      }

      DH.form.showView('form');

      /* Restaura modo */
      if (data.convertingFromQuote) {
        st.convertingFromQuote = data.convertingFromQuote;
        st.editingSaleId = null;
        st.editingSale = null;
        st.correctingSaleId = null;
        st.correctingSale = null;
        if (DH.form.setFormMode) DH.form.setFormMode('from_quote', st.convertingFromQuote);
      } else if (data.correctingSaleId) {
        st.correctingSaleId = data.correctingSaleId;
        st.correctingSale = data.correctingSale || { id: data.correctingSaleId };
        st.editingSaleId = null;
        st.editingSale = null;
        st.convertingFromQuote = null;
        if (DH.form.setFormMode) DH.form.setFormMode('correct', st.correctingSale);
      } else if (data.editingSaleId) {
        st.editingSaleId = data.editingSaleId;
        st.editingSale = data.editingSale || { id: data.editingSaleId };
        st.correctingSaleId = null;
        st.correctingSale = null;
        st.convertingFromQuote = null;
        if (DH.form.setFormMode) DH.form.setFormMode('edit', st.editingSale);
      } else if (data.formMode === 'quote') {
        st.editingSaleId = null;
        st.editingSale = null;
        st.correctingSaleId = null;
        st.correctingSale = null;
        st.convertingFromQuote = null;
        if (DH.form.setFormMode) DH.form.setFormMode('quote');
      } else {
        st.editingSaleId = null;
        st.editingSale = null;
        st.correctingSaleId = null;
        st.correctingSale = null;
        st.convertingFromQuote = null;
        if (DH.form.setFormMode) DH.form.setFormMode('create');
      }

      /* Restaura campos do formulário */
      const f = DH.form.els();
      if (f.customer)    f.customer.value    = data.customerId || '';
      if (f.discount)    f.discount.value    = data.discount || '0';
      if (f.discountPct) f.discountPct.value = data.discountPct || '0';
      if (f.payment)     f.payment.value     = data.payment || '';
      if (f.notes)       f.notes.value       = data.notes || '';
      if (f.noStock)     f.noStock.checked   = !!data.noStock;

      const depositEl = document.getElementById('sale-deposit');
      if (depositEl) depositEl.value = data.depositAmount || '0';

      const validEl = document.getElementById('sale-valid-until');
      if (validEl && data.validUntil) validEl.value = data.validUntil;

      /* Campos de visibilidade */
      const validField = document.getElementById('quote-valid-field');
      if (validField) validField.hidden = data.formMode !== 'quote' && !data.editingSaleId && !data.correctingSaleId;
      const noStockField = document.getElementById('no-stock-field');
      if (noStockField) noStockField.hidden = data.formMode === 'quote';

      st.lastDiscountEdit = data.lastDiscountEdit || 'brl';
      st.noStock = !!data.noStock;

      /* Restaura carrinho */
      st.cart = (data.cart || []).map(it => ({
        product_id: it.product_id,
        product_name: it.product_name || '',
        unit_price: ut.toNumber(it.unit_price, 0),
        quantity: ut.toInteger(it.quantity, 1),
        subtotal: ut.toNumber(it.subtotal, 0),
        stock_available: ut.toInteger(it.stock_available, 0)
      }));

      DH.cart.render();
      DH.cart.recalc();

      DH.toast('Rascunho da venda restaurado.', 'info');
      log('restaurado com sucesso');
      return true;
    } catch (e) {
      console.error('[DEV HUB] draft.tryRestore falhou:', e);
      return false;
    } finally {
      setTimeout(() => { restoring = false; }, 0);
    }
  }

  function bindAutoSave() {
    const f = (DH.form && DH.form.els) ? DH.form.els() : {};
    ['customer', 'discount', 'discountPct', 'payment', 'notes', 'noStock', 'deposit', 'validUntil'].forEach(k => {
      const el = f[k];
      if (!el) return;
      el.addEventListener('input', saveDebounced);
      el.addEventListener('change', saveDebounced);
    });

    window.addEventListener('beforeunload', saveNow);
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveNow();
    });
  }

  function wrapCart() {
    if (!DH.cart) return;
    const _render = DH.cart.render;
    const _recalc = DH.cart.recalc;
    const _reset  = DH.cart.reset;

    DH.cart.render = function () {
      const r = _render.apply(this, arguments);
      saveDebounced();
      return r;
    };
    DH.cart.recalc = function () {
      const r = _recalc.apply(this, arguments);
      saveDebounced();
      return r;
    };
    DH.cart.reset = function () {
      clear();
      return _reset.apply(this, arguments);
    };
  }

  function wrapForm() {
    if (!DH.form) return;
    const _close = DH.form.closeFormView;
    DH.form.closeFormView = function () {
      clear();
      return _close.apply(this, arguments);
    };
  }

  function init() {
    log('init');
    wrapCart();
    wrapForm();
    bindAutoSave();
  }

  DH.draft = { init, tryRestore, saveNow, saveDebounced, clear, load };
})();