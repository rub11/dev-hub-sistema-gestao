/* =========================================================
   DEV HUB · Orçamentos · main
   Lista de orçamentos + modal de detalhes + editar + excluir
   + APROVAR → gera venda (com modal de confirmação customizado)
   ========================================================= */
(function () {
  'use strict';

  const state = {
    all: [],
    filtered: [],
    search: '',
    status: 'todos',
    periodo: 'todos'
  };

  const $ = (id) => document.getElementById(id);

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  function boot() {
    if (!window.db || !window.Auth) {
      console.warn('[orcamentos] db ou Auth não carregados');
      return;
    }

    injectStyles();

    const params = new URLSearchParams(window.location.search);
    const statusUrl = params.get('status');
    if (statusUrl) {
      state.status = statusUrl;
      const sel = $('orc-filter-status');
      if (sel) sel.value = statusUrl;
    }

    const newBtn = $('new-quote-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        try { sessionStorage.setItem('dh_return_to', 'orcamentos.html'); } catch (e) {}
        window.location.href = 'vendas.html?novo=orcamento';
      });
    }

    $('orc-search').addEventListener('input', (e) => {
      state.search = e.target.value.trim().toLowerCase();
      aplicar();
    });

    $('orc-filter-status').addEventListener('change', (e) => {
      state.status = e.target.value;
      aplicar();
    });

    $('orc-filter-periodo').addEventListener('change', (e) => {
      state.periodo = e.target.value;
      aplicar();
    });

    carregar();
  }

  /* ---------------------------------------------------------
     Org
     --------------------------------------------------------- */
  async function resolverOrgId(userId) {
    try {
      const profile = await window.Auth.getProfile(userId);
      if (profile) {
        const orgId = profile.organization_id || profile.org_id;
        if (orgId) return orgId;
      }
    } catch (e) {}

    try {
      const { data } = await window.db
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .maybeSingle();
      if (data?.organization_id) return data.organization_id;
    } catch (e) {}

    return null;
  }

  /* ---------------------------------------------------------
     Carregar
     --------------------------------------------------------- */
  async function carregar() {
    const session = await window.Auth.requireSession().catch(() => null);
    if (!session) return;

    const orgId = await resolverOrgId(session.user.id);
    if (!orgId) {
      mostrarVazio('Empresa não identificada', 'Não foi possível identificar sua organização.');
      return;
    }

    try {
      const { data, error } = await window.db
        .from('quotes')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      state.all = data || [];
      aplicar();
      atualizarStats();
    } catch (err) {
      console.error('[orcamentos] erro:', err);
      mostrarVazio('Erro ao carregar', 'Não foi possível carregar os orçamentos.');
    }
  }

  /* ---------------------------------------------------------
     Filtros
     --------------------------------------------------------- */
  function aplicar() {
    const agora = new Date();
    const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const seteDias = new Date(inicioDia.getTime() - 7 * 24 * 60 * 60 * 1000);
    const trintaDias = new Date(inicioDia.getTime() - 30 * 24 * 60 * 60 * 1000);
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    state.filtered = state.all.filter(q => {
      if (state.search) {
        const nome = String(q.customer_name || '').toLowerCase();
        const num = String(q.quote_number || '').toLowerCase();
        if (!nome.includes(state.search) && !num.includes(state.search)) return false;
      }

      const st = String(q.status || '').toLowerCase();
      const vencido = isExpired(q);

      if (state.status === 'pendentes') {
        if (!['draft', 'sent'].includes(st)) return false;
      }
      if (state.status === 'convertidos') {
        if (st !== 'converted') return false;
      }
      if (state.status === 'cancelados') {
        if (st !== 'cancelled') return false;
      }
      if (state.status === 'vencidos') {
        if (!vencido) return false;
      }

      const dt = new Date(q.created_at);
      if (state.periodo === 'hoje' && dt < inicioDia) return false;
      if (state.periodo === '7dias' && dt < seteDias) return false;
      if (state.periodo === '30dias' && dt < trintaDias) return false;
      if (state.periodo === 'mes' && dt < inicioMes) return false;

      return true;
    });

    render();
  }

  function isExpired(q) {
    if (!q || !q.valid_until) return false;
    if (q.status === 'converted' || q.status === 'cancelled') return false;
    return new Date(q.valid_until + 'T23:59:59') < new Date();
  }

  /* ---------------------------------------------------------
     Render
     --------------------------------------------------------- */
  function render() {
    const body = $('orc-body');
    const wrap = $('orc-table-wrap');
    const empty = $('orc-empty');
    const loading = $('orc-loading');

    loading.hidden = true;

    if (state.filtered.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      $('orc-count').textContent = 'Nenhum orçamento';
      return;
    }

    empty.hidden = true;
    wrap.hidden = false;

    $('orc-count').textContent =
      state.filtered.length === 1
        ? '1 orçamento'
        : state.filtered.length + ' orçamentos';

    body.innerHTML = state.filtered.map(renderRow).join('');

    body.querySelectorAll('[data-action]').forEach(btn => {
      const id = btn.dataset.id;
      const q = state.all.find(x => x.id === id);
      if (!q) return;

      btn.addEventListener('click', () => {
        const a = btn.dataset.action;
        if (a === 'view')    return abrirModalDetalhes(q);
        if (a === 'edit')    return editarOrcamento(q);
        if (a === 'delete')  return abrirConfirmacaoExcluir(q);
        if (a === 'approve') return aprovarOrcamento(q);
      });
    });
  }

  function renderRow(q) {
    const st = String(q.status || '').toLowerCase();
    const vencido = isExpired(q);
    const badge = statusBadge(st, vencido);
    const num = q.quote_number != null ? 'ORC-' + padNum(q.quote_number) : '—';
    const cliente = q.customer_name || '—';
    const data = formatDate(q.created_at);
    const validade = q.valid_until ? formatDate(q.valid_until) : '—';
    const total = formatMoney(q.total);
    const criador = q.created_by_name || '—';

    const podeEditar = st !== 'converted' && st !== 'cancelled';
    const podeAprovar = st !== 'converted' && st !== 'cancelled';

    return `
      <tr data-id="${q.id}">
        <td><span class="sale-number">${escapeHtml(num)}</span></td>
        <td class="cell--muted">${escapeHtml(cliente)}</td>
        <td class="cell--muted">${data}</td>
        <td class="cell--muted">${validade}</td>
        <td class="cell--num cell-price">${total}</td>
        <td><span class="badge ${badge.class}">${badge.label}</span></td>
        <td class="cell--muted">${escapeHtml(criador)}</td>
        <td class="cell--num">
          <div class="row-actions">
            <button class="row-action" data-action="view" data-id="${q.id}" title="Ver detalhes" aria-label="Ver">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            ${podeAprovar ? `
              <button class="row-action row-action--success" data-action="approve" data-id="${q.id}" title="Aprovar e gerar venda" aria-label="Aprovar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                     stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </button>
            ` : ''}
            ${podeEditar ? `
              <button class="row-action" data-action="edit" data-id="${q.id}" title="Editar orçamento" aria-label="Editar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                     stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                  <path d="M12 20h9"/>
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
                </svg>
              </button>
              <button class="row-action row-action--danger" data-action="delete" data-id="${q.id}" title="Excluir orçamento" aria-label="Excluir">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                     stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                  <path d="M3 6h18"/>
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                  <path d="M10 11v6M14 11v6"/>
                </svg>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  /* ---------------------------------------------------------
     Stats
     --------------------------------------------------------- */
  function atualizarStats() {
    const total = state.all.length;
    let pendentes = 0, aprovados = 0, valor = 0;

    state.all.forEach(q => {
      const st = String(q.status || '').toLowerCase();
      if (st === 'cancelled') return;
      if (['draft', 'sent'].includes(st)) pendentes++;
      if (st === 'converted') aprovados++;
      valor += Number(q.total) || 0;
    });

    $('stat-total').textContent = total;
    $('stat-pendentes').textContent = pendentes;
    $('stat-aprovados').textContent = aprovados;
    $('stat-valor').textContent = 'R$ ' + formatMoneyNumber(valor);
  }

  /* ---------------------------------------------------------
     MODAL DE DETALHES
     --------------------------------------------------------- */
  async function abrirModalDetalhes(q) {
    let items = [];

    console.log('[orcamentos] buscando itens do orçamento:', q.id);

    try {
      const { data, error } = await window.db
        .from('quote_items')
        .select('*')
        .eq('quote_id', q.id)
        .order('created_at', { ascending: true });

      console.log('[orcamentos] itens retornados:', data);
      console.log('[orcamentos] erro:', error);

      if (error) throw error;
      items = data || [];
    } catch (e) {
      console.error('[orcamentos] erro ao buscar itens:', e);
      items = [];
    }

    console.log('[orcamentos] items.length:', items.length);

    const st = String(q.status || '').toLowerCase();
    const badge = statusBadge(st, isExpired(q));
    const num = q.quote_number != null ? 'ORC-' + padNum(q.quote_number) : '—';
    const deposit = Number(q.deposit_amount) || 0;
    const totalNum = Number(q.total) || 0;
    const saldo = Math.max(0, totalNum - deposit);

    const podeEditar  = st !== 'converted' && st !== 'cancelled';
    const podeAprovar = st !== 'converted' && st !== 'cancelled';

    const modal = document.createElement('div');
    modal.className = 'modal dh-q-modal';
    modal.innerHTML = `
      <div class="modal__backdrop" data-close></div>
      <div class="modal__dialog modal__dialog--lg" role="dialog" aria-modal="true">
        <header class="modal__head">
          <div>
            <h2 class="modal__title">${escapeHtml(num)}</h2>
            <p style="margin:6px 0 0;font-size:13px;color:var(--text-muted)">
              ${escapeHtml(q.customer_name || 'Sem cliente')} · ${formatDate(q.created_at)}
            </p>
          </div>
          <button class="icon-btn modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
                 stroke-linecap="round" width="18" height="18">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </header>

        <div class="modal__body">
          <div class="dh-q-meta">
            <div class="dh-q-meta__item">
              <span class="dh-q-meta__label">Status</span>
              <span class="badge ${badge.class}">${badge.label}</span>
            </div>
            <div class="dh-q-meta__item">
              <span class="dh-q-meta__label">Válido até</span>
              <span>${q.valid_until ? formatDate(q.valid_until) : '—'}</span>
            </div>
            <div class="dh-q-meta__item">
              <span class="dh-q-meta__label">Criado por</span>
              <span>${escapeHtml(q.created_by_name || '—')}</span>
            </div>
            <div class="dh-q-meta__item">
              <span class="dh-q-meta__label">Pagamento</span>
              <span>${escapeHtml(q.payment_method || '—')}</span>
            </div>
          </div>

          <h3 class="dh-q-section">Itens do orçamento</h3>
          ${items.length === 0 ? `
            <div class="dh-q-empty-items">
              Nenhum item cadastrado neste orçamento.
            </div>
          ` : `
            <div class="dh-q-items">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th class="cell--num">Qtd</th>
                    <th class="cell--num">Preço un.</th>
                    <th class="cell--num">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(it => `
                    <tr>
                      <td>${escapeHtml(it.product_name || '—')}</td>
                      <td class="cell--num">${Number(it.quantity) || 0}</td>
                      <td class="cell--num">${formatMoney(it.unit_price)}</td>
                      <td class="cell--num">${formatMoney(it.subtotal)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}

          <div class="dh-q-totals">
            <div class="dh-q-totals__row">
              <span>Subtotal</span>
              <span>${formatMoney(q.subtotal)}</span>
            </div>
            <div class="dh-q-totals__row">
              <span>Desconto</span>
              <span>- ${formatMoney(q.discount)}</span>
            </div>
            <div class="dh-q-totals__row dh-q-totals__row--grand">
              <span>Total</span>
              <span>${formatMoney(q.total)}</span>
            </div>
            ${deposit > 0 ? `
              <div class="dh-q-totals__row">
                <span>Sinal</span>
                <span>${formatMoney(deposit)}</span>
              </div>
              <div class="dh-q-totals__row dh-q-totals__row--grand">
                <span>Saldo</span>
                <span>${formatMoney(saldo)}</span>
              </div>
            ` : ''}
          </div>

          ${q.notes ? `
            <h3 class="dh-q-section">Observações</h3>
            <p class="dh-q-notes">${escapeHtml(q.notes)}</p>
          ` : ''}
        </div>

        <footer class="modal__foot">
          <button class="btn btn--ghost" data-close>Fechar</button>
          <div class="modal__foot-actions">
            ${podeEditar ? `
              <button class="btn btn--danger" data-delete>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
                     stroke-linecap="round" stroke-linejoin="round" width="16" height="16"
                     style="margin-right:6px">
                  <path d="M3 6h18"/>
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                </svg>
                Excluir
              </button>
              <button class="btn btn--ghost" data-edit>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
                     stroke-linecap="round" stroke-linejoin="round" width="16" height="16"
                     style="margin-right:6px">
                  <path d="M12 20h9"/>
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
                </svg>
                Editar
              </button>
            ` : ''}
            ${podeAprovar ? `
              <button class="btn btn--success" data-approve>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                     stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
                Aprovar e gerar venda
              </button>
            ` : ''}
          </div>
        </footer>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const close = () => {
      modal.remove();
      document.body.style.overflow = '';
    };

    modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));

    modal.querySelector('[data-edit]')?.addEventListener('click', () => {
      close();
      editarOrcamento(q);
    });

    modal.querySelector('[data-delete]')?.addEventListener('click', () => {
      close();
      abrirConfirmacaoExcluir(q);
    });

    modal.querySelector('[data-approve]')?.addEventListener('click', () => {
      close();
      aprovarOrcamento(q);
    });

    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  /* ---------------------------------------------------------
     APROVAR → GERAR VENDA
     --------------------------------------------------------- */
  async function aprovarOrcamento(q) {
    const num = q.quote_number != null ? 'ORC-' + padNum(q.quote_number) : '—';
    const cliente = q.customer_name || 'Sem cliente';
    const total = formatMoney(q.total);

    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal dh-q-modal';
      modal.innerHTML = `
        <div class="modal__backdrop" data-close></div>
        <div class="modal__dialog modal__dialog--sm" role="alertdialog" aria-modal="true">
          <header class="modal__head dh-q-confirm__head">
            <div class="dh-q-confirm__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                   stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            </div>
            <div>
              <h2 class="modal__title">Aprovar orçamento</h2>
              <p class="dh-q-confirm__sub">Gerar venda a partir deste orçamento?</p>
            </div>
          </header>

          <div class="modal__body dh-q-confirm__body">
            <div class="dh-q-confirm__summary">
              <div class="dh-q-confirm__row">
                <span class="dh-q-confirm__label">Orçamento</span>
                <span class="dh-q-confirm__value dh-q-confirm__value--mono">${escapeHtml(num)}</span>
              </div>
              <div class="dh-q-confirm__row">
                <span class="dh-q-confirm__label">Cliente</span>
                <span class="dh-q-confirm__value">${escapeHtml(cliente)}</span>
              </div>
              <div class="dh-q-confirm__row dh-q-confirm__row--total">
                <span class="dh-q-confirm__label">Total</span>
                <span class="dh-q-confirm__value dh-q-confirm__value--total">${total}</span>
              </div>
            </div>

            <div class="dh-q-confirm__alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
                   stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8v5"/>
                <path d="M12 16h.01"/>
              </svg>
              <p>
                Uma <strong>nova venda</strong> será criada em Vendas com os mesmos itens.
                O orçamento ficará marcado como <strong>Convertido</strong> e não poderá mais ser editado.
              </p>
            </div>

            <p id="dh-q-approve-feedback" class="feedback feedback--error"
               role="alert" aria-live="polite" hidden></p>
          </div>

          <footer class="modal__foot dh-q-confirm__foot">
            <button type="button" class="btn btn--ghost" data-close>Cancelar</button>
            <button type="button" class="btn btn--success" id="dh-q-approve-confirm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                   stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
              <span class="btn__label">Confirmar e gerar venda</span>
            </button>
          </footer>
        </div>
      `;

      document.body.appendChild(modal);
      document.body.style.overflow = 'hidden';

      const close = () => {
        modal.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', esc);
        resolve();
      };

      const esc = (e) => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', esc);

      modal.querySelectorAll('[data-close]').forEach(el =>
        el.addEventListener('click', close)
      );

      const confirmBtn = modal.querySelector('#dh-q-approve-confirm');
      const feedback = modal.querySelector('#dh-q-approve-feedback');
      const label = confirmBtn.querySelector('.btn__label');

      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        if (label) label.textContent = 'Gerando venda...';

        try {
          const { data: items, error: itemsErr } = await window.db
            .from('quote_items')
            .select('*')
            .eq('quote_id', q.id)
            .order('created_at');

          if (itemsErr) throw itemsErr;

          if (!items || items.length === 0) {
            throw new Error('Orçamento sem itens — não dá pra gerar venda.');
          }

          const payloadItems = items.map(it => ({
            product_id: it.product_id,
            product_name: it.product_name,
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0,
            subtotal: Number(it.subtotal) || 0
          }));

          const { data, error } = await window.db.rpc('create_sale', {
            p_customer_id: q.customer_id,
            p_subtotal: Number(q.subtotal) || 0,
            p_discount: Number(q.discount) || 0,
            p_total: Number(q.total) || 0,
            p_payment_method: q.payment_method || '',
            p_notes: (q.notes ? q.notes + '\n\n' : '') + 'Gerado a partir do orçamento ' + num,
            p_items: payloadItems,
            p_allow_no_stock: true,
            p_deposit_amount: Number(q.deposit_amount) || 0,
            p_installment_count: null,
            p_installment_value: null,
            p_method_requires_appr: false
          });

          if (error) throw error;

          const result = Array.isArray(data) ? data[0] : data;
          const saleId = result && (result.sale_id || result.id);
          const saleNumber = result && result.sale_number;

          if (!saleId) throw new Error('Venda criada mas sem ID retornado.');

          try {
            await window.db.rpc('link_quote_to_sale', {
              p_quote_id: q.id,
              p_sale_id: saleId
            });
          } catch (e) {
            console.warn('[orcamentos] link_quote_to_sale falhou, usando update direto:', e);
            await window.db
              .from('quotes')
              .update({ status: 'converted' })
              .eq('id', q.id);
          }

          q.status = 'converted';
          aplicar();
          atualizarStats();

          close();
          toast(
            'Venda #' + padNum(saleNumber) + ' gerada a partir do ' + num + '.',
            'success'
          );
        } catch (e) {
          console.error('[orcamentos] aprovar:', e);
          if (feedback) {
            feedback.textContent = e.message || 'Não foi possível gerar a venda. Tente novamente.';
            feedback.hidden = false;
          }
          confirmBtn.disabled = false;
          if (label) label.textContent = 'Confirmar e gerar venda';
        }
      });
    });
  }

  /* ---------------------------------------------------------
     EDITAR
     --------------------------------------------------------- */
  function editarOrcamento(q) {
    try { sessionStorage.setItem('dh_return_to', 'orcamentos.html'); } catch (e) {}
    window.location.href = 'vendas.html?editar_orcamento=' + encodeURIComponent(q.id);
  }

  /* ---------------------------------------------------------
     EXCLUIR
     --------------------------------------------------------- */
  function abrirConfirmacaoExcluir(q) {
    const num = q.quote_number != null ? 'ORC-' + padNum(q.quote_number) : '—';
    const cliente = q.customer_name || 'sem cliente';

    const modal = document.createElement('div');
    modal.className = 'modal dh-q-modal';
    modal.innerHTML = `
      <div class="modal__backdrop" data-close></div>
      <div class="modal__dialog modal__dialog--sm" role="alertdialog" aria-modal="true">
        <header class="modal__head">
          <h2 class="modal__title">Excluir orçamento</h2>
          <button class="icon-btn modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
                 stroke-linecap="round" width="18" height="18">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </header>

        <div class="modal__body">
          <p style="margin:0;font-size:14px;line-height:1.5">
            Tem certeza que deseja excluir o orçamento
            <strong>${escapeHtml(num)}</strong> de <strong>${escapeHtml(cliente)}</strong>?
          </p>
          <p style="margin:12px 0 0;font-size:12.5px;color:var(--text-muted)">
            Esta ação não pode ser desfeita. Todos os itens vinculados serão removidos.
          </p>
          <p id="dh-q-del-feedback" class="feedback feedback--error"
             role="alert" aria-live="polite" hidden
             style="margin-top:12px"></p>
        </div>

        <footer class="modal__foot">
          <button class="btn btn--ghost" data-close>Cancelar</button>
          <button class="btn btn--danger" id="dh-q-del-confirm">
            <span class="btn__label">Sim, excluir</span>
          </button>
        </footer>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const close = () => {
      modal.remove();
      document.body.style.overflow = '';
    };

    modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));

    const confirmBtn = modal.querySelector('#dh-q-del-confirm');
    const feedback = modal.querySelector('#dh-q-del-feedback');

    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Excluindo...';

      try {
        await window.db.from('quote_items').delete().eq('quote_id', q.id);
        const { error } = await window.db.from('quotes').delete().eq('id', q.id);
        if (error) throw error;

        state.all = state.all.filter(x => x.id !== q.id);
        aplicar();
        atualizarStats();

        close();
        toast('Orçamento excluído com sucesso.', 'success');
      } catch (e) {
        console.error('[orcamentos] erro ao excluir:', e);
        if (feedback) {
          feedback.textContent = 'Não foi possível excluir. Tente novamente.';
          feedback.hidden = false;
        }
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Sim, excluir';
      }
    });

    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  /* ---------------------------------------------------------
     Badge
     --------------------------------------------------------- */
  function statusBadge(st, vencido) {
    if (vencido) return { class: 'badge--expired', label: 'Vencido' };
    if (st === 'draft')     return { class: 'badge--draft', label: 'Rascunho' };
    if (st === 'sent')      return { class: 'badge--sent', label: 'Enviado' };
    if (st === 'converted') return { class: 'badge--converted', label: 'Convertido' };
    if (st === 'cancelled') return { class: 'badge--cancelled', label: 'Cancelado' };
    if (st === 'expired')   return { class: 'badge--expired', label: 'Vencido' };
    return { class: 'badge--muted', label: st || '—' };
  }

  /* ---------------------------------------------------------
     Helpers
     --------------------------------------------------------- */
  function padNum(n) {
    const s = String(n == null ? '' : n);
    return s.length >= 6 ? s : '0'.repeat(6 - s.length) + s;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('pt-BR');
  }

  function formatMoney(v) {
    const n = Number(v) || 0;
    return 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function formatMoneyNumber(v) {
    const n = Number(v) || 0;
    return n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function mostrarVazio(title, text) {
    const loading = $('orc-loading');
    const wrap = $('orc-table-wrap');
    const empty = $('orc-empty');
    if (loading) loading.hidden = true;
    if (wrap) wrap.hidden = true;
    if (empty) empty.hidden = false;
    const titleEl = $('orc-empty-title');
    const textEl = $('orc-empty-text');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
  }

  function toast(msg, type) {
    const region = document.getElementById('toast-region');
    if (!region) { console.log('[orcamentos]', msg); return; }
    const el = document.createElement('div');
    el.className = 'toast toast--' + (type || 'info');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const t = document.createElement('span');
    t.className = 'toast__message';
    t.textContent = msg;
    el.appendChild(t);
    region.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 400);
    }, 3200);
  }

  /* ---------------------------------------------------------
     CSS — DESIGN PREMIUM (CORRIGIDO)
     --------------------------------------------------------- */
  function injectStyles() {
    if (document.getElementById('dh-q-styles')) return;
    const s = document.createElement('style');
    s.id = 'dh-q-styles';
    s.textContent = `
      /* =====================================================
         MODAL DE ORÇAMENTO — DESIGN PREMIUM
         ===================================================== */

      /* Backdrop */
      .dh-q-modal {
        position: fixed !important;
        inset: 0 !important;
        z-index: 9999 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 20px !important;
        overflow-y: auto !important;
      }

      /* Card */
      .dh-q-modal .modal__dialog {
        width: 100% !important;
        max-width: 760px !important;
        max-height: calc(100vh - 40px) !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        background: linear-gradient(180deg, #0e1420 0%, #0a0f18 100%) !important;
        border: 1px solid rgba(255,255,255,.08) !important;
        border-radius: 18px !important;
        box-shadow: 0 30px 80px -20px rgba(0,0,0,.8),
                    0 0 120px -40px rgba(99,102,241,.3) !important;
        display: flex !important;
        flex-direction: column !important;
        margin: auto !important;
      }
      .dh-q-modal .modal__dialog--sm {
        max-width: 480px !important;
      }

      /* Scroll customizado no modal */
      .dh-q-modal .modal__dialog::-webkit-scrollbar { width: 8px; }
      .dh-q-modal .modal__dialog::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,.1); border-radius: 4px;
      }

      /* Head */
      .dh-q-modal .modal__head {
        padding: 22px 26px 18px !important;
        border-bottom: 1px solid rgba(255,255,255,.06) !important;
        flex-shrink: 0 !important;
      }
      .dh-q-modal .modal__title {
        font-size: 18px !important;
        font-weight: 700 !important;
        letter-spacing: -.01em !important;
        color: #f0f4fa !important;
        margin: 0 !important;
      }

      /* Body */
      .dh-q-modal .modal__body {
        padding: 24px 26px !important;
        flex: 1 1 auto !important;
        overflow: visible !important;
      }

      /* Fix do badge */
      .dh-q-modal .badge {
        display: inline-flex !important;
        align-items: center !important;
        padding: 4px 10px !important;
        line-height: 1.2 !important;
        height: auto !important;
        max-width: fit-content !important;
        white-space: nowrap !important;
        overflow: visible !important;
        font-size: 11.5px !important;
        font-weight: 600 !important;
        border-radius: 6px !important;
      }

      /* ---------- META ---------- */
      .dh-q-meta {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) !important;
        gap: 1px !important;
        background: rgba(255,255,255,.05) !important;
        border-radius: 12px !important;
        overflow: hidden !important;
        margin-bottom: 26px !important;
        border: 1px solid rgba(255,255,255,.05) !important;
      }
      .dh-q-meta__item {
        display: flex !important;
        flex-direction: column !important;
        gap: 6px !important;
        padding: 14px 16px !important;
        background: #0a0f18 !important;
        min-height: 60px !important;
        justify-content: center !important;
        overflow: visible !important;
      }
      .dh-q-meta__label {
        font-size: 10.5px !important;
        font-weight: 600 !important;
        letter-spacing: .08em !important;
        text-transform: uppercase !important;
        color: #7a8698 !important;
      }
      .dh-q-meta__item > span:last-child {
        font-size: 13.5px !important;
        color: #e6eaf2 !important;
        font-weight: 500 !important;
      }

      /* ---------- SEÇÕES ---------- */
      .dh-q-section {
        margin: 0 0 12px !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        letter-spacing: .1em !important;
        text-transform: uppercase !important;
        color: #7a8698 !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }
      .dh-q-section::after {
        content: '' !important;
        flex: 1 !important;
        height: 1px !important;
        background: linear-gradient(90deg, rgba(255,255,255,.08), transparent) !important;
      }
      .dh-q-section:not(:first-child) {
        margin-top: 26px !important;
      }

      /* ---------- TABELA DE ITENS (FIX) ---------- */
      .dh-q-items {
        border: 1px solid rgba(255,255,255,.06) !important;
        border-radius: 12px !important;
        background: rgba(0,0,0,.2) !important;
        overflow: visible !important;
        display: block !important;
        width: 100% !important;
      }
      .dh-q-items table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 13px !important;
        display: table !important;
        table-layout: auto !important;
      }
      .dh-q-items thead {
        display: table-header-group !important;
      }
      .dh-q-items tbody {
        display: table-row-group !important;
      }
      .dh-q-items thead th {
        text-align: left !important;
        padding: 11px 16px !important;
        background: rgba(255,255,255,.025) !important;
        color: #8b95a7 !important;
        font-size: 10.5px !important;
        font-weight: 600 !important;
        letter-spacing: .08em !important;
        text-transform: uppercase !important;
        border-bottom: 1px solid rgba(255,255,255,.06) !important;
        white-space: nowrap !important;
      }
      .dh-q-items tbody td {
        padding: 12px 16px !important;
        border-top: 1px solid rgba(255,255,255,.04) !important;
        color: #c7d0dd !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
        vertical-align: middle !important;
        white-space: normal !important;
      }
      .dh-q-items tbody tr:first-child td { border-top: 0 !important; }
      .dh-q-items tbody tr:hover td {
        background: rgba(255,255,255,.02) !important;
      }
      .dh-q-items tbody td:first-child {
        color: #e6eaf2 !important;
        font-weight: 500 !important;
      }
      .dh-q-items .cell--num {
        text-align: right !important;
        font-family: ui-monospace, "SF Mono", Menlo, monospace !important;
        font-size: 12.5px !important;
        white-space: nowrap !important;
      }

      .dh-q-empty-items {
        padding: 32px 20px !important;
        text-align: center !important;
        color: #6b7688 !important;
        font-size: 13px !important;
        background: rgba(0,0,0,.15) !important;
        border: 1px dashed rgba(255,255,255,.08) !important;
        border-radius: 12px !important;
      }

      /* ---------- TOTAIS ---------- */
      .dh-q-totals {
        margin-top: 22px !important;
        padding: 18px 22px !important;
        border-radius: 12px !important;
        background: linear-gradient(135deg, rgba(99,102,241,.05), rgba(59,130,246,.03)) !important;
        border: 1px solid rgba(99,102,241,.15) !important;
      }
      .dh-q-totals__row {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding: 7px 0 !important;
        font-size: 13px !important;
        color: #c7d0dd !important;
      }
      .dh-q-totals__row span:last-child {
        font-family: ui-monospace, "SF Mono", Menlo, monospace !important;
        font-size: 13px !important;
      }
      .dh-q-totals__row--grand {
        padding-top: 14px !important;
        margin-top: 8px !important;
        border-top: 1px solid rgba(99,102,241,.2) !important;
        font-size: 16px !important;
        font-weight: 700 !important;
        color: #f0f4fa !important;
      }
      .dh-q-totals__row--grand span:last-child {
        font-size: 20px !important;
        color: #93b6ff !important;
        text-shadow: 0 0 24px rgba(99,102,241,.4) !important;
      }

      /* ---------- NOTAS ---------- */
      .dh-q-notes {
        margin: 0 !important;
        padding: 14px 18px !important;
        border-radius: 12px !important;
        background: rgba(255,255,255,.02) !important;
        border: 1px solid rgba(255,255,255,.06) !important;
        font-size: 13px !important;
        line-height: 1.55 !important;
        color: #c7d0dd !important;
        white-space: pre-wrap !important;
      }

      /* ---------- FOOTER ---------- */
      .dh-q-modal .modal__foot {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        gap: 12px !important;
        padding: 18px 26px !important;
        border-top: 1px solid rgba(255,255,255,.06) !important;
        background: rgba(0,0,0,.15) !important;
        flex-wrap: wrap !important;
        flex-shrink: 0 !important;
      }
      .dh-q-modal .modal__foot-actions {
        display: flex !important;
        gap: 8px !important;
        align-items: center !important;
        flex-wrap: wrap !important;
        margin-left: auto !important;
      }
      .dh-q-modal .modal__foot .btn,
      .dh-q-modal .modal__foot-actions .btn {
        padding: 10px 16px !important;
        font-size: 13px !important;
        border-radius: 10px !important;
        white-space: nowrap !important;
      }

      /* ---------- BOTÃO VERDE (SUCCESS) ---------- */
      .btn--success {
        appearance: none !important;
        border: 0 !important;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
        color: #fff !important;
        border-radius: 10px !important;
        padding: 10px 18px !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        font-family: inherit !important;
        cursor: pointer !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        box-shadow: 0 0 0 1px rgba(255,255,255,.1) inset,
                    0 8px 24px -8px rgba(16,185,129,.6) !important;
        transition: filter .15s ease, box-shadow .15s ease, transform .12s ease !important;
      }
      .btn--success:hover:not(:disabled) {
        filter: brightness(1.1) !important;
        box-shadow: 0 0 0 1px rgba(255,255,255,.15) inset,
                    0 12px 32px -8px rgba(16,185,129,.8) !important;
        transform: translateY(-1px) !important;
      }
      .btn--success:active:not(:disabled) {
        transform: translateY(0) !important;
      }
      .btn--success:disabled {
        opacity: .6 !important;
        cursor: not-allowed !important;
      }

      /* ---------- ROW ACTION VERDE ---------- */
      .row-action--success { color: #10b981 !important; }
      .row-action--success:hover {
        background: rgba(16,185,129,.12) !important;
        color: #34d399 !important;
      }

      /* =====================================================
         MODAL DE CONFIRMAÇÃO (aprovar orçamento)
         ===================================================== */
      .dh-q-confirm__head {
        display: flex !important;
        align-items: center !important;
        gap: 14px !important;
        padding: 22px 24px 16px !important;
        border-bottom: 1px solid rgba(255,255,255,.06) !important;
      }
      .dh-q-confirm__icon {
        display: grid !important;
        place-items: center !important;
        width: 44px !important;
        height: 44px !important;
        border-radius: 12px !important;
        flex: none !important;
        background: linear-gradient(135deg, rgba(16,185,129,.25), rgba(5,150,105,.1)) !important;
        border: 1px solid rgba(16,185,129,.4) !important;
        color: #34d399 !important;
        box-shadow: 0 0 24px -4px rgba(16,185,129,.5) !important;
      }
      .dh-q-confirm__head .modal__title {
        margin: 0 !important;
        font-size: 16px !important;
        font-weight: 700 !important;
      }
      .dh-q-confirm__sub {
        margin: 3px 0 0 !important;
        font-size: 12.5px !important;
        color: #8b95a7 !important;
      }

      .dh-q-confirm__body {
        padding: 22px 24px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 16px !important;
      }

      .dh-q-confirm__summary {
        border-radius: 12px !important;
        border: 1px solid rgba(255,255,255,.06) !important;
        background: rgba(255,255,255,.02) !important;
        overflow: hidden !important;
      }
      .dh-q-confirm__row {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding: 12px 16px !important;
        border-top: 1px solid rgba(255,255,255,.04) !important;
      }
      .dh-q-confirm__row:first-child { border-top: 0 !important; }
      .dh-q-confirm__label {
        font-size: 12px !important;
        color: #7a8698 !important;
        font-weight: 500 !important;
      }
      .dh-q-confirm__value {
        font-size: 13.5px !important;
        color: #e6eaf2 !important;
        font-weight: 500 !important;
      }
      .dh-q-confirm__value--mono {
        font-family: ui-monospace, "SF Mono", Menlo, monospace !important;
        letter-spacing: -.01em !important;
      }
      .dh-q-confirm__row--total {
        background: linear-gradient(135deg, rgba(99,102,241,.08), rgba(59,130,246,.04)) !important;
        border-top: 1px solid rgba(99,102,241,.15) !important;
      }
      .dh-q-confirm__value--total {
        font-family: ui-monospace, "SF Mono", Menlo, monospace !important;
        font-size: 18px !important;
        font-weight: 700 !important;
        color: #93b6ff !important;
        text-shadow: 0 0 20px rgba(99,102,241,.4) !important;
      }

      .dh-q-confirm__alert {
        display: flex !important;
        gap: 12px !important;
        padding: 14px 16px !important;
        border-radius: 12px !important;
        background: rgba(59,130,246,.06) !important;
        border: 1px solid rgba(59,130,246,.2) !important;
        color: #93b6ff !important;
      }
      .dh-q-confirm__alert svg {
        flex: none !important;
        margin-top: 1px !important;
        color: #60a5fa !important;
      }
      .dh-q-confirm__alert p {
        margin: 0 !important;
        font-size: 12.5px !important;
        line-height: 1.55 !important;
        color: #b7c9f0 !important;
      }
      .dh-q-confirm__alert strong {
        color: #e6eaf2 !important;
        font-weight: 600 !important;
      }

      .dh-q-confirm__foot {
        padding: 16px 24px !important;
      }

      /* ---------- RESPONSIVO ---------- */
      @media (max-width: 640px) {
        .dh-q-modal .modal__dialog { max-width: 100% !important; }
        .dh-q-modal .modal__head { padding: 18px 20px 14px !important; }
        .dh-q-modal .modal__body { padding: 20px !important; }
        .dh-q-modal .modal__foot {
          padding: 16px 20px !important;
          flex-direction: column-reverse !important;
          align-items: stretch !important;
        }
        .dh-q-modal .modal__foot-actions {
          flex-direction: column-reverse !important;
          width: 100% !important;
          margin-left: 0 !important;
        }
        .dh-q-modal .modal__foot .btn,
        .dh-q-modal .modal__foot-actions .btn {
          width: 100% !important;
          justify-content: center !important;
        }
        .dh-q-meta { grid-template-columns: 1fr 1fr !important; }
        .dh-q-totals__row--grand span:last-child { font-size: 18px !important; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ---------------------------------------------------------
     Start
     --------------------------------------------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();