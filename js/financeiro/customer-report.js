/* =========================================================
   DEV HUB · Financeiro · customer-report
   Relatório 360° por cliente / fornecedor.
   ========================================================= */

(function () {
  'use strict';

  const { escapeHTML, fmtBRL, fmtDate, state, db } = window.Fin;

  const todayISO = () => new Date().toISOString().slice(0, 10);

  /* =========================================================
     BUSCA DO CLIENTE (telefone / e-mail)
     ========================================================= */
  async function fetchCustomerInfo(partnerName, partnerDoc) {
    try {
      let q = db().from('customers')
        .select('id, name, cpf_cnpj, phone, email');

      if (partnerDoc) {
        q = q.eq('cpf_cnpj', partnerDoc);
      } else if (partnerName) {
        q = q.ilike('name', partnerName);
      }

      const { data, error } = await q.limit(1).maybeSingle();
      if (error) {
        console.warn('[report] customers:', error);
        return null;
      }
      return data;
    } catch (e) {
      console.warn('[report] customers falhou:', e);
      return null;
    }
  }

  /* =========================================================
     MODAL
     ========================================================= */
  async function openCustomerReport(partnerName, partnerDoc) {
    if (!partnerName) {
      window.Fin.toast?.('Parceiro não identificado.', 'error');
      return;
    }

    const partnerEntries = state.entries.filter(e =>
      (e.partner_name === partnerName) ||
      (partnerDoc && e.partner_doc === partnerDoc)
    );

    if (!partnerEntries.length) {
      window.Fin.toast?.('Nenhum título encontrado para este parceiro.', 'error');
      return;
    }

    const isCustomer = partnerEntries.some(e => e.kind === 'receita');
    const kind = isCustomer ? 'receita' : 'despesa';

    const modal = document.createElement('div');
    modal.className = 'fin-modal fin-modal--report';
    modal.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog fin-modal__dialog--lg fin-report-dialog"
           role="dialog" aria-modal="true" aria-labelledby="rep-title">

        <header class="fin-modal__head fin-report-head">
          <div class="fin-report-head__main">
            <h3 class="fin-modal__title" id="rep-title">
              Relatório de ${isCustomer ? 'Recebimentos' : 'Pagamentos'}
            </h3>
            <p class="fin-report-head__partner">
              <strong>${escapeHTML(partnerName)}</strong>
              ${partnerDoc ? '<span class="fin-report-head__doc">' + escapeHTML(partnerDoc) + '</span>' : ''}
            </p>
            <div class="fin-report-head__contact" id="rep-contact">
              <span class="fin-report-skel">Carregando contato…</span>
            </div>
          </div>
          <button class="fin-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>

        <div class="fin-modal__body fin-report-body">

          <div class="fin-report-filters">
            <div class="fin-field">
              <label>Data inicial</label>
              <input type="date" id="rep-start" />
            </div>
            <div class="fin-field">
              <label>Data final</label>
              <input type="date" id="rep-end" />
            </div>
            <div class="fin-field">
              <label>Status</label>
              <select id="rep-status">
                <option value="">Todos</option>
                <option value="pendente">Só pendentes</option>
                <option value="baixado">Só baixados</option>
              </select>
            </div>
            <button type="button" class="fin-btn fin-btn--primary" id="rep-filter-btn" style="height:40px;">Filtrar</button>
            <button type="button" class="fin-btn fin-btn--ghost" id="rep-clear-btn" style="height:40px;">Limpar</button>
          </div>

          <div class="rep-summary-grid" id="rep-summary"></div>

          <nav class="fin-report-tabs" role="tablist">
            <button type="button" class="fin-report-tab is-active" data-tab="titulos" role="tab" aria-selected="true">
              Títulos <span class="fin-report-tab__count" id="cnt-titulos">0</span>
            </button>
            <button type="button" class="fin-report-tab" data-tab="pagamentos" role="tab" aria-selected="false">
              Histórico de pagamentos <span class="fin-report-tab__count" id="cnt-pagamentos">0</span>
            </button>
            <button type="button" class="fin-report-tab" data-tab="atrasos" role="tab" aria-selected="false">
              Histórico de atrasos <span class="fin-report-tab__count" id="cnt-atrasos">0</span>
            </button>
          </nav>

          <div class="fin-report-pane is-active" data-pane="titulos">
            <div class="fin-report-scroll">
              <table class="fin-table fin-report-table">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Vencimento</th>
                    <th>Status</th>
                    <th class="cell--num">Valor</th>
                    <th class="cell--num">Baixado</th>
                    <th class="cell--num">Saldo</th>
                  </tr>
                </thead>
                <tbody id="rep-tbody-titulos"></tbody>
              </table>
            </div>
          </div>

          <div class="fin-report-pane" data-pane="pagamentos">
            <div class="fin-report-scroll">
              <table class="fin-table fin-report-table">
                <thead>
                  <tr>
                    <th>Data baixa</th>
                    <th>Título</th>
                    <th>Vencimento</th>
                    <th class="cell--num">Valor pago</th>
                    <th class="cell--num">Diferença</th>
                  </tr>
                </thead>
                <tbody id="rep-tbody-pagamentos"></tbody>
              </table>
            </div>
          </div>

          <div class="fin-report-pane" data-pane="atrasos">
            <div class="fin-report-scroll">
              <table class="fin-table fin-report-table">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Vencimento</th>
                    <th>Baixa</th>
                    <th class="cell--num">Dias em atraso</th>
                    <th class="cell--num">Valor</th>
                  </tr>
                </thead>
                <tbody id="rep-tbody-atrasos"></tbody>
              </table>
            </div>
          </div>

        </div>

        <footer class="fin-modal__foot">
          <button type="button" class="fin-btn fin-btn--ghost" data-close>Fechar</button>
          <button type="button" class="fin-btn fin-btn--primary" id="rep-export-csv">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round"
                 style="width:16px;height:16px;margin-right:4px;">
              <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>
            </svg>
            Exportar CSV
          </button>
        </footer>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));

    /* ---------- Preenche o contato em background ---------- */
    fetchCustomerInfo(partnerName, partnerDoc).then(info => {
      const el = modal.querySelector('#rep-contact');
      if (!el) return;

      if (!info) {
        el.innerHTML = '<span class="fin-report-muted">Telefone e e-mail não cadastrados</span>';
        return;
      }

      const parts = [];
      if (info.phone) {
        parts.push(`
          <span class="fin-report-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            ${escapeHTML(info.phone)}
          </span>
        `);
      }
      if (info.email) {
        parts.push(`
          <span class="fin-report-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>
            </svg>
            ${escapeHTML(info.email)}
          </span>
        `);
      }

      el.innerHTML = parts.length
        ? parts.join('')
        : '<span class="fin-report-muted">Telefone e e-mail não cadastrados</span>';
    });

    const q = (sel) => modal.querySelector(sel);

    /* ---------- Tabs ---------- */
    modal.querySelectorAll('.fin-report-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const t = tab.dataset.tab;
        modal.querySelectorAll('.fin-report-tab').forEach(x => {
          const on = x.dataset.tab === t;
          x.classList.toggle('is-active', on);
          x.setAttribute('aria-selected', String(on));
        });
        modal.querySelectorAll('.fin-report-pane').forEach(p => {
          p.classList.toggle('is-active', p.dataset.pane === t);
        });
      });
    });

    /* ---------- Filtro ---------- */
    function getFilteredEntries() {
      const start  = q('#rep-start').value;
      const end    = q('#rep-end').value;
      const status = q('#rep-status').value;

      let filtered = partnerEntries.filter(e => e.kind === kind);
      if (start)  filtered = filtered.filter(e => e.due_date >= start);
      if (end)    filtered = filtered.filter(e => e.due_date <= end);
      if (status) filtered = filtered.filter(e => e.status === status);
      return filtered;
    }

    /* ---------- Render ---------- */
    function renderReport() {
      const today = todayISO();
      const filtered = getFilteredEntries();

      let totalCompras   = 0;
      let totalRecebido  = 0;
      let totalPendente  = 0;
      let emAtraso       = 0;
      let aVencer        = 0;
      let countPendentes = 0;
      let countTitulos   = 0;
      let ultimaMov      = null;

      filtered.forEach(e => {
        const val  = Number(e.amount_cents) || 0;
        const paid = Number(e.paid_cents)   || 0;
        const bal  = Number(e.current_balance_cents || (val - paid));

        totalCompras += val;
        countTitulos++;

        if (e.status === 'baixado') {
          totalRecebido += paid || val;
          if (e.settlement_date) {
            if (!ultimaMov || e.settlement_date > ultimaMov) ultimaMov = e.settlement_date;
          }
        }
        if (e.status === 'pendente') {
          totalPendente += bal;
          countPendentes++;
          if (e.due_date && e.due_date < today) emAtraso += bal;
          else                                  aVencer  += bal;
        }
      });

      /* Cards */
      q('#rep-summary').innerHTML = `
        <div class="rep-card rep-card--neutral">
          <span class="rep-card__label">Total de compras</span>
          <strong class="rep-card__value">${fmtBRL(totalCompras)}</strong>
          <span class="rep-card__hint">${countTitulos} título(s) no período</span>
        </div>
        <div class="rep-card rep-card--success">
          <span class="rep-card__label">Total ${isCustomer ? 'recebido' : 'pago'}</span>
          <strong class="rep-card__value">${fmtBRL(totalRecebido)}</strong>
          <span class="rep-card__hint">${ultimaMov ? 'Última: ' + fmtDate(ultimaMov) : 'Sem baixas'}</span>
        </div>
        <div class="rep-card rep-card--warning">
          <span class="rep-card__label">Total pendente</span>
          <strong class="rep-card__value">${fmtBRL(totalPendente)}</strong>
          <span class="rep-card__hint">${countPendentes} título(s) em aberto</span>
        </div>
        <div class="rep-card rep-card--danger">
          <span class="rep-card__label">Em atraso</span>
          <strong class="rep-card__value">${fmtBRL(emAtraso)}</strong>
          <span class="rep-card__hint">Valores vencidos</span>
        </div>
        <div class="rep-card rep-card--info">
          <span class="rep-card__label">A vencer</span>
          <strong class="rep-card__value">${fmtBRL(aVencer)}</strong>
          <span class="rep-card__hint">Valores futuros</span>
        </div>
        <div class="rep-card rep-card--purple">
          <span class="rep-card__label">Títulos em aberto</span>
          <strong class="rep-card__value">${countPendentes}</strong>
          <span class="rep-card__hint">${countTitulos} no total</span>
        </div>
      `;

      /* Tab: Títulos */
      const sorted = filtered.slice().sort((a, b) =>
        String(a.due_date || '').localeCompare(String(b.due_date || ''))
      );
      const tbodyTit = q('#rep-tbody-titulos');
      if (!sorted.length) {
        tbodyTit.innerHTML = '<tr><td colspan="6" class="rep-empty">Nenhum título no período filtrado.</td></tr>';
      } else {
        tbodyTit.innerHTML = sorted.map(e => {
          const bal  = Number(e.current_balance_cents || (e.amount_cents - (e.paid_cents || 0)));
          const paid = Number(e.paid_cents) || 0;
          const isLate = e.status === 'pendente' && e.due_date < today;
          return `
            <tr>
              <td>
                <div class="rep-cell-title">${escapeHTML(e.title_code || e.doc_number || '—')}</div>
                <div class="rep-muted">${escapeHTML(e.notes || '')}</div>
              </td>
              <td style="${isLate ? 'color:var(--danger);font-weight:600;' : ''}">${fmtDate(e.due_date)}</td>
              <td>
                <span class="fin-badge fin-badge--${escapeHTML(e.status)}">
                  ${escapeHTML(window.Fin.STATUS_LABEL[e.status] || e.status)}
                </span>
              </td>
              <td class="cell--num rep-cell-value">${fmtBRL(e.amount_cents)}</td>
              <td class="cell--num">${paid ? fmtBRL(paid) : '—'}</td>
              <td class="cell--num">${fmtBRL(bal)}</td>
            </tr>
          `;
        }).join('');
      }
      q('#cnt-titulos').textContent = sorted.length;

      /* Tab: Pagamentos */
      const pagos = filtered
        .filter(e => e.status === 'baixado' && e.settlement_date)
        .sort((a, b) => String(b.settlement_date).localeCompare(String(a.settlement_date)));

      const tbodyPag = q('#rep-tbody-pagamentos');
      if (!pagos.length) {
        tbodyPag.innerHTML = '<tr><td colspan="5" class="rep-empty">Nenhum pagamento registrado.</td></tr>';
      } else {
        tbodyPag.innerHTML = pagos.map(e => {
          const paid = Number(e.paid_cents) || Number(e.amount_cents) || 0;
          const diff = paid - Number(e.amount_cents || 0);
          const diffCls = diff > 0 ? 'rep-money--pos' : diff < 0 ? 'rep-money--neg' : '';
          return `
            <tr>
              <td>${fmtDate(e.settlement_date)}</td>
              <td>${escapeHTML(e.title_code || e.doc_number || '—')}</td>
              <td>${fmtDate(e.due_date)}</td>
              <td class="cell--num rep-cell-value">${fmtBRL(paid)}</td>
              <td class="cell--num ${diffCls}">${diff !== 0 ? (diff > 0 ? '+' : '') + fmtBRL(diff) : '—'}</td>
            </tr>
          `;
        }).join('');
      }
      q('#cnt-pagamentos').textContent = pagos.length;

      /* Tab: Atrasos */
      const atrasos = filtered
        .filter(e =>
          e.status === 'baixado' &&
          e.settlement_date &&
          e.due_date &&
          e.settlement_date > e.due_date
        )
        .sort((a, b) => String(b.settlement_date).localeCompare(String(a.settlement_date)));

      const tbodyAtr = q('#rep-tbody-atrasos');
      if (!atrasos.length) {
        tbodyAtr.innerHTML = '<tr><td colspan="5" class="rep-empty">Nenhum atraso registrado.</td></tr>';
      } else {
        tbodyAtr.innerHTML = atrasos.map(e => {
          const dias = Math.round(
            (new Date(e.settlement_date) - new Date(e.due_date)) / 86400000
          );
          return `
            <tr>
              <td>${escapeHTML(e.title_code || e.doc_number || '—')}</td>
              <td>${fmtDate(e.due_date)}</td>
              <td>${fmtDate(e.settlement_date)}</td>
              <td class="cell--num rep-cell-late">${dias} dia(s)</td>
              <td class="cell--num rep-cell-value">${fmtBRL(e.amount_cents)}</td>
            </tr>
          `;
        }).join('');
      }
      q('#cnt-atrasos').textContent = atrasos.length;
    }

    /* ---------- Exportar CSV ---------- */
    function exportCSV() {
      const filtered = getFilteredEntries();
      const SEP = ';';
      const BOM = '\uFEFF';
      const brl = (c) => ((Number(c) || 0) / 100).toFixed(2).replace('.', ',');

      const rows = [];
      rows.push(['Relatório do parceiro', partnerName, partnerDoc || ''].join(SEP));
      rows.push(['Gerado em', new Date().toLocaleString('pt-BR')].join(SEP));
      rows.push('');
      rows.push(['Título', 'Vencimento', 'Status', 'Valor (R$)', 'Pago (R$)', 'Saldo (R$)'].join(SEP));

      filtered
        .slice()
        .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')))
        .forEach(e => {
          const bal = Number(e.current_balance_cents || (e.amount_cents - (e.paid_cents || 0)));
          rows.push([
            e.title_code || e.doc_number || '',
            e.due_date || '',
            e.status || '',
            brl(e.amount_cents),
            brl(e.paid_cents),
            brl(bal)
          ].join(SEP));
        });

      const csv = BOM + rows.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio_' + (partnerName || 'cliente').replace(/\s+/g, '_') + '_' + todayISO() + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.Fin.toast?.('CSV exportado.', 'success');
    }

    q('#rep-filter-btn').addEventListener('click', renderReport);
    q('#rep-clear-btn').addEventListener('click', () => {
      q('#rep-start').value = '';
      q('#rep-end').value = '';
      q('#rep-status').value = '';
      renderReport();
    });
    q('#rep-export-csv').addEventListener('click', exportCSV);

    renderReport();
  }

  window.Fin.openCustomerReport = openCustomerReport;

})();