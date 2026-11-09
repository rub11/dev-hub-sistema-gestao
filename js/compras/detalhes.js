/* =========================================================
   DEV HUB · Compras · detalhes
   ========================================================= */

(function () {
  'use strict';

  const {
    $, escapeHTML, fmtBRL, fmtDate, fmtDateTime,
    STATUS_LABEL, PAYMENT_LABEL, EVENT_LABEL,
    API, toast
  } = window.Cmp;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (!id) { window.location.href = 'compras.html'; return; }

    try {
      const { purchase, items, events } = await API.getPurchase(id);
      
      renderHeader(purchase);
      renderInfo(purchase);
      renderReceiptSummary(items);
      renderFinance(purchase);
      renderItems(items);
      renderTimeline(events);

      $('#loading-msg').hidden = true;
      $('#det-content').hidden = false;
      $('#det-header').hidden = false;

    } catch (e) {
      console.error(e);
      $('#loading-msg').textContent = 'Erro ao carregar detalhes: ' + e.message;
      $('#loading-msg').style.color = 'var(--danger)';
    }
  }

  function renderHeader(p) {
    $('#det-code').textContent = p.code;
    $('#det-supplier').textContent = p.supplier_name || 'Sem fornecedor';
    
    const stEl = $('#det-status');
    const label = STATUS_LABEL[p.status] || p.status;
    stEl.innerHTML = `<span class="cmp-status cmp-status--${p.status}" style="font-size:14px; padding:6px 14px;">${label}</span>`;
  }

  function renderInfo(p) {
    $('#det-forn').textContent = p.supplier_name || '—';
    $('#det-doc').textContent = p.supplier_doc || '—';
    $('#det-date').textContent = fmtDate(p.purchase_date);
    $('#det-expected').textContent = p.expected_date ? fmtDate(p.expected_date) : '—';
    $('#det-created-by').textContent = p.created_by_name || 'Sistema';
    $('#det-notes').textContent = p.notes || 'Sem observações.';
  }

  function renderReceiptSummary(items) {
    let totalQty = 0;
    let receivedQty = 0;

    (items || []).forEach(it => {
      totalQty += Number(it.quantity) || 0;
      receivedQty += Number(it.quantity_received) || 0;
    });

    const pendingQty = Math.max(0, totalQty - receivedQty);

    $('#det-total-items').textContent = totalQty;
    $('#det-received-items').textContent = receivedQty;
    $('#det-pending-items').textContent = pendingQty;
    $('#det-receipt-status').textContent = pendingQty === 0 ? 'Concluído' : (receivedQty > 0 ? 'Parcial' : 'Aguardando');
  }

  function renderFinance(p) {
    $('#det-total').textContent = fmtBRL(p.total_cents);
    $('#det-payment-method').textContent = PAYMENT_LABEL[p.payment_method] || p.payment_method || '—';
    $('#det-payment-terms').textContent = p.payment_terms || '—';
    $('#det-installments').textContent = p.installments ? `${p.installments}x` : '—';
  }

  function renderItems(items) {
    const tbody = $('#det-items-body');
    if (!items || !items.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum item registrado.</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(it => {
      // Tenta pegar a imagem do produto vinculado
      let imgHtml = `<div style="width:44px; height:44px; border-radius:8px; background:var(--surface-2); display:grid; place-items:center; color:var(--text-muted); border:1px solid var(--border);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21 8-9-5-9 5v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 21v-8"/></svg></div>`;
      
      if (it.products && it.products.image_urls && it.products.image_urls.length > 0) {
        imgHtml = `<img src="${it.products.image_urls[0]}" class="det-product-img" alt="${escapeHTML(it.description)}" />`;
      }

      const qtyRec = Number(it.quantity_received) || 0;
      const qtyRecColor = qtyRec > 0 ? 'var(--success)' : 'var(--text-muted)';

      return `
        <tr>
          <td>${imgHtml}</td>
          <td>
            <div style="font-weight:600; color:var(--text);">${escapeHTML(it.description)}</div>
            ${it.products && it.products.code ? `<div style="font-size:11px; color:var(--text-muted);">SKU: ${escapeHTML(it.products.code)}</div>` : ''}
          </td>
          <td style="text-align:center;">${it.quantity} ${escapeHTML(it.unit || 'un')}</td>
          <td style="text-align:center; font-weight:600; color:${qtyRecColor};">${qtyRec}</td>
          <td style="text-align:right;">${fmtBRL(it.unit_price_cents)}</td>
          <td style="text-align:right; font-weight:600;">${fmtBRL(it.total_cents)}</td>
        </tr>
      `;
    }).join('');
  }

  function renderTimeline(events) {
    const wrap = $('#det-timeline');
    if (!events || !events.length) {
      wrap.innerHTML = '<p style="color:var(--text-muted); font-size:13.5px;">Nenhum histórico registrado.</p>';
      return;
    }

    wrap.innerHTML = events.map(ev => {
      const isDanger = ev.event === 'cancelled' || ev.event === 'deleted';
      const label = EVENT_LABEL[ev.event] || ev.event;
      
      let summaryDesc = '';
      if (ev.from_status || ev.to_status) {
        summaryDesc = ` · ${STATUS_LABEL[ev.from_status] || ''} → ${STATUS_LABEL[ev.to_status] || ''}`;
      }

      // Monta os detalhes da expansão
      let detailHtml = 'Nenhum detalhe adicional registrado.';
      
      if (ev.payload) {
        if (ev.event === 'received' && ev.payload.items) {
          detailHtml = `<strong>Itens Recebidos:</strong><ul>` + 
            ev.payload.items.map(i => `<li>${escapeHTML(i.name)}: +${i.qty}</li>`).join('') +
            `</ul>`;
        } else if (ev.event === 'cancelled' || ev.event === 'deleted') {
          detailHtml = `<strong>Motivo:</strong> ${escapeHTML(ev.payload.reason || 'Não informado')}`;
        } else if (ev.event === 'updated') {
          detailHtml = `<strong>Alterações:</strong> O registro foi modificado.`;
        } else {
          detailHtml = `<pre style="margin:0; font-size:11px; overflow-x:auto;">${JSON.stringify(ev.payload, null, 2)}</pre>`;
        }
      }

      return `
        <div class="tl-item ${isDanger ? 'is-danger' : ''}">
          <details>
            <summary>
              <span class="tl-item__label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
                ${label}${summaryDesc}
              </span>
              <span class="tl-item__meta">${escapeHTML(ev.actor_name || 'Sistema')} · ${fmtDateTime(ev.created_at)}</span>
            </summary>
            <div class="tl-detail-box">
              ${detailHtml}
            </div>
          </details>
        </div>
      `;
    }).join('');
  }

})();