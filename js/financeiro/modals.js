/* =========================================================
   DEV HUB · Financeiro · modals
   ---------------------------------------------------------
   Modais de baixa, estorno e transferência entre contas.
   Inclui o setup do drawer de filtros.
   ---------------------------------------------------------
   Depende de: state.js
   Publica em: window.Fin
   ========================================================= */

(function () {
  'use strict';

  const {
    $, $$, escapeHTML,
    fmtBRL, fmtDate, parseBRLToCents, todayISO,
    db, toast,
    state,
    STATUS_LABEL, PAYMENT_METHODS
  } = window.Fin;

  /* =========================================================
     DRAWER DE FILTROS
     ========================================================= */
  function setupDrawer() {
    const drawer  = document.getElementById('fin-filters-drawer');
    const openBtn = document.getElementById('fin-open-filters');
    if (!drawer || !openBtn) return;

    const openDrawer = () => {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      openBtn.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => {
        const focusable = drawer.querySelector('.fin-custom__name, .fin-side__acc-search, .fin-drawer__close');
        if (focusable) focusable.focus({ preventScroll: true });
      });
    };

    const closeDrawer = () => {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      openBtn.setAttribute('aria-expanded', 'false');
    };

    openBtn.addEventListener('click', openDrawer);
    drawer.querySelectorAll('[data-drawer-close]').forEach((el) => {
      el.addEventListener('click', closeDrawer);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
    });

    window.FinCloseDrawer = closeDrawer;
  }

  /* =========================================================
     MODAL · BAIXA
     ========================================================= */
  function openSettleModal(entry) {
    if (window.Fin.isPurchaseBlocked(entry)) {
      toast('Esta conta só pode ser baixada após a entrega da compra.', 'error');
      return;
    }

    const balance = Number(entry.current_balance_cents || (entry.amount_cents - (entry.paid_cents || 0)));
    const modal = document.createElement('div');
    modal.className = 'fin-modal';
    modal.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog fin-modal__dialog--lg">
        <header class="fin-modal__head">
          <div>
            <h3 class="fin-modal__title">${entry.kind === 'receita' ? 'Receber' : 'Baixar'} título</h3>
            <p style="margin:4px 0 0;font-size:13px;color:var(--text-soft)">
              ${escapeHTML(entry.title_code || entry.doc_number || '')}
              · ${escapeHTML(entry.partner_name || 'Sem parceiro')}
            </p>
          </div>
          <button class="fin-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>
        <div class="fin-modal__body">
          <div class="sp-header">
            <div class="sp-header__title">Saldo atual do título</div>
            <div class="sp-header__value">${fmtBRL(balance)}</div>
          </div>
          <div class="fin-grid fin-grid--4 sp-grid">
            <div class="fin-field"><label>Valor a baixar</label>
              <input type="text" id="sp-amount" value="${(balance / 100).toFixed(2).replace('.', ',')}" /></div>
            <div class="fin-field"><label>Desconto</label>
              <input type="text" id="sp-discount" value="0,00" /></div>
            <div class="fin-field"><label>Juros</label>
              <input type="text" id="sp-interest" value="0,00" /></div>
            <div class="fin-field"><label>Multa</label>
              <input type="text" id="sp-penalty" value="0,00" /></div>
          </div>
          <div class="fin-grid fin-grid--2">
            <div class="fin-field"><label>Data da baixa</label>
              <input type="date" id="sp-date" value="${todayISO()}" /></div>
            <div class="fin-field"><label>Tarifa bancária</label>
              <input type="text" id="sp-fee" value="0,00" /></div>
          </div>
          <div class="fin-section-title" style="margin-top:8px">Formas de pagamento</div>
          <div class="sp-lines" id="sp-lines">
            <div class="sp-lines__head">
              <span>Método</span><span>Conta bancária</span>
              <span style="text-align:right">Valor</span><span></span>
            </div>
            <div id="sp-lines-body"></div>
          </div>
          <button type="button" class="sp-add" id="sp-add">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <path d="M12 5v14M5 12h14"/></svg>
            Adicionar forma de pagamento
          </button>
          <div class="sp-summary">
            <span class="sp-summary__label">Total das formas</span>
            <span class="sp-summary__value" id="sp-total">R$ 0,00</span>
          </div>
          <div class="fin-field"><label>Observações</label>
            <input type="text" id="sp-notes" placeholder="Opcional" /></div>
          <div id="sp-error" hidden class="fin-err"></div>
        </div>
        <footer class="fin-modal__foot">
          <button type="button" class="fin-btn fin-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="fin-btn fin-btn--primary" id="sp-confirm">Confirmar baixa</button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    const linesBody = modal.querySelector('#sp-lines-body');
    const totalEl   = modal.querySelector('#sp-total');
    const amountEl  = modal.querySelector('#sp-amount');

    const accountOptions = state.accounts.length
      ? state.accounts.map((a) => `<option value="${a.id}">${escapeHTML(a.name)}</option>`).join('')
      : '<option value="">— Nenhuma conta cadastrada —</option>';
    const methodOptions = Object.entries(PAYMENT_METHODS)
      .map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

    function buildLine(defaultAmountCents) {
      const row = document.createElement('div');
      row.className = 'sp-lines__row';
      row.innerHTML = `
        <select data-field="method">${methodOptions}</select>
        <select data-field="account">
          <option value="">— Sem conta —</option>
          ${accountOptions}
        </select>
        <input type="text" data-field="amount" value="${(defaultAmountCents / 100).toFixed(2).replace('.', ',')}" />
        <button type="button" class="sp-lines__remove" data-action="remove" title="Remover">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>`;
      row.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', recalc));
      row.querySelector('[data-action="remove"]').addEventListener('click', () => { row.remove(); recalc(); });
      return row;
    }
    function addLine(cents) { linesBody.appendChild(buildLine(cents || 0)); recalc(); }
    function recalc() {
      let sum = 0;
      linesBody.querySelectorAll('.sp-lines__row').forEach((row) => {
        sum += parseBRLToCents(row.querySelector('[data-field="amount"]').value);
      });
      const target = parseBRLToCents(amountEl.value);
      totalEl.textContent = fmtBRL(sum);
      const ok = sum === target;
      totalEl.classList.toggle('sp-summary__value--ok', ok);
      totalEl.classList.toggle('sp-summary__value--err', !ok);
    }

    amountEl.addEventListener('input', recalc);
    modal.querySelector('#sp-add').addEventListener('click', () => addLine(0));
    addLine(balance);

    modal.querySelector('#sp-confirm').addEventListener('click', async () => {
      const err = modal.querySelector('#sp-error');
      err.hidden = true;
      const amount = parseBRLToCents(amountEl.value);
      const disc   = parseBRLToCents(modal.querySelector('#sp-discount').value);
      const intr   = parseBRLToCents(modal.querySelector('#sp-interest').value);
      const pen    = parseBRLToCents(modal.querySelector('#sp-penalty').value);
      const fee    = parseBRLToCents(modal.querySelector('#sp-fee').value);
      const date   = modal.querySelector('#sp-date').value;
      const notes  = modal.querySelector('#sp-notes').value.trim();

      if (amount <= 0) { err.textContent = 'Valor a baixar deve ser maior que zero.'; err.hidden = false; return; }
      const items = [];
      let sumItems = 0;
      linesBody.querySelectorAll('.sp-lines__row').forEach((row) => {
        const method = row.querySelector('[data-field="method"]').value;
        const accId  = row.querySelector('[data-field="account"]').value || null;
        const val    = parseBRLToCents(row.querySelector('[data-field="amount"]').value);
        if (val > 0) { items.push({ method, account_id: accId, amount_cents: val }); sumItems += val; }
      });
      if (items.length === 0) { err.textContent = 'Adicione ao menos uma forma de pagamento.'; err.hidden = false; return; }
      if (sumItems !== amount) {
        err.textContent = `Soma das formas (${fmtBRL(sumItems)}) difere do valor a baixar (${fmtBRL(amount)}).`;
        err.hidden = false; return;
      }
      const cleared = Math.max(0, amount + disc - intr - pen - fee);
      const btn = modal.querySelector('#sp-confirm');
      btn.disabled = true;
      try {
        const { data, error } = await db().rpc('settle_title', {
          p_title_id: entry.id, p_amount_cents: amount, p_cleared_cents: cleared,
          p_discount_cents: disc, p_interest_cents: intr, p_penalty_cents: pen,
          p_fee_cents: fee, p_settlement_date: date, p_items: items, p_notes: notes || null
        });
        if (error) throw error;
        toast(`Baixa registrada! Status: ${STATUS_LABEL[data.status] || data.status}`);
        close(); await window.Fin.loadAll?.();
      } catch (e) {
        console.error(e);
        let msg = e.message || 'Erro ao baixar o título.';
        if (msg.includes('ainda não foi entregue') || msg.includes('23514')) {
          msg = 'Esta conta só pode ser baixada após a entrega da compra.';
        }
        err.textContent = msg;
        err.hidden = false;
        btn.disabled = false;
      }
    });
  }

  /* =========================================================
     MODAL · ESTORNO
     ========================================================= */
  async function openReverseModal(entry) {
    let lastSettlement = null;
    try {
      const { data } = await db().from('financial_settlements')
        .select('*').eq('entry_id', entry.id).eq('action', 'baixa')
        .order('created_at', { ascending: false }).limit(1);
      lastSettlement = data && data[0] ? data[0] : null;
    } catch (e) { console.error(e); }
    if (!lastSettlement) { toast('Nenhuma baixa encontrada para estornar.', 'error'); return; }

    const modal = document.createElement('div');
    modal.className = 'fin-modal';
    modal.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog">
        <header class="fin-modal__head">
          <h3 class="fin-modal__title">Estornar baixa</h3>
          <button class="fin-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>
        <div class="fin-modal__body">
          <p style="margin:0;font-size:13.5px;color:var(--text-soft)">
            Baixa de <strong>${fmtBRL(lastSettlement.amount_cents)}</strong>
            em ${fmtDate(lastSettlement.settlement_date)}.
            O título voltará para pendente e a movimentação será revertida.
          </p>
          <div class="fin-field">
            <label>Motivo do estorno *</label>
            <textarea id="r-reason" rows="3" placeholder="Ex.: baixa em duplicidade, valor incorreto..."
              style="width:100%;min-height:80px;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14.5px;resize:vertical"></textarea>
          </div>
          <div id="r-error" hidden class="fin-err"></div>
        </div>
        <footer class="fin-modal__foot">
          <button type="button" class="fin-btn fin-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="fin-btn fin-btn--danger" id="r-confirm">Confirmar estorno</button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
    const reasonEl = modal.querySelector('#r-reason');
    reasonEl.focus();

    modal.querySelector('#r-confirm').addEventListener('click', async () => {
      const err = modal.querySelector('#r-error');
      err.hidden = true;
      const reason = reasonEl.value.trim();
      if (reason.length < 5) { err.textContent = 'Motivo muito curto.'; err.hidden = false; return; }
      const btn = modal.querySelector('#r-confirm');
      btn.disabled = true;
      try {
        const { error } = await db().rpc('reverse_settlement_v2', {
          p_settlement_id: lastSettlement.id, p_reason: reason
        });
        if (error) throw error;
        close(); toast('Estorno registrado.'); await window.Fin.loadAll?.();
      } catch (e) {
        console.error(e);
        err.textContent = e.message;
        err.hidden = false;
        btn.disabled = false;
      }
    });
  }

  /* =========================================================
     MODAL · TRANSFERÊNCIA
     ========================================================= */
  function openTransferModal() {
    if (!state.accounts.length) { toast('Cadastre contas bancárias antes de transferir.', 'error'); return; }
    const accountOptions = state.accounts.map((a) =>
      `<option value="${a.id}">${escapeHTML(a.name)} — ${fmtBRL(a.current_balance_cents)}</option>`
    ).join('');

    const modal = document.createElement('div');
    modal.className = 'fin-modal';
    modal.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog">
        <header class="fin-modal__head">
          <h3 class="fin-modal__title">Nova transferência</h3>
          <button class="fin-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>
        <div class="fin-modal__body">
          <div class="fin-grid fin-grid--2">
            <div class="fin-field"><label>De (origem) *</label><select id="t-from">${accountOptions}</select></div>
            <div class="fin-field"><label>Para (destino) *</label><select id="t-to">${accountOptions}</select></div>
          </div>
          <div class="fin-grid fin-grid--2">
            <div class="fin-field"><label>Valor *</label><input type="text" id="t-amount" placeholder="0,00" /></div>
            <div class="fin-field"><label>Data *</label><input type="date" id="t-date" value="${todayISO()}" /></div>
          </div>
          <div class="fin-field"><label>Descrição</label>
            <input type="text" id="t-desc" placeholder="Ex.: Transferência para conta salário" /></div>
          <div id="t-error" hidden class="fin-err"></div>
        </div>
        <footer class="fin-modal__foot">
          <button type="button" class="fin-btn fin-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="fin-btn fin-btn--primary" id="t-confirm">Transferir</button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    const fromEl = modal.querySelector('#t-from');
    const toEl   = modal.querySelector('#t-to');
    toEl.value = state.accounts.find((a) => a.id !== fromEl.value)?.id || '';
    fromEl.addEventListener('change', () => {
      if (fromEl.value === toEl.value) {
        const alt = state.accounts.find((a) => a.id !== fromEl.value);
        if (alt) toEl.value = alt.id;
      }
    });

    modal.querySelector('#t-confirm').addEventListener('click', async () => {
      const err = modal.querySelector('#t-error'); err.hidden = true;
      const from = fromEl.value; const to = toEl.value;
      const amount = parseBRLToCents(modal.querySelector('#t-amount').value);
      const date = modal.querySelector('#t-date').value;
      const desc = modal.querySelector('#t-desc').value.trim();
      if (from === to) { err.textContent = 'Conta de origem e destino devem ser diferentes.'; err.hidden = false; return; }
      if (amount <= 0) { err.textContent = 'Informe um valor válido.'; err.hidden = false; return; }
      const btn = modal.querySelector('#t-confirm'); btn.disabled = true;
      try {
        const { error } = await db().rpc('transfer_between_accounts', {
          p_from_account_id: from, p_to_account_id: to, p_amount_cents: amount,
          p_transfer_date: date, p_description: desc || null
        });
        if (error) throw error;
        close(); toast('Transferência registrada.'); await window.Fin.loadAll?.();
      } catch (e) {
        console.error(e);
        err.textContent = e.message;
        err.hidden = false;
        btn.disabled = false;
      }
    });
  }

  /* =========================================================
     PUBLICA
     ========================================================= */
  Object.assign(window.Fin, {
    setupDrawer,
    openSettleModal,
    openReverseModal,
    openTransferModal
  });

})();