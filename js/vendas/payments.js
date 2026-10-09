/* =========================================================
   DEV HUB · Vendas · payments.js
   Múltiplas formas de pagamento por venda.
   ---------------------------------------------------------
   - Lista dinâmica de pagamentos (até 6)
   - Cada linha tem forma + valor
   - Cartão de crédito mostra seletor de parcelas
   - Valida se a soma dos valores bate com o total da venda
   ========================================================= */
(function () {
  'use strict';
  const DH = window.DH = window.DH || {};
  const { state, utils } = DH;

  const $ = (id) => document.getElementById(id);

  /* [{ method, amount, installment_count, installment_value }] */
  let rows = [];

  /* =====================================================
     Render
     ===================================================== */
  function ensureAtLeastOne() {
    if (rows.length === 0) {
      rows.push({ method: '', amount: 0, installment_count: null, installment_value: null });
    }
  }

  function render() {
    const list = $('payments-list');
    if (!list) return;

    ensureAtLeastOne();

    list.innerHTML = rows.map((row, i) => {
      const methods = state.paymentMethods || [];
      const isCredit = row.method === 'credit_card';
      const canRemove = rows.length > 1;

      const options = methods.map(m =>
        `<option value="${m.code}"${m.code === row.method ? ' selected' : ''}>${m.label}</option>`
      ).join('');

      return `
        <div class="payment-row" data-idx="${i}">
          <select class="payment-row__select" data-action="method">
            <option value="">Selecione…</option>
            ${options}
          </select>
          <div class="payment-row__amount">
            <input type="number" min="0" step="0.01" inputmode="decimal"
                   value="${row.amount ? row.amount.toFixed(2) : ''}"
                   placeholder="0,00"
                   data-action="amount" />
          </div>
          <button type="button" class="payment-row__remove"
                  data-action="remove" ${canRemove ? '' : 'disabled'}
                  aria-label="Remover forma">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>

          ${isCredit ? `
            <div class="payment-row__installments">
              <label>Parcelas</label>
              <select data-action="installments"></select>
              <span class="payment-row__installments-hint" data-role="installments-hint"></span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    /* Listeners por linha */
    list.querySelectorAll('.payment-row').forEach(el => {
      const idx = Number(el.dataset.idx);

      el.querySelector('[data-action="method"]').addEventListener('change', (e) => {
        rows[idx].method = e.target.value;
        rows[idx].installment_count = null;
        rows[idx].installment_value = null;
        render();
        recalc();
      });

      el.querySelector('[data-action="amount"]').addEventListener('input', (e) => {
        const v = Number(String(e.target.value).replace(',', '.')) || 0;
        rows[idx].amount = Math.max(0, v);
        recalc();
      });

      const rm = el.querySelector('[data-action="remove"]');
      if (rm) {
        rm.addEventListener('click', () => {
          if (rows.length <= 1) return;
          rows.splice(idx, 1);
          render();
          recalc();
        });
      }

      const instSel = el.querySelector('[data-action="installments"]');
      if (instSel) {
        const hint = el.querySelector('[data-role="installments-hint"]');
        populateInstallments(idx, instSel, hint);
        instSel.addEventListener('change', () => {
          const n = Number(instSel.value) || 1;
          rows[idx].installment_count = n;
          rows[idx].installment_value = rows[idx].amount > 0
            ? utils.round2(rows[idx].amount / n)
            : null;
          if (hint) {
            hint.textContent = n > 1 && rows[idx].amount > 0
              ? `${n}x de ${utils.formatMoney(rows[idx].installment_value)}`
              : '';
          }
        });
      }
    });

    recalc();
  }

  /* Popula select de parcelamento de UMA linha */
  function populateInstallments(idx, select, hint) {
    const row = rows[idx];
    const total = Number(row.amount) || 0;
    const rules = (DH.installments && DH.installments.getRules)
      ? DH.installments.getRules()
      : [];

    if (!total || total <= 0 || rules.length === 0) {
      select.innerHTML = '<option value="1">1x à vista</option>';
      select.value = '1';
      row.installment_count = 1;
      row.installment_value = total;
      if (hint) hint.textContent = '';
      return;
    }

    const sorted = rules.slice().sort((a, b) => Number(a.max_value) - Number(b.max_value));
    let rule = sorted.find(r => total <= Number(r.max_value));
    if (!rule) rule = sorted[sorted.length - 1];

    let maxInst = Number(rule.max_installments) || 1;
    const minInst = Number(rule.min_installment_value) || 0;
    if (minInst > 0) {
      while (maxInst > 1 && (total / maxInst) < minInst) maxInst -= 1;
    }
    if (maxInst < 1) maxInst = 1;

    const opts = [];
    for (let i = 1; i <= maxInst; i++) {
      const value = utils.round2(total / i);
      const label = i === 1
        ? `À vista — ${utils.formatMoney(total)}`
        : `${i}x de ${utils.formatMoney(value)}`;
      opts.push(`<option value="${i}">${label}</option>`);
    }
    select.innerHTML = opts.join('');

    const cur = Number(row.installment_count) || 1;
    select.value = String(Math.min(cur, maxInst));
    row.installment_count = Number(select.value) || 1;
    row.installment_value = utils.round2(total / row.installment_count);

    if (hint) {
      hint.textContent = row.installment_count > 1
        ? `${row.installment_count}x de ${utils.formatMoney(row.installment_value)}`
        : '';
    }
  }

  /* =====================================================
     Cálculo
     ===================================================== */
  function getTotalFromCart() {
    const subtotal = state.cart.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
    const discountEl = $('sale-discount');
    const discount = discountEl ? (Number(discountEl.value) || 0) : 0;
    return Math.max(0, utils.round2(subtotal - discount));
  }

  function getTotal() {
    const v = getTotalFromCart();
    const el = $('payments-total');
    if (el) el.textContent = utils.formatMoney(v);
    return v;
  }

  function getAllocated() {
    const sum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const v = utils.round2(sum);
    const el = $('payments-allocated');
    if (el) el.textContent = utils.formatMoney(v);
    return v;
  }

  function recalc() {
    const total = getTotal();
    const allocated = getAllocated();
    const diff = utils.round2(total - allocated);

    const row = $('payments-balance-row');
    const label = $('payments-balance-label');
    const value = $('payments-balance');

    if (row && label && value) {
      row.classList.remove(
        'payments-summary__row--ok',
        'payments-summary__row--warn',
        'payments-summary__row--err'
      );

      if (diff === 0 && total > 0) {
        row.classList.add('payments-summary__row--ok');
        label.textContent = 'Alocado ✅';
        value.textContent = utils.formatMoney(allocated);
      } else if (diff > 0) {
        row.classList.add('payments-summary__row--warn');
        label.textContent = 'Falta alocar';
        value.textContent = utils.formatMoney(diff);
      } else {
        row.classList.add('payments-summary__row--err');
        label.textContent = 'Excesso';
        value.textContent = utils.formatMoney(-diff);
      }
    }

    if (DH.form && DH.form.refreshSubmitEnabled) DH.form.refreshSubmitEnabled();
  }

  /* =====================================================
     API pública
     ===================================================== */
  function isBalanced() {
    const total = getTotalFromCart();
    const allocated = getAllocated();
    if (total <= 0) return false;
    return Math.abs(total - allocated) < 0.01;
  }

  function hasPayment() {
    if (rows.length === 0) return false;
    return rows.every(r => r.method && Number(r.amount) > 0) && isBalanced();
  }

  function getPayments() {
    return rows
      .filter(r => r.method && Number(r.amount) > 0)
      .map((r, i) => ({
        payment_method: r.method,
        amount: utils.round2(Number(r.amount)),
        installment_count: r.installment_count || 1,
        installment_value: r.installment_value || null,
        sort_order: i
      }));
  }

  function getPrimary() {
    const list = getPayments();
    return list.length > 0 ? list[0] : null;
  }

  function reset() {
    rows = [{ method: '', amount: 0, installment_count: null, installment_value: null }];
    render();
  }

  function loadFromSale(sale) {
    rows = [];
    if (sale && sale.payment_method) {
      rows.push({
        method: sale.payment_method,
        amount: Number(sale.total) || 0,
        installment_count: sale.installment_count || 1,
        installment_value: sale.installment_value || null
      });
    }
    ensureAtLeastOne();
    render();
  }

  /* =====================================================
     Boot
     ===================================================== */
  function setup() {
    const addBtn = $('add-payment-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (rows.length >= 6) {
          if (DH.toast) DH.toast('Máximo de 6 formas por venda.', 'info');
          return;
        }
        rows.push({ method: '', amount: 0, installment_count: null, installment_value: null });
        render();
        recalc();
      });
    }

    reset();
  }

  DH.payments = {
    setup, render, recalc, reset,
    isBalanced, hasPayment, getPayments, getPrimary,
    loadFromSale,
    getTotal: getTotalFromCart,
    getAllocated
  };
})();