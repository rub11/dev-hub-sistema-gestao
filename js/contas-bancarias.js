/* =========================================================
   DEV HUB · Contas Bancárias
   ========================================================= */

(function () {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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

  const parseBRLToCents = (str) => {
    if (str == null || str === '') return 0;
    const clean = String(str)
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : Math.round(n * 100);
  };

  const db = () => {
    if (window.db && window.db.from) return window.db;
    throw new Error('Supabase client não encontrado.');
  };

  const toast = (msg, kind) => {
    if (window.Toast && typeof window.Toast.show === 'function') {
      return window.Toast.show(msg, kind);
    }
    const el = document.createElement('div');
    el.className = kind === 'error' ? 'fin-err' : '';
    el.style.cssText =
      'position:fixed;top:80px;right:20px;z-index:200;max-width:360px;' +
      'padding:12px 16px;border-radius:10px;background:' +
      (kind === 'error' ? 'var(--danger-soft)' : 'var(--accent-soft)') +
      ';color:' + (kind === 'error' ? 'var(--danger)' : 'var(--accent-hover)') +
      ';box-shadow:0 12px 32px -8px rgba(16,24,40,.24);font-size:13.5px';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  };

  /* =========================================================
     ESTADO
     ========================================================= */
  const state = {
    all: [],
    currentUser: null
  };

  const ACCOUNT_TYPE_LABEL = {
    corrente:    'Conta corrente',
    poupanca:    'Poupança',
    digital:     'Conta digital',
    dinheiro:    'Caixa / Dinheiro',
    investimento:'Investimento'
  };

  const BANK_SLUGS = {
    nubank:   'nubank',
    itau:     'itau',
    'itaú':   'itau',
    bb:       'bb',
    'banco do brasil': 'bb',
    bradesco: 'bradesco',
    santander:'santander',
    caixa:    'caixa',
    inter:    'inter',
    'c6':     'c6',
    'c6 bank':'c6'
  };

  /* Detecta classe visual pelo nome do banco */
  function bankClass(bankName) {
    const n = String(bankName || '').toLowerCase().trim();
    if (!n) return '';
    for (const key in BANK_SLUGS) {
      if (n.indexOf(key) !== -1) return 'cb-acc__logo--' + BANK_SLUGS[key];
    }
    return '';
  }

  /* Sigla pro logo (2 letras) */
  function bankInitials(name) {
    const n = String(name || '').trim();
    if (!n) return '—';
    const words = n.split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  /* =========================================================
     CARREGAMENTO
     ========================================================= */
  async function loadUser() {
    try {
      const { data: u } = await db().auth.getUser();
      if (u && u.user) {
        const { data: prof } = await db().from('profiles')
          .select('id, name, email').eq('id', u.user.id).maybeSingle();
        state.currentUser = prof || { id: u.user.id, name: u.user.email };
      }
    } catch (e) { console.warn(e); }
  }

  async function loadAccounts() {
    const tbody = $('#cb-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8"><div class="fin-loading">Carregando...</div></td></tr>`;

    try {
      /* Busca contas + última movimentação agregada */
      const { data: accounts, error: e1 } = await db()
        .from('financial_accounts')
        .select('*')
        .order('active', { ascending: false })
        .order('name',   { ascending: true });

      if (e1) throw e1;

      /* Última movimentação por conta (1 query só) */
      const ids = (accounts || []).map((a) => a.id);
      let lastMov = {};
      if (ids.length) {
        const { data: movs } = await db()
          .from('financial_movements')
          .select('account_id, movement_date')
          .in('account_id', ids)
          .order('movement_date', { ascending: false });

        (movs || []).forEach((m) => {
          if (!lastMov[m.account_id]) lastMov[m.account_id] = m.movement_date;
        });
      }

      state.all = (accounts || []).map((a) => ({
        ...a,
        _last_movement: lastMov[a.id] || null
      }));

      renderKpis();
      renderTable();
    } catch (e) {
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="8"><div class="fin-err">Erro: ${escapeHTML(e.message)}</div></td></tr>`;
    }
  }

  /* =========================================================
     KPIs
     ========================================================= */
  function renderKpis() {
    const wrap = $('#cb-kpis');
    if (!wrap) return;

    const active    = state.all.filter((a) => a.active);
    const totalBal  = active.reduce((s, a) => s + Number(a.current_balance_cents || 0), 0);
    const openingBal= active.reduce((s, a) => s + Number(a.opening_balance_cents || 0), 0);

    let topAcc = null;
    active.forEach((a) => {
      const b = Number(a.current_balance_cents || 0);
      if (!topAcc || b > Number(topAcc.current_balance_cents || 0)) topAcc = a;
    });

    const now = Date.now();
    const mov30 = state.all.filter((a) =>
      a._last_movement && (now - new Date(a._last_movement).getTime()) < 30 * 86400000
    ).length;

    wrap.innerHTML = `
      <div class="cb-kpi cb-kpi--balance">
        <span class="cb-kpi__label">Saldo total</span>
        <span class="cb-kpi__value ${totalBal >= 0 ? 'cb-kpi__value--pos' : 'cb-kpi__value--neg'}">${fmtBRL(totalBal)}</span>
        <span class="cb-kpi__hint">Somatório das contas ativas</span>
      </div>
      <div class="cb-kpi cb-kpi--active">
        <span class="cb-kpi__label">Contas ativas</span>
        <span class="cb-kpi__value">${active.length}</span>
        <span class="cb-kpi__hint">${state.all.length - active.length} inativa(s)</span>
      </div>
      <div class="cb-kpi cb-kpi--top">
        <span class="cb-kpi__label">Maior saldo</span>
        <span class="cb-kpi__value">${topAcc ? fmtBRL(topAcc.current_balance_cents) : '—'}</span>
        <span class="cb-kpi__hint">${topAcc ? escapeHTML(topAcc.name) : 'Sem contas'}</span>
      </div>
      <div class="cb-kpi cb-kpi--movements">
        <span class="cb-kpi__label">Movimentadas (30d)</span>
        <span class="cb-kpi__value">${mov30}</span>
        <span class="cb-kpi__hint">Contas com atividade recente</span>
      </div>
    `;
  }

  /* =========================================================
     TABELA
     ========================================================= */
  function renderTable() {
    const tbody = $('#cb-tbody');
    if (!tbody) return;

    const rows = state.all;

    if (!rows.length) {
      tbody.innerHTML = `
        <tr><td colspan="8" style="padding:0;border:0">
          <div class="cb-empty">
            <div class="cb-empty__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M2.5 10h19"/>
              </svg>
            </div>
            <h3 class="cb-empty__title">Nenhuma conta cadastrada</h3>
            <p class="cb-empty__text">Crie sua primeira conta bancária para começar.</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((a) => {
      const bal      = Number(a.current_balance_cents || 0);
      const opening  = Number(a.opening_balance_cents || 0);
      const balClass = bal >= 0 ? 'cb-money--pos' : 'cb-money--neg';
      const inactive = !a.active;

      return `
        <tr data-id="${a.id}" style="${inactive ? 'opacity:0.55' : ''}">
          <td>
            <div class="cb-acc">
              <span class="cb-acc__logo ${bankClass(a.bank_name)}">${escapeHTML(bankInitials(a.bank_name || a.name))}</span>
              <div class="cb-acc__info">
                <span class="cb-acc__name">${escapeHTML(a.name)}</span>
                ${inactive ? '<span class="cb-acc__meta">Inativa</span>' : ''}
              </div>
            </div>
          </td>
          <td>${a.bank_name ? escapeHTML(a.bank_name) : '<span style="color:var(--text-muted)">—</span>'}</td>
          <td><span class="cb-type">${escapeHTML(ACCOUNT_TYPE_LABEL[a.account_type] || a.account_type || '—')}</span></td>
          <td>
            ${a.agency || a.account_number
              ? `<span style="font-variant-numeric:tabular-nums;font-size:12.5px;color:var(--text-soft)">
                   ${a.agency ? 'Ag ' + escapeHTML(a.agency) : ''}
                   ${a.agency && a.account_number ? ' · ' : ''}
                   ${a.account_number ? 'Cc ' + escapeHTML(a.account_number) : ''}
                 </span>`
              : '<span style="color:var(--text-muted)">—</span>'}
          </td>
          <td class="cell--num"><span class="cb-money cb-money--soft">${fmtBRL(opening)}</span></td>
          <td class="cell--num"><span class="cb-money ${balClass}">${fmtBRL(bal)}</span></td>
          <td>${a._last_movement ? fmtDate(a._last_movement) : '<span style="color:var(--text-muted)">—</span>'}</td>
          <td class="cell--right">
            <div class="cb-actions">
              <button class="fin-btn fin-btn--ghost fin-btn--sm" data-action="movements" data-id="${a.id}" title="Ver movimentações">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m7 15 3.5-4 3 2.5L20 7"/>
                </svg>
              </button>
              <button class="fin-btn fin-btn--ghost fin-btn--sm" data-action="edit" data-id="${a.id}" title="Editar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                </svg>
              </button>
              <button class="fin-btn fin-btn--ghost fin-btn--sm" data-action="toggle" data-id="${a.id}" title="${a.active ? 'Desativar' : 'Ativar'}">
                ${a.active ? `
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>` : `
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>`}
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const row = state.all.find((x) => x.id === id);
        if (!row) return;
        if (btn.dataset.action === 'edit')      openAccountModal(row);
        if (btn.dataset.action === 'movements') openMovementsModal(row);
        if (btn.dataset.action === 'toggle')    toggleActive(row);
      });
    });
  }

  /* =========================================================
     MODAL · NOVA / EDITAR CONTA
     ========================================================= */
  function openAccountModal(account) {
    const isEdit = !!account;
    const a = account || {};

    const modal = document.createElement('div');
    modal.className = 'fin-modal cb-modal';
    modal.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog">
        <header class="fin-modal__head">
          <h3 class="fin-modal__title">${isEdit ? 'Editar conta' : 'Nova conta bancária'}</h3>
          <button class="fin-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>

        <div class="fin-modal__body">

          <div class="fin-grid fin-grid--2">
            <div class="fin-field">
              <label>Nome da conta *</label>
              <input type="text" id="c-name" value="${escapeHTML(a.name || '')}" placeholder="Ex.: Conta principal" />
            </div>
            <div class="fin-field">
              <label>Tipo *</label>
              <select id="c-type">
                ${Object.entries(ACCOUNT_TYPE_LABEL).map(([v, l]) =>
                  `<option value="${v}" ${a.account_type === v ? 'selected' : ''}>${l}</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <div class="fin-grid fin-grid--3">
            <div class="fin-field">
              <label>Banco</label>
              <input type="text" id="c-bankname" value="${escapeHTML(a.bank_name || '')}" placeholder="Ex.: Itaú" />
            </div>
            <div class="fin-field">
              <label>Código do banco</label>
              <input type="text" id="c-bankcode" value="${escapeHTML(a.bank_code || '')}" placeholder="Ex.: 341" />
            </div>
            <div class="fin-field">
              <label>Agência</label>
              <input type="text" id="c-agency" value="${escapeHTML(a.agency || '')}" placeholder="Ex.: 1234" />
            </div>
          </div>

          <div class="fin-grid fin-grid--2">
            <div class="fin-field">
              <label>Número da conta</label>
              <input type="text" id="c-account" value="${escapeHTML(a.account_number || '')}" placeholder="Ex.: 12345-6" />
            </div>
            <div class="fin-field">
              <label>Saldo inicial (R$) *</label>
              <input type="text" id="c-opening" value="${(Number(a.opening_balance_cents || 0) / 100).toFixed(2).replace('.', ',')}" placeholder="0,00" />
            </div>
          </div>

          <div class="fin-field">
            <label>Observações</label>
            <textarea id="c-notes" rows="2" style="width:100%;min-height:64px;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14.5px;resize:vertical">${escapeHTML(a.notes || '')}</textarea>
          </div>

          <div id="c-error" hidden class="fin-err"></div>
        </div>

        <footer class="fin-modal__foot">
          <button type="button" class="fin-btn fin-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="fin-btn fin-btn--primary" id="c-save">${isEdit ? 'Salvar alterações' : 'Criar conta'}</button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    modal.querySelector('#c-save').addEventListener('click', async () => {
      const err = modal.querySelector('#c-error');
      err.hidden = true;

      const name = modal.querySelector('#c-name').value.trim();
      if (!name) { err.textContent = 'Informe o nome da conta.'; err.hidden = false; return; }

      const payload = {
        name,
        account_type:          modal.querySelector('#c-type').value,
        bank_name:             modal.querySelector('#c-bankname').value.trim() || null,
        bank_code:             modal.querySelector('#c-bankcode').value.trim() || null,
        agency:                modal.querySelector('#c-agency').value.trim() || null,
        account_number:        modal.querySelector('#c-account').value.trim() || null,
        opening_balance_cents: parseBRLToCents(modal.querySelector('#c-opening').value),
        notes:                 modal.querySelector('#c-notes').value.trim() || null,
        updated_at:            new Date().toISOString()
      };

      /* Ao criar, current = opening */
      if (!isEdit) {
        payload.current_balance_cents = payload.opening_balance_cents;
        payload.created_by            = state.currentUser ? state.currentUser.id : null;
        payload.created_by_name       = state.currentUser ? state.currentUser.name : null;
      }

      const btn = modal.querySelector('#c-save');
      btn.disabled = true;

      try {
        if (isEdit) {
          const { error } = await db().from('financial_accounts').update(payload).eq('id', a.id);
          if (error) throw error;
          toast('Conta atualizada.');
        } else {
          const { error } = await db().from('financial_accounts').insert(payload);
          if (error) throw error;
          toast('Conta criada.');
        }
        close();
        await loadAccounts();
      } catch (e) {
        console.error(e);
        err.textContent = e.message;
        err.hidden = false;
        btn.disabled = false;
      }
    });
  }

  /* =========================================================
     MODAL · MOVIMENTAÇÕES DA CONTA
     ========================================================= */
  async function openMovementsModal(account) {
    const modal = document.createElement('div');
    modal.className = 'fin-modal cb-modal';
    modal.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog fin-modal__dialog--lg">
        <header class="fin-modal__head">
          <div>
            <h3 class="fin-modal__title">Movimentações — ${escapeHTML(account.name)}</h3>
            <p style="margin:4px 0 0;font-size:13px;color:var(--text-soft)">
              ${account.bank_name ? escapeHTML(account.bank_name) + ' · ' : ''}${escapeHTML(ACCOUNT_TYPE_LABEL[account.account_type] || '')}
            </p>
          </div>
          <button class="fin-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>

        <div class="fin-modal__body" id="cb-mov-body">
          <div class="fin-loading">Carregando movimentações...</div>
        </div>

        <footer class="fin-modal__foot">
          <button type="button" class="fin-btn fin-btn--ghost" id="cb-recalc">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>
            </svg>
            Recalcular saldo
          </button>
          <button type="button" class="fin-btn fin-btn--ghost" data-close>Fechar</button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    /* Recalcular */
    modal.querySelector('#cb-recalc').addEventListener('click', async () => {
      if (!confirm('Recalcular o saldo desta conta com base em todas as movimentações?')) return;
      try {
        const { data, error } = await db().rpc('recalc_account_balance', { p_account_id: account.id });
        if (error) throw error;
        toast('Saldo recalculado: ' + fmtBRL(data));
        close();
        await loadAccounts();
      } catch (e) {
        console.error(e);
        toast('Erro ao recalcular: ' + e.message, 'error');
      }
    });

    /* Carrega movimentações */
    try {
      const { data: movs, error } = await db()
        .from('financial_movements')
        .select('id, type, amount_cents, movement_date, description, origin_type, balance_before_cents, balance_after_cents, reconciled')
        .eq('account_id', account.id)
        .order('movement_date', { ascending: false })
        .order('created_at',    { ascending: false })
        .limit(200);

      if (error) throw error;

      const list = movs || [];

      /* Sums */
      let inSum = 0, outSum = 0;
      list.forEach((m) => {
        if (m.amount_cents > 0) inSum  += m.amount_cents;
        else                    outSum += Math.abs(m.amount_cents);
      });

      const summary = `
        <div class="cb-mov-summary">
          <div>
            <span>Entradas</span>
            <span class="cb-mov-summary__pos">${fmtBRL(inSum)}</span>
          </div>
          <div>
            <span>Saídas</span>
            <span class="cb-mov-summary__neg">${fmtBRL(outSum)}</span>
          </div>
          <div>
            <span>Saldo atual</span>
            <span class="${Number(account.current_balance_cents) >= 0 ? 'cb-mov-summary__pos' : 'cb-mov-summary__neg'}">
              ${fmtBRL(account.current_balance_cents)}
            </span>
          </div>
        </div>`;

      const itemsHTML = !list.length
        ? `<div class="cb-empty" style="padding:32px 16px">
             <p class="cb-empty__text">Nenhuma movimentação registrada nesta conta.</p>
           </div>`
        : list.map((m) => {
            const isIn  = m.amount_cents > 0;
            const val   = isIn ? '+' : '-';
            const cls   = isIn ? 'cb-mov-value--in' : 'cb-mov-value--out';
            const label = {
              entrada: 'Entrada', saida: 'Saída', transferencia: 'Transferência',
              ajuste: 'Ajuste', estorno: 'Estorno'
            }[m.type] || m.type;

            return `
              <div class="cb-mov-item">
                <div class="cb-mov-date">${fmtDate(m.movement_date)}</div>
                <div class="cb-mov-body">
                  <span class="cb-mov-desc">${escapeHTML(m.description || label)}</span>
                  <span class="cb-mov-origin">
                    ${escapeHTML(label)}
                    ${m.origin_type ? ' · ' + escapeHTML(m.origin_type) : ''}
                    ${m.reconciled ? ' · conciliado' : ''}
                  </span>
                </div>
                <div class="cb-mov-value ${cls}">
                  ${val} ${fmtBRL(Math.abs(m.amount_cents))}
                </div>
              </div>`;
          }).join('');

      modal.querySelector('#cb-mov-body').innerHTML = summary + `<div class="cb-mov-list">${itemsHTML}</div>`;
    } catch (e) {
      console.error(e);
      modal.querySelector('#cb-mov-body').innerHTML =
        `<div class="fin-err">Erro: ${escapeHTML(e.message)}</div>`;
    }
  }

  /* =========================================================
     TOGGLE ATIVO
     ========================================================= */
  async function toggleActive(account) {
    const action = account.active ? 'Desativar' : 'Ativar';
    if (!confirm(`${action} a conta "${account.name}"?`)) return;

    try {
      const { error } = await db().from('financial_accounts')
        .update({ active: !account.active, updated_at: new Date().toISOString() })
        .eq('id', account.id);
      if (error) throw error;
      toast(`Conta ${account.active ? 'desativada' : 'ativada'}.`);
      await loadAccounts();
    } catch (e) {
      console.error(e);
      toast('Erro: ' + e.message, 'error');
    }
  }

  /* =========================================================
     BOOTSTRAP
     ========================================================= */
  document.addEventListener('DOMContentLoaded', async () => {
    if (document.body.dataset.page !== 'contas-bancarias') return;

    const refresh = $('#cb-refresh');
    if (refresh) refresh.addEventListener('click', loadAccounts);

    const newBtn = $('#cb-new');
    if (newBtn) newBtn.addEventListener('click', () => openAccountModal(null));

    await loadUser();
    await loadAccounts();
  });

  window.ContasBancarias = { reload: loadAccounts, state };

})();