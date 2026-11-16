/* =========================================================
   DEV HUB · Financeiro · modals
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
    };

    const closeDrawer = () => {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      openBtn.setAttribute('aria-expanded', 'false');
    };

    openBtn.addEventListener('click', openDrawer);
    drawer.querySelectorAll('[data-drawer-close]').forEach((el) => el.addEventListener('click', closeDrawer));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
    });

    window.FinCloseDrawer = closeDrawer;
  }

  /* =========================================================
     MODAL · BAIXA (BAIXAR TÍTULO)
     ========================================================= */
  function openSettleModal(entry) {
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
              ${escapeHTML(entry.title_code || entry.doc_number || '')} · ${escapeHTML(entry.partner_name || 'Sem parceiro')}
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
            <div class="sp-lines__head"><span>Método</span><span>Conta bancária</span><span style="text-align:right">Valor</span><span></span></div>
            <div id="sp-lines-body"></div>
          </div>
          <button type="button" class="sp-add" id="sp-add">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Adicionar forma de pagamento
          </button>
          <div class="sp-summary">
            <span class="sp-summary__label">Total das formas</span>
            <span class="sp-summary__value" id="sp-total">R$ 0,00</span>
          </div>
          <div id="sp-error" hidden class="fin-err"></div>
        </div>
        <footer class="fin-modal__foot">
          <button type="button" class="fin-btn fin-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="fin-btn fin-btn--primary" id="sp-confirm">Confirmar baixa</button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    // --- INICIALIZA TOM SELECT ---
    setTimeout(() => {
      modal.querySelectorAll('select').forEach(select => {
        if (!select.tomselect && window.TomSelect) {
          new window.TomSelect(select, { create: false });
        }
      });
    }, 50);
    // -----------------------------

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    const linesBody = modal.querySelector('#sp-lines-body');
    const totalEl   = modal.querySelector('#sp-total');
    const amountEl  = modal.querySelector('#sp-amount');

    const accountOptions = state.accounts.length
      ? state.accounts.map((a) => `<option value="${a.id}">${escapeHTML(a.name)}</option>`).join('')
      : '<option value="">— Nenhuma conta cadastrada —</option>';
    const methodOptions = Object.entries(PAYMENT_METHODS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

    function buildLine(defaultAmountCents) {
      const row = document.createElement('div');
      row.className = 'sp-lines__row';
      row.innerHTML = `
        <select data-field="method">${methodOptions}</select>
        <select data-field="account"><option value="">— Sem conta —</option>${accountOptions}</select>
        <input type="text" data-field="amount" value="${(defaultAmountCents / 100).toFixed(2).replace('.', ',')}" />
        <button type="button" class="sp-lines__remove" data-action="remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
      
      row.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', recalc));
      row.querySelector('[data-action="remove"]').addEventListener('click', () => { row.remove(); recalc(); });
      
      // Inicializa TomSelect nas novas linhas
      row.querySelectorAll('select').forEach(select => {
        if (window.TomSelect) new window.TomSelect(select, { create: false });
      });

      return row;
    }
    function addLine(cents) { linesBody.appendChild(buildLine(cents || 0)); recalc(); }
    function recalc() {
      let sum = 0;
      linesBody.querySelectorAll('.sp-lines__row').forEach((row) => { sum += parseBRLToCents(row.querySelector('[data-field="amount"]').value); });
      const target = parseBRLToCents(amountEl.value);
      totalEl.textContent = fmtBRL(sum);
      totalEl.className = 'sp-summary__value ' + (sum === target ? 'sp-summary__value--ok' : 'sp-summary__value--err');
    }

    amountEl.addEventListener('input', recalc);
    modal.querySelector('#sp-add').addEventListener('click', () => addLine(0));
    addLine(balance);

    modal.querySelector('#sp-confirm').addEventListener('click', async () => {
      const err = modal.querySelector('#sp-error');
      err.hidden = true;
      const amount = parseBRLToCents(amountEl.value);
      const date   = modal.querySelector('#sp-date').value;
      const items = [];
      let sumItems = 0;
      
      linesBody.querySelectorAll('.sp-lines__row').forEach((row) => {
        const method = row.querySelector('[data-field="method"]').value;
        const accId  = row.querySelector('[data-field="account"]').value || null;
        const val    = parseBRLToCents(row.querySelector('[data-field="amount"]').value);
        if (val > 0) { items.push({ method, account_id: accId, amount_cents: val }); sumItems += val; }
      });
      
      if (items.length === 0) { err.textContent = 'Adicione uma forma de pagamento.'; err.hidden = false; return; }
      if (sumItems !== amount) { err.textContent = 'A soma das formas difere do valor.'; err.hidden = false; return; }
      
      const btn = modal.querySelector('#sp-confirm');
      btn.disabled = true; btn.textContent = 'Processando...';
      
      try {
        const { data, error } = await db().rpc('settle_title', {
          p_title_id: entry.id, p_amount_cents: amount, p_cleared_cents: amount,
          p_discount_cents: 0, p_interest_cents: 0, p_penalty_cents: 0,
          p_fee_cents: 0, p_settlement_date: date, p_items: items, p_notes: 'Baixa manual'
        });
        if (error) throw error;
        toast(`Baixa registrada! Status: ${STATUS_LABEL[data.status] || data.status}`, 'success');
        close(); await window.Fin.loadTitulos?.();
      } catch (e) {
        console.error('[fin] erro ao baixar:', e);
        err.textContent = e.message || 'Erro ao baixar o título.';
        err.hidden = false;
        btn.disabled = false; btn.textContent = 'Confirmar baixa';
      }
    });
  }

  /* =========================================================
     MODAL · ESTORNO
     ========================================================= */
  async function openReverseModal(entry) {
    let lastSettlement = null;
    try {
      const { data, error } = await db().from('financial_settlements')
        .select('*').eq('entry_id', entry.id).eq('action', 'baixa')
        .order('created_at', { ascending: false }).limit(1);
      lastSettlement = data && data[0] ? data[0] : null;
    } catch (e) { console.error(e); }

    const dataBaixa = lastSettlement ? lastSettlement.settlement_date : (entry.settlement_date || todayISO());
    const valorBaixa = lastSettlement ? lastSettlement.amount_cents : (entry.paid_cents || entry.amount_cents);

    const modal = document.createElement('div');
    modal.className = 'fin-modal';
    modal.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog">
        <header class="fin-modal__head">
          <h3 class="fin-modal__title">Estornar baixa</h3>
          <button class="fin-modal__close" data-close><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </header>
        <div class="fin-modal__body">
          <p style="margin:0;font-size:13.5px;color:var(--text-soft)">
            Baixa de <strong>${fmtBRL(valorBaixa)}</strong> em ${fmtDate(dataBaixa)}.<br>
            O título voltará para <strong>Pendente</strong>.
          </p>
          <div class="fin-field" style="margin-top:16px;">
            <label>Motivo do estorno *</label>
            <textarea id="r-reason" rows="3" placeholder="Ex.: baixa em duplicidade, valor incorreto..."></textarea>
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
        const { error } = await db().rpc('reverse_settlement_v2', { p_settlement_id: lastSettlement.id, p_reason: reason });
        if (error) throw error;
        close(); toast('Estorno registrado.'); await window.Fin.loadTitulos?.();
      } catch (e) {
        console.error(e); err.textContent = e.message; err.hidden = false; btn.disabled = false;
      }
    });
  }

  /* =========================================================
     MODAL · TRANSFERÊNCIA
     ========================================================= */
  function openTransferModal() {
    if (!state.accounts.length) { toast('Cadastre contas bancárias antes de transferir.', 'error'); return; }
    const accountOptions = state.accounts.map((a) => `<option value="${a.id}">${escapeHTML(a.name)} — ${fmtBRL(a.current_balance_cents)}</option>`).join('');

    const modal = document.createElement('div');
    modal.className = 'fin-modal';
    modal.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog">
        <header class="fin-modal__head">
          <h3 class="fin-modal__title">Nova transferência</h3>
          <button class="fin-modal__close" data-close><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
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
          <div class="fin-field"><label>Descrição</label><input type="text" id="t-desc" placeholder="Ex.: Transferência para conta salário" /></div>
          <div id="t-error" hidden class="fin-err"></div>
        </div>
        <footer class="fin-modal__foot">
          <button type="button" class="fin-btn fin-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="fin-btn fin-btn--primary" id="t-confirm">Transferir</button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    // --- INICIALIZA TOM SELECT ---
    setTimeout(() => {
      modal.querySelectorAll('select').forEach(select => {
        if (!select.tomselect && window.TomSelect) {
          new window.TomSelect(select, { create: false });
        }
      });
    }, 50);
    // -----------------------------

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
      if (from === to) { err.textContent = 'Contas devem ser diferentes.'; err.hidden = false; return; }
      if (amount <= 0) { err.textContent = 'Informe um valor válido.'; err.hidden = false; return; }
      const btn = modal.querySelector('#t-confirm'); btn.disabled = true;
      try {
        const { error } = await db().rpc('transfer_between_accounts', { p_from_account_id: from, p_to_account_id: to, p_amount_cents: amount, p_transfer_date: date, p_description: desc || null });
        if (error) throw error;
        close(); toast('Transferência registrada.'); await window.Fin.loadTitulos?.();
      } catch (e) {
        console.error(e); err.textContent = e.message; err.hidden = false; btn.disabled = false;
      }
    });
  }

  /* =========================================================
     MODAL · RATEAR
     ========================================================= */
  function openRatearModal(entry) {
    const total = Number(entry.current_balance_cents || entry.amount_cents);
    
    const modal = document.createElement('div');
    modal.className = 'fin-modal';
    modal.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog">
        <header class="fin-modal__head">
          <h3 class="fin-modal__title">Ratear Título</h3>
          <button class="fin-modal__close" data-close><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </header>
        <div class="fin-modal__body">
          <p style="font-size:13.5px; color:var(--text-soft); margin-bottom:16px;">
            Divida o valor de <strong>${fmtBRL(total)}</strong> entre diferentes centros de custo.
          </p>
          
          <div id="ratear-lines" style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;"></div>
          
          <button type="button" class="fin-btn fin-btn--ghost" id="ratear-add" style="width:100%; border:1px dashed var(--border);">+ Adicionar Centro de Custo</button>
          
          <div style="display:flex; justify-content:space-between; margin-top:20px; padding-top:16px; border-top:1px solid var(--border);">
            <span style="font-weight:600;">Total Rateado:</span>
            <span id="ratear-total" style="font-weight:700; color:var(--danger);">R$ 0,00</span>
          </div>
          <div id="ratear-error" hidden class="fin-err" style="margin-top:12px;"></div>
        </div>
        <footer class="fin-modal__foot">
          <button type="button" class="fin-btn fin-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="fin-btn fin-btn--primary" id="ratear-confirm">Salvar Rateio</button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
    
    const linesWrap = modal.querySelector('#ratear-lines');
    const totalEl = modal.querySelector('#ratear-total');

    function addLine() {
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.gap = '10px';
      div.innerHTML = `
        <input type="text" class="ratear-cc" placeholder="Centro de Custo" style="flex:2; padding:8px; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text);" />
        <input type="text" class="ratear-val" placeholder="0,00" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text);" />
        <button type="button" class="fin-btn fin-btn--ghost" style="padding:0 10px; color:var(--danger);" onclick="this.parentElement.remove(); window.calcRateio()">X</button>
      `;
      linesWrap.appendChild(div);
      div.querySelector('.ratear-val').addEventListener('input', calcRateio);
    }

    window.calcRateio = function() {
      let sum = 0;
      linesWrap.querySelectorAll('.ratear-val').forEach(inp => {
        sum += parseBRLToCents(inp.value);
      });
      totalEl.textContent = fmtBRL(sum);
      totalEl.style.color = (sum === total) ? 'var(--success)' : 'var(--danger)';
    };

    modal.querySelector('#ratear-add').addEventListener('click', addLine);
    addLine();

    modal.querySelector('#ratear-confirm').addEventListener('click', async () => {
      const err = modal.querySelector('#ratear-error');
      err.hidden = true;
      
      let sum = 0;
      const rateios = [];
      linesWrap.querySelectorAll('div').forEach(div => {
        const cc = div.querySelector('.ratear-cc').value.trim();
        const val = parseBRLToCents(div.querySelector('.ratear-val').value);
        if (cc && val > 0) {
          rateios.push({ cc, val });
          sum += val;
        }
      });

      if (sum !== total) { err.textContent = 'A soma dos rateios deve ser igual ao valor total do título.'; err.hidden = false; return; }

      const btn = modal.querySelector('#ratear-confirm');
      btn.disabled = true; btn.textContent = 'Salvando...';

      try {
        const rateioText = rateios.map(r => `${r.cc}: ${fmtBRL(r.val)}`).join(' | ');
        const newNotes = (entry.notes ? entry.notes + '\n' : '') + 'Rateio: ' + rateioText;

        const { error } = await db().from('financial_entries').update({ notes: newNotes }).eq('id', entry.id);
        if (error) throw error;

        toast('Rateio salvo com sucesso.', 'success');
        close();
        await window.Fin.loadTitulos?.();
      } catch (e) {
        err.textContent = e.message; err.hidden = false; btn.disabled = false; btn.textContent = 'Salvar Rateio';
      }
    });
  }

  /* =========================================================
     MODAL · PARCELAR
     ========================================================= */
  function openParcelarModal(entry) {
    const total = Number(entry.current_balance_cents || entry.amount_cents);
    
    const modal = document.createElement('div');
    modal.className = 'fin-modal';
    modal.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog">
        <header class="fin-modal__head">
          <h3 class="fin-modal__title">Parcelar Título</h3>
          <button class="fin-modal__close" data-close><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </header>
        <div class="fin-modal__body">
          <p style="font-size:13.5px; color:var(--text-soft); margin-bottom:16px;">
            O título original será <strong>substituído</strong> por novas parcelas mensais a partir da data de vencimento atual.
          </p>
          
          <div class="fin-field">
            <label>Quantidade de Parcelas</label>
            <input type="number" id="parc-qtd" value="2" min="2" max="48" style="padding:10px; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text); width:100%;" />
          </div>

          <div style="margin-top:20px; padding:16px; background:var(--surface-2); border-radius:8px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
              <span style="color:var(--text-muted);">Valor Total:</span>
              <strong>${fmtBRL(total)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted);">Valor da Parcela:</span>
              <strong id="parc-valor">R$ 0,00</strong>
            </div>
          </div>

          <div id="parc-error" hidden class="fin-err" style="margin-top:12px;"></div>
        </div>
        <footer class="fin-modal__foot">
          <button type="button" class="fin-btn fin-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="fin-btn fin-btn--primary" id="parc-confirm">Gerar Parcelas</button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
    
    const qtdInput = modal.querySelector('#parc-qtd');
    const valorEl = modal.querySelector('#parc-valor');

    function updatePreview() {
      const qtd = parseInt(qtdInput.value) || 2;
      const val = Math.floor(total / qtd);
      valorEl.textContent = fmtBRL(val);
    }

    qtdInput.addEventListener('input', updatePreview);
    updatePreview();

    modal.querySelector('#parc-confirm').addEventListener('click', async () => {
      const err = modal.querySelector('#parc-error');
      err.hidden = true;
      
      const qtd = parseInt(qtdInput.value);
      if (qtd < 2) { err.textContent = 'A quantidade mínima é 2 parcelas.'; err.hidden = false; return; }

      const btn = modal.querySelector('#parc-confirm');
      btn.disabled = true; btn.textContent = 'Processando...';

      try {
        const baseVal = Math.floor(total / qtd);
        const resto = total - (baseVal * qtd);

        const { error: err1 } = await db().from('financial_entries').update({
          amount_cents: baseVal + resto,
          current_balance_cents: baseVal + resto,
          installment_number: 1,
          installments_total: qtd,
          notes: entry.notes ? entry.notes + ' (Parcelado)' : 'Parcelado'
        }).eq('id', entry.id);
        
        if (err1) throw err1;

        const baseDate = new Date(entry.due_date + 'T12:00:00');
        
        for (let i = 2; i <= qtd; i++) {
          baseDate.setMonth(baseDate.getMonth() + 1);
          
          const newEntry = {
            ...entry,
            id: undefined,
            title_code: undefined,
            amount_cents: baseVal,
            current_balance_cents: baseVal,
            due_date: baseDate.toISOString().slice(0, 10),
            installment_number: i,
            installments_total: qtd,
            notes: entry.notes ? entry.notes + ' (Parcelado)' : 'Parcelado'
          };
          
          delete newEntry.id;
          delete newEntry.title_code;
          delete newEntry.created_at;
          
          newEntry.title_code = await window.Fin.getNextTitleCode();

          const { error: err2 } = await db().from('financial_entries').insert(newEntry);
          if (err2) throw err2;
        }

        toast('Título parcelado com sucesso.', 'success');
        close();
        await window.Fin.loadTitulos?.();
      } catch (e) {
        console.error(e);
        err.textContent = e.message || 'Erro ao parcelar.';
        err.hidden = false; btn.disabled = false; btn.textContent = 'Gerar Parcelas';
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
    openTransferModal,
    openRatearModal,
    openParcelarModal
  });

})();