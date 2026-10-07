/* =========================================================
   DEV HUB · Aprovacoes · render
   ---------------------------------------------------------
   Desenha KPIs e as duas tabelas (compras + vendas).
   ---------------------------------------------------------
   Depende de: state.js, api.js
   Publica em: window.Appr
   ========================================================= */

(function () {
  'use strict';

  const {
    $,
    escapeHTML, fmtBRL, fmtBRLFromReais, fmtDate, timeAgo, fmtSaleNumber,
    state
  } = window.Appr;

  /* =========================================================
     KPIs (compras + vendas somados)
     ========================================================= */
  function renderKpis() {
    const wrap = $('#appr-kpis');
    if (!wrap) return;

    const hoje = new Date().toISOString().slice(0, 10);

    /* Compras */
    const totalComprasCents = state.all.reduce((s, r) => s + (Number(r.total_cents) || 0), 0);
    const maisAntigoCompra  = state.all[0];
    const diasAntigoCompra  = maisAntigoCompra
      ? Math.floor((Date.now() - new Date(maisAntigoCompra.created_at).getTime()) / 86400000)
      : 0;

    /* Vendas (reais) */
    const totalVendasReais = state.sales.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const maisAntigaVenda  = state.sales[0];
    const diasAntigaVenda  = maisAntigaVenda
      ? Math.floor((Date.now() - new Date(maisAntigaVenda.created_at).getTime()) / 86400000)
      : 0;

    const totalPendentes = state.all.length + state.sales.length;

    /* Mais antiga entre as duas filas */
    let maisAntigaLabel = '—';
    let maisAntigaHint  = 'Nada pendente';
    if (maisAntigoCompra && maisAntigaVenda) {
      if (diasAntigoCompra >= diasAntigaVenda) {
        maisAntigaLabel = timeAgo(maisAntigoCompra.created_at);
        maisAntigaHint  = `Há ${diasAntigoCompra} dia${diasAntigoCompra !== 1 ? 's' : ''} (compra)`;
      } else {
        maisAntigaLabel = timeAgo(maisAntigaVenda.created_at);
        maisAntigaHint  = `Há ${diasAntigaVenda} dia${diasAntigaVenda !== 1 ? 's' : ''} (venda)`;
      }
    } else if (maisAntigoCompra) {
      maisAntigaLabel = timeAgo(maisAntigoCompra.created_at);
      maisAntigaHint  = `Há ${diasAntigoCompra} dia${diasAntigoCompra !== 1 ? 's' : ''} (compra)`;
    } else if (maisAntigaVenda) {
      maisAntigaLabel = timeAgo(maisAntigaVenda.created_at);
      maisAntigaHint  = `Há ${diasAntigaVenda} dia${diasAntigaVenda !== 1 ? 's' : ''} (venda)`;
    }

    const cards = [
      {
        cls: 'pendente',
        label: 'Aguardando',
        value: String(totalPendentes),
        hint: totalPendentes === 0
          ? 'Tudo em dia 🎉'
          : `${state.all.length} compra${state.all.length !== 1 ? 's' : ''} · ${state.sales.length} venda${state.sales.length !== 1 ? 's' : ''}`
      },
      {
        cls: 'valor',
        label: 'Valor total',
        value: fmtBRL(totalComprasCents + Math.round(totalVendasReais * 100)),
        hint: 'Compras + vendas pendentes'
      },
      {
        cls: 'antigo',
        label: 'Mais antiga',
        value: maisAntigaLabel,
        hint:  maisAntigaHint
      },
      {
        cls: 'hoje',
        label: 'Enviadas hoje',
        value: String(
          state.all.filter(r => r.created_at && r.created_at.slice(0, 10) === hoje).length +
          state.sales.filter(r => r.created_at && r.created_at.slice(0, 10) === hoje).length
        ),
        hint: 'Novas solicitações'
      }
    ];

    wrap.innerHTML = cards.map((c) => `
      <div class="appr-kpi appr-kpi--${c.cls}">
        <span class="appr-kpi__label">${escapeHTML(c.label)}</span>
        <span class="appr-kpi__value">${escapeHTML(c.value)}</span>
        <span class="appr-kpi__hint">${escapeHTML(c.hint)}</span>
      </div>
    `).join('');

    /* Badges nos cabeçalhos */
    const pc = document.getElementById('appr-purchases-count');
    if (pc) {
      pc.textContent = String(state.all.length);
      pc.className = 'appr-badge' + (state.all.length === 0 ? ' appr-badge--muted' : '');
    }
    const sc = document.getElementById('appr-sales-count');
    if (sc) {
      sc.textContent = String(state.sales.length);
      sc.className = 'appr-badge' + (state.sales.length === 0 ? ' appr-badge--muted' : '');
    }
  }

  /* =========================================================
     TABELA · COMPRAS
     ========================================================= */
  function renderTable() {
    const tbody = $('#appr-tbody');
    if (!tbody) return;

    const rows = state.all;

    if (!rows.length) {
      tbody.innerHTML = `
        <tr><td colspan="7" style="padding:0;border:0">
          <div class="appr-panel__empty">
            <div class="appr-panel__empty-title">Nada para aprovar</div>
            <p class="appr-panel__empty-text">Todas as compras foram revisadas. Bom trabalho! 🎉</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r) => `
      <tr data-id="${r.id}">
        <td><span class="appr-code">${escapeHTML(r.code || '—')}</span></td>
        <td>
          <div class="appr-supplier">
            <span class="appr-supplier__name">${escapeHTML(r.created_by_name || '—')}</span>
            <span class="appr-supplier__meta">${timeAgo(r.created_at)}</span>
          </div>
        </td>
        <td>
          <div class="appr-supplier">
            <span class="appr-supplier__name">${escapeHTML(r.supplier_name || 'Sem fornecedor')}</span>
            ${r.invoice_number ? `<span class="appr-supplier__meta">NF-e ${escapeHTML(r.invoice_number)}</span>` : ''}
          </div>
        </td>
        <td>${fmtDate(r.created_at)}</td>
        <td class="cell--num"><span class="appr-money">${fmtBRL(r.total_cents)}</span></td>
        <td><span class="appr-chip">Ver itens</span></td>
        <td class="cell--right">
          <div class="appr-actions">
            <button class="appr-action" data-action="view" data-id="${r.id}" title="Ver detalhes">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button class="appr-action appr-action--approve" data-action="approve" data-id="${r.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
              Aprovar
            </button>
            <button class="appr-action appr-action--reject" data-action="reject" data-id="${r.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
              Rejeitar
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-action]').forEach((btn) => {
      const id = btn.dataset.id;
      const row = state.all.find((x) => x.id === id);
      if (!row) return;
      if (btn.dataset.action === 'view')    btn.addEventListener('click', () => window.Appr.openViewModal(row));
      if (btn.dataset.action === 'approve') btn.addEventListener('click', () => window.Appr.openApproveModal(row));
      if (btn.dataset.action === 'reject')  btn.addEventListener('click', () => window.Appr.openRejectModal(row));
    });
  }

  /* =========================================================
     TABELA · VENDAS
     ========================================================= */
  function renderSalesTable() {
    const tbody = $('#appr-sales-tbody');
    if (!tbody) return;

    const rows = state.sales;

    if (!rows.length) {
      tbody.innerHTML = `
        <tr><td colspan="7" style="padding:0;border:0">
          <div class="appr-panel__empty">
            <div class="appr-panel__empty-title">Nada para aprovar</div>
            <p class="appr-panel__empty-text">Todas as vendas foram revisadas. Bom trabalho! 🎉</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r) => {
      const cliente = (r.customers && r.customers.name) ? r.customers.name : '—';
      return `
        <tr data-id="${r.id}">
          <td><span class="appr-code">${escapeHTML(fmtSaleNumber(r))}</span></td>
          <td>
            <div class="appr-supplier">
              <span class="appr-supplier__name">${escapeHTML(cliente)}</span>
            </div>
          </td>
          <td>
            <div class="appr-supplier">
              <span class="appr-supplier__name">${escapeHTML(r.created_by_name || '—')}</span>
              <span class="appr-supplier__meta">${timeAgo(r.created_at)}</span>
            </div>
          </td>
          <td>${fmtDate(r.created_at)}</td>
          <td class="cell--num"><span class="appr-money">${fmtBRLFromReais(r.total)}</span></td>
          <td><span class="appr-chip">Ver itens</span></td>
          <td class="cell--right">
            <div class="appr-actions">
              <button class="appr-action" data-action="view" data-id="${r.id}" title="Ver detalhes">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              <button class="appr-action appr-action--approve" data-action="approve" data-id="${r.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
                Aprovar
              </button>
              <button class="appr-action appr-action--reject" data-action="reject" data-id="${r.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
                Rejeitar
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-action]').forEach((btn) => {
      const id = btn.dataset.id;
      const row = state.sales.find((x) => x.id === id);
      if (!row) return;
      if (btn.dataset.action === 'view')    btn.addEventListener('click', () => window.Appr.openViewSaleModal(row));
      if (btn.dataset.action === 'approve') btn.addEventListener('click', () => window.Appr.openApproveSaleModal(row));
      if (btn.dataset.action === 'reject')  btn.addEventListener('click', () => window.Appr.openRejectSaleModal(row));
    });
  }

  /* =========================================================
     PUBLICA
     ========================================================= */
  Object.assign(window.Appr, {
    renderKpis,
    renderTable,
    renderSalesTable
  });

})();