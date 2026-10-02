/* =========================================================
   DEV HUB · Financeiro · render
   ---------------------------------------------------------
   Renderização das tabelas, cards, movimentações,
   transferências, totais e do filtro aplicado.
   ---------------------------------------------------------
   Depende de: state.js, custom-filters.js (applyCustomConditions)
   Publica em: window.Fin
   ========================================================= */

(function () {
  'use strict';

  const {
    $, $$, escapeHTML,
    fmtBRL, fmtDate, todayISO,
    state,
    STATUS_LABEL, KIND_LABEL, MOV_TYPE_LABEL
  } = window.Fin;

  const { setCount, setViewMode } = window.Fin;

  /* =========================================================
     TRAVA DE COMPRA
     ========================================================= */
  function isPurchaseBlocked(entry) {
    return !!(entry && entry.purchase && entry.purchase.status !== 'recebida');
  }

  function canSettleEntry(entry) {
    if (!entry) return false;
    if (entry.status !== 'pendente') return false;
    if (isPurchaseBlocked(entry)) return false;
    return true;
  }

  /* =========================================================
     RENDER · ALL
     ========================================================= */
  function renderAll() {
    setCount('count-pagar',
      state.entries.filter((e) => e.kind === 'despesa' && e.status === 'pendente').length);
    setCount('count-receber',
      state.entries.filter((e) => e.kind === 'receita' && e.status === 'pendente').length);
    setCount('count-todos', state.entries.length);
    setCount('count-movimentos', state.movements.length);
    setCount('count-transferencias', state.transfers.length);

    if (state.tab === 'pagar')               renderEntries('despesa', 'pagar');
    else if (state.tab === 'receber')        renderEntries('receita', 'receber');
    else if (state.tab === 'todos')          renderAllEntries();
    else if (state.tab === 'movimentos')     renderMovements();
    else if (state.tab === 'transferencias') renderTransfers();

    updateFilterBadge();
  }

  /* =========================================================
     FILTROS DE ENTRADA
     ========================================================= */
  function applyEntryFilters(kind) {
    const f = state.filters;
    let rows = state.entries.filter((e) => e.kind === kind);

    if (f.status)     rows = rows.filter((r) => r.status === f.status);
    if (f.dueFrom)    rows = rows.filter((r) => r.due_date >= f.dueFrom);
    if (f.dueTo)      rows = rows.filter((r) => r.due_date <= f.dueTo);
    if (f.issueFrom)  rows = rows.filter((r) => (r.issue_date || '') >= f.issueFrom);
    if (f.issueTo)    rows = rows.filter((r) => (r.issue_date || '') <= f.issueTo);
    if (f.settleFrom) rows = rows.filter((r) => (r.settlement_date || '') >= f.settleFrom);
    if (f.settleTo)   rows = rows.filter((r) => (r.settlement_date || '') <= f.settleTo);
    if (f.doc)        rows = rows.filter((r) => (r.doc_number || '').toLowerCase().includes(f.doc.toLowerCase()));
    if (f.partner)    rows = rows.filter((r) =>
      (r.partner_name || '').toLowerCase().includes(f.partner.toLowerCase()) ||
      (r.partner_doc  || '').toLowerCase().includes(f.partner.toLowerCase()));
    if (f.notes)      rows = rows.filter((r) => (r.notes || '').toLowerCase().includes(f.notes.toLowerCase()));
    if (f.min != null) rows = rows.filter((r) => Number(r.amount_cents) >= f.min);
    if (f.max != null) rows = rows.filter((r) => Number(r.amount_cents) <= f.max);

    if (f.companies.length) {
      const set = new Set(f.companies);
      rows = rows.filter((r) => set.has(r.company_name));
    }
    if (f.natures.length) {
      const set = new Set(f.natures);
      rows = rows.filter((r) => set.has(r.nature_name));
    }

    const q = f.quick;
    const statuses = [];
    if (q.pendentes) statuses.push('pendente');
    if (q.baixados)  statuses.push('baixado');
    if (q.provisao)  statuses.push('provisao');
    if (statuses.length) {
      const set = new Set(statuses);
      rows = rows.filter((r) => set.has(r.status));
    }
    if (q.real && !q.provisao) {
      rows = rows.filter((r) => r.status !== 'provisao');
    }
    if (kind === 'receita' && q.despesas && !q.receitas) rows = [];
    if (kind === 'despesa' && q.receitas && !q.despesas) rows = [];

    rows = window.Fin.applyCustomConditions(rows);
    return rows;
  }

  function applyAllEntriesFilters() {
    const f = state.filters;
    let rows = state.entries.slice();

    if (f.dueFrom)    rows = rows.filter((r) => r.due_date >= f.dueFrom);
    if (f.dueTo)      rows = rows.filter((r) => r.due_date <= f.dueTo);
    if (f.issueFrom)  rows = rows.filter((r) => (r.issue_date || '') >= f.issueFrom);
    if (f.issueTo)    rows = rows.filter((r) => (r.issue_date || '') <= f.issueTo);
    if (f.settleFrom) rows = rows.filter((r) => (r.settlement_date || '') >= f.settleFrom);
    if (f.settleTo)   rows = rows.filter((r) => (r.settlement_date || '') <= f.settleTo);
    if (f.doc)        rows = rows.filter((r) => (r.doc_number || '').toLowerCase().includes(f.doc.toLowerCase()));
    if (f.partner)    rows = rows.filter((r) =>
      (r.partner_name || '').toLowerCase().includes(f.partner.toLowerCase()) ||
      (r.partner_doc  || '').toLowerCase().includes(f.partner.toLowerCase()));
    if (f.notes)      rows = rows.filter((r) => (r.notes || '').toLowerCase().includes(f.notes.toLowerCase()));
    if (f.min != null) rows = rows.filter((r) => Number(r.amount_cents) >= f.min);
    if (f.max != null) rows = rows.filter((r) => Number(r.amount_cents) <= f.max);

    if (f.companies.length) {
      const set = new Set(f.companies);
      rows = rows.filter((r) => set.has(r.company_name));
    }
    if (f.natures.length) {
      const set = new Set(f.natures);
      rows = rows.filter((r) => set.has(r.nature_name));
    }

    const q = f.quick;
    const statuses = [];
    if (q.pendentes) statuses.push('pendente');
    if (q.baixados)  statuses.push('baixado');
    if (q.provisao)  statuses.push('provisao');
    if (statuses.length) {
      const set = new Set(statuses);
      rows = rows.filter((r) => set.has(r.status));
    }
    if (q.real && !q.provisao) {
      rows = rows.filter((r) => r.status !== 'provisao');
    }
    if (q.receitas && !q.despesas) rows = rows.filter((r) => r.kind === 'receita');
    if (q.despesas && !q.receitas) rows = rows.filter((r) => r.kind === 'despesa');

    rows = window.Fin.applyCustomConditions(rows);
    rows.sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')));
    return rows;
  }

  /* =========================================================
     VIEW HOST + ENTRIES
     ========================================================= */
  function getViewHost(tab) {
    return document.querySelector(`[data-main-pane="${tab}"] [data-view-host]`);
  }

  function renderEntries(kind, tab) {
    const host = getViewHost(tab);
    if (!host) return;
    const rows = applyEntryFilters(kind);
    const tableEl = host.querySelector('[data-view="table"]');
    const gridEl  = host.querySelector('[data-view="grid"]');
    if (tableEl) tableEl.hidden = state.viewMode !== 'table';
    if (gridEl)  gridEl.hidden  = state.viewMode !== 'grid';
    const tbody = tableEl ? tableEl.querySelector('tbody') : null;
    renderEntryTable(tbody, tab, rows, false);
    renderEntryGrid(gridEl, tab, rows);
    renderTotals(tab, rows);
  }

  function renderAllEntries() {
    const host = getViewHost('todos');
    if (!host) return;
    const rows = applyAllEntriesFilters();
    const tableEl = host.querySelector('[data-view="table"]');
    const gridEl  = host.querySelector('[data-view="grid"]');
    if (tableEl) tableEl.hidden = state.viewMode !== 'table';
    if (gridEl)  gridEl.hidden  = state.viewMode !== 'grid';
    const tbody = tableEl ? tableEl.querySelector('tbody') : null;
    renderEntryTable(tbody, 'todos', rows, true);
    renderEntryGrid(gridEl, 'todos', rows);
    renderTotals('todos', rows);
  }

  /* =========================================================
     TABELA
     ========================================================= */
  function renderEntryTable(tbody, tab, rows, showKind) {
    if (!tbody) return;
    const colSpan = showKind ? 9 : 10;

    if (!rows.length) {
      tbody.innerHTML = `
        <tr><td colspan="${colSpan}" style="padding:0;border:0">
          <div class="fin-empty">
            <div class="fin-empty__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M2.5 10h19"/>
              </svg>
            </div>
            <h3 class="fin-empty__title">Nenhum título encontrado</h3>
            <p class="fin-empty__text">Ajuste os filtros ou crie um novo lançamento.</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r) => {
      const sel = state.selected.has(r.id) ? ' is-selected' : '';
      const stClass = 'fin-badge--' + r.status;
      const bal = Number(r.current_balance_cents || (r.amount_cents - (r.paid_cents || 0)));
      const amountClass = r.kind === 'receita' ? 'fin-money--positive' : 'fin-money--negative';
      const sign = r.kind === 'receita' ? '+' : '-';
      const purchaseBlocked = isPurchaseBlocked(r);
      const canSettle       = canSettleEntry(r);

      const kindCell = showKind
        ? `<td><span class="fin-badge fin-badge--${r.kind}">${escapeHTML(KIND_LABEL[r.kind] || r.kind)}</span></td>`
        : '';

      const checkboxCell = showKind
        ? ''
        : `<td><input type="checkbox" data-check="${r.id}" ${sel ? 'checked' : ''} /></td>`;

      return `
        <tr data-id="${r.id}" class="${sel} fin-row-clickable">
          ${checkboxCell}
          ${kindCell}
          <td>
            <div class="fin-code">
              ${escapeHTML(r.title_code || r.doc_number || '—')}
              ${purchaseBlocked ? `<span class="fin-badge fin-badge--aguardando" title="Compra ${escapeHTML(r.purchase.code || '')} ainda não foi recebida">Aguardando entrega</span>` : ''}
            </div>
            <div class="fin-partner__meta">${escapeHTML(r.notes || '')}</div>
          </td>
          <td><span class="fin-badge ${stClass}">${escapeHTML(STATUS_LABEL[r.status] || r.status)}</span></td>
          <td>${fmtDate(r.due_date)}</td>
          <td>
            <div class="fin-partner">
              <span class="fin-partner__name">${escapeHTML(r.partner_name || '—')}</span>
              ${r.partner_doc ? `<span class="fin-partner__meta">${escapeHTML(r.partner_doc)}</span>` : ''}
            </div>
          </td>
          <td>${r.doc_number ? escapeHTML(r.doc_number) : '<span style="color:var(--text-muted)">—</span>'}</td>
          ${showKind ? '' : `
            <td>
              ${r.installment_number && r.installments_total
                ? `<span style="font-variant-numeric:tabular-nums">${r.installment_number}/${r.installments_total}</span>`
                : '<span style="color:var(--text-muted)">—</span>'}
            </td>`}
          <td class="cell--num">
            <span class="fin-money ${amountClass}">${sign} ${fmtBRL(r.amount_cents)}</span>
          </td>
          <td class="cell--num">
            <span class="fin-money">${fmtBRL(bal)}</span>
          </td>
          <td class="cell--right">
            <div class="fin-row-actions" style="display:inline-flex;gap:4px">
              ${canSettle ? `
                <button class="fin-btn fin-btn--ghost fin-btn--sm" data-action="settle-one" data-id="${r.id}" title="Baixar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </button>` : ''}
              ${r.status === 'baixado' ? `
                <button class="fin-btn fin-btn--ghost fin-btn--sm" data-action="reverse-one" data-id="${r.id}" title="Estornar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>
                </button>` : ''}
              <button class="fin-btn fin-btn--ghost fin-btn--sm" data-action="view-one" data-id="${r.id}" title="Abrir / editar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

    bindEntryRowActions(tbody);
  }

  /* =========================================================
     GRID
     ========================================================= */
  function renderEntryGrid(gridEl, tab, rows) {
    if (!gridEl) return;
    if (!rows.length) {
      gridEl.innerHTML = `
        <div class="fin-empty" style="grid-column:1/-1">
          <div class="fin-empty__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M2.5 10h19"/>
            </svg>
          </div>
          <h3 class="fin-empty__title">Nenhum título encontrado</h3>
          <p class="fin-empty__text">Ajuste os filtros ou crie um novo lançamento.</p>
        </div>`;
      return;
    }
    gridEl.innerHTML = rows.map(buildEntryCard).join('');
    gridEl.querySelectorAll('.fin-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const row = state.entries.find((x) => x.id === id);
        if (row) window.Fin.openEntryModal?.(row);
      });
    });
  }

  function buildEntryCard(r) {
    const bal = Number(r.current_balance_cents || (r.amount_cents - (r.paid_cents || 0)));
    const stLabel = STATUS_LABEL[r.status] || r.status;
    const kindLabel = KIND_LABEL[r.kind] || r.kind;
    const valueClass = r.kind === 'receita' ? 'fin-money--positive' : 'fin-money--negative';
    const sign = r.kind === 'receita' ? '+' : '-';
    const purchaseBlocked = isPurchaseBlocked(r);

    let dueMeta = '';
    let dueClass = '';
    if (r.due_date) {
      const today = new Date(todayISO() + 'T00:00:00');
      const due   = new Date(r.due_date + 'T00:00:00');
      const diffDays = Math.round((due - today) / 86400000);
      if (diffDays < 0 && r.status === 'pendente') {
        dueMeta = `Venceu há ${Math.abs(diffDays)}d`;
        dueClass = 'fin-card__due--late';
      } else if (diffDays === 0) {
        dueMeta = 'Vence hoje';
        dueClass = 'fin-card__due--today';
      } else if (diffDays > 0) {
        dueMeta = `Vence em ${diffDays}d`;
      } else {
        dueMeta = fmtDate(r.due_date);
      }
    }

    return `
      <button type="button" class="fin-card fin-card--${escapeHTML(r.kind || 'despesa')}"
              data-id="${escapeHTML(r.id)}"
              aria-label="Abrir título ${escapeHTML(r.title_code || r.doc_number || '')}">
        <header class="fin-card__head">
          <span class="fin-badge fin-badge--${escapeHTML(r.kind || 'despesa')}">${escapeHTML(kindLabel)}</span>
          <span class="fin-card__date">${fmtDate(r.due_date)}</span>
        </header>
        <h4 class="fin-card__title">${escapeHTML(r.title_code || r.doc_number || '—')}</h4>
        <p class="fin-card__partner">${escapeHTML(r.partner_name || '—')}</p>
        <div class="fin-card__value ${valueClass}">${sign} ${fmtBRL(r.amount_cents)}</div>
        <footer class="fin-card__foot">
          <span class="fin-badge fin-badge--${escapeHTML(r.status)}">${escapeHTML(stLabel)}</span>
          ${purchaseBlocked
            ? `<span class="fin-badge fin-badge--aguardando" title="Compra ${escapeHTML(r.purchase.code || '')} ainda não foi recebida">Aguardando entrega</span>`
            : `<span class="fin-card__due ${dueClass}">${escapeHTML(dueMeta)}</span>`}
        </footer>
      </button>
    `;
  }

  /* =========================================================
     BIND · LINHAS
     ========================================================= */
  function bindEntryRowActions(tbody) {
    tbody.querySelectorAll('[data-check]').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.check;
        if (e.target.checked) state.selected.add(id);
        else state.selected.delete(id);
        e.target.closest('tr').classList.toggle('is-selected', e.target.checked);
        updateActionButtons();
      });
    });

    tbody.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const row = state.entries.find((x) => x.id === id);
        if (!row) return;
        if (btn.dataset.action === 'settle-one')  window.Fin.openSettleModal?.(row);
        if (btn.dataset.action === 'reverse-one') window.Fin.openReverseModal?.(row);
        if (btn.dataset.action === 'view-one')    window.Fin.openEntryModal?.(row);
      });
    });

    tbody.querySelectorAll('tr.fin-row-clickable').forEach((tr) => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button, input, a, select, label')) return;
        const id = tr.dataset.id;
        const row = state.entries.find((x) => x.id === id);
        if (row) window.Fin.openEntryModal?.(row);
      });
      tr.style.cursor = 'pointer';
    });

    updateActionButtons();
  }

  /* =========================================================
     TOTAIS
     ========================================================= */
  function renderTotals(tab, rows) {
    const wrap = $(`#fin-totals-${tab}`);
    if (!wrap) return;

    let receitas = 0, despesas = 0, baixado = 0, aberto = 0;
    rows.forEach((r) => {
      const a = Number(r.amount_cents) || 0;
      const p = Number(r.paid_cents) || 0;
      if (r.kind === 'receita') receitas += a; else despesas += a;
      baixado += p;
      aberto += Math.max(0, a - p);
    });

    if (tab === 'todos') {
      wrap.innerHTML = `
        <div class="fin-total"><span class="fin-total__label">Receitas</span>
          <span class="fin-total__value" style="color:var(--success)">${fmtBRL(receitas)}</span></div>
        <div class="fin-total"><span class="fin-total__label">Despesas</span>
          <span class="fin-total__value" style="color:var(--danger)">${fmtBRL(despesas)}</span></div>
        <div class="fin-total"><span class="fin-total__label">Rec-Desp</span>
          <span class="fin-total__value">${fmtBRL(receitas - despesas)}</span></div>
        <div class="fin-total"><span class="fin-total__label">Baixado</span>
          <span class="fin-total__value">${fmtBRL(baixado)}</span></div>
        <div class="fin-total fin-total--receita"><span class="fin-total__label">Em aberto</span>
          <span class="fin-total__value">${fmtBRL(aberto)}</span></div>`;
      return;
    }

    let total = 0;
    rows.forEach((r) => { total += Number(r.amount_cents) || 0; });
    wrap.innerHTML = `
      <div class="fin-total"><span class="fin-total__label">Total</span>
        <span class="fin-total__value">${fmtBRL(total)}</span></div>
      <div class="fin-total"><span class="fin-total__label">Baixado</span>
        <span class="fin-total__value">${fmtBRL(baixado)}</span></div>
      <div class="fin-total fin-total--receita"><span class="fin-total__label">Em aberto</span>
        <span class="fin-total__value">${fmtBRL(aberto)}</span></div>`;
  }

  /* =========================================================
     MOVIMENTAÇÕES
     ========================================================= */
  function renderMovements() {
    const tbody = $('#fin-tbody-movimentos');
    if (!tbody) return;
    let rows = state.movements.slice();
    if (state.filters.accounts.length) {
      const set = new Set(state.filters.accounts);
      rows = rows.filter((m) => set.has(m.account_id));
    }
    if (state.filters.dueFrom) rows = rows.filter((m) => m.movement_date >= state.filters.dueFrom);
    if (state.filters.dueTo)   rows = rows.filter((m) => m.movement_date <= state.filters.dueTo);

    if (!rows.length) {
      tbody.innerHTML = `
        <tr><td colspan="8" style="padding:0;border:0">
          <div class="fin-empty">
            <div class="fin-empty__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m7 15 3.5-4 3 2.5L20 7"/>
              </svg>
            </div>
            <h3 class="fin-empty__title">Nenhuma movimentação</h3>
            <p class="fin-empty__text">Não há movimentações no período selecionado.</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((m) => {
      const acc = state.accounts.find((a) => a.id === m.account_id);
      const isIn = Number(m.amount_cents) > 0;
      const cls = isIn ? 'fin-money--positive' : 'fin-money--negative';
      const sign = isIn ? '+' : '-';
      return `
        <tr>
          <td>${fmtDate(m.movement_date)}</td>
          <td>${escapeHTML(acc ? acc.name : '—')}</td>
          <td>${escapeHTML(MOV_TYPE_LABEL[m.type] || m.type)}</td>
          <td>${escapeHTML(m.description || '—')}</td>
          <td>${m.origin_type ? `<span class="fin-badge" style="background:var(--surface-2);color:var(--text-muted)">${escapeHTML(m.origin_type)}</span>` : '—'}</td>
          <td class="cell--num"><span class="fin-money ${cls}">${sign} ${fmtBRL(Math.abs(m.amount_cents))}</span></td>
          <td class="cell--num"><span class="fin-money">${m.balance_after_cents != null ? fmtBRL(m.balance_after_cents) : '—'}</span></td>
          <td>${m.reconciled ? '<span class="fin-badge fin-badge--baixado">Conciliado</span>' : '<span style="color:var(--text-muted);font-size:12px">—</span>'}</td>
        </tr>`;
    }).join('');
  }

  /* =========================================================
     TRANSFERÊNCIAS
     ========================================================= */
  function renderTransfers() {
    const tbody = $('#fin-tbody-transferencias');
    if (!tbody) return;
    let rows = state.transfers.slice();
    if (state.filters.accounts.length) {
      const set = new Set(state.filters.accounts);
      rows = rows.filter((t) => set.has(t.from_account_id) || set.has(t.to_account_id));
    }
    if (!rows.length) {
      tbody.innerHTML = `
        <tr><td colspan="6" style="padding:0;border:0">
          <div class="fin-empty">
            <div class="fin-empty__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 10 2 5l5-5"/><path d="M2 5h13a5 5 0 0 1 0 10h-3"/>
                <path d="M17 14l5 5-5 5"/><path d="M22 19H9a5 5 0 0 1 0-10h3"/>
              </svg>
            </div>
            <h3 class="fin-empty__title">Nenhuma transferência</h3>
            <p class="fin-empty__text">Use o botão "Transferir" para mover saldo entre contas.</p>
          </div>
        </td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map((t) => {
      const from = state.accounts.find((a) => a.id === t.from_account_id);
      const to   = state.accounts.find((a) => a.id === t.to_account_id);
      return `
        <tr>
          <td>${fmtDate(t.transfer_date)}</td>
          <td>${escapeHTML(from ? from.name : '—')}</td>
          <td>${escapeHTML(to ? to.name : '—')}</td>
          <td>${escapeHTML(t.description || '—')}</td>
          <td class="cell--num"><span class="fin-money">${fmtBRL(t.amount_cents)}</span></td>
          <td>${escapeHTML(t.created_by_name || '—')}</td>
        </tr>`;
    }).join('');
  }

  /* =========================================================
     BADGE / BOTÕES
     ========================================================= */
  function updateFilterBadge() {
    const f = state.filters;
    let n = 0;
    ['kind','dueFrom','dueTo','issueFrom','issueTo','settleFrom','settleTo','doc','partner','notes']
      .forEach((k) => { if (f[k]) n++; });
    n += f.companies.length;
    n += f.natures.length;
    n += f.accounts.length;

    if (state.custom && state.custom.enabled) {
      const activeFilters = state.custom.filters.filter(x => x.active).length;
      n += activeFilters;
    }

    const badge = document.getElementById('fin-filter-count');
    if (badge) {
      badge.textContent = String(n);
      badge.dataset.empty = n === 0 ? 'true' : 'false';
    }
    const pill = document.getElementById('fin-filter-pill');
    if (pill) {
      pill.textContent = String(n);
      pill.dataset.empty = n === 0 ? 'true' : 'false';
    }
  }

  function updateActionButtons() {
    const n = state.selected.size;
    const pane = $(`.fin-main > .fin-tabpane[data-main-pane="${state.tab}"]`);
    if (!pane) return;
    pane.querySelectorAll('.fin-actions [data-action]').forEach((btn) => {
      btn.disabled = n === 0;
    });
    const editBtn = pane.querySelector('.fin-actions [data-action="edit"]');
    const delBtn  = pane.querySelector('.fin-actions [data-action="delete"]');
    if (editBtn) editBtn.disabled = n !== 1;
    if (delBtn)  delBtn.disabled  = n !== 1;
  }

  /* =========================================================
     PUBLICA
     ========================================================= */
  Object.assign(window.Fin, {
    isPurchaseBlocked,
    canSettleEntry,
    renderAll,
    applyEntryFilters,
    applyAllEntriesFilters,
    renderEntries,
    renderAllEntries,
    renderTotals,
    renderMovements,
    renderTransfers,
    updateFilterBadge,
    updateActionButtons
  });

})();