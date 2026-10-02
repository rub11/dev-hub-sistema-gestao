/* =========================================================
   DEV HUB · Financeiro · entry-modal
   ---------------------------------------------------------
   Modal ERP de criação/edição de título (o "monstro").
   Inclui o picker de parceiros.
   ---------------------------------------------------------
   Depende de: state.js, api.js
   Publica em: window.Fin
   ========================================================= */

(function () {
  'use strict';

  const {
    $, escapeHTML, db, toast,
    fmtBRL, parseBRLToCents, todayISO,
    state
  } = window.Fin;

  /* =========================================================
     PICKER · PARCEIRO
     ========================================================= */
  function openPartnerPicker(parentModal) {
    const picker = document.createElement('div');
    picker.className = 'fin-modal fin-modal--picker';
    picker.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog" style="max-width: 720px;">
        <header class="fin-modal__head">
          <h3 class="fin-modal__title">Selecionar parceiro</h3>
          <button class="fin-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>
        <div class="fin-modal__body" style="gap:10px">
          <div style="position:relative">
            <input type="search" id="pp-search" placeholder="Buscar por nome, CPF/CNPJ ou telefone…"
                   autocomplete="off" style="width:100%;height:42px;padding:0 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px" />
          </div>
          <div id="pp-results" style="max-height:380px;overflow-y:auto;border:1px solid var(--border);border-radius:10px">
            <div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13.5px">Digite para buscar…</div>
          </div>
        </div>
        <footer class="fin-modal__foot">
          <button type="button" class="fin-btn fin-btn--ghost" data-close>Fechar</button>
        </footer>
      </div>`;
    document.body.appendChild(picker);

    const closePicker = () => picker.remove();
    picker.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closePicker));

    const input = picker.querySelector('#pp-search');
    const results = picker.querySelector('#pp-results');
    let debounce = null;

    async function runSearch(q) {
      results.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13.5px">Buscando…</div>';
      try {
        const { data, error } = await db().rpc('search_partners', { p_term: q || '', p_limit: 40 });
        if (error) throw error;
        if (!data || data.length === 0) {
          results.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13.5px">Nenhum parceiro encontrado.</div>';
          return;
        }
        results.innerHTML = data.map((p) => {
          const tags = [];
          if (p.is_customer) tags.push('Cliente');
          if (p.is_supplier) tags.push('Fornecedor');
          if (p.is_carrier)  tags.push('Transportadora');
          return `
            <button type="button" data-id="${p.id}" data-name="${escapeHTML(p.name || '')}" data-doc="${escapeHTML(p.cpf_cnpj || '')}"
                    style="display:flex;width:100%;gap:10px;align-items:center;padding:12px 14px;border:0;border-bottom:1px solid var(--border);background:transparent;text-align:left;cursor:pointer;font-family:inherit;color:inherit">
              <span style="flex:1;min-width:0">
                <span style="display:block;font-size:13.5px;font-weight:600;color:var(--text)">${escapeHTML(p.name || '—')}</span>
                <span style="display:block;font-size:12px;color:var(--text-muted);margin-top:2px">${escapeHTML(p.cpf_cnpj || '')}${p.city ? ' · ' + escapeHTML(p.city) + (p.state ? '/' + escapeHTML(p.state) : '') : ''}</span>
              </span>
              <span style="flex:none;display:flex;gap:4px">
                ${tags.map((t) => `<span style="padding:2px 8px;border-radius:999px;background:var(--surface-2);color:var(--text-muted);font-size:11px;font-weight:600">${t}</span>`).join('')}
              </span>
            </button>`;
        }).join('');
        results.querySelectorAll('button[data-id]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const partnerInput = parentModal.querySelector('#e-partner');
            const docInput = parentModal.querySelector('#e-doc');
            if (partnerInput) partnerInput.value = btn.dataset.name;
            if (docInput) docInput.value = btn.dataset.doc;
            closePicker();
          });
        });
      } catch (e) {
        console.error('[fin] picker parceiro:', e);
        results.innerHTML = '<div style="padding:32px;text-align:center;color:var(--danger);font-size:13.5px">Erro ao buscar parceiros.</div>';
      }
    }

    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => runSearch(q), 220);
    });
    runSearch('');
    setTimeout(() => input.focus(), 50);
  }

  /* =========================================================
     MODAL · NOVO / EDITAR TÍTULO
     ========================================================= */
  function openEntryModal(entry) {
    const isEdit = !!entry;
    const e = entry || {};
    const balance = Number(e.current_balance_cents || (Number(e.amount_cents || 0) - Number(e.paid_cents || 0)));
    const paidCents = Number(e.paid_cents || 0);

    const modal = document.createElement('div');
    modal.className = 'fin-modal fin-modal--erp';
    modal.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog fin-modal__dialog--erp" role="dialog" aria-modal="true" aria-labelledby="entry-modal-title">
        <header class="fin-modal__head">
          <h3 class="fin-modal__title" id="entry-modal-title">
            ${isEdit ? 'Editar título' : 'Novo título'}
          </h3>
          <button class="fin-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>

        <div class="fin-erp-toolbar" role="toolbar" aria-label="Ações do título">
          <button type="button" class="fin-erp-tool" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            <span>Baixar</span>
          </button>
          <button type="button" class="fin-erp-tool" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>
            <span>Estornar</span>
          </button>
          <button type="button" class="fin-erp-tool" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14h3M12 10h3M17 6h3"/></svg>
            <span>Ratear</span>
          </button>
          <button type="button" class="fin-erp-tool" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></svg>
            <span>Parcelar</span>
          </button>
          <button type="button" class="fin-erp-tool" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M2.5 10h19"/></svg>
            <span>Receber</span>
          </button>
          <button type="button" class="fin-erp-tool" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
            <span>Ver renegociação</span>
          </button>
        </div>

        <nav class="fin-tabs fin-tabs--erp" role="tablist" aria-label="Seções do título">
          <button type="button" class="fin-tab is-active" data-tab="lancamento" role="tab" aria-selected="true">Lançamento</button>
          <button type="button" class="fin-tab" data-tab="outras" role="tab" aria-selected="false">Outras informações</button>
          <button type="button" class="fin-tab" data-tab="geral" role="tab" aria-selected="false">Geral</button>
          <button type="button" class="fin-tab" data-tab="boleto" role="tab" aria-selected="false">Boleto</button>
        </nav>

        <div class="fin-modal__body fin-erp-body">
          <section class="fin-tabpane is-active" data-pane="lancamento">
            <div class="fin-erp-row fin-erp-row--3">
              <div class="fin-erp-field"><label for="e-unique">Nro Único</label>
                <input type="text" id="e-unique" value="${escapeHTML(e.unique_number || '')}" /></div>
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-obs-padrao">Observação padrão</label>
                <input type="text" id="e-obs-padrao" placeholder="" />
                <button type="button" class="fin-erp-search-btn" id="e-partner-search" aria-label="Buscar parceiro">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                </button>
              </div>
              <div class="fin-erp-field">
                <label>Baixa Realizada pelo Importador</label>
                <label class="fin-erp-switch">
                  <input type="checkbox" id="e-baixa-importador" />
                  <span class="fin-erp-switch-track"></span>
                  <span class="fin-erp-switch-label">Ativar</span>
                </label>
              </div>
            </div>

            <div class="fin-erp-row">
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-partner">Parceiro <span class="req">*</span></label>
                <input type="text" id="e-partner" value="${escapeHTML(e.partner_name || '')}" placeholder="Nome" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar parceiro" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                </button>
              </div>
              <div class="fin-erp-field">
                <label for="e-kind">Receita/Despesa <span class="req">*</span></label>
                <select id="e-kind">
                  <option value="despesa" ${e.kind === 'despesa' || !e.kind ? 'selected' : ''}>Despesa</option>
                  <option value="receita" ${e.kind === 'receita' ? 'selected' : ''}>Receita</option>
                </select>
              </div>
              <div class="fin-erp-field">
                <label>Provisão</label>
                <label class="fin-erp-switch">
                  <input type="checkbox" id="e-provisao" ${e.status === 'provisao' ? 'checked' : ''} />
                  <span class="fin-erp-switch-track"></span>
                  <span class="fin-erp-switch-label">Marcar como provisão</span>
                </label>
                <input type="hidden" id="e-status" value="${e.status || 'pendente'}" />
              </div>
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-company">Empresa <span class="req">*</span></label>
                <input type="text" id="e-company" value="${escapeHTML(e.company_name || '')}" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar empresa" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                </button>
              </div>
            </div>

            <div class="fin-erp-row">
              <div class="fin-erp-field"><label for="e-docnum">Nro Nota <span class="req">*</span></label>
                <input type="text" id="e-docnum" value="${escapeHTML(e.doc_number || '')}" /></div>
              <div class="fin-erp-field"><label for="e-issue">Dt. Negociação <span class="req">*</span></label>
                <input type="date" id="e-issue" value="${escapeHTML(e.issue_date || todayISO())}" /></div>
              <div class="fin-erp-field"><label for="e-amount">Vlr. do Desdobramento <span class="req">*</span></label>
                <input type="text" id="e-amount" value="${(Number(e.amount_cents || 0) / 100).toFixed(2).replace('.', ',')}" placeholder="0,00" /></div>
              <div class="fin-erp-field"><label for="e-net">Valor Líquido</label>
                <input type="text" id="e-net" value="${(balance / 100).toFixed(2).replace('.', ',')}" readonly /></div>
            </div>

            <div class="fin-erp-row">
              <div class="fin-erp-field"><label for="e-due">Dt. Vencimento <span class="req">*</span></label>
                <input type="date" id="e-due" value="${escapeHTML(e.due_date || todayISO())}" /></div>
              <div class="fin-erp-field"><label for="e-doc">CNPJ / CPF</label>
                <input type="text" id="e-doc" value="${escapeHTML(e.partner_doc || '')}" /></div>
              <div class="fin-erp-field"><label for="e-installments">Parcela (1/1)</label>
                <input type="text" id="e-installments" value="${e.installment_number && e.installments_total ? e.installment_number + '/' + e.installments_total : '1/1'}" /></div>
              <div class="fin-erp-field"></div>
            </div>

            <div class="fin-erp-row fin-erp-row--full">
              <div class="fin-erp-field"><label for="e-notes">Histórico</label>
                <textarea id="e-notes" rows="2">${escapeHTML(e.notes || '')}</textarea></div>
            </div>

            <div class="fin-erp-row">
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-bank">Banco <span class="req">*</span></label>
                <input type="text" id="e-bank" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar banco" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                </button>
              </div>
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-tipo-titulo">Tipo de Título <span class="req">*</span></label>
                <input type="text" id="e-tipo-titulo" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar tipo de título" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                </button>
              </div>
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-tipo-operacao">Tipo Operação <span class="req">*</span></label>
                <input type="text" id="e-tipo-operacao" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar tipo de operação" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                </button>
              </div>
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-nature">Natureza <span class="req">*</span></label>
                <input type="text" id="e-nature" value="${escapeHTML(e.nature_name || '')}" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar natureza" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                </button>
              </div>
            </div>

            <div class="fin-erp-row">
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-costcenter">Centro Resultado</label>
                <input type="text" id="e-costcenter" value="${escapeHTML(e.cost_center_name || '')}" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar centro de resultado" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                </button>
              </div>
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-account">Conta Bancária</label>
                <input type="text" id="e-account" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar conta" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                </button>
              </div>
              <div class="fin-erp-field"><label for="e-data-baixa">Data Baixa</label>
                <input type="date" id="e-data-baixa" value="${e.settlement_date || ''}" /></div>
              <div class="fin-erp-field"><label for="e-vlr-baixa">Vlr Baixa</label>
                <input type="text" id="e-vlr-baixa" value="${(paidCents / 100).toFixed(2).replace('.', ',')}" readonly /></div>
            </div>

            <div class="fin-erp-row fin-erp-row--3">
              <div class="fin-erp-field"><label for="e-dt-mov">Dt/Hr Movimentação</label>
                <input type="datetime-local" id="e-dt-mov" /></div>
              <div class="fin-erp-field"><label for="e-vlr-liberar">Vlr. a liberar</label>
                <input type="text" id="e-vlr-liberar" placeholder="0,00" /></div>
              <div class="fin-erp-field"><label for="e-nfse">Nro. NFS-e</label>
                <input type="text" id="e-nfse" value="${escapeHTML(e.nfse_number || '')}" /></div>
            </div>

            <div class="fin-erp-row fin-erp-row--2">
              <div class="fin-erp-field fin-erp-field--search">
                <label for="e-contract">Nro Contrato</label>
                <input type="text" id="e-contract" value="${escapeHTML(e.contract_number || '')}" />
                <button type="button" class="fin-erp-search-btn" aria-label="Buscar contrato" tabindex="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                </button>
              </div>
            </div>

            <div id="e-error" hidden class="fin-err"></div>
          </section>

          <section class="fin-tabpane" data-pane="outras">
            <div class="fin-erp-row fin-erp-row--3">
              <div class="fin-erp-field"><label for="e-nfse-2">Nº NFS-e</label>
                <input type="text" id="e-nfse-2" value="${escapeHTML(e.nfse_number || '')}" /></div>
              <div class="fin-erp-field"><label for="e-unique-2">Nº Único</label>
                <input type="text" id="e-unique-2" value="${escapeHTML(e.unique_number || '')}" /></div>
              <div class="fin-erp-field"><label for="e-contract-2">Contrato</label>
                <input type="text" id="e-contract-2" value="${escapeHTML(e.contract_number || '')}" /></div>
            </div>
          </section>

          <section class="fin-tabpane" data-pane="geral">
            <div class="fin-erp-row fin-erp-row--full">
              <div class="fin-erp-field"><label for="e-general">Observações gerais</label>
                <textarea id="e-general" rows="4"></textarea></div>
            </div>
          </section>

          <section class="fin-tabpane" data-pane="boleto">
            <div class="fin-erp-row fin-erp-row--full">
              <div class="fin-erp-field">
                <label>Informações do boleto</label>
                <p style="font-size:13px;color:var(--text-muted);margin:6px 0 0">
                  Emissão de boleto ainda não disponível nesta versão.
                </p>
              </div>
            </div>
          </section>
        </div>

        <footer class="fin-modal__foot fin-erp-foot">
          <div class="fin-erp-totals">
            <span class="fin-erp-tot-receita"><strong>Receita:</strong> <span id="e-tot-receita">0,00</span></span>
            <span class="fin-erp-tot-despesa"><strong>Despesa:</strong> <span id="e-tot-despesa">0,00</span></span>
            <span><strong>Rec-Despesa:</strong> <span id="e-tot-recdesp">0,00</span></span>
            <span><strong>Total baixado:</strong> <span id="e-tot-baixado">${(paidCents / 100).toFixed(2).replace('.', ',')}</span></span>
            <span class="fin-erp-tot-aberto"><strong>Total em aberto:</strong> <span id="e-tot-aberto">${(balance / 100).toFixed(2).replace('.', ',')}</span></span>
          </div>
          <div class="fin-erp-foot__actions">
            <button type="button" class="fin-btn fin-btn--ghost" data-close>Cancelar</button>
            <button type="button" class="fin-btn fin-btn--primary" id="e-save">
              ${isEdit ? 'Salvar alterações' : 'Criar título'}
            </button>
          </div>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    /* ---------- Tabs ---------- */
    modal.querySelectorAll('.fin-tabs--erp .fin-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.fin-tabs--erp .fin-tab').forEach((t) => {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        modal.querySelectorAll('.fin-modal__body .fin-tabpane').forEach((p) => p.classList.remove('is-active'));
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');
        const pane = modal.querySelector(`.fin-modal__body .fin-tabpane[data-pane="${tab.dataset.tab}"]`);
        if (pane) pane.classList.add('is-active');
      });
    });

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    /* ---------- Provisão ---------- */
    const provSwitch = modal.querySelector('#e-provisao');
    const statusHidden = modal.querySelector('#e-status');
    if (provSwitch && statusHidden) {
      provSwitch.addEventListener('change', () => {
        statusHidden.value = provSwitch.checked ? 'provisao' : 'pendente';
      });
    }

    /* ---------- Picker parceiro ---------- */
    const partnerSearchBtn = modal.querySelector('#e-partner-search');
    if (partnerSearchBtn) partnerSearchBtn.addEventListener('click', () => openPartnerPicker(modal));

    /* ---------- Totais do rodapé ---------- */
    const amountEl   = modal.querySelector('#e-amount');
    const kindEl     = modal.querySelector('#e-kind');
    const totReceita = modal.querySelector('#e-tot-receita');
    const totDespesa = modal.querySelector('#e-tot-despesa');
    const totRecDesp = modal.querySelector('#e-tot-recdesp');
    const totAberto  = modal.querySelector('#e-tot-aberto');
    const totBaixado = modal.querySelector('#e-tot-baixado');

    const fmtBR = (cents) => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    function recalcFooterTotals() {
      const amt  = parseBRLToCents(amountEl ? amountEl.value : '0');
      const kind = kindEl ? kindEl.value : 'despesa';
      const rec  = kind === 'receita' ? amt : 0;
      const desp = kind === 'despesa' ? amt : 0;
      if (totReceita) totReceita.textContent = fmtBR(rec);
      if (totDespesa) totDespesa.textContent = fmtBR(desp);
      if (totRecDesp) totRecDesp.textContent = fmtBR(rec - desp);
      if (totBaixado) totBaixado.textContent = fmtBR(paidCents);
      if (totAberto)  totAberto.textContent  = fmtBR(Math.max(0, amt - paidCents));
      const netEl = modal.querySelector('#e-net');
      if (netEl) netEl.value = fmtBR(Math.max(0, amt - paidCents));
    }
    if (amountEl) amountEl.addEventListener('input', recalcFooterTotals);
    if (kindEl)   kindEl.addEventListener('change', recalcFooterTotals);
    recalcFooterTotals();

    /* ---------- Salvar ---------- */
    modal.querySelector('#e-save').addEventListener('click', async () => {
      const err = modal.querySelector('#e-error');
      const btn = modal.querySelector('#e-save');
      const showErr = (msg) => {
        err.textContent = msg; err.hidden = false;
        try { err.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
        toast(msg, 'error'); console.error('[fin] erro ao salvar título:', msg);
      };
      err.hidden = true;

      const amountCents = parseBRLToCents(amountEl ? amountEl.value : '0');
      const payload = {
        kind: kindEl.value,
        status: statusHidden ? statusHidden.value : 'pendente',
        due_date: modal.querySelector('#e-due').value || null,
        issue_date: modal.querySelector('#e-issue').value || null,
        partner_name: modal.querySelector('#e-partner').value.trim() || null,
        partner_doc: modal.querySelector('#e-doc').value.trim() || null,
        doc_number: modal.querySelector('#e-docnum').value.trim() || null,
        amount_cents: amountCents,
        nature_name: modal.querySelector('#e-nature').value.trim() || null,
        cost_center_name: modal.querySelector('#e-costcenter').value.trim() || null,
        company_name: modal.querySelector('#e-company').value.trim() || null,
        nfse_number: (modal.querySelector('#e-nfse') || {}).value || null,
        unique_number: modal.querySelector('#e-unique').value.trim() || null,
        contract_number: modal.querySelector('#e-contract').value.trim() || null,
        notes: modal.querySelector('#e-notes').value.trim() || null,
        updated_by: state.currentUser ? state.currentUser.id : null,
        updated_by_name: state.currentUser ? state.currentUser.name : null
      };

      if (!payload.due_date) { showErr('Informe a data de vencimento.'); return; }
      if (payload.amount_cents <= 0) { showErr('O valor do título precisa ser maior que zero.'); return; }
      if (!payload.partner_name) { showErr('Informe o parceiro.'); return; }

      btn.disabled = true;
      const oldLabel = btn.textContent;
      btn.textContent = isEdit ? 'Salvando…' : 'Criando…';

      try {
        if (!isEdit) {
          const orgId = await window.Fin.resolveOrgIdAsync();
          if (!orgId) throw new Error('Sua sessão não trouxe a empresa (organization_id). Faça logout e login novamente.');
          payload.organization_id = orgId;
          payload.current_balance_cents = payload.amount_cents;
          payload.title_code = await window.Fin.getNextTitleCode();
          payload.created_by      = state.currentUser ? state.currentUser.id : null;
          payload.created_by_name = state.currentUser ? state.currentUser.name : null;

          const { data, error } = await db().from('financial_entries')
            .insert(payload).select('id, title_code').single();
          if (error) throw error;
          toast(`Título ${data && data.title_code ? data.title_code : ''} criado.`, 'success');
        } else {
          delete payload.current_balance_cents;
          const { error } = await db().from('financial_entries').update(payload).eq('id', e.id);
          if (error) throw error;
          toast('Título atualizado.', 'success');
        }
        close();
        await window.Fin.loadAll?.();
      } catch (ex) {
        console.error('[fin] falha ao salvar título:', ex);
        let msg = ex.message || 'Erro desconhecido.';
        const low = msg.toLowerCase();
        if (low.includes('row-level security') || low.includes('permission denied')) {
          msg = 'Sem permissão para gravar o título. Verifique organization_id.';
        } else if (low.includes('organization_id') && low.includes('null')) {
          msg = 'Faltou organization_id. Faça logout e login novamente.';
        } else if (low.includes('column') && low.includes('does not exist')) {
          msg = 'Coluna inexistente em financial_entries: ' + msg;
        } else if (low.includes('next_title_code') || low.includes('function')) {
          msg = 'A função next_title_code não está criada no banco.';
        } else if (low.includes('duplicate') || low.includes('unique')) {
          msg = 'Já existe um título com esse código. Tente novamente.';
        }
        showErr(msg);
      } finally {
        btn.disabled = false;
        btn.textContent = oldLabel;
      }
    });
  }

  /* =========================================================
     PUBLICA
     ========================================================= */
  Object.assign(window.Fin, {
    openPartnerPicker,
    openEntryModal
  });

})();