/* =========================================================
   DEV HUB · Compras · list
   ---------------------------------------------------------
   Página compras.html.
   ========================================================= */

(function () {
  'use strict';

  const {
    $, escapeHTML, fmtBRL, fmtDate, fmtDateTime,
    toast, parseBRLToCents,
    STATUS_LABEL, PAYMENT_LABEL, EVENT_LABEL,
    API
  } = window.Cmp;

  async function pageComprasList() {
    const tbody = $('#cmp-tbody');
    const searchInput = $('#cmp-search');
    const statusFilter = $('#cmp-status-filter');
    if (!tbody || !searchInput || !statusFilter) return;

    let allData = [];

    async function load() {
      tbody.innerHTML = `<tr><td colspan="7"><div class="cmp-loading">Carregando...</div></td></tr>`;
      try {
        allData = await API.listPurchases();
        render();
      } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="7"><div class="cmp-error">Erro ao carregar: ${escapeHTML(e.message)}</div></td></tr>`;
      }
    }

    function render() {
      const q = (searchInput.value || '').trim().toLowerCase();
      const st = statusFilter.value || '';

      let rows = allData;
      if (q) {
        rows = rows.filter((r) =>
          (r.code || '').toLowerCase().includes(q) ||
          (r.supplier_name || '').toLowerCase().includes(q) ||
          (r.created_by_name || '').toLowerCase().includes(q)
        );
      }
      if (st) rows = rows.filter((r) => r.status === st);

      if (!rows.length) {
        const hasFilter = q || st;
        tbody.innerHTML = `
          <tr><td colspan="7" style="padding:0;border:0">
            <div class="cmp-empty">
              <div class="cmp-empty__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h9.2a2 2 0 0 0 2-1.6L22 7H6"/>
                  <circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>
                </svg>
              </div>
              <h3 class="cmp-empty__title">
                ${hasFilter ? 'Nenhum resultado encontrado' : 'Nenhuma compra ainda'}
              </h3>
              <p class="cmp-empty__text">
                ${hasFilter
                  ? 'Tente ajustar a busca ou os filtros.'
                  : 'Comece lançando uma nova compra ou cadastrando fornecedores.'}
              </p>
              ${hasFilter ? '' : `
                <div class="cmp-empty__actions">
                  <a href="fornecedores.html" class="cmp-btn cmp-btn--ghost">Gerenciar fornecedores</a>
                  <a href="compras-nova.html" class="cmp-btn cmp-btn--primary">+ Nova compra</a>
                </div>
              `}
            </div>
          </td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map((r) => {
        const canEdit   = r.status === 'rascunho' || r.status === 'pendente_recebimento' || r.status === 'aguardando_aprovacao';
        const canCancel = r.status !== 'paga' && r.status !== 'cancelada';
        const canPay    = r.status === 'recebida' || r.status === 'recebida_parcial';

        return `
        <tr data-id="${r.id}">
          <td><span class="cmp-code">${escapeHTML(r.code || '—')}</span></td>
          <td>
            <div class="cmp-supplier">
              <span class="cmp-supplier__name">${escapeHTML(r.supplier_name || 'Sem fornecedor')}</span>
              ${r.created_by_name ? `<span class="cmp-supplier__meta">por ${escapeHTML(r.created_by_name)}</span>` : ''}
            </div>
          </td>
          <td>${fmtDate(r.purchase_date)}</td>
          <td class="cell--num"><span class="cmp-money">${fmtBRL(r.total_cents)}</span></td>
          <td>
            ${r.payment_method
              ? escapeHTML(PAYMENT_LABEL[r.payment_method] || r.payment_method)
              : '<span style="color:var(--text-muted)">—</span>'}
          </td>
          <td>
            <span class="cmp-status cmp-status--${escapeHTML(r.status)}">
              ${escapeHTML(STATUS_LABEL[r.status] || r.status)}
            </span>
          </td>
          <td class="cell--right">
            <div class="cmp-row-actions">
              <button class="cmp-action" data-action="view" data-id="${r.id}" title="Ver detalhes" aria-label="Ver">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>

              ${canEdit ? `
                <button class="cmp-action" data-action="edit" data-id="${r.id}" title="Editar" aria-label="Editar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                  </svg>
                </button>
              ` : ''}

              ${canPay ? `
                <button class="cmp-action" data-action="pay" data-id="${r.id}" title="Dar baixa no pagamento" aria-label="Pagar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2.5" y="6" width="19" height="12" rx="2"/>
                    <path d="M2.5 10h19"/>
                    <circle cx="17" cy="14" r="1"/>
                  </svg>
                </button>
              ` : ''}

              ${canCancel ? `
                <button class="cmp-action cmp-action--danger" data-action="cancel" data-id="${r.id}" title="Cancelar compra" aria-label="Cancelar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="m9 9 6 6M15 9l-6 6"/>
                  </svg>
                </button>
              ` : ''}

              ${r.status === 'rascunho' ? `
                <button class="cmp-action cmp-action--danger" data-action="delete" data-id="${r.id}" title="Excluir rascunho" aria-label="Excluir">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>`;
      }).join('');

      /* Bind de ações */
      tbody.querySelectorAll('[data-action]').forEach((btn) => {
        const id = btn.dataset.id;
        const row = allData.find((x) => x.id === id);
        if (!row) return;

        if (btn.dataset.action === 'view')   btn.addEventListener('click', () => viewPurchaseModal(row));
        if (btn.dataset.action === 'edit')   btn.addEventListener('click', () => {
          window.location.href = 'compras-nova.html?id=' + encodeURIComponent(id);
        });
        if (btn.dataset.action === 'cancel') btn.addEventListener('click', () => cancelPurchaseModal(row, load));
        if (btn.dataset.action === 'pay')    btn.addEventListener('click', () => payPurchaseModal(row, load));
        if (btn.dataset.action === 'delete') btn.addEventListener('click', async () => {
          if (!confirm('Excluir este rascunho? Esta ação não pode ser desfeita.')) return;
          try {
            await API.deletePurchase(id);
            allData = allData.filter((x) => x.id !== id);
            render();
            toast('Rascunho excluído.');
          } catch (e) {
            toast('Erro ao excluir: ' + e.message, 'error');
          }
        });
      });
    }

    /* ---------- Ver detalhes ---------- */
    async function viewPurchaseModal(row) {
      try {
        const { purchase, items, events } = await API.getPurchase(row.id);
        const modal = document.createElement('div');
        modal.className = 'cmp-modal';
        modal.innerHTML = `
          <div class="cmp-modal__backdrop" data-close></div>
          <div class="cmp-modal__dialog cmp-modal__dialog--lg">
            <header class="cmp-modal__head">
              <div>
                <h3 class="cmp-modal__title">${escapeHTML(purchase.code)}</h3>
                <p style="margin:4px 0 0;font-size:13px;color:var(--text-soft)">
                  ${escapeHTML(purchase.supplier_name || 'Sem fornecedor')} · ${fmtDate(purchase.purchase_date)}
                </p>
              </div>
              <button class="cmp-modal__close" data-close aria-label="Fechar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </header>
            <div class="cmp-modal__body">
              <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">
                <span class="cmp-status cmp-status--${escapeHTML(purchase.status)}">
                  ${escapeHTML(STATUS_LABEL[purchase.status] || purchase.status)}
                </span>
                ${purchase.payment_method ? `<span style="font-size:13px;color:var(--text-soft);align-self:center">
                  ${escapeHTML(PAYMENT_LABEL[purchase.payment_method] || purchase.payment_method)}
                </span>` : ''}
              </div>

              ${purchase.notes ? `
                <p style="margin:0;padding:10px 14px;background:var(--surface-2);border-radius:8px;font-size:13px;color:var(--text-soft);line-height:1.5">
                  ${escapeHTML(purchase.notes)}
                </p>
              ` : ''}

              <h4 style="margin:12px 0 8px;font-size:13.5px;font-weight:600">Itens</h4>
              <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;font-size:13.5px;min-width:520px">
                  <thead>
                    <tr style="border-bottom:1px solid var(--border);text-align:left;color:var(--text-muted);font-size:11.5px;letter-spacing:.06em;text-transform:uppercase">
                      <th style="padding:8px 0">Descrição</th>
                      <th style="padding:8px 0;text-align:right">Qtd</th>
                      <th style="padding:8px 0;text-align:right">Recebido</th>
                      <th style="padding:8px 0;text-align:right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map((it) => `
                      <tr style="border-bottom:1px solid var(--border)">
                        <td style="padding:10px 0">${escapeHTML(it.description)}</td>
                        <td style="padding:10px 0;text-align:right">${Number(it.quantity)} ${escapeHTML(it.unit || 'un')}</td>
                        <td style="padding:10px 0;text-align:right">${Number(it.quantity_received) || 0}</td>
                        <td style="padding:10px 0;text-align:right;font-variant-numeric:tabular-nums">${fmtBRL(it.total_cents)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                  <tfoot>
                    <tr><td colspan="3" style="padding:8px 0;text-align:right;color:var(--text-muted)">Subtotal</td>
                        <td style="padding:8px 0;text-align:right;font-weight:600">${fmtBRL(purchase.subtotal_cents)}</td></tr>
                    ${purchase.discount_cents ? `
                    <tr><td colspan="3" style="padding:4px 0;text-align:right;color:var(--text-muted)">Desconto</td>
                        <td style="padding:4px 0;text-align:right">- ${fmtBRL(purchase.discount_cents)}</td></tr>` : ''}
                    ${purchase.shipping_cents ? `
                    <tr><td colspan="3" style="padding:4px 0;text-align:right;color:var(--text-muted)">Frete</td>
                        <td style="padding:4px 0;text-align:right">${fmtBRL(purchase.shipping_cents)}</td></tr>` : ''}
                    <tr><td colspan="3" style="padding:12px 0 0;text-align:right;font-weight:700;border-top:1px solid var(--border)">Total</td>
                        <td style="padding:12px 0 0;text-align:right;font-weight:700;font-size:16px;border-top:1px solid var(--border)">${fmtBRL(purchase.total_cents)}</td></tr>
                  </tfoot>
                </table>
              </div>

              ${events && events.length ? `
                <h4 style="margin:20px 0 8px;font-size:13.5px;font-weight:600">Histórico</h4>
                <ul style="list-style:none;padding:0;margin:0;font-size:13px;color:var(--text-soft)">
                  ${events.map((ev) => `
                    <li style="padding:10px 0;border-bottom:1px dashed var(--border)">
                      <strong style="color:var(--text)">${escapeHTML(EVENT_LABEL[ev.event] || ev.event)}</strong>
                      ${ev.from_status || ev.to_status ? ` — ${escapeHTML(STATUS_LABEL[ev.from_status] || ev.from_status || '—')} → ${escapeHTML(STATUS_LABEL[ev.to_status] || ev.to_status || '—')}` : ''}
                      <span style="display:block;font-size:12px;color:var(--text-muted);margin-top:3px">
                        ${escapeHTML(ev.actor_name || 'Sistema')} · ${fmtDateTime(ev.created_at)}
                      </span>
                    </li>
                  `).join('')}
                </ul>
              ` : ''}
            </div>
            <footer class="cmp-modal__foot">
              <button type="button" class="cmp-btn cmp-btn--ghost" data-close>Fechar</button>
            </footer>
          </div>`;
        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
      } catch (e) {
        console.error(e);
        toast('Erro ao abrir: ' + e.message, 'error');
      }
    }

    /* ---------- Cancelar ---------- */
    function cancelPurchaseModal(row, onDone) {
      const modal = document.createElement('div');
      modal.className = 'cmp-modal';
      modal.innerHTML = `
        <div class="cmp-modal__backdrop" data-close></div>
        <div class="cmp-modal__dialog">
          <header class="cmp-modal__head">
            <h3 class="cmp-modal__title">Cancelar ${escapeHTML(row.code)}</h3>
            <button class="cmp-modal__close" data-close aria-label="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </header>
          <div class="cmp-modal__body">
            <p style="margin:0;font-size:13.5px;color:var(--text-soft);line-height:1.5">
              Esta ação é <strong>permanente</strong> e o gestor será notificado.
            </p>
            <div class="field">
              <label for="c-reason">Motivo do cancelamento *</label>
              <textarea id="c-reason" rows="3" placeholder="Ex.: fornecedor não tinha o produto, preço mudou, etc."></textarea>
            </div>
            <div class="cmp-error" id="c-error" hidden></div>
          </div>
          <footer class="cmp-modal__foot">
            <button type="button" class="cmp-btn cmp-btn--ghost" data-close>Voltar</button>
            <button type="button" class="cmp-btn cmp-btn--primary" id="c-confirm" style="background:var(--danger);border-color:var(--danger)">
              Cancelar compra
            </button>
          </footer>
        </div>`;
      document.body.appendChild(modal);
      const close = () => modal.remove();
      modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

      const reasonEl = $('#c-reason', modal);
      reasonEl.focus();

      $('#c-confirm', modal).addEventListener('click', async () => {
        const reason = (reasonEl.value || '').trim();
        const err = $('#c-error', modal);
        err.hidden = true;
        if (reason.length < 5) {
          err.textContent = 'Informe um motivo (mínimo 5 caracteres).';
          err.hidden = false;
          return;
        }
        const btn = $('#c-confirm', modal);
        btn.disabled = true;
        btn.textContent = 'Cancelando...';

        try {
          await API.cancelPurchase(row.id, reason);
          close();
          await onDone();
          toast('Compra cancelada.');
        } catch (e) {
          console.error(e);
          err.textContent = e.message;
          err.hidden = false;
          btn.disabled = false;
          btn.textContent = 'Cancelar compra';
        }
      });
    }

    /* ---------- Pagar ---------- */
    function payPurchaseModal(row, onDone) {
      const modal = document.createElement('div');
      modal.className = 'cmp-modal';
      modal.innerHTML = `
        <div class="cmp-modal__backdrop" data-close></div>
        <div class="cmp-modal__dialog">
          <header class="cmp-modal__head">
            <h3 class="cmp-modal__title">Pagar ${escapeHTML(row.code)}</h3>
            <button class="cmp-modal__close" data-close aria-label="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </header>
          <div class="cmp-modal__body">
            <div class="field">
              <label for="p-amount">Valor pago (R$)</label>
              <input id="p-amount" type="text" value="${((row.total_cents || 0) / 100).toFixed(2).replace('.', ',')}" />
            </div>
            <div class="field">
              <label for="p-method">Forma de pagamento</label>
              <select id="p-method" class="control-select">
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="transferencia">Transferência</option>
                <option value="cartao_credito">Cartão de crédito</option>
                <option value="cartao_debito">Cartão de débito</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div class="field">
              <label for="p-notes">Observações</label>
              <input id="p-notes" type="text" placeholder="Opcional" />
            </div>
            <div class="cmp-error" id="p-error" hidden></div>
          </div>
          <footer class="cmp-modal__foot">
            <button type="button" class="cmp-btn cmp-btn--ghost" data-close>Cancelar</button>
            <button type="button" class="cmp-btn cmp-btn--primary" id="p-confirm">Confirmar pagamento</button>
          </footer>
        </div>`;
      document.body.appendChild(modal);
      const close = () => modal.remove();
      modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

      $('#p-confirm', modal).addEventListener('click', async () => {
        const err = $('#p-error', modal);
        err.hidden = true;
        const amount = parseBRLToCents($('#p-amount', modal).value);
        if (amount <= 0) {
          err.textContent = 'Informe um valor válido.';
          err.hidden = false;
          return;
        }
        const btn = $('#p-confirm', modal);
        btn.disabled = true;
        btn.textContent = 'Salvando...';
        try {
          await API.payPurchase(
            row.id,
            amount,
            $('#p-method', modal).value,
            $('#p-notes', modal).value.trim()
          );
          close();
          await onDone();
          toast('Pagamento registrado! Gestor notificado.');
        } catch (e) {
          console.error(e);
          err.textContent = e.message;
          err.hidden = false;
          btn.disabled = false;
          btn.textContent = 'Confirmar pagamento';
        }
      });
    }

    /* ---------- Binds ---------- */
    let t = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(render, 220);
    });
    statusFilter.addEventListener('change', render);

    await load();
  }

  window.Cmp.pageComprasList = pageComprasList;

})();