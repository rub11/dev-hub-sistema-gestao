/* =========================================================
   DEV HUB · Compras · receber
   ---------------------------------------------------------
   Página compras-receber.html — confere e dá entrada no estoque.
   Usa os IDs/classes `rcv-*` (compras-receber.css).
   ========================================================= */

(function () {
  'use strict';

  const {
    $, $$, escapeHTML, fmtBRL, fmtDate, fmtDateTime,
    toast, STATUS_LABEL,
    API
  } = window.Cmp;

  /* =========================================================
     ESTADO LOCAL DA PÁGINA
     ========================================================= */
  const ui = {
    all: [],
    filtered: [],
    search: '',
    status: '',
    activeKpi: 'all'
  };

  /* =========================================================
     HELPERS
     ========================================================= */
  function statusInfo(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'recebida_parcial') return { label: 'Recebida parcial', modifier: 'rcv-status--recebida_parcial' };
    if (s === 'recebida')         return { label: 'Recebida',         modifier: 'rcv-status--recebida' };
    return { label: STATUS_LABEL[s] || 'Aguardando recebimento', modifier: 'rcv-status--pendente_recebimento' };
  }

  function daysUntil(iso) {
    if (!iso) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    return Math.round((d - today) / 86400000);
  }

  function isOverdue(p) {
    const d = daysUntil(p.expected_date);
    return d !== null && d < 0 && p.status !== 'recebida';
  }

  /* =========================================================
     KPIs
     ========================================================= */
  function renderKpis() {
    const wrap = $('#rcv-kpis');
    if (!wrap) return;

    const aguardando = ui.all.filter(p => p.status === 'pendente_recebimento');
    const parciais   = ui.all.filter(p => p.status === 'recebida_parcial');
    const atrasadas  = ui.all.filter(isOverdue);
    const valorCents = ui.all.reduce((s, p) => s + (Number(p.total_cents) || 0), 0);

    const cards = [
      { key: 'all',         cls: 'valor',      label: 'Total a receber',  value: String(ui.all.length),  hint: fmtBRL(valorCents) },
      { key: 'aguardando',  cls: 'aguardando', label: 'Aguardando',       value: String(aguardando.length), hint: 'Pedidos pendentes' },
      { key: 'parcial',     cls: 'parcial',    label: 'Recebidas parcial',value: String(parciais.length),   hint: 'Aguardando saldo' },
      { key: 'atrasadas',   cls: 'divergencia',label: 'Em atraso',        value: String(atrasadas.length),  hint: 'Previsão vencida' }
    ];

    wrap.innerHTML = cards.map(c => `
      <button type="button"
              class="rcv-kpi rcv-kpi--${c.cls} ${ui.activeKpi === c.key ? 'is-active' : ''}"
              data-kpi="${c.key}">
        <span class="rcv-kpi__label">${escapeHTML(c.label)}</span>
        <span class="rcv-kpi__value">${escapeHTML(c.value)}</span>
        <span class="rcv-kpi__hint">${escapeHTML(c.hint)}</span>
      </button>
    `).join('');

    wrap.querySelectorAll('[data-kpi]').forEach(btn => {
      btn.addEventListener('click', () => {
        ui.activeKpi = btn.dataset.kpi;
        applyFilters();
        renderKpis();
      });
    });
  }

  /* =========================================================
     FILTRO + RENDER
     ========================================================= */
  function applyFilters() {
    let rows = ui.all.slice();

    if (ui.activeKpi === 'aguardando') rows = rows.filter(p => p.status === 'pendente_recebimento');
    if (ui.activeKpi === 'parcial')    rows = rows.filter(p => p.status === 'recebida_parcial');
    if (ui.activeKpi === 'atrasadas')  rows = rows.filter(isOverdue);

    if (ui.status) rows = rows.filter(p => p.status === ui.status);

    if (ui.search) {
      const q = ui.search;
      rows = rows.filter(p =>
        (p.code || '').toLowerCase().includes(q) ||
        (p.supplier_name || '').toLowerCase().includes(q) ||
        (p.invoice_number || '').toLowerCase().includes(q)
      );
    }

    ui.filtered = rows;
    renderTable();
  }

  function renderTable() {
    const tbody = $('#rcv-tbody');
    if (!tbody) return;

    if (!ui.filtered.length) {
      tbody.innerHTML = `
        <tr><td colspan="7" style="padding:0;border:0">
          <div class="rcv-empty">
            <div class="rcv-empty__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="m5 12 5 5L20 7"/>
              </svg>
            </div>
            <h3 class="rcv-empty__title">Nada para receber</h3>
            <p class="rcv-empty__text">
              ${ui.search || ui.status || ui.activeKpi !== 'all'
                ? 'Ajuste os filtros para ver outros pedidos.'
                : 'Não há compras pendentes de recebimento.'}
            </p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = ui.filtered.map(p => {
      const st = statusInfo(p.status);
      const overdue = isOverdue(p);
      const previsao = p.expected_date
        ? fmtDate(p.expected_date) + (overdue ? ' · em atraso' : '')
        : '—';

      return `
        <tr data-id="${p.id}">
          <td><span class="rcv-status ${st.modifier}">${escapeHTML(st.label)}</span></td>
          <td><span class="rcv-code">${escapeHTML(p.code || '—')}</span></td>
          <td>
            <div class="rcv-supplier">
              <span class="rcv-supplier__name">${escapeHTML(p.supplier_name || 'Sem fornecedor')}</span>
              ${p.created_by_name ? `<span class="rcv-supplier__meta">por ${escapeHTML(p.created_by_name)}</span>` : ''}
            </div>
          </td>
          <td>${fmtDate(p.purchase_date)}</td>
          <td style="${overdue ? 'color:var(--danger);font-weight:600' : ''}">${escapeHTML(previsao)}</td>
          <td class="cell--num"><span class="rcv-money">${fmtBRL(p.total_cents)}</span></td>
          <td class="cell--right">
            <div class="rcv-row-actions">
              <button type="button" class="rcv-action rcv-action--primary"
                      data-action="receive" data-id="${p.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="m5 12 5 5L20 7"/>
                </svg>
                Receber
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-action="receive"]').forEach(btn => {
      btn.addEventListener('click', () => openReceiveModal(btn.dataset.id));
    });
  }

  /* =========================================================
     MODAL DE RECEBIMENTO
     ========================================================= */
  async function openReceiveModal(purchaseId) {
    try {
      const { purchase, items, events } = await API.getPurchase(purchaseId);

      const modal = document.createElement('div');
      modal.className = 'rcv-modal';
      modal.innerHTML = `
        <div class="rcv-modal__backdrop" data-close></div>
        <div class="rcv-modal__dialog rcv-modal__dialog--lg">
          <header class="rcv-modal__head">
            <div>
              <h3 class="rcv-modal__title">Receber ${escapeHTML(purchase.code)}</h3>
              <p class="rcv-modal__sub">
                ${escapeHTML(purchase.supplier_name || 'Sem fornecedor')} · ${fmtBRL(purchase.total_cents)}
              </p>
            </div>
            <button type="button" class="rcv-modal__close" data-close aria-label="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </header>

          <div class="rcv-modal__body">

            <!-- Leitor de código de barras -->
            <div class="rcv-barcode">
              <div class="rcv-barcode__input">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 5v14M7 5v14M11 5v10M15 5v14M19 5v10"/>
                </svg>
                <input type="text" id="rcv-barcode-input"
                       placeholder="Bipe ou digite o código de barras…"
                       autocomplete="off" inputmode="numeric" />
              </div>
              <p class="rcv-barcode__hint">
                Escaneie o código de barras ou <strong>digite</strong> e pressione <strong>Enter</strong>
                para dar baixa rápida do item.
              </p>
            </div>

            <!-- Conferência -->
            <div class="rcv-conference" id="rcv-conference">
              <div class="rcv-conf-head">
                <span>Item</span>
                <span class="rcv-conf-num">Pedido</span>
                <span class="rcv-conf-num">Recebido</span>
                <span class="rcv-conf-num">Receber agora</span>
                <span class="rcv-conf-num">Divergência</span>
                <span style="text-align:right">Status</span>
              </div>
              <div id="rcv-conf-body"></div>
            </div>

            <!-- Histórico -->
            ${events && events.length ? `
              <div>
                <h4 class="pf-section-title" style="margin:10px 0 8px">Histórico do pedido</h4>
                <div class="rcv-timeline">
                  ${events.slice(0, 6).map(ev => `
                    <div class="rcv-tl-item">
                      <span class="rcv-tl-item__label">${escapeHTML(ev.event || 'evento')}</span>
                      <span class="rcv-tl-item__meta">
                        ${escapeHTML(ev.actor_name || 'Sistema')} · ${fmtDateTime(ev.created_at)}
                      </span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div id="rcv-error" hidden class="rcv-err"></div>
          </div>

          <footer class="rcv-modal__foot">
            <button type="button" class="cmp-btn cmp-btn--ghost" data-close>Cancelar</button>
            <button type="button" class="cmp-btn cmp-btn--primary" id="rcv-confirm">
              <span class="cmp-cnpj__spinner" aria-hidden="true"></span>
              <span>Confirmar recebimento</span>
            </button>
          </footer>
        </div>
      `;
      document.body.appendChild(modal);

      const close = () => modal.remove();
      modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
      document.addEventListener('keydown', function onEsc(e) {
        if (e.key === 'Escape' && document.body.contains(modal)) {
          close();
          document.removeEventListener('keydown', onEsc);
        }
      });

      renderConference(modal, items);
      wireBarcode(modal);
      wireConfirm(modal, purchase, close);

    } catch (e) {
      console.error('[compras/receber] openReceiveModal:', e);
      toast('Não foi possível abrir: ' + e.message, 'error');
    }
  }

  /* =========================================================
     CONFERÊNCIA
     ========================================================= */
  function renderConference(modal, items) {
    const body = modal.querySelector('#rcv-conf-body');
    if (!body) return;

    body.innerHTML = (items || []).map(it => {
      const ped = Number(it.quantity) || 0;
      const jaRecebido = Number(it.quantity_received) || 0;
      const pendente = Math.max(0, ped - jaRecebido);
      const isParcial = jaRecebido > 0 && pendente > 0;
      const isOk = pendente === 0;

      return `
        <div class="rcv-conf-row ${isOk ? '' : (isParcial ? 'is-divergent' : '')}"
             data-item-id="${it.id}"
             data-barcode="${escapeHTML(it.barcode || it.code || '')}"
             data-expected="${ped}"
             data-received="${jaRecebido}"
             data-pending="${pendente}">
          <span class="rcv-conf-name">
            ${escapeHTML(it.description || '—')}
            ${(it.barcode || it.code) ? `<span class="rcv-conf-barcode">${escapeHTML(it.barcode || it.code)}</span>` : ''}
          </span>
          <span class="rcv-conf-num">${ped} ${escapeHTML(it.unit || 'un')}</span>
          <span class="rcv-conf-num">${jaRecebido}</span>
          <span>
            <input type="number" class="rcv-conf-input"
                   data-qty
                   min="0" max="${pendente}" step="1"
                   value="${pendente}"
                   ${isOk ? 'disabled' : ''} />
          </span>
          <span class="rcv-conf-num" data-diff>
            ${isOk ? '—' : '0'}
          </span>
          <span style="text-align:right">
            ${isOk
              ? '<span class="rcv-status rcv-status--recebida">Completo</span>'
              : (isParcial
                  ? '<span class="rcv-div-badge">Parcial</span>'
                  : '<span class="rcv-status rcv-status--pendente_recebimento">Pendente</span>')}
          </span>
        </div>`;
    }).join('');

    body.querySelectorAll('.rcv-conf-row').forEach(row => {
      const input = row.querySelector('[data-qty]');
      if (!input) return;
      const update = () => {
        const pending = Number(row.dataset.pending) || 0;
        const qty = Number(input.value) || 0;
        const diff = qty - pending;
        const diffEl = row.querySelector('[data-diff]');
        if (diffEl) {
          diffEl.textContent = diff === 0 ? '0' : (diff > 0 ? '+' + diff : String(diff));
          diffEl.className = 'rcv-conf-num ' +
            (diff === 0 ? 'rcv-conf-diff--zero' : (diff > 0 ? 'rcv-conf-diff--pos' : 'rcv-conf-diff--neg'));
        }
        row.classList.toggle('is-divergent', diff !== 0);
      };
      input.addEventListener('input', update);
      update();
    });
  }

  /* =========================================================
     BARCODE READER
     ========================================================= */
  function wireBarcode(modal) {
    const input = modal.querySelector('#rcv-barcode-input');
    if (!input) return;

    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();

      const code = (input.value || '').trim().toLowerCase();
      if (!code) return;

      const match = Array.from(modal.querySelectorAll('.rcv-conf-row'))
        .find(r => String(r.dataset.barcode || '').toLowerCase() === code);

      if (!match) {
        toast('Código não encontrado neste pedido.', 'error');
        input.select();
        return;
      }

      const qtyInput = match.querySelector('[data-qty]');
      const pending = Number(match.dataset.pending) || 0;
      if (qtyInput && !qtyInput.disabled) {
        qtyInput.value = String((Number(qtyInput.value) || 0) + 1);
        qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (pending === 0) {
        toast('Item já recebido por completo.', 'info');
      }

      match.classList.add('is-scanned');
      setTimeout(() => match.classList.remove('is-scanned'), 900);

      input.value = '';
      input.focus();
    });
  }

  /* =========================================================
     CONFIRMAR
     ========================================================= */
  function wireConfirm(modal, purchase, close) {
    const btn = modal.querySelector('#rcv-confirm');
    const err = modal.querySelector('#rcv-error');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      err.hidden = true;
      const payload = [];
      modal.querySelectorAll('.rcv-conf-row').forEach(row => {
        const qtyInput = row.querySelector('[data-qty]');
        if (!qtyInput || qtyInput.disabled) return;
        const qty = Number(qtyInput.value) || 0;
        if (qty > 0) {
          payload.push({ item_id: row.dataset.itemId, qty });
        }
      });

      if (!payload.length) {
        err.textContent = 'Informe ao menos uma quantidade para receber.';
        err.hidden = false;
        return;
      }

      btn.disabled = true;
      btn.classList.add('is-loading');
      try {
        const res = await API.receivePurchase(purchase.id, payload);
        const statusFinal = res && res.status
          ? (STATUS_LABEL[res.status] || res.status)
          : 'recebida';
        toast(`Recebimento registrado! Status: ${statusFinal}`, 'success');
        close();
        await load();
      } catch (e) {
        console.error('[compras/receber] confirm:', e);
        err.textContent = e.message || 'Erro ao confirmar recebimento.';
        err.hidden = false;
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    });
  }

  /* =========================================================
     CARGA
     ========================================================= */
  async function load() {
    const tbody = $('#rcv-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="rcv-loading">Carregando…</div></td></tr>`;
    }
    try {
      const all = await API.listPurchases();
      ui.all = all.filter(p =>
        p.status === 'pendente_recebimento' || p.status === 'recebida_parcial'
      );
      renderKpis();
      applyFilters();
    } catch (e) {
      console.error('[compras/receber] load:', e);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="rcv-err">Erro: ${escapeHTML(e.message)}</div></td></tr>`;
      }
    }
  }

  /* =========================================================
     BOOTSTRAP
     ========================================================= */
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page !== 'compras-receber') return;

    const search = $('#rcv-search');
    if (search) {
      search.addEventListener('input', () => {
        ui.search = (search.value || '').trim().toLowerCase();
        applyFilters();
      });
    }

    const statusSel = $('#rcv-status');
    if (statusSel) {
      statusSel.addEventListener('change', () => {
        ui.status = statusSel.value;
        applyFilters();
      });
    }

    const clearBtn = $('#rcv-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        ui.search = '';
        ui.status = '';
        ui.activeKpi = 'all';
        if (search) search.value = '';
        if (statusSel) statusSel.value = '';
        renderKpis();
        applyFilters();
      });
    }

    load();
  });

  window.Cmp.pageComprasReceber = load;

})();