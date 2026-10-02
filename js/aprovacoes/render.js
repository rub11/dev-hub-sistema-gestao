/* =========================================================
   DEV HUB · Aprovacoes · render
   ---------------------------------------------------------
   Desenha os KPIs e a tabela de compras pendentes.
   ---------------------------------------------------------
   Depende de: state.js, api.js
   Publica em: window.Appr
   ========================================================= */

(function () {
  'use strict';

  const {
    $,
    escapeHTML, fmtBRL, fmtDate, timeAgo,
    state
  } = window.Appr;

  /* =========================================================
     KPIs
     ========================================================= */
  function renderKpis() {
    const wrap = $('#appr-kpis');
    if (!wrap) return;

    const hoje = new Date().toISOString().slice(0, 10);

    const totalCents = state.all.reduce((s, r) => s + (Number(r.total_cents) || 0), 0);

    const maisAntigo = state.all[0];
    const diasAntigo = maisAntigo
      ? Math.floor((Date.now() - new Date(maisAntigo.created_at).getTime()) / 86400000)
      : 0;

    const cards = [
      {
        cls: 'pendente',
        label: 'Aguardando',
        value: String(state.all.length),
        hint: state.all.length === 0
          ? 'Tudo em dia 🎉'
          : `${state.all.length} compra${state.all.length > 1 ? 's' : ''} para revisar`
      },
      {
        cls: 'valor',
        label: 'Valor total',
        value: fmtBRL(totalCents),
        hint: 'Somatório das compras pendentes'
      },
      {
        cls: 'antigo',
        label: 'Mais antiga',
        value: maisAntigo ? timeAgo(maisAntigo.created_at) : '—',
        hint: maisAntigo
          ? `Há ${diasAntigo} dia${diasAntigo !== 1 ? 's' : ''}`
          : 'Nada pendente'
      },
      {
        cls: 'hoje',
        label: 'Enviadas hoje',
        value: String(
          state.all.filter((r) => r.created_at && r.created_at.slice(0, 10) === hoje).length
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
  }

  /* =========================================================
     TABELA
     ========================================================= */
  function renderTable() {
    const tbody = $('#appr-tbody');
    if (!tbody) return;

    const rows = state.all;

    if (!rows.length) {
      tbody.innerHTML = `
        <tr><td colspan="7" style="padding:0;border:0">
          <div class="appr-empty">
            <div class="appr-empty__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            </div>
            <h3 class="appr-empty__title">Nada para aprovar</h3>
            <p class="appr-empty__text">Todas as compras foram revisadas. Bom trabalho! 🎉</p>
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

    /* ---- Bind dos botões ---- */
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
     PUBLICA
     ========================================================= */
  Object.assign(window.Appr, {
    renderKpis,
    renderTable
  });

})();