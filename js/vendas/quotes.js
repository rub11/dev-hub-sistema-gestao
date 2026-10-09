/* =========================================================
   DEV HUB · Vendas · quotes.js
   Módulo de Orçamentos: listar, criar, imprimir, converter em venda,
   EDITAR existente.
   ========================================================= */
(function () {
  'use strict';
  const DH = window.DH;
  const { state, utils } = DH;

  const QUOTE_STATUS = {
    draft:     { label: 'Rascunho',   cls: 'badge--draft' },
    sent:      { label: 'Enviado',    cls: 'badge--sent' },
    converted: { label: 'Convertido', cls: 'badge--converted' },
    expired:   { label: 'Vencido',    cls: 'badge--expired' },
    cancelled: { label: 'Cancelado',  cls: 'badge--cancelled' }
  };

  function padNum(n) {
    const s = String(n == null ? '' : n);
    return s.length >= 6 ? s : '0'.repeat(6 - s.length) + s;
  }
  function fmtQuoteNumber(q) {
    return q && q.quote_number != null ? 'ORC-' + padNum(q.quote_number) : '—';
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
  }
  function statusInfo(s) {
    return QUOTE_STATUS[s] || { label: s || '—', cls: '' };
  }
  function isExpired(q) {
    if (!q || !q.valid_until) return false;
    if (q.status === 'converted' || q.status === 'cancelled') return false;
    return new Date(q.valid_until + 'T23:59:59') < new Date();
  }
  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  /* =========================================================
     CARREGAR
     ========================================================= */
  async function loadQuotes() {
    try {
      const { data, error } = await window.db
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      state.quotes.list = data || [];
      applyQuoteFilter();
      updateQuotesTabCount();
    } catch (e) {
      console.error('[DEV HUB] loadQuotes:', e);
      state.quotes.list = [];
      applyQuoteFilter();
    }
  }

  function updateQuotesTabCount() {
    const el = document.getElementById('quotes-tab-count');
    if (!el) return;
    const n = state.quotes.list.filter(q =>
      q.status !== 'converted' && q.status !== 'cancelled'
    ).length;
    if (n > 0) { el.textContent = String(n); el.hidden = false; }
    else { el.hidden = true; }
  }

  function applyQuoteFilter() {
    const q = (state.quotes.search || '').toLowerCase().trim();
    if (!q) {
      state.quotes.filtered = state.quotes.list.slice();
    } else {
      state.quotes.filtered = state.quotes.list.filter(item => {
        const cliente = item.customer_name || '';
        const num     = String(item.quote_number || '');
        return cliente.toLowerCase().includes(q) ||
               num.includes(q) ||
               ('orc-' + num).includes(q);
      });
    }
    renderQuotesTable();
  }

  /* =========================================================
     RENDER · TABELA
     ========================================================= */
  function renderQuotesTable() {
    const tbody = document.getElementById('quotes-body');
    const wrap  = document.getElementById('quotes-table-wrap');
    const empty = document.getElementById('quotes-empty');
    if (!tbody || !wrap || !empty) return;

    if (state.quotes.list.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    wrap.hidden = false;

    if (state.quotes.filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="padding:32px;text-align:center;color:var(--text-muted)">Nenhum orçamento encontrado com essa busca.</td></tr>`;
      return;
    }

    tbody.innerHTML = state.quotes.filtered.map(q => {
      const expired = isExpired(q);
      const st = expired ? { label: 'Vencido', cls: 'badge--expired' } : statusInfo(q.status);
      const canConvert = q.status !== 'converted' && q.status !== 'cancelled';
      const canCancel  = q.status !== 'converted' && q.status !== 'cancelled';

      const deposit = utils.toNumber(q.deposit_amount, 0);
      const depositCell = deposit > 0
        ? utils.formatMoney(deposit)
        : '<span style="color:var(--text-muted)">—</span>';

      return `
        <tr data-id="${q.id}">
          <td><span class="sale-number">${fmtQuoteNumber(q)}</span></td>
          <td class="cell--muted">${escapeHTML(q.customer_name || '—')}</td>
          <td class="cell--muted">${fmtDate(q.created_at)}</td>
          <td class="cell--muted">${q.valid_until ? fmtDate(q.valid_until) : '—'}</td>
          <td class="cell--num cell-price">${utils.formatMoney(q.total)}</td>
          <td class="cell--num">${depositCell}</td>
          <td><span class="badge ${st.cls}">${st.label}</span></td>
          <td class="cell--muted">${escapeHTML(q.created_by_name || '—')}</td>
          <td class="cell--num">
            <div class="row-actions">
              <button class="row-action" data-qaction="view" data-id="${q.id}" title="Ver detalhes">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              <button class="row-action" data-qaction="print" data-id="${q.id}" title="Imprimir">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 9V3h12v6"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
              </button>
              ${canConvert ? `
                <button class="row-action" data-qaction="convert" data-id="${q.id}" title="Converter em venda">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                </button>
              ` : ''}
              ${canCancel ? `
                <button class="row-action row-action--danger" data-qaction="cancel" data-id="${q.id}" title="Cancelar orçamento">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-qaction]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const q = state.quotes.list.find(x => x.id === id);
        if (!q) return;
        const a = btn.dataset.qaction;
        if (a === 'view')    return openQuoteDetail(q);
        if (a === 'print')   return window.QuotePrint.print(q);
        if (a === 'convert') return convertQuoteToSale(q);
        if (a === 'cancel')  return cancelQuote(q);
      });
    });
  }

  /* =========================================================
     VER DETALHE
     ========================================================= */
  async function openQuoteDetail(q) {
    try {
      const { data: items, error } = await window.db
        .from('quote_items').select('*').eq('quote_id', q.id).order('created_at');
      if (error) throw error;

      const deposit = utils.toNumber(q.deposit_amount, 0);
      const saldo   = Math.max(0, utils.toNumber(q.total, 0) - deposit);

      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal__backdrop" data-close-modal></div>
        <div class="modal__dialog modal__dialog--lg" role="dialog" aria-modal="true">
          <header class="modal__head">
            <div>
              <h2 class="modal__title">${fmtQuoteNumber(q)}</h2>
              <p style="margin:4px 0 0;font-size:13px;color:var(--text-muted)">
                ${escapeHTML(q.customer_name || 'Sem cliente')} · ${fmtDate(q.created_at)}
              </p>
            </div>
            <button class="icon-btn modal__close" data-close-modal aria-label="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </header>
          <div class="modal__body">
            <h3 style="margin:0;font-size:13px;font-weight:600;text-transform:uppercase;color:var(--text-muted);letter-spacing:.05em">Itens</h3>
            <table class="detail-items-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th class="cell--num">Qtd</th>
                  <th class="cell--num">Preço un.</th>
                  <th class="cell--num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${(items || []).map(it => `
                  <tr>
                    <td>${escapeHTML(it.product_name)}</td>
                    <td class="cell--num">${Number(it.quantity)}</td>
                    <td class="cell--num">${utils.formatMoney(it.unit_price)}</td>
                    <td class="cell--num">${utils.formatMoney(it.subtotal)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="detail-totals">
              <div class="detail-totals__row"><span>Subtotal</span><span>${utils.formatMoney(q.subtotal)}</span></div>
              <div class="detail-totals__row"><span>Desconto</span><span>- ${utils.formatMoney(q.discount)}</span></div>
              <div class="detail-totals__row detail-totals__row--grand"><span>Total</span><span>${utils.formatMoney(q.total)}</span></div>
              ${deposit > 0 ? `
                <div class="detail-totals__row"><span>Sinal</span><span>${utils.formatMoney(deposit)}</span></div>
                <div class="detail-totals__row detail-totals__row--grand"><span>Saldo</span><span>${utils.formatMoney(saldo)}</span></div>
              ` : ''}
            </div>
            ${q.notes ? `<div><strong style="font-size:12px;color:var(--text-muted);text-transform:uppercase">Observações</strong><p style="margin:6px 0 0;font-size:13.5px;color:var(--text-soft);white-space:pre-wrap">${escapeHTML(q.notes)}</p></div>` : ''}
          </div>
          <footer class="modal__foot modal__foot--split">
            <button class="btn btn--ghost" data-close-modal>Fechar</button>
            <div class="modal__foot-actions">
              <button class="btn btn--ghost" data-print>🖨️ Imprimir</button>
              ${q.status !== 'converted' && q.status !== 'cancelled'
                ? '<button class="btn btn--primary" data-convert>Converter em venda</button>' : ''}
            </div>
          </footer>
        </div>`;
      document.body.appendChild(modal);

      const close = () => modal.remove();
      modal.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', close));
      modal.querySelector('[data-print]')?.addEventListener('click', () => window.QuotePrint.print(q, items));
      modal.querySelector('[data-convert]')?.addEventListener('click', () => {
        close();
        convertQuoteToSale(q);
      });
    } catch (e) {
      console.error('[DEV HUB] openQuoteDetail:', e);
      DH.toast('Não foi possível abrir o orçamento.', 'error');
    }
  }

  /* =========================================================
     NOVO ORÇAMENTO
     ========================================================= */
  async function openNewQuote() {
    if (!state.perms.create) {
      DH.toast('Você não tem permissão para criar orçamentos.', 'error');
      return;
    }
    state.editingSaleId = null;
    state.editingSale = null;
    state.correctingSaleId = null;
    state.correctingSale = null;
    state.convertingFromQuote = null;
    state.editingQuoteId = null;
    state.noStock = false;

    if (DH.cart && DH.cart.reset) DH.cart.reset();

    DH.form.setFormMode('quote');
    DH.form.showView('form');

    const validField = document.getElementById('quote-valid-field');
    if (validField) validField.hidden = false;
    const noStockField = document.getElementById('no-stock-field');
    if (noStockField) noStockField.hidden = true;

    const validInput = document.getElementById('sale-valid-until');
    if (validInput) {
      const d = new Date(); d.setDate(d.getDate() + 7);
      validInput.value = d.toISOString().slice(0, 10);
    }

    if (!state.formDataLoaded) await DH.form.loadFormData();
  }

  /* =========================================================
     EDITAR ORÇAMENTO EXISTENTE
     ========================================================= */
  async function openEditQuote(quoteId) {
    if (!state.perms.create) {
      DH.toast('Você não tem permissão para editar orçamentos.', 'error');
      return;
    }

    /* Busca o orçamento */
    const { data: q, error } = await window.db
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .maybeSingle();

    if (error || !q) {
      console.error('[DEV HUB] openEditQuote:', error);
      DH.toast('Orçamento não encontrado.', 'error');
      return;
    }

    if (q.status === 'converted' || q.status === 'cancelled') {
      DH.toast('Este orçamento não pode mais ser editado.', 'info');
      return;
    }

    /* Busca itens */
    const { data: items } = await window.db
      .from('quote_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('created_at');

    /* Limpa estado */
    state.editingSaleId = null;
    state.editingSale = null;
    state.correctingSaleId = null;
    state.correctingSale = null;
    state.convertingFromQuote = null;
    state.editingQuoteId = quoteId;
    state.noStock = false;

    if (DH.cart && DH.cart.reset) DH.cart.reset();

    /* Carrega produtos/clientes */
    if (!state.formDataLoaded) await DH.form.loadFormData();

    /* Popula carrinho */
    state.cart = (items || []).map(it => {
      const p = utils.findProduct(it.product_id);
      return {
        product_id: it.product_id,
        product_name: it.product_name,
        unit_price: utils.toNumber(it.unit_price, 0),
        quantity: utils.toInteger(it.quantity, 0),
        subtotal: utils.toNumber(it.subtotal, 0),
        stock_available: p ? utils.toInteger(p.stock, 0) : 0
      };
    });

    /* Modo e view */
    DH.form.setFormMode('quote_edit', q);
    DH.form.showView('form');

    /* Campos */
    const validField = document.getElementById('quote-valid-field');
    if (validField) validField.hidden = false;
    const noStockField = document.getElementById('no-stock-field');
    if (noStockField) noStockField.hidden = true;

    const f = DH.form.els();
    if (f.customer) f.customer.value = q.customer_id || '';
    if (f.discount) f.discount.value = String(utils.toNumber(q.discount, 0));
    if (f.payment)  f.payment.value  = q.payment_method || '';
    if (f.notes)    f.notes.value    = q.notes || '';
    if (f.discountPct) {
      const sub = utils.toNumber(q.subtotal, 0);
      f.discountPct.value = sub > 0
        ? String(utils.round2(utils.toNumber(q.discount, 0) / sub * 100))
        : '0';
    }
    state.lastDiscountEdit = 'brl';

    const validInput = document.getElementById('sale-valid-until');
    if (validInput && q.valid_until) validInput.value = q.valid_until;

    const depositEl = document.getElementById('sale-deposit');
    if (depositEl) depositEl.value = String(utils.toNumber(q.deposit_amount, 0));

    DH.cart.render();
    DH.cart.recalc();

    DH.toast('Orçamento carregado para edição.', 'info');
  }

  /* =========================================================
     SALVAR (criar ou editar)
     ========================================================= */
  async function saveQuote(payload) {
    const validInput = document.getElementById('sale-valid-until');
    const validUntil = validInput ? validInput.value || null : null;

    /* Se tem editingQuoteId, é update */
    if (state.editingQuoteId) {
      const { data, error } = await window.db
        .from('quotes')
        .update({
          customer_id:      payload.customer_id,
          subtotal:         payload.subtotal,
          discount:         payload.discount,
          total:            payload.total,
          payment_method:   payload.payment_method,
          notes:            payload.notes,
          valid_until:      validUntil,
          deposit_amount:   payload.deposit_amount || 0
        })
        .eq('id', state.editingQuoteId)
        .select()
        .single();

      if (error) throw error;

      /* Deleta itens antigos e insere os novos */
      await window.db.from('quote_items').delete().eq('quote_id', state.editingQuoteId);

      if (payload.items && payload.items.length > 0) {
        const items = payload.items.map(it => ({
          quote_id:      state.editingQuoteId,
          product_id:    it.product_id,
          product_name:  it.product_name,
          quantity:      it.quantity,
          unit_price:    it.unit_price,
          subtotal:      it.subtotal
        }));
        const { error: itemsErr } = await window.db.from('quote_items').insert(items);
        if (itemsErr) throw itemsErr;
      }

      state.editingQuoteId = null;
      return data;
    }

    /* Senão, é criação */
    const { data, error } = await window.db.rpc('create_quote', {
      p_customer_id:    payload.customer_id,
      p_subtotal:       payload.subtotal,
      p_discount:       payload.discount,
      p_total:          payload.total,
      p_payment_method: payload.payment_method,
      p_notes:          payload.notes,
      p_valid_until:    validUntil,
      p_items:          payload.items,
      p_deposit_amount: payload.deposit_amount || 0
    });
    if (error) throw error;

    return Array.isArray(data) ? data[0] : data;
  }

  /* =========================================================
     CANCELAR / CONVERTER
     ========================================================= */
  function cancelQuote(q) {
    const reason = window.prompt('Motivo do cancelamento (opcional):', '');
    if (reason === null) return;
    executeCancel(q, reason);
  }

  async function executeCancel(q, reason) {
    try {
      const { error } = await window.db.rpc('update_quote_status', {
        p_quote_id: q.id,
        p_status: 'cancelled',
        p_reason: reason || ''
      });
      if (error) throw error;
      DH.toast('Orçamento cancelado.', 'info');
      await loadQuotes();
    } catch (e) {
      console.error('[DEV HUB] cancelQuote:', e);
      DH.toast(DH.mapSaleError(e), 'error');
    }
  }

  async function convertQuoteToSale(q) {
    if (q.status === 'converted' || q.status === 'cancelled') {
      DH.toast('Este orçamento não pode mais ser convertido.', 'info');
      return;
    }

    const { data: items, error } = await window.db
      .from('quote_items').select('*').eq('quote_id', q.id).order('created_at');
    if (error) {
      DH.toast('Erro ao carregar itens do orçamento.', 'error');
      return;
    }

    if (!state.formDataLoaded) await DH.form.loadFormData();

    state.cart = (items || []).map(it => {
      const p = utils.findProduct(it.product_id);
      return {
        product_id: it.product_id,
        product_name: it.product_name,
        unit_price: utils.toNumber(it.unit_price, 0),
        quantity: utils.toInteger(it.quantity, 0),
        subtotal: utils.toNumber(it.subtotal, 0),
        stock_available: p ? utils.toInteger(p.stock, 0) : 0
      };
    });

    const temSemEstoque = state.cart.some(it => it.quantity > it.stock_available);

    state.convertingFromQuote = q;
    state.editingSaleId = null;
    state.editingSale = null;
    state.correctingSaleId = null;
    state.correctingSale = null;
    state.noStock = temSemEstoque;

    DH.form.setFormMode('from_quote', q);
    DH.form.showView('form');

    const validField = document.getElementById('quote-valid-field');
    if (validField) validField.hidden = true;
    const noStockField = document.getElementById('no-stock-field');
    if (noStockField) noStockField.hidden = false;

    const noStockEl = document.getElementById('sale-no-stock');
    if (noStockEl) noStockEl.checked = temSemEstoque;

    const f = DH.form.els();
    if (f.customer) f.customer.value = q.customer_id || '';
    if (f.discount) f.discount.value = String(utils.toNumber(q.discount, 0));
    if (f.payment)  f.payment.value  = q.payment_method || '';
    if (f.notes)    f.notes.value    = q.notes || '';
    if (f.discountPct) {
      const sub = utils.toNumber(q.subtotal, 0);
      f.discountPct.value = sub > 0
        ? String(utils.round2(utils.toNumber(q.discount, 0) / sub * 100))
        : '0';
    }
    state.lastDiscountEdit = 'brl';

    const depositEl = document.getElementById('sale-deposit');
    if (depositEl) depositEl.value = String(utils.toNumber(q.deposit_amount, 0));

    DH.cart.render();
    DH.cart.recalc();

    if (temSemEstoque) {
      DH.toast(
        'Orçamento convertido. Há itens sem estoque — a venda irá para aprovação do gestor.',
        'info'
      );
    }
  }

  function markQuoteConverted(saleId) {
    const q = state.convertingFromQuote;
    if (!q || !saleId) return Promise.resolve();
    return window.db.rpc('link_quote_to_sale', {
      p_quote_id: q.id,
      p_sale_id: saleId
    }).then(({ error }) => {
      if (error) console.warn('[DEV HUB] link_quote_to_sale:', error);
    });
  }

  /* =========================================================
     TABS
     ========================================================= */
  function setupTabs() {
    document.querySelectorAll('.sales-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(tab) {
    state.quotes.tab = tab;
    document.querySelectorAll('.sales-tab').forEach(b => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });

    const isSales = tab === 'sales';

    const titleEl = document.getElementById('sales-title');
    const countEl = document.getElementById('sales-count');
    if (titleEl) titleEl.textContent = isSales ? 'Todas as vendas' : 'Todos os orçamentos';
    if (countEl) countEl.textContent = isSales
      ? (state.sales.length === 1 ? '1 venda' : state.sales.length + ' vendas')
      : (state.quotes.list.length === 1 ? '1 orçamento' : state.quotes.list.length + ' orçamentos');

    const emptyEl   = document.getElementById('sales-empty');
    const qEmptyEl  = document.getElementById('quotes-empty');
    const tableEl   = document.getElementById('sales-table-wrap');
    const qTableEl  = document.getElementById('quotes-table-wrap');
    const loadingEl = document.getElementById('sales-loading');

    if (emptyEl)   emptyEl.hidden   = !isSales || state.sales.length > 0;
    if (qEmptyEl)  qEmptyEl.hidden  = isSales  || state.quotes.list.length > 0;
    if (tableEl)   tableEl.hidden   = !isSales || state.sales.length === 0;
    if (qTableEl)  qTableEl.hidden  = isSales  || state.quotes.list.length === 0;
    if (loadingEl) loadingEl.hidden = true;

    const search = document.getElementById('search-input');
    if (search) search.placeholder = isSales ? 'Buscar vendas...' : 'Buscar orçamentos...';

    const newSaleBtn  = document.getElementById('new-sale-btn');
    const newQuoteBtn = document.getElementById('new-quote-btn');
    const apprBtn     = document.getElementById('approvals-btn');

    if (newSaleBtn)  newSaleBtn.hidden  = !isSales;
    if (newQuoteBtn) newQuoteBtn.hidden = isSales;
    if (apprBtn)     apprBtn.hidden     = !isSales || !state.perms.approve;

    if (isSales) DH.list.renderSalesTable();
    else         renderQuotesTable();
  }

  /* =========================================================
     INIT
     ========================================================= */
  function setup() {
    setupTabs();

    const newQuoteBtn   = document.getElementById('new-quote-btn');
    const emptyQuoteBtn = document.getElementById('empty-new-quote-btn');
    if (newQuoteBtn)   newQuoteBtn.addEventListener('click', openNewQuote);
    if (emptyQuoteBtn) emptyQuoteBtn.addEventListener('click', openNewQuote);

    const search = document.getElementById('search-input');
    if (search) {
      search.addEventListener('input', () => {
        const v = search.value.trim();
        if (state.quotes.tab === 'sales') {
          state.search = v.toLowerCase();
          DH.list.applyFilter();
        } else {
          state.quotes.search = v;
          applyQuoteFilter();
        }
      });
    }
  }

  DH.quotes = {
    setup,
    loadQuotes,
    openNewQuote,
    openEditQuote,
    saveQuote,
    convertQuoteToSale,
    markQuoteConverted,
    switchTab,
    renderQuotesTable,
    applyQuoteFilter,
    fmtQuoteNumber,
    statusInfo,
    isExpired
  };
})();