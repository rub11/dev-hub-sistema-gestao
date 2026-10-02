/* =========================================================
   DEV HUB · Aprovacoes · modals
   ---------------------------------------------------------
   Modais de ver detalhes, aprovar e rejeitar.
   ---------------------------------------------------------
   Depende de: state.js, api.js
   Publica em: window.Appr
   ========================================================= */

(function () {
  'use strict';

  const {
    $, escapeHTML, fmtBRL, fmtDateTime,
    toast
  } = window.Appr;

  /* =========================================================
     MODAL · VER DETALHES
     ========================================================= */
  async function openViewModal(row) {
    try {
      const items = await window.Appr.fetchItems(row.id);

      const modal = document.createElement('div');
      modal.className = 'appr-modal';
      modal.innerHTML = `
        <div class="appr-modal__backdrop" data-close></div>
        <div class="appr-modal__dialog appr-modal__dialog--lg">
          <header class="appr-modal__head">
            <div>
              <h3 class="appr-modal__title">${escapeHTML(row.code)}</h3>
              <p class="appr-modal__sub">
                Solicitada por ${escapeHTML(row.created_by_name || '—')} · ${fmtDateTime(row.created_at)}
              </p>
            </div>
            <button class="appr-modal__close" data-close aria-label="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </header>
          <div class="appr-modal__body">

            <div style="display:flex;gap:12px;flex-wrap:wrap">
              <span class="appr-chip">Aguardando aprovação</span>
              ${row.payment_method ? `<span style="font-size:13px;color:var(--text-soft);align-self:center">${escapeHTML(row.payment_method)}</span>` : ''}
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div>
                <strong style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Fornecedor</strong>
                <div style="font-size:15px;margin-top:2px">${escapeHTML(row.supplier_name || '—')}</div>
              </div>
              <div>
                <strong style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Valor total</strong>
                <div style="font-size:18px;font-weight:700;margin-top:2px">${fmtBRL(row.total_cents)}</div>
              </div>
            </div>

            <h4 style="margin:4px 0 0;font-size:13.5px;font-weight:600">Itens do pedido</h4>
            <div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px">
              <table style="width:100%;border-collapse:collapse;font-size:13.5px;min-width:420px">
                <thead>
                  <tr style="border-bottom:1px solid var(--border);text-align:left;color:var(--text-muted);font-size:11px;text-transform:uppercase">
                    <th style="padding:10px 14px">Descrição</th>
                    <th style="padding:10px 14px;text-align:right">Qtd</th>
                    <th style="padding:10px 14px;text-align:right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  ${(items || []).map((it) => `
                    <tr style="border-bottom:1px solid var(--border)">
                      <td style="padding:10px 14px">${escapeHTML(it.description)}</td>
                      <td style="padding:10px 14px;text-align:right">${Number(it.quantity)} ${escapeHTML(it.unit || 'un')}</td>
                      <td style="padding:10px 14px;text-align:right;font-variant-numeric:tabular-nums">${fmtBRL(it.total_cents)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            ${row.notes ? `
              <div>
                <strong style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Observações</strong>
                <p style="margin:6px 0 0;font-size:13.5px;color:var(--text-soft);line-height:1.5;white-space:pre-wrap">${escapeHTML(row.notes)}</p>
              </div>
            ` : ''}

          </div>
          <footer class="appr-modal__foot">
            <button type="button" class="appr-btn appr-btn--ghost" data-close>Fechar</button>
            <button type="button" class="appr-btn appr-btn--danger" id="m-reject">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
              Rejeitar
            </button>
            <button type="button" class="appr-btn appr-btn--success" id="m-approve">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
              Aprovar
            </button>
          </footer>
        </div>`;
      document.body.appendChild(modal);

      const close = () => modal.remove();
      modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

      modal.querySelector('#m-approve').addEventListener('click', () => {
        close();
        openApproveModal(row);
      });
      modal.querySelector('#m-reject').addEventListener('click', () => {
        close();
        openRejectModal(row);
      });
    } catch (e) {
      console.error('[aprovacoes] openViewModal:', e);
      toast('Não foi possível abrir os detalhes.', 'error');
    }
  }

  /* =========================================================
     MODAL · APROVAR
     ========================================================= */
  function openApproveModal(row) {
    const modal = document.createElement('div');
    modal.className = 'appr-modal';
    modal.innerHTML = `
      <div class="appr-modal__backdrop" data-close></div>
      <div class="appr-modal__dialog">
        <header class="appr-modal__head">
          <div>
            <h3 class="appr-modal__title">Aprovar compra</h3>
            <p class="appr-modal__sub">${escapeHTML(row.code)}</p>
          </div>
          <button class="appr-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>
        <div class="appr-modal__body">
          <p style="margin:0;font-size:14px;line-height:1.55;color:var(--text-soft)">
            Ao aprovar, a compra seguirá para o <strong>recebimento</strong>. O estoquista
            será notificado. O valor total é <strong>${fmtBRL(row.total_cents)}</strong>.
          </p>
          <div class="appr-err" id="ap-error" hidden></div>
        </div>
        <footer class="appr-modal__foot">
          <button type="button" class="appr-btn appr-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="appr-btn appr-btn--success" id="ap-confirm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            Aprovar e enviar
          </button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    modal.querySelector('#ap-confirm').addEventListener('click', async () => {
      const btn = modal.querySelector('#ap-confirm');
      btn.disabled = true;
      try {
        await window.Appr.approvePurchase(row.id);
        close();
        toast('Compra aprovada! Enviada para recebimento.');
        await window.Appr.reload();
      } catch (e) {
        console.error('[aprovacoes] approve:', e);
        const err = modal.querySelector('#ap-error');
        err.textContent = e.message;
        err.hidden = false;
        btn.disabled = false;
      }
    });
  }

  /* =========================================================
     MODAL · REJEITAR
     ========================================================= */
  function openRejectModal(row) {
    const modal = document.createElement('div');
    modal.className = 'appr-modal';
    modal.innerHTML = `
      <div class="appr-modal__backdrop" data-close></div>
      <div class="appr-modal__dialog">
        <header class="appr-modal__head">
          <div>
            <h3 class="appr-modal__title">Rejeitar compra</h3>
            <p class="appr-modal__sub">${escapeHTML(row.code)} · ${fmtBRL(row.total_cents)}</p>
          </div>
          <button class="appr-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>
        <div class="appr-modal__body">
          <p style="margin:0;font-size:13.5px;line-height:1.5;color:var(--text-soft)">
            A compra voltará para <strong>Rascunho</strong> e o solicitante será notificado.
          </p>
          <div class="appr-field">
            <label for="rj-reason">Motivo da rejeição *</label>
            <textarea id="rj-reason" rows="3" placeholder="Ex.: valor acima do orçamento, fornecedor não homologado..."></textarea>
          </div>
          <div class="appr-err" id="rj-error" hidden></div>
        </div>
        <footer class="appr-modal__foot">
          <button type="button" class="appr-btn appr-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="appr-btn appr-btn--danger" id="rj-confirm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
            Rejeitar
          </button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    const reasonEl = modal.querySelector('#rj-reason');
    reasonEl.focus();

    modal.querySelector('#rj-confirm').addEventListener('click', async () => {
      const reason = (reasonEl.value || '').trim();
      const err = modal.querySelector('#rj-error');
      err.hidden = true;
      if (reason.length < 5) {
        err.textContent = 'Informe um motivo com pelo menos 5 caracteres.';
        err.hidden = false;
        return;
      }
      const btn = modal.querySelector('#rj-confirm');
      btn.disabled = true;
      try {
        await window.Appr.rejectPurchase(row.id, reason);
        close();
        toast('Compra rejeitada. Solicitante notificado.');
        await window.Appr.reload();
      } catch (e) {
        console.error('[aprovacoes] reject:', e);
        err.textContent = e.message;
        err.hidden = false;
        btn.disabled = false;
      }
    });
  }

  /* =========================================================
     PUBLICA
     ========================================================= */
  Object.assign(window.Appr, {
    openViewModal,
    openApproveModal,
    openRejectModal
  });

})();