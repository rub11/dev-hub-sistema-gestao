/* =========================================================
   DEV HUB · Receber Compras
   ---------------------------------------------------------
   Índice:
     1. Helpers (DOM, formatação, toast, db)
     2. Estado
     3. Leitor de código de barras (lookup + beep)
     4. Carregamento (usuário + compras)
     5. Dashboard (KPIs clicáveis)
     6. Filtros
     7. Tabela
     8. Modal · Ver detalhes
     9. Modal · Receber (conferência + barcode)
    10. Modal · Contestar
    11. Bind de filtros
    12. Bootstrap
   ========================================================= */

(function () {
  'use strict';

  /* =========================================================
     1) HELPERS
     ========================================================= */
  const $ = (sel, root = document) => root.querySelector(sel);

  const escapeHTML = (s) =>
    String(s || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));

  const fmtBRL = (cents) =>
    ((Number(cents) || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
  };

  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleString('pt-BR');
  };

  const db = () => {
    if (window.db && window.db.from) return window.db;
    if (window.supabaseClient && window.supabaseClient.from) return window.supabaseClient;
    throw new Error('Supabase client não encontrado.');
  };

  const toast = (msg, kind) => {
    if (window.Toast && typeof window.Toast.show === 'function') {
      return window.Toast.show(msg, kind);
    }
    const el = document.createElement('div');
    el.className = kind === 'error' ? 'rcv-err' : 'rcv-alert';
    el.style.cssText =
      'position:fixed;top:80px;right:20px;z-index:200;max-width:360px;box-shadow:0 12px 32px -8px rgba(16,24,40,.24)';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  };

  /* =========================================================
     CONSTANTES
     ========================================================= */
  const STATUS_LABEL = {
    rascunho:              'Rascunho',
    aguardando_aprovacao:  'Aguardando aprovação',
    pendente_recebimento:  'Aguardando recebimento',
    recebida_parcial:      'Recebida parcial',
    recebida:              'Recebida',
    paga:                  'Paga',
    cancelada:             'Cancelada'
  };

  const EVENT_LABEL = {
    created:   'Compra criada',
    updated:   'Compra alterada',
    submitted: 'Enviada para aprovação',
    approved:  'Aprovada',
    received:  'Recebida',
    paid:      'Paga',
    cancelled: 'Cancelada',
    disputed:  'Contestação aberta'
  };

  /* =========================================================
     2) ESTADO
     ========================================================= */
  const state = {
    all: [],
    filtered: [],
    filters: {
      q: '',
      status: '',
      card: ''
    },
    currentUser: null
  };

  /* =========================================================
     3) LEITOR DE CÓDIGO DE BARRAS
     ========================================================= */

  /**
   * Busca um produto pelo código de barras na organização atual.
   * Retorna o registro completo ou null.
   */
  async function findProductByBarcode(barcode) {
    const code = String(barcode || '').trim();
    if (!code) return null;

    const { data, error } = await db()
      .from('products')
      .select('id, name, code, price, stock, barcode')
      .eq('barcode', code)
      .eq('active', true)
      .maybeSingle();

    if (error) {
      console.warn('[barcode] erro ao buscar:', error.message);
      return null;
    }
    return data || null;
  }

  /**
   * Beep curtinho de feedback (WebAudio API).
   * success = tom agudo · error = tom grave.
   */
  function beep(kind) {
    try {
      if (!window.AudioContext && !window.webkitAudioContext) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = kind === 'error' ? 220 : 880;

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.14);
    } catch (e) { /* ignora */ }
  }

  /* =========================================================
     4) CARREGAMENTO
     ========================================================= */
  async function loadCurrentUser() {
    try {
      const { data: u } = await db().auth.getUser();
      if (u && u.user) {
        const { data: prof } = await db().from('profiles')
          .select('id, name, email')
          .eq('id', u.user.id)
          .maybeSingle();
        state.currentUser = prof || { id: u.user.id, name: u.user.email };
      }
    } catch (e) {
      console.warn('[rcv] loadCurrentUser:', e);
    }
  }

  async function loadPurchases() {
    const tbody = $('#rcv-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7"><div class="rcv-loading">Carregando compras...</div></td></tr>`;

    try {
      const { data, error } = await db().from('purchases')
        .select(`
          id, code, status, supplier_name, supplier_id,
          total_cents, purchase_date, expected_date,
          received_at, received_by_name, created_at, created_by_name,
          invoice_number, notes
        `)
        .in('status', ['pendente_recebimento', 'recebida_parcial', 'recebida'])
        .order('expected_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) throw error;

      state.all = data || [];
      applyFilters();
    } catch (e) {
      console.error('[rcv] loadPurchases:', e);
      tbody.innerHTML = `
        <tr><td colspan="7" style="padding:0;border:0">
          <div class="rcv-empty">
            <div class="rcv-empty__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
            </div>
            <h3 class="rcv-empty__title">Erro ao carregar</h3>
            <p class="rcv-empty__text">${escapeHTML(e.message)}</p>
          </div>
        </td></tr>`;
    }
  }

  /* =========================================================
     5) DASHBOARD (KPIs)
     ========================================================= */
  function renderKpis() {
    const wrap = $('#rcv-kpis');
    if (!wrap) return;

    const hoje = new Date().toISOString().slice(0, 10);

    const counts = {
      aguardando: state.all.filter((p) => p.status === 'pendente_recebimento').length,
      parcial:    state.all.filter((p) => p.status === 'recebida_parcial').length,
      hoje:       state.all.filter((p) =>
        p.status === 'recebida' && p.received_at && p.received_at.slice(0, 10) === hoje
      ).length,
      total:      state.all.length
    };

    const valor30d = state.all
      .filter((p) => p.received_at && new Date(p.received_at) >= new Date(Date.now() - 30 * 86400000))
      .reduce((s, p) => s + (Number(p.total_cents) || 0), 0);

    const cards = [
      { key: 'aguardando', label: 'Aguardando',        value: counts.aguardando, cls: 'aguardando' },
      { key: 'parcial',    label: 'Parciais',          value: counts.parcial,    cls: 'parcial' },
      { key: 'hoje',       label: 'Recebidas hoje',    value: counts.hoje,       cls: 'hoje' },
      { key: 'total',      label: 'Total no período',  value: counts.total,      cls: 'contestacao' },
      { key: '',           label: 'Valor recebido · 30d', value: fmtBRL(valor30d), cls: 'valor' }
    ];

    wrap.innerHTML = cards.map((c) => `
      <button type="button"
              class="rcv-kpi rcv-kpi--${c.cls} ${state.filters.card === c.key ? 'is-active' : ''}"
              data-card="${c.key}">
        <span class="rcv-kpi__label">${escapeHTML(c.label)}</span>
        <span class="rcv-kpi__value">${escapeHTML(String(c.value))}</span>
      </button>
    `).join('');

    wrap.querySelectorAll('.rcv-kpi').forEach((btn) => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.card;
        state.filters.card = (state.filters.card === k) ? '' : k;
        renderKpis();
        applyFilters();
      });
    });
  }

  /* =========================================================
     6) FILTROS
     ========================================================= */
  function applyFilters() {
    const { q, status, card } = state.filters;
    const hoje = new Date().toISOString().slice(0, 10);

    let rows = state.all.slice();

    if (q) {
      const ql = q.toLowerCase();
      rows = rows.filter((r) =>
        (r.code || '').toLowerCase().includes(ql) ||
        (r.supplier_name || '').toLowerCase().includes(ql) ||
        (r.invoice_number || '').toLowerCase().includes(ql) ||
        (r.created_by_name || '').toLowerCase().includes(ql)
      );
    }

    if (status) rows = rows.filter((r) => r.status === status);

    if (card === 'aguardando') rows = rows.filter((r) => r.status === 'pendente_recebimento');
    if (card === 'parcial')    rows = rows.filter((r) => r.status === 'recebida_parcial');
    if (card === 'hoje')       rows = rows.filter((r) =>
      r.status === 'recebida' && r.received_at && r.received_at.slice(0, 10) === hoje
    );

    state.filtered = rows;
    renderTable();
  }

  /* =========================================================
     7) TABELA
     ========================================================= */
  function renderTable() {
    const tbody = $('#rcv-tbody');
    if (!tbody) return;

    const rows = state.filtered;

    if (!rows.length) {
      const hasFilter = state.filters.q || state.filters.status || state.filters.card;
      tbody.innerHTML = `
        <tr><td colspan="7" style="padding:0;border:0">
          <div class="rcv-empty">
            <div class="rcv-empty__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="m5 12 5 5L20 7"/>
              </svg>
            </div>
            <h3 class="rcv-empty__title">Nada para receber</h3>
            <p class="rcv-empty__text">${
              hasFilter
                ? 'Nenhuma compra bate com os filtros atuais.'
                : 'Não há compras pendentes de recebimento no momento.'
            }</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r) => {
      const canReceive = r.status === 'pendente_recebimento' || r.status === 'recebida_parcial';
      const canDispute = r.status !== 'recebida';

      return `
        <tr data-id="${r.id}">
          <td>
            <span class="rcv-status rcv-status--${escapeHTML(r.status)}">
              ${escapeHTML(STATUS_LABEL[r.status] || r.status)}
            </span>
          </td>
          <td><span class="rcv-code">${escapeHTML(r.code || '—')}</span></td>
          <td>
            <div class="rcv-supplier">
              <span class="rcv-supplier__name">${escapeHTML(r.supplier_name || 'Sem fornecedor')}</span>
              ${r.invoice_number
                ? `<span class="rcv-supplier__meta">NF-e ${escapeHTML(r.invoice_number)}</span>`
                : ''}
            </div>
          </td>
          <td>${fmtDate(r.purchase_date)}</td>
          <td>${fmtDate(r.expected_date)}</td>
          <td class="cell--num"><span class="rcv-money">${fmtBRL(r.total_cents)}</span></td>
          <td class="cell--right">
            <div class="rcv-row-actions">
              <button class="rcv-action" data-action="view" data-id="${r.id}" title="Ver detalhes">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>

              ${canDispute ? `
                <button class="rcv-action" data-action="dispute" data-id="${r.id}" title="Contestar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <path d="M12 9v4M12 17h.01"/>
                  </svg>
                </button>
              ` : ''}

              ${canReceive ? `
                <button class="rcv-action rcv-action--primary" data-action="receive" data-id="${r.id}" title="Receber">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m5 12 5 5L20 7"/>
                  </svg>
                  Receber
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-action]').forEach((btn) => {
      const id = btn.dataset.id;
      const row = state.all.find((x) => x.id === id);
      if (!row) return;
      if (btn.dataset.action === 'view')    btn.addEventListener('click', () => openViewModal(row));
      if (btn.dataset.action === 'receive') btn.addEventListener('click', () => openReceiveModal(row));
      if (btn.dataset.action === 'dispute') btn.addEventListener('click', () => openDisputeModal(row));
    });
  }

  /* =========================================================
     8) MODAL · VER DETALHES
     ========================================================= */
  async function openViewModal(row) {
    try {
      const [p, i, e] = await Promise.all([
        db().from('purchases').select('*').eq('id', row.id).single(),
        db().from('purchase_items').select('*').eq('purchase_id', row.id).order('created_at'),
        db().from('purchase_events').select('*').eq('purchase_id', row.id)
          .order('created_at', { ascending: false }).limit(30)
      ]);
      if (p.error) throw p.error;

      const purchase = p.data;
      const items = i.data || [];
      const events = e.data || [];

      const modal = document.createElement('div');
      modal.className = 'rcv-modal';
      modal.innerHTML = `
        <div class="rcv-modal__backdrop" data-close></div>
        <div class="rcv-modal__dialog rcv-modal__dialog--lg">
          <header class="rcv-modal__head">
            <div>
              <h3 class="rcv-modal__title">${escapeHTML(purchase.code)}</h3>
              <p class="rcv-modal__sub">
                ${escapeHTML(purchase.supplier_name || 'Sem fornecedor')} · ${fmtDate(purchase.purchase_date)}
              </p>
            </div>
            <button class="rcv-modal__close" data-close aria-label="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M6 6l12 12M18 6L6 18"/>
              </svg>
            </button>
          </header>

          <div class="rcv-modal__body">

            <div style="display:flex;gap:12px;flex-wrap:wrap">
              <span class="rcv-status rcv-status--${escapeHTML(purchase.status)}">
                ${escapeHTML(STATUS_LABEL[purchase.status] || purchase.status)}
              </span>
              ${purchase.invoice_number
                ? `<span style="font-size:13px;color:var(--text-soft);align-self:center">NF-e ${escapeHTML(purchase.invoice_number)}</span>`
                : ''}
              ${purchase.created_by_name
                ? `<span style="font-size:13px;color:var(--text-soft);align-self:center">por ${escapeHTML(purchase.created_by_name)}</span>`
                : ''}
            </div>

            <div class="rcv-grid-2">
              <div>
                <strong style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Valor total</strong>
                <div style="font-size:18px;font-weight:700;margin-top:2px">${fmtBRL(purchase.total_cents)}</div>
              </div>
              <div>
                <strong style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Previsão</strong>
                <div style="font-size:15px;margin-top:2px">${fmtDate(purchase.expected_date)}</div>
              </div>
            </div>

            <h4 style="margin:8px 0 8px;font-size:13.5px;font-weight:600">Itens</h4>
            <div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px">
              <table style="width:100%;border-collapse:collapse;font-size:13.5px;min-width:480px">
                <thead>
                  <tr style="border-bottom:1px solid var(--border);text-align:left;color:var(--text-muted);font-size:11px;text-transform:uppercase">
                    <th style="padding:10px 14px">Descrição</th>
                    <th style="padding:10px 14px;text-align:right">Pedido</th>
                    <th style="padding:10px 14px;text-align:right">Recebido</th>
                    <th style="padding:10px 14px;text-align:right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map((it) => `
                    <tr style="border-bottom:1px solid var(--border)">
                      <td style="padding:10px 14px">${escapeHTML(it.description)}</td>
                      <td style="padding:10px 14px;text-align:right">${Number(it.quantity)} ${escapeHTML(it.unit || 'un')}</td>
                      <td style="padding:10px 14px;text-align:right">${Number(it.quantity_received) || 0}</td>
                      <td style="padding:10px 14px;text-align:right;font-variant-numeric:tabular-nums">${fmtBRL(it.total_cents)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            ${events.length ? `
              <h4 style="margin:8px 0 8px;font-size:13.5px;font-weight:600">Histórico</h4>
              <div class="rcv-timeline">
                ${events.map((ev) => `
                  <div class="rcv-tl-item">
                    <div class="rcv-tl-item__label">${escapeHTML(EVENT_LABEL[ev.event] || ev.event || 'evento')}</div>
                    <span class="rcv-tl-item__meta">
                      ${escapeHTML(ev.actor_name || 'Sistema')} · ${fmtDateTime(ev.created_at)}
                    </span>
                  </div>
                `).join('')}
              </div>
            ` : ''}

          </div>

          <footer class="rcv-modal__foot">
            <button type="button" class="cmp-btn cmp-btn--ghost" data-close>Fechar</button>
          </footer>
        </div>`;
      document.body.appendChild(modal);

      const close = () => modal.remove();
      modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
    } catch (err) {
      console.error('[rcv] openViewModal:', err);
      toast('Não foi possível abrir os detalhes.', 'error');
    }
  }

  /* =========================================================
     9) MODAL · RECEBER (CONFERÊNCIA + BARCODE)
     ========================================================= */
   /* =========================================================
     MODAL · RECEBER (CONFERÊNCIA + BARCODE)
     ---------------------------------------------------------
     - Quantidades inteiras (sem decimais)
     - Registra cada alteração de quantidade no confirmar
     - Auditoria vai pra purchase_events
     ========================================================= */
  async function openReceiveModal(row) {
    try {
      const [p, i] = await Promise.all([
        db().from('purchases').select('*').eq('id', row.id).single(),
        db().from('purchase_items').select('*').eq('purchase_id', row.id).order('created_at')
      ]);
      if (p.error) throw p.error;
      const purchase = p.data;
      const items = i.data || [];

      /* Carrega produtos vinculados (para barcode) */
      const productIds = items.map((it) => it.product_id).filter(Boolean);
      const productMap = {};
      if (productIds.length) {
        const { data: prods } = await db()
          .from('products')
          .select('id, barcode, name, code')
          .in('id', productIds);
        (prods || []).forEach((p) => { productMap[p.id] = p; });
      }

      /* Mapa inverso: barcode -> item_id */
      const barcodeToItem = {};
      items.forEach((it) => {
        const prod = it.product_id ? productMap[it.product_id] : null;
        if (prod && prod.barcode) {
          barcodeToItem[String(prod.barcode).trim()] = it.id;
        }
      });

      const itensComBarcode = items.filter((it) => {
        const prod = it.product_id ? productMap[it.product_id] : null;
        return prod && prod.barcode;
      }).length;

      /* Snapshot dos valores originais (para auditoria) */
      const originalSnapshot = {};
      items.forEach((it) => {
        originalSnapshot[it.id] = {
          description: it.description,
          quantity:    Math.floor(Number(it.quantity) || 0),
          received:    Math.floor(Number(it.quantity_received) || 0)
        };
      });

      const modal = document.createElement('div');
      modal.className = 'rcv-modal';
      modal.innerHTML = `
        <div class="rcv-modal__backdrop" data-close></div>
        <div class="rcv-modal__dialog rcv-modal__dialog--lg">
          <header class="rcv-modal__head">
            <div>
              <h3 class="rcv-modal__title">Conferir ${escapeHTML(purchase.code)}</h3>
              <p class="rcv-modal__sub">
                Bipe os produtos ou ajuste as quantidades manualmente.
              </p>
            </div>
            <button class="rcv-modal__close" data-close aria-label="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M6 6l12 12M18 6L6 18"/>
              </svg>
            </button>
          </header>

          <div class="rcv-modal__body">

            <div class="rcv-barcode">
              <div class="rcv-barcode__input">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14"/>
                </svg>
                <input
                  type="text"
                  id="rcv-barcode-input"
                  placeholder="Bipe o código de barras ou digite + Enter"
                  autocomplete="off"
                  spellcheck="false"
                  inputmode="numeric"
                />
              </div>
              <div class="rcv-barcode__hint" id="rcv-barcode-hint">
                ${itensComBarcode > 0
                  ? `<strong>${itensComBarcode}</strong> de ${items.length} itens com código cadastrado.`
                  : 'Nenhum item possui código de barras cadastrado. Preencha em Produtos.'}
              </div>
            </div>

            <div class="rcv-conference" id="rcv-conference">
              <div class="rcv-conf-head">
                <span>Produto</span>
                <span style="text-align:right">Pedido</span>
                <span style="text-align:right">Recebido</span>
                <span style="text-align:right">Receber agora</span>
                <span style="text-align:right">Diferença</span>
                <span style="text-align:right">Situação</span>
              </div>
              ${items.map((it) => {
                const pedido   = Math.floor(Number(it.quantity) || 0);
                const recebido = Math.floor(Number(it.quantity_received) || 0);
                const pendente = Math.max(0, pedido - recebido);
                const prod     = it.product_id ? productMap[it.product_id] : null;
                const bc       = prod && prod.barcode ? prod.barcode : '';

                return `
                  <div class="rcv-conf-row"
                       data-item-id="${it.id}"
                       data-pedido="${pedido}"
                       data-recebido-antes="${recebido}"
                       data-barcode="${escapeHTML(bc)}">
                    <div class="rcv-conf-name">
                      ${escapeHTML(it.description)}
                      ${bc ? `<span class="rcv-conf-barcode">${escapeHTML(bc)}</span>` : ''}
                    </div>
                    <div class="rcv-conf-num">${pedido} ${escapeHTML(it.unit || 'un')}</div>
                    <div class="rcv-conf-num">${recebido}</div>
                    <div>
                      <input type="number"
                             min="0"
                             max="${pendente}"
                             step="1"
                             class="rcv-conf-input"
                             value="${pendente}"
                             data-qty />
                    </div>
                    <div class="rcv-conf-num rcv-conf-diff--zero" data-diff>0</div>
                    <div class="rcv-conf-num" data-status>OK</div>
                  </div>
                `;
              }).join('')}
            </div>

            <div id="rcv-alert" hidden></div>

            <div class="rcv-field">
              <label for="rcv-notes">Observações do recebimento (opcional)</label>
              <textarea id="rcv-notes" placeholder="Ex.: 3 caixas amassadas, produto entregue em embalagem diferente..."></textarea>
            </div>
          </div>

          <footer class="rcv-modal__foot">
            <button type="button" class="cmp-btn cmp-btn--ghost" data-close>Cancelar</button>
            <button type="button" class="cmp-btn cmp-btn--primary" id="rcv-confirm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m5 12 5 5L20 7"/>
              </svg>
              <span>Confirmar recebimento</span>
            </button>
          </footer>
        </div>`;
      document.body.appendChild(modal);

      /* ---------- Recalcula linha (só inteiros) ---------- */
      function recalcRow(rowEl) {
        const pedido     = Math.floor(Number(rowEl.dataset.pedido));
        const antes      = Math.floor(Number(rowEl.dataset.recebidoAntes));
        const input      = rowEl.querySelector('[data-qty]');
        const agoraRaw   = Number(input.value);
        const agora      = isNaN(agoraRaw) ? 0 : Math.floor(agoraRaw);
        const totalAgora = antes + agora;
        const diff       = totalAgora - pedido;

        const diffEl   = rowEl.querySelector('[data-diff]');
        const statusEl = rowEl.querySelector('[data-status]');

        /* Se o input perdeu dígitos por arredondamento, corrige visualmente */
        if (agoraRaw !== agora && !isNaN(agoraRaw)) {
          input.value = agora;
        }

        diffEl.textContent = (diff > 0 ? '+' : '') + diff;
        diffEl.className = 'rcv-conf-num ' + (
          diff === 0 ? 'rcv-conf-diff--zero' :
          diff > 0   ? 'rcv-conf-diff--pos'  :
                       'rcv-conf-diff--neg'
        );

        const divergente = diff !== 0;
        rowEl.classList.toggle('is-divergent', divergente);
        input.classList.toggle('is-divergent', divergente);

        statusEl.textContent = divergente ? (diff > 0 ? 'Excesso' : 'Falta') : 'OK';
        statusEl.style.color = divergente ? 'var(--danger)' : 'var(--text-muted)';

        return divergente;
      }

      function recalcAll() {
        let hasDiv = false;
        modal.querySelectorAll('.rcv-conf-row').forEach((r) => {
          if (recalcRow(r)) hasDiv = true;
        });

        const alert = modal.querySelector('#rcv-alert');
        if (hasDiv) {
          alert.hidden = false;
          alert.className = 'rcv-alert';
          alert.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <path d="M12 9v4M12 17h.01"/>
            </svg>
            <div>
              <strong>Existem divergências neste recebimento.</strong>
              <div style="margin-top:4px;font-size:13px;color:var(--text-soft)">
                Você pode continuar (status vira <em>Recebida parcial</em>) ou contestar depois.
              </div>
            </div>
          `;
        } else {
          alert.hidden = true;
        }
      }

      /* Força inteiros digitados: bloqueia . , e -
         e mantém cursor no lugar certo */
      modal.querySelectorAll('[data-qty]').forEach((inp) => {
        inp.addEventListener('input', recalcAll);
        inp.addEventListener('keydown', (e) => {
          if (e.key === '.' || e.key === ',' || e.key === '-' || e.key === 'e') {
            e.preventDefault();
          }
        });
        inp.addEventListener('blur', () => {
          const v = Number(inp.value);
          if (isNaN(v) || v < 0) inp.value = '0';
          else if (v > Number(inp.max)) inp.value = String(Math.floor(Number(inp.max)));
          else inp.value = String(Math.floor(v));
          recalcAll();
        });
      });
      recalcAll();

      /* ---------- LEITOR DE BARCODE ---------- */
      const bcInput = modal.querySelector('#rcv-barcode-input');
      const bcHint  = modal.querySelector('#rcv-barcode-hint');

      async function processBarcode(rawCode) {
        const code = String(rawCode || '').trim();
        if (!code) return;

        bcHint.innerHTML = `Lendo <strong>${escapeHTML(code)}</strong>...`;

        /* Match 1: já está nesta compra */
        const itemId = barcodeToItem[code];
        if (itemId) {
          const rowEl = modal.querySelector(`.rcv-conf-row[data-item-id="${itemId}"]`);
          if (rowEl) {
            const input = rowEl.querySelector('[data-qty]');
            const max   = Math.floor(Number(input.max)) || 0;
            const atual = Math.floor(Number(input.value)) || 0;
            const novo  = Math.min(max, atual + 1);
            input.value = novo;

            recalcRow(rowEl);

            rowEl.classList.add('is-scanned');
            setTimeout(() => rowEl.classList.remove('is-scanned'), 800);
            rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

            beep('success');
            bcHint.innerHTML =
              `✓ <strong>${escapeHTML(code)}</strong> — ${escapeHTML(rowEl.querySelector('.rcv-conf-name').textContent.trim().split('\n')[0])} (${novo}/${max})`;

            if (novo >= max) {
              setTimeout(() => {
                bcHint.innerHTML = `<span style="color:var(--success)">Item completo (${max}/${max}).</span>`;
              }, 1200);
            }
            return;
          }
        }

        /* Match 2: existe no catálogo mas não no pedido */
        try {
          const product = await findProductByBarcode(code);
          if (product) {
            beep('error');
            bcHint.innerHTML = `
              <span style="color:var(--warning)">
                ⚠ Produto <strong>${escapeHTML(product.name)}</strong> não está neste pedido.
              </span>
            `;
            setTimeout(() => { bcHint.innerHTML = 'Pronto para bipear novamente.'; }, 2500);
            return;
          }
          beep('error');
          bcHint.innerHTML = `
            <span style="color:var(--danger)">
              ✗ Código <strong>${escapeHTML(code)}</strong> não encontrado.
            </span>
          `;
          setTimeout(() => { bcHint.innerHTML = 'Pronto para bipear novamente.'; }, 2500);
        } catch (e) {
          console.error('[barcode] process:', e);
        }
      }

      bcInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const code = bcInput.value.trim();
          bcInput.value = '';
          processBarcode(code);
        }
      });

      setTimeout(() => { bcInput && bcInput.focus(); }, 100);

      modal.addEventListener('click', (e) => {
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'select' && tag !== 'textarea' && tag !== 'button') {
          bcInput && bcInput.focus();
        }
      });

      /* ---------- Fechar ---------- */
      const close = () => modal.remove();
      modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

      /* ---------- Confirmar ---------- */
      modal.querySelector('#rcv-confirm').addEventListener('click', async () => {
        const btn = modal.querySelector('#rcv-confirm');
        btn.disabled = true;
        btn.querySelector('span').textContent = 'Salvando...';

        try {
          const receivedItems = [];
          const quantityChanges = [];   // auditoria

          modal.querySelectorAll('.rcv-conf-row').forEach((r) => {
            const id    = r.dataset.itemId;
            const qty   = Math.floor(Number(r.querySelector('[data-qty]').value)) || 0;
            const orig  = originalSnapshot[id];

            /* Guarda mudanças para auditoria mesmo se qty = 0 */
            if (orig && qty !== Math.max(0, orig.quantity - orig.received)) {
              quantityChanges.push({
                item_id:     id,
                description: orig.description,
                de:          Math.max(0, orig.quantity - orig.received),
                para:        qty
              });
            }

            if (qty > 0) receivedItems.push({ item_id: id, qty });
          });

          if (!receivedItems.length) {
            throw new Error('Informe pelo menos uma quantidade recebida.');
          }

          /* ---------- RPC existente ---------- */
          const { data: res, error } = await db().rpc('receive_purchase', {
            p_purchase_id: purchase.id,
            p_items:       receivedItems
          });
          if (error) throw error;

          /* ---------- Observações ---------- */
          const notes = modal.querySelector('#rcv-notes').value.trim();
          if (notes) {
            await db().from('purchases').update({
              notes: (purchase.notes ? purchase.notes + '\n\n' : '') +
                     '[RECEBIMENTO] ' + notes
            }).eq('id', purchase.id).then(() => {}).catch(() => {});
          }

          /* ---------- Auditoria: registra cada alteração ---------- */
          if (quantityChanges.length) {
            const actor = state.currentUser || { id: null, name: 'Sistema' };
            const events = quantityChanges.map((c) => ({
              purchase_id: purchase.id,
              event:       'quantity_adjusted',
              actor_id:    actor.id,
              actor_name:  actor.name,
              payload: {
                item_id:     c.item_id,
                description: c.description,
                de:          c.de,
                para:        c.para,
                diff:        c.para - c.de
              }
            }));

            await db().from('purchase_events')
              .insert(events)
              .then(() => {})
              .catch((e) => console.warn('[audit] falha ao registrar ajustes:', e));
          }

          toast(`Recebimento registrado! Status: ${STATUS_LABEL[res.status] || res.status}`);
          close();
          await loadPurchases();
          renderKpis();
        } catch (e) {
          console.error('[rcv] confirm receive:', e);
          toast('Não foi possível registrar o recebimento. ' + e.message, 'error');
          btn.disabled = false;
          btn.querySelector('span').textContent = 'Confirmar recebimento';
        }
      });

    } catch (err) {
      console.error('[rcv] openReceiveModal:', err);
      toast('Não foi possível abrir o recebimento.', 'error');
    }
  }

  /* =========================================================
     10) MODAL · CONTESTAR
     ========================================================= */
  async function openDisputeModal(row) {
    const REASONS = [
      ['produto_faltando',     'Produto faltando'],
      ['produto_errado',       'Produto errado'],
      ['quantidade_incorreta', 'Quantidade incorreta'],
      ['preco_incorreto',      'Preço incorreto'],
      ['produto_danificado',   'Produto danificado'],
      ['produto_vencido',      'Produto vencido'],
      ['embalagem_violada',    'Embalagem violada'],
      ['cobranca_indevida',    'Cobrança indevida'],
      ['item_nao_solicitado',  'Item não solicitado'],
      ['nfe_incorreta',        'NF-e incorreta'],
      ['condicao_divergente',  'Condição comercial divergente'],
      ['prazo_divergente',     'Prazo de entrega divergente'],
      ['outro',                'Outro']
    ];

    const ACTIONS = [
      ['corrigir_nfe',          'Solicitar correção da NF-e'],
      ['enviar_faltante',       'Solicitar envio do item faltante'],
      ['substituir',            'Solicitar substituição'],
      ['devolver',              'Solicitar devolução'],
      ['recusar_item',          'Recusar item'],
      ['recusar_entrega',       'Recusar toda a entrega'],
      ['solicitar_credito',     'Solicitar crédito'],
      ['solicitar_abatimento',  'Solicitar abatimento'],
      ['receber_ressalva',      'Receber com ressalva'],
      ['enviar_aprovacao',      'Enviar para aprovação'],
      ['outro',                 'Outro']
    ];

    const modal = document.createElement('div');
    modal.className = 'rcv-modal';
    modal.innerHTML = `
      <div class="rcv-modal__backdrop" data-close></div>
      <div class="rcv-modal__dialog">
        <header class="rcv-modal__head">
          <div>
            <h3 class="rcv-modal__title">Contestar recebimento</h3>
            <p class="rcv-modal__sub">
              ${escapeHTML(row.code)} · ${escapeHTML(row.supplier_name || 'Sem fornecedor')}
            </p>
          </div>
          <button class="rcv-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </header>

        <div class="rcv-modal__body">
          <div class="rcv-field">
            <label for="rcv-reason">Motivo *</label>
            <select id="rcv-reason">
              <option value="">— Selecione —</option>
              ${REASONS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>

          <div class="rcv-field">
            <label for="rcv-action">Ação desejada *</label>
            <select id="rcv-action">
              <option value="">— Selecione —</option>
              ${ACTIONS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>

          <div class="rcv-grid-2">
            <div class="rcv-field">
              <label for="rcv-qty">Quantidade afetada</label>
              <input id="rcv-qty" type="number" min="0" step="0.001" placeholder="0" />
            </div>
            <div class="rcv-field">
              <label for="rcv-value">Valor afetado (R$)</label>
              <input id="rcv-value" type="text" placeholder="0,00" />
            </div>
          </div>

          <div class="rcv-field">
            <label for="rcv-desc">Descrição detalhada *</label>
            <textarea id="rcv-desc" placeholder="Descreva o que aconteceu, com o máximo de detalhes possível..."></textarea>
          </div>

          <div class="rcv-field">
            <label for="rcv-deadline">Prazo de resposta do fornecedor</label>
            <input id="rcv-deadline" type="date" />
          </div>

          <div id="rcv-disp-error" hidden></div>
        </div>

        <footer class="rcv-modal__foot">
          <button type="button" class="cmp-btn cmp-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="cmp-btn cmp-btn--danger" id="rcv-dispute-confirm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <path d="M12 9v4M12 17h.01"/>
            </svg>
            Registrar contestação
          </button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    modal.querySelector('#rcv-dispute-confirm').addEventListener('click', async () => {
      const errEl = modal.querySelector('#rcv-disp-error');
      errEl.hidden = true;

      const reason   = modal.querySelector('#rcv-reason').value;
      const action   = modal.querySelector('#rcv-action').value;
      const desc     = modal.querySelector('#rcv-desc').value.trim();
      const qty      = Number(modal.querySelector('#rcv-qty').value) || 0;
      const valueStr = modal.querySelector('#rcv-value').value;
      const deadline = modal.querySelector('#rcv-deadline').value || null;

      const errs = [];
      if (!reason) errs.push('Selecione um motivo.');
      if (!action) errs.push('Selecione uma ação desejada.');
      if (desc.length < 10) errs.push('Descreva o motivo com pelo menos 10 caracteres.');

      if (errs.length) {
        errEl.hidden = false;
        errEl.className = 'rcv-err';
        errEl.innerHTML = errs.map((x) => '• ' + escapeHTML(x)).join('<br>');
        return;
      }

      const valueCents = valueStr
        ? Math.round(parseFloat(String(valueStr).replace(/[^\d,.-]/g, '').replace(',', '.')) * 100)
        : 0;

      const btn = modal.querySelector('#rcv-dispute-confirm');
      btn.disabled = true;
      btn.querySelector('svg').style.opacity = '0.5';

      try {
        /* Código sequencial CONT-YYYY-NNNN */
        const year = new Date().getFullYear();
        const prefix = `CONT-${year}-`;
        const { data: last } = await db()
          .from('purchase_disputes')
          .select('code')
          .like('code', `${prefix}%`)
          .order('code', { ascending: false })
          .limit(1);
        const n = last && last[0]
          ? parseInt(last[0].code.split('-').pop(), 10) + 1
          : 1;
        const code = prefix + String(n).padStart(4, '0');

        const { error } = await db().from('purchase_disputes').insert({
          purchase_id:       row.id,
          code,
          status:            'aberta',
          reason,
          requested_action:  action,
          description:       desc,
          affected_value:    valueCents || 0,
          affected_qty:      qty || 0,
          response_deadline: deadline,
          created_by:        state.currentUser ? state.currentUser.id : null,
          created_by_name:   state.currentUser ? state.currentUser.name : null
        });
        if (error) throw error;

        await db().from('purchase_events').insert({
          purchase_id: row.id,
          event:       'disputed',
          actor_id:    state.currentUser ? state.currentUser.id : null,
          actor_name:  state.currentUser ? state.currentUser.name : 'Sistema',
          payload:     { reason, requested_action: action, code }
        }).then(() => {}).catch(() => {});

        await db().from('notifications').insert({
          target_role: 'gestor',
          title:       'Compra contestada',
          message:     `${row.code} foi contestada (${code}).`,
          kind:        'warn',
          entity_type: 'purchase',
          entity_id:   row.id
        }).then(() => {}).catch(() => {});

        toast('Contestação registrada com sucesso.');
        close();
      } catch (e) {
        console.error('[rcv] dispute:', e);
        errEl.hidden = false;
        errEl.className = 'rcv-err';
        errEl.textContent = 'Erro: ' + e.message;
        btn.disabled = false;
        btn.querySelector('svg').style.opacity = '1';
      }
    });
  }

  /* =========================================================
     11) BIND DE FILTROS
     ========================================================= */
  function bindFilters() {
    const search = $('#rcv-search');
    const status = $('#rcv-status');
    const clear  = $('#rcv-clear');

    if (!search || !status) return;

    let t = null;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.filters.q = search.value.trim();
        applyFilters();
      }, 220);
    });

    status.addEventListener('change', () => {
      state.filters.status = status.value;
      applyFilters();
    });

    if (clear) {
      clear.addEventListener('click', () => {
        search.value = '';
        status.value = '';
        state.filters.q = '';
        state.filters.status = '';
        state.filters.card = '';
        renderKpis();
        applyFilters();
      });
    }
  }

  /* =========================================================
     12) BOOTSTRAP
     ========================================================= */
  document.addEventListener('DOMContentLoaded', async () => {
    const page = document.body.dataset.page;
    if (page !== 'compras-receber') return;

    bindFilters();
    await loadCurrentUser();
    await loadPurchases();
    renderKpis();
  });

  /* Expõe para debug */
  window.RCV = { state, reload: loadPurchases };

})();