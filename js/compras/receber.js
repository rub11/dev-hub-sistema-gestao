/* =========================================================
   DEV HUB · Compras · receber
   ---------------------------------------------------------
   Página compras-receber.html — confere e dá entrada no estoque.
   ========================================================= */

(function () {
  'use strict';

  const {
    $, escapeHTML, fmtBRL, fmtDate, fmtDateTime,
    toast, STATUS_LABEL, EVENT_LABEL,
    API
  } = window.Cmp;

  async function pageComprasReceber() {
    const wrap = $('#cmp-receive-list');
    if (!wrap) return;

    async function load() {
      wrap.innerHTML = `<div class="cmp-loading">Carregando compras pendentes...</div>`;
      try {
        const all = await API.listPurchases();
        const pending = all.filter((p) =>
          p.status === 'pendente_recebimento' || p.status === 'recebida_parcial'
        );
        if (!pending.length) {
          wrap.innerHTML = `
            <div class="cmp-panel">
              <div class="cmp-empty">
                <div class="cmp-empty__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m5 12 5 5L20 7"/>
                  </svg>
                </div>
                <h3 class="cmp-empty__title">Nada para receber</h3>
                <p class="cmp-empty__text">Não há compras pendentes de recebimento.</p>
              </div>
            </div>`;
          return;
        }
        wrap.innerHTML = pending.map((p) => `
          <div class="cmp-panel" style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start;padding:20px 24px">
              <div style="min-width:0">
                <div style="font-size:11.5px;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;font-weight:600">
                  ${escapeHTML(p.code)}
                </div>
                <div style="font-size:16px;font-weight:700;color:var(--text);margin-top:4px">
                  ${escapeHTML(p.supplier_name || 'Sem fornecedor')}
                </div>
                <div style="font-size:13px;color:var(--text-soft);margin-top:6px">
                  Data: ${fmtDate(p.purchase_date)} · Previsão: ${fmtDate(p.expected_date)}
                </div>
              </div>
              <button class="cmp-btn cmp-btn--primary" data-action="open" data-id="${p.id}">Receber</button>
            </div>
          </div>
        `).join('');
        wrap.querySelectorAll('[data-action="open"]').forEach((btn) => {
          btn.addEventListener('click', () => openReceiveModal(btn.dataset.id));
        });
      } catch (e) {
        console.error(e);
        wrap.innerHTML = `<div class="cmp-error">Erro: ${escapeHTML(e.message)}</div>`;
      }
    }

    async function openReceiveModal(purchaseId) {
      try {
        const { purchase, items } = await API.getPurchase(purchaseId);
        const modal = document.createElement('div');
        modal.className = 'cmp-modal';
        modal.innerHTML = `
          <div class="cmp-modal__backdrop" data-close></div>
          <div class="cmp-modal__dialog cmp-modal__dialog--lg">
            <header class="cmp-modal__head">
              <h3 class="cmp-modal__title">Receber ${escapeHTML(purchase.code)}</h3>
              <button class="cmp-modal__close" data-close aria-label="Fechar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </header>
            <div class="cmp-modal__body">
              <p style="font-size:13.5px;color:var(--text-soft);margin:0">
                Informe a quantidade recebida de cada item.
              </p>
              <div id="cmp-receive-items">
                ${items.map((it) => {
                  const pend = (Number(it.quantity) || 0) - (Number(it.quantity_received) || 0);
                  return `
                    <div class="cmp-receive-item" data-item-id="${it.id}">
                      <div class="cmp-receive-item__info">
                        <span class="cmp-receive-item__name">${escapeHTML(it.description)}</span>
                        <span class="cmp-receive-item__meta">
                          Pedido: ${Number(it.quantity)} ${escapeHTML(it.unit || 'un')} · Recebido: ${Number(it.quantity_received) || 0} · Pendente: ${pend}
                        </span>
                      </div>
                      <div class="cmp-receive-item__qty">
                        <div class="cmp-receive-item__label">Receber agora</div>
                        <input type="number" min="0" max="${pend}" step="0.001" value="${pend}" data-qty />
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
            <footer class="cmp-modal__foot">
              <button type="button" class="cmp-btn cmp-btn--ghost" data-close>Cancelar</button>
              <button type="button" class="cmp-btn cmp-btn--primary" id="cmp-receive-confirm">Confirmar recebimento</button>
            </footer>
          </div>
        `;
        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

        $('#cmp-receive-confirm').addEventListener('click', async () => {
          const btn = $('#cmp-receive-confirm');
          btn.disabled = true;
          btn.textContent = 'Salvando...';
          try {
            const receivedItems = [];
            modal.querySelectorAll('.cmp-receive-item').forEach((row) => {
              const itemId = row.dataset.itemId;
              const qty = Number(row.querySelector('[data-qty]').value) || 0;
              if (qty > 0) receivedItems.push({ item_id: itemId, qty });
            });
            if (!receivedItems.length) throw new Error('Nenhuma quantidade para receber.');
            const res = await API.receivePurchase(purchase.id, receivedItems);
            toast(`Recebido! Status: ${STATUS_LABEL[res.status] || res.status}`);
            close();
            await load();
          } catch (e) {
            console.error(e);
            toast('Erro ao receber: ' + e.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Confirmar recebimento';
          }
        });
      } catch (e) {
        console.error(e);
        toast('Erro: ' + e.message, 'error');
      }
    }

    await load();
  }

  window.Cmp.pageComprasReceber = pageComprasReceber;

})();