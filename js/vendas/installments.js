/* =========================================================
   DEV HUB · Vendas · installments.js
   Parcelamento no cartão de crédito.
   v4: usa state.paymentMethods pra saber se é crédito.
   ========================================================= */
(function () {
  'use strict';
  const DH = window.DH = window.DH || {};
  const DEBUG = true;

  let rules = [];
  let lastLoadAt = 0;
  const CACHE_TTL = 5 * 1000;
  const els = {};
  let ready = false;
  let observer = null;
  let pollTimer = null;

  function log() {
    if (!DEBUG) return;
    console.log.apply(console, ['[installments]'].concat(Array.from(arguments)));
  }

  function setup() {
    if (ready) return;

    els.field   = document.getElementById('installment-field');
    els.select  = document.getElementById('sale-installments');
    els.hint    = document.getElementById('installment-hint');
    els.payment = document.getElementById('sale-payment');

    log('setup', { field: !!els.field, select: !!els.select, payment: !!els.payment });
    if (!els.payment || !els.field || !els.select) return;

    els.payment.addEventListener('change', onPaymentChange);
    els.payment.addEventListener('input', onPaymentChange);
    els.select.addEventListener('change', updateHint);

    const totalEl = document.getElementById('total-total');
    if (totalEl) {
      observer = new MutationObserver(() => {
        if (isCreditSelected() && !els.field.hidden) buildOptions();
      });
      observer.observe(totalEl, { childList: true, characterData: true, subtree: true });
    }

    pollTimer = setInterval(() => {
      if (isCreditSelected() && els.field.hidden) onPaymentChange();
    }, 1500);

    if (isCreditSelected()) onPaymentChange();

    ready = true;
    log('setup ok');
  }

  /* Verifica se o método atual é da categoria "credit" */
  function isCreditSelected() {
    const code = els.payment.value;
    if (!code) return false;
    const methods = DH.state.paymentMethods;
    if (Array.isArray(methods)) {
      const m = methods.find(x => x.code === code);
      if (m) return m.category === 'credit';
    }
    /* Fallback se ainda não carregou */
    return code === 'credit_card';
  }

  function onPaymentChange() {
    const code = els.payment.value;
    log('payment mudou para:', code, '· crédito?', isCreditSelected());
    if (isCreditSelected()) {
      loadRules().then(() => buildOptions());
    } else {
      hideField();
    }
  }

  async function loadRules() {
    const now = Date.now();
    if (rules.length > 0 && (now - lastLoadAt) < CACHE_TTL) return rules;
    try {
      const { data, error } = await window.db
        .from('installment_rules')
        .select('*')
        .eq('active', true)
        .order('max_value', { ascending: true });
      if (error) throw error;
      rules = data || [];
      lastLoadAt = now;
      log('regras carregadas:', rules.length);
    } catch (e) {
      rules = [];
    }
    return rules;
  }

  function getTotal() {
    const st = DH.state;
    if (st && Array.isArray(st.cart) && st.cart.length > 0) {
      const subtotal = st.cart.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0);
      const discountEl = document.getElementById('sale-discount');
      const discountPctEl = document.getElementById('sale-discount-pct');
      let discount = 0;
      if (st.lastDiscountEdit === 'pct' && discountPctEl) {
        discount = subtotal * ((Number(discountPctEl.value) || 0) / 100);
      } else if (discountEl) {
        discount = Number(discountEl.value) || 0;
      }
      const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
      if (total > 0) return total;
    }
    const el = document.getElementById('total-total');
    if (!el) return 0;
    const cleaned = String(el.textContent || '').replace(/[^\d,]/g, '').replace(',', '.');
    const v = Number(cleaned);
    return Number.isFinite(v) ? v : 0;
  }

  async function buildOptions() {
    if (!els.select || !els.field) return;
    await loadRules();

    const total = getTotal();
    log('  total calculado:', total);
    if (!total || total <= 0) { hideField(); return; }

    const sorted = rules.slice().sort((a, b) => Number(a.max_value) - Number(b.max_value));
    if (sorted.length === 0) { hideField(); return; }

    let rule = sorted.find(r => total <= Number(r.max_value));
    if (!rule) rule = sorted[sorted.length - 1];

    let maxInsts = Number(rule.max_installments) || 1;
    const minInst = Number(rule.min_installment_value) || 0;
    if (minInst > 0) {
      while (maxInsts > 1 && (total / maxInsts) < minInst) maxInsts--;
    }
    if (maxInsts < 1) maxInsts = 1;

    const opts = [];
    for (let i = 1; i <= maxInsts; i++) {
      const value = DH.utils.round2(total / i);
      const label = i === 1
        ? 'À vista — ' + DH.utils.formatMoney(total)
        : i + 'x de ' + DH.utils.formatMoney(value) + ' (total ' + DH.utils.formatMoney(total) + ')';
      opts.push({ n: i, value, label });
    }

    if (els.select.dataset.total === String(total) &&
        els.select.children.length === opts.length) {
      els.field.hidden = false;
      return;
    }

    els.select.dataset.total = String(total);
    els.select.innerHTML = opts.map(o =>
      '<option value="' + o.n + '" data-value="' + o.value + '">' + o.label + '</option>'
    ).join('');
    els.select.value = '1';

    log('  ✅ mostrando com', opts.length, 'opções');
    els.field.hidden = false;
    updateHint();
  }

  function updateHint() {
    if (!els.hint || !els.select) return;
    const n = Number(els.select.value);
    const total = getTotal();
    if (!n || !total) { els.hint.textContent = ''; return; }
    const value = DH.utils.round2(total / n);
    if (DH.state) {
      DH.state.installmentCount = n;
      DH.state.installmentValue = value;
    }
    els.hint.textContent = n === 1
      ? 'Pagamento à vista no cartão.'
      : 'Cliente pagará ' + n + ' parcelas de ' + DH.utils.formatMoney(value) + '.';
  }

  function hideField() {
    if (els.field) els.field.hidden = true;
    if (els.select) {
      els.select.innerHTML = '';
      delete els.select.dataset.total;
    }
    if (DH.state) {
      DH.state.installmentCount = null;
      DH.state.installmentValue = null;
    }
  }

  function reset() {
    hideField();
    if (els.hint) els.hint.textContent = '';
  }

  function getSelection() {
    if (!els.field || els.field.hidden || !els.select) {
      return { count: null, value: null };
    }
    const n = Number(els.select.value);
    const opt = els.select.selectedOptions[0];
    const v = opt ? Number(opt.dataset.value) : NaN;
    if (!n || !Number.isFinite(v)) return { count: null, value: null };
    return { count: n, value: DH.utils.round2(v) };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

  DH.installments = { setup, reset, getSelection, buildOptions, hideField, loadRules };
})();