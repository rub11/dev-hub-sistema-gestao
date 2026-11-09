/* =========================================================
   DEV HUB · Compras · list
   ========================================================= */

(function () {
  'use strict';

  const {
    $, escapeHTML, fmtBRL, fmtDate, toast,
    STATUS_LABEL, PAYMENT_LABEL, API
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
        rows = rows.filter((r) => (r.code || '').toLowerCase().includes(q) || (r.supplier_name || '').toLowerCase().includes(q));
      }
      if (st) rows = rows.filter((r) => r.status === st);

      if (!rows.length) {
        const hasFilter = q || st;
        tbody.innerHTML = `
          <tr><td colspan="7" style="padding:0;border:0">
            <div class="cmp-empty">
              <h3 class="cmp-empty__title">${hasFilter ? 'Nenhum resultado encontrado' : 'Nenhuma compra ainda'}</h3>
              <p class="cmp-empty__text">${hasFilter ? 'Tente ajustar a busca.' : 'Comece lançando uma nova compra.'}</p>
            </div>
          </td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map((r) => {
        const canCancel = r.status !== 'paga' && r.status !== 'cancelada';
        
        // Tenta pegar a imagem do primeiro produto da compra
        let thumbHtml = `<div style="width:32px; height:32px; border-radius:6px; background:var(--surface-2); display:grid; place-items:center; color:var(--text-muted);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21 8-9-5-9 5v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 21v-8"/></svg></div>`;
        
        if (r.purchase_items && r.purchase_items.length > 0) {
          const item = r.purchase_items.find(i => i.products && i.products.image_urls && i.products.image_urls.length > 0);
          if (item && item.products.image_urls[0]) {
            thumbHtml = `<img src="${item.products.image_urls[0]}" style="width:32px; height:32px; border-radius:6px; object-fit:cover; border:1px solid var(--border);" alt="Capa" />`;
          }
        }

        return `
        <tr data-id="${r.id}">
          <td>
            <div style="display:flex; align-items:center; gap:12px;">
              ${thumbHtml}
              <span class="cmp-code">${escapeHTML(r.code || '—')}</span>
            </div>
          </td>
          <td>
            <div class="cmp-supplier">
              <span class="cmp-supplier__name">${escapeHTML(r.supplier_name || 'Sem fornecedor')}</span>
              ${r.created_by_name ? `<span class="cmp-supplier__meta">por ${escapeHTML(r.created_by_name)}</span>` : ''}
            </div>
          </td>
          <td>${fmtDate(r.purchase_date)}</td>
          <td class="cell--num"><span class="cmp-money">${fmtBRL(r.total_cents)}</span></td>
          <td>
            ${r.payment_method ? escapeHTML(PAYMENT_LABEL[r.payment_method] || r.payment_method) : '<span style="color:var(--text-muted)">—</span>'}
          </td>
          <td>
            <span class="cmp-status cmp-status--${escapeHTML(r.status)}">
              ${escapeHTML(STATUS_LABEL[r.status] || r.status)}
            </span>
          </td>
          <td class="cell--right">
            <div class="cmp-row-actions">
              <button class="cmp-action" data-action="view" data-id="${r.id}" title="Ver detalhes" aria-label="Ver">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>

              ${canCancel ? `
                <button class="cmp-action cmp-action--danger" data-action="cancel" data-id="${r.id}" title="Cancelar compra" aria-label="Cancelar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></svg>
                </button>
              ` : ''}

              <button class="cmp-action cmp-action--danger" data-action="delete" data-id="${r.id}" title="Excluir compra" aria-label="Excluir">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
      }).join('');

      tbody.querySelectorAll('[data-action]').forEach((btn) => {
        const id = btn.dataset.id;
        const row = allData.find((x) => x.id === id);
        if (!row) return;

        if (btn.dataset.action === 'view') btn.addEventListener('click', () => {
          window.location.href = 'compras-detalhes.html?id=' + encodeURIComponent(id);
        });
        if (btn.dataset.action === 'cancel') btn.addEventListener('click', () => cancelPurchaseModal(row, load));
        if (btn.dataset.action === 'delete') btn.addEventListener('click', () => deletePurchaseModal(row, load));
      });
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
            <button class="cmp-modal__close" data-close><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          </header>
          <div class="cmp-modal__body">
            <p style="margin:0;font-size:13.5px;color:var(--text-soft);line-height:1.5">Esta ação é <strong>permanente</strong> e o gestor será notificado.</p>
            <div class="field">
              <label for="c-reason">Motivo do cancelamento *</label>
              <textarea id="c-reason" rows="3" placeholder="Descreva o motivo..."></textarea>
            </div>
            <div class="cmp-error" id="c-error" hidden></div>
          </div>
          <footer class="cmp-modal__foot">
            <button type="button" class="cmp-btn cmp-btn--ghost" data-close>Voltar</button>
            <button type="button" class="cmp-btn cmp-btn--primary" id="c-confirm" style="background:var(--danger);border-color:var(--danger)">Cancelar compra</button>
          </footer>
        </div>`;
      document.body.appendChild(modal);
      const close = () => modal.remove();
      modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

      $('#c-confirm', modal).addEventListener('click', async () => {
        const reason = ($('#c-reason', modal).value || '').trim();
        const err = $('#c-error', modal);
        err.hidden = true;
        if (reason.length < 5) { err.textContent = 'Informe um motivo (mín. 5 caracteres).'; err.hidden = false; return; }
        const btn = $('#c-confirm', modal); btn.disabled = true; btn.textContent = 'Cancelando...';
        try {
          await API.cancelPurchase(row.id, reason); close(); await onDone(); toast('Compra cancelada.');
        } catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; btn.textContent = 'Cancelar compra'; }
      });
    }

    /* ---------- Excluir (Soft Delete) ---------- */
    function deletePurchaseModal(row, onDone) {
      const modal = document.createElement('div');
      modal.className = 'cmp-modal';
      modal.innerHTML = `
        <div class="cmp-modal__backdrop" data-close></div>
        <div class="cmp-modal__dialog">
          <header class="cmp-modal__head">
            <h3 class="cmp-modal__title">Excluir ${escapeHTML(row.code)}</h3>
            <button class="cmp-modal__close" data-close><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          </header>
          <div class="cmp-modal__body">
            <p style="margin:0;font-size:13.5px;color:var(--text-soft);line-height:1.5">A compra não aparecerá mais na listagem, mas o histórico será preservado para auditoria.</p>
            <div class="field">
              <label for="d-reason">Motivo da exclusão *</label>
              <textarea id="d-reason" rows="3" placeholder="Ex: Compra duplicada, erro de lançamento..."></textarea>
            </div>
            <div class="cmp-error" id="d-error" hidden></div>
          </div>
          <footer class="cmp-modal__foot">
            <button type="button" class="cmp-btn cmp-btn--ghost" data-close>Voltar</button>
            <button type="button" class="cmp-btn cmp-btn--primary" id="d-confirm" style="background:var(--danger);border-color:var(--danger)">Excluir compra</button>
          </footer>
        </div>`;
      document.body.appendChild(modal);
      const close = () => modal.remove();
      modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

      $('#d-confirm', modal).addEventListener('click', async () => {
        const reason = ($('#d-reason', modal).value || '').trim();
        const err = $('#d-error', modal);
        err.hidden = true;
        if (reason.length < 5) { err.textContent = 'Informe um motivo (mín. 5 caracteres).'; err.hidden = false; return; }
        const btn = $('#d-confirm', modal); btn.disabled = true; btn.textContent = 'Excluindo...';
        try {
          await API.softDeletePurchase(row.id, reason); close(); await onDone(); toast('Compra excluída com sucesso.');
        } catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; btn.textContent = 'Excluir compra'; }
      });
    }

    let t = null;
    searchInput.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 220); });
    statusFilter.addEventListener('change', render);

    await load();
  }

  window.Cmp.pageComprasList = pageComprasList;

})();