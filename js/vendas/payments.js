/* =========================================================
   DEV HUB · Vendas · payments.js
   Múltiplas formas de pagamento por venda.
   ========================================================= */
(function () {
  'use strict';
  const DH = window.DH = window.DH || {};
  const { state, utils } = DH;

  const $ = (id) => document.getElementById(id);

  let rows = [];

  /* =====================================================
     Render
     ===================================================== */
  function ensureAtLeastOne() {
    if (rows.length === 0) {
      rows.push({ method: '', amount: 0, installment_count: null, installment_value: null, other_description: '' });
    }
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.dh-select-menu').forEach(m => m.classList.remove('is-open'));
  }

  function render() {
    const list = $('payments-list');
    if (!list) return;

    ensureAtLeastOne();

    // Deduplicação de métodos
    const rawMethods = state.paymentMethods || [];
    const methods = [];
    const seen = new Set();
    rawMethods.forEach(m => {
      if (!seen.has(m.code)) {
        seen.add(m.code);
        methods.push(m);
      }
    });

    list.innerHTML = rows.map((row, i) => {
      const isCredit = row.method === 'credit_card';
      const isOther = row.method === 'other';
      const canRemove = rows.length > 1;
      
      const currentLabel = row.method 
        ? (methods.find(m => m.code === row.method)?.label || 'Selecione…') 
        : 'Selecione…';

      const options = methods.map(m =>
        `<div class="dh-select-option ${m.code === row.method ? 'is-selected' : ''}" data-value="${m.code}">${m.label}</div>`
      ).join('');

      // Formata o texto das parcelas (ex: 1x à vista ou 2x de R$ 50)
      let instLabel = '1x à vista';
      if (row.installment_count > 1 && row.installment_value) {
        instLabel = `${row.installment_count}x de ${utils.formatMoney(row.installment_value)}`;
      }

      return `
        <div class="payment-row" data-idx="${i}" style="flex-wrap: wrap;">
          
          <!-- CUSTOM SELECT (Método) -->
          <div class="dh-select" data-action="method-wrap" style="flex: 1;">
            <button type="button" class="dh-select-trigger">
              <span>${currentLabel}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            
            <div class="dh-select-menu">
              <div class="dh-select-option ${!row.method ? 'is-selected' : ''}" data-value="">Selecione…</div>
              ${options}
            </div>
          </div>
          <!-- /CUSTOM SELECT -->

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

          ${isOther ? `
            <div class="payment-row__other" style="width: 100%; margin-top: 6px;">
              <input type="text" class="payment-row__other-input" 
                     placeholder="Especifique o meio de pagamento..." 
                     value="${row.other_description || ''}" 
                     data-action="other-desc" required />
            </div>
          ` : ''}

          ${isCredit ? `
            <div class="payment-row__installments" style="width: 100%; margin-top: 6px; display: flex; align-items: center; gap: 10px;">
              <label style="margin:0; font-size:12px; color:var(--text-muted);">Parcelas</label>
              
              <!-- CUSTOM SELECT (Parcelas) -->
              <div class="dh-select" data-action="installments-wrap" style="width: 140px;">
                <button type="button" class="dh-select-trigger" style="height:32px;">
                  <span data-role="inst-label">${instLabel}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>
                <div class="dh-select-menu" data-role="inst-menu">
                  <!-- Injetado via JS -->
                </div>
              </div>
              <!-- /CUSTOM SELECT -->
              
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    /* Listeners por linha */
    list.querySelectorAll('.payment-row').forEach(el => {
      const idx = Number(el.dataset.idx);

      // Lógica do Custom Select de MÉTODO
      const wrap = el.querySelector('[data-action="method-wrap"]');
      const trigger = wrap.querySelector('.dh-select-trigger');
      const menu = wrap.querySelector('.dh-select-menu');

      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = menu.classList.contains('is-open');
        closeAllDropdowns();
        if (!isOpen) menu.classList.add('is-open');
      });

      menu.querySelectorAll('.dh-select-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          rows[idx].method = opt.dataset.value;
          rows[idx].installment_count = null;
          rows[idx].installment_value = null;
          rows[idx].other_description = '';
          closeAllDropdowns();
          render();
          recalc();
        });
      });

      // Lógica do Custom Select de PARCELAS
      const instWrap = el.querySelector('[data-action="installments-wrap"]');
      if (instWrap) {
        const instTrigger = instWrap.querySelector('.dh-select-trigger');
        const instMenu = instWrap.querySelector('.dh-select-menu');
        const instLabel = instWrap.querySelector('[data-role="inst-label"]');

        instTrigger.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isOpen = instMenu.classList.contains('is-open');
          closeAllDropdowns();
          if (!isOpen) {
            populateInstallmentsMenu(idx, instMenu, instLabel);
            instMenu.classList.add('is-open');
          }
        });
      }

      // Input de valor
      el.querySelector('[data-action="amount"]').addEventListener('input', (e) => {
        const v = Number(String(e.target.value).replace(',', '.')) || 0;
        rows[idx].amount = Math.max(0, v);
        recalc();
      });

      // Input de descrição do "Outro"
      const otherInput = el.querySelector('[data-action="other-desc"]');
      if (otherInput) {
        otherInput.addEventListener('input', (e) => {
          rows[idx].other_description = e.target.value;
          recalc();
        });
      }

      // Remover
      const rm = el.querySelector('[data-action="remove"]');
      if (rm) {
        rm.addEventListener('click', () => {
          if (rows.length <= 1) return;
          rows.splice(idx, 1);
          render();
          recalc();
        });
      }
    });

    recalc();
  }

  document.addEventListener('click', closeAllDropdowns);

  function populateInstallmentsMenu(idx, menu, labelEl) {
    const row = rows[idx];
    
    // Se o valor digitado for 0, pega o valor que falta alocar (ou o total do carrinho) para calcular
    let total = Number(row.amount) || 0;
    if (total <= 0) {
      total = getTotalFromCart() - getAllocated();
      if (total <= 0) total = getTotalFromCart();
    }

    const rules = (DH.installments && DH.installments.getRules)
      ? DH.installments.getRules()
      : [];

    let maxInst = 1;

    if (total > 0 && rules.length > 0) {
      const sorted = rules.slice().sort((a, b) => Number(a.max_value) - Number(b.max_value));
      let rule = sorted.find(r => total <= Number(r.max_value));
      if (!rule) rule = sorted[sorted.length - 1];

      maxInst = Number(rule.max_installments) || 1;
      const minInst = Number(rule.min_installment_value) || 0;
      if (minInst > 0) {
        while (maxInst > 1 && (total / maxInst) < minInst) maxInst -= 1;
      }
    }
    if (maxInst < 1) maxInst = 1;

    let html = '';
    for (let i = 1; i <= maxInst; i++) {
      const value = utils.round2(total / i);
      const label = i === 1
        ? `À vista — ${utils.formatMoney(total)}`
        : `${i}x de ${utils.formatMoney(value)}`;
      
      const isSelected = (row.installment_count || 1) === i;
      html += `<div class="dh-select-option ${isSelected ? 'is-selected' : ''}" data-val="${i}">${label}</div>`;
    }

    menu.innerHTML = html;

    menu.querySelectorAll('.dh-select-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const n = Number(opt.dataset.val) || 1;
        
        // Se o input de valor estava zerado, preenche automaticamente ao escolher a parcela
        if (Number(row.amount) <= 0) {
           row.amount = total;
           const inputAmount = document.querySelector(`.payment-row[data-idx="${idx}"] [data-action="amount"]`);
           if (inputAmount) inputAmount.value = total.toFixed(2);
        }

        rows[idx].installment_count = n;
        rows[idx].installment_value = total > 0 ? utils.round2(total / n) : null;
        
        labelEl.textContent = n === 1 
          ? '1x à vista' 
          : `${n}x de ${utils.formatMoney(rows[idx].installment_value)}`;

        menu.classList.remove('is-open');
        recalc();
      });
    });
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
    
    const allRowsValid = rows.every(r => {
      if (!r.method || Number(r.amount) <= 0) return false;
      if (r.method === 'other' && !r.other_description?.trim()) return false;
      return true;
    });

    return allRowsValid && isBalanced();
  }

  function getPayments() {
    return rows
      .filter(r => r.method && Number(r.amount) > 0)
      .map((r, i) => ({
        payment_method: r.method,
        amount: utils.round2(Number(r.amount)),
        installment_count: r.installment_count || 1,
        installment_value: r.installment_value || null,
        other_description: r.other_description || null,
        sort_order: i
      }));
  }

  function getPrimary() {
    const list = getPayments();
    return list.length > 0 ? list[0] : null;
  }

  function reset() {
    rows = [{ method: '', amount: 0, installment_count: null, installment_value: null, other_description: '' }];
    render();
  }

  function loadFromSale(sale) {
    rows = [];
    if (sale && sale.payment_method) {
      rows.push({
        method: sale.payment_method,
        amount: Number(sale.total) || 0,
        installment_count: sale.installment_count || 1,
        installment_value: sale.installment_value || null,
        other_description: sale.other_description || ''
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
        rows.push({ method: '', amount: 0, installment_count: null, installment_value: null, other_description: '' });
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