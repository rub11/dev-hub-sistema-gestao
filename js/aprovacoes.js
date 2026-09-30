/* =========================================================
   DEV HUB · Tela de Aprovações
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

  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleString('pt-BR');
  };

  const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return 'agora';
    if (diff < 3600)  return Math.floor(diff / 60) + ' min';
    if (diff < 86400) return Math.floor(diff / 3600) + ' h';
    return Math.floor(diff / 86400) + ' d';
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
    el.className = kind === 'error' ? 'appr-err' : '';
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

  /* =========================================================
     CARREGAMENTO
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
      console.warn(e);
    }
  }

  async function loadPending() {
    const tbody = $('#appr-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7"><div class="appr-loading">Carregando...</div></td></tr>`;

    try {
      const { data, error } = await db().from('purchases')
        .select(`
          id, code, status, supplier_name, supplier_id, total_cents,
          purchase_date, expected_date, created_at, created_by_name,
          payment_method, invoice_number, notes
        `)
        .eq('status', 'aguardando_aprovacao')
        .order('created_at', { ascending: true })
        .limit(300);

      if (error) throw error;

      state.all = data || [];
      renderKpis();
      renderTable();
    } catch (e) {
      console.error(e);
      tbody.innerHTML = `
        <tr><td colspan="7" style="padding:0;border:0">
          <div class="appr-empty">
            <div class="appr-empty__icon" style="background:var(--danger-soft);color:var(--danger)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
            </div>
            <h3 class="appr-empty__title">Erro ao carregar</h3>
            <p class="appr-empty__text">${escapeHTML(e.message)}</p>
          </div>
        </td></tr>`;
    }
  }

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
        hint: state.all.length === 0 ? 'Tudo em dia 🎉' : `${state.all.length} compra${state.all.length > 1 ? 's' : ''} para revisar`
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
        hint: maisAntigo ? `Há ${diasAntigo} dia${diasAntigo !== 1 ? 's' : ''}` : 'Nada pendente'
      },
      {
        cls: 'hoje',
        label: 'Enviadas hoje',
        value: String(state.all.filter((r) => r.created_at && r.created_at.slice(0, 10) === hoje).length),
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

    tbody.querySelectorAll('[data-action]').forEach((btn) => {
      const id = btn.dataset.id;
      const row = state.all.find((x) => x.id === id);
      if (!row) return;
      if (btn.dataset.action === 'view')    btn.addEventListener('click', () => openViewModal(row));
      if (btn.dataset.action === 'approve') btn.addEventListener('click', () => openApproveModal(row));
      if (btn.dataset.action === 'reject')  btn.addEventListener('click', () => openRejectModal(row));
    });
  }

  /* =========================================================
     MODAL · VER DETALHES
     ========================================================= */
  async function openViewModal(row) {
    try {
      const { data: items, error } = await db()
        .from('purchase_items')
        .select('*')
        .eq('purchase_id', row.id)
        .order('created_at');
      if (error) throw error;

      const modal = document.createElement('div');
      modal.className = 'appr-modal';
      modal.innerHTML = `
        <div class="appr-modal__backdrop" data-close></div>
        <div class="appr-modal__dialog appr-modal__dialog--lg">
          <header class="appr-modal__head">
            <div>
              <h3 class="appr-modal__title">${escapeHTML(row.code)}</h3>
              <p class="appr-modal__sub">
                Solicitada por ${escapeHTML(row.created_by_name || '—')} · ${fmtDateTime(row.created_at)}
              </p>
            </div>
            <button class="appr-modal__close" data-close aria-label="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </header>
          <div class="appr-modal__body">

            <div style="display:flex;gap:12px;flex-wrap:wrap">
              <span class="appr-chip">Aguardando aprovação</span>
              ${row.payment_method ? `<span style="font-size:13px;color:var(--text-soft);align-self:center">${escapeHTML(row.payment_method)}</span>` : ''}
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div>
                <strong style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Fornecedor</strong>
                <div style="font-size:15px;margin-top:2px">${escapeHTML(row.supplier_name || '—')}</div>
              </div>
              <div>
                <strong style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Valor total</strong>
                <div style="font-size:18px;font-weight:700;margin-top:2px">${fmtBRL(row.total_cents)}</div>
              </div>
            </div>

            <h4 style="margin:4px 0 0;font-size:13.5px;font-weight:600">Itens do pedido</h4>
            <div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px">
              <table style="width:100%;border-collapse:collapse;font-size:13.5px;min-width:420px">
                <thead>
                  <tr style="border-bottom:1px solid var(--border);text-align:left;color:var(--text-muted);font-size:11px;text-transform:uppercase">
                    <th style="padding:10px 14px">Descrição</th>
                    <th style="padding:10px 14px;text-align:right">Qtd</th>
                    <th style="padding:10px 14px;text-align:right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  ${(items || []).map((it) => `
                    <tr style="border-bottom:1px solid var(--border)">
                      <td style="padding:10px 14px">${escapeHTML(it.description)}</td>
                      <td style="padding:10px 14px;text-align:right">${Number(it.quantity)} ${escapeHTML(it.unit || 'un')}</td>
                      <td style="padding:10px 14px;text-align:right;font-variant-numeric:tabular-nums">${fmtBRL(it.total_cents)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            ${row.notes ? `
              <div>
                <strong style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Observações</strong>
                <p style="margin:6px 0 0;font-size:13.5px;color:var(--text-soft);line-height:1.5;white-space:pre-wrap">${escapeHTML(row.notes)}</p>
              </div>
            ` : ''}

          </div>
          <footer class="appr-modal__foot">
            <button type="button" class="appr-btn appr-btn--ghost" data-close>Fechar</button>
            <button type="button" class="appr-btn appr-btn--danger" id="m-reject">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
              Rejeitar
            </button>
            <button type="button" class="appr-btn appr-btn--success" id="m-approve">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
              Aprovar
            </button>
          </footer>
        </div>`;
      document.body.appendChild(modal);

      const close = () => modal.remove();
      modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

      modal.querySelector('#m-approve').addEventListener('click', () => {
        close();
        openApproveModal(row);
      });
      modal.querySelector('#m-reject').addEventListener('click', () => {
        close();
        openRejectModal(row);
      });
    } catch (e) {
      console.error(e);
      toast('Não foi possível abrir os detalhes.', 'error');
    }
  }

  /* =========================================================
     MODAL · APROVAR
     ========================================================= */
  function openApproveModal(row) {
    const modal = document.createElement('div');
    modal.className = 'appr-modal';
    modal.innerHTML = `
      <div class="appr-modal__backdrop" data-close></div>
      <div class="appr-modal__dialog">
        <header class="appr-modal__head">
          <div>
            <h3 class="appr-modal__title">Aprovar compra</h3>
            <p class="appr-modal__sub">${escapeHTML(row.code)}</p>
          </div>
          <button class="appr-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>
        <div class="appr-modal__body">
          <p style="margin:0;font-size:14px;line-height:1.55;color:var(--text-soft)">
            Ao aprovar, a compra seguirá para o <strong>recebimento</strong>. O estoquista
            será notificado. O valor total é <strong>${fmtBRL(row.total_cents)}</strong>.
          </p>
          <div class="appr-err" id="ap-error" hidden></div>
        </div>
        <footer class="appr-modal__foot">
          <button type="button" class="appr-btn appr-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="appr-btn appr-btn--success" id="ap-confirm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            Aprovar e enviar
          </button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    modal.querySelector('#ap-confirm').addEventListener('click', async () => {
      const btn = modal.querySelector('#ap-confirm');
      btn.disabled = true;
      try {
        const { error } = await db().rpc('approve_purchase', { p_purchase_id: row.id });
        if (error) throw error;
        close();
        toast('Compra aprovada! Enviada para recebimento.');
        await loadPending();
      } catch (e) {
        console.error(e);
        const err = modal.querySelector('#ap-error');
        err.textContent = e.message;
        err.hidden = false;
        btn.disabled = false;
      }
    });
  }

  /* =========================================================
     MODAL · REJEITAR
     ========================================================= */
  function openRejectModal(row) {
    const modal = document.createElement('div');
    modal.className = 'appr-modal';
    modal.innerHTML = `
      <div class="appr-modal__backdrop" data-close></div>
      <div class="appr-modal__dialog">
        <header class="appr-modal__head">
          <div>
            <h3 class="appr-modal__title">Rejeitar compra</h3>
            <p class="appr-modal__sub">${escapeHTML(row.code)} · ${fmtBRL(row.total_cents)}</p>
          </div>
          <button class="appr-modal__close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>
        <div class="appr-modal__body">
          <p style="margin:0;font-size:13.5px;line-height:1.5;color:var(--text-soft)">
            A compra voltará para <strong>Rascunho</strong> e o solicitante será notificado.
          </p>
          <div class="appr-field">
            <label for="rj-reason">Motivo da rejeição *</label>
            <textarea id="rj-reason" rows="3" placeholder="Ex.: valor acima do orçamento, fornecedor não homologado..."></textarea>
          </div>
          <div class="appr-err" id="rj-error" hidden></div>
        </div>
        <footer class="appr-modal__foot">
          <button type="button" class="appr-btn appr-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="appr-btn appr-btn--danger" id="rj-confirm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
            Rejeitar
          </button>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    const reasonEl = modal.querySelector('#rj-reason');
    reasonEl.focus();

    modal.querySelector('#rj-confirm').addEventListener('click', async () => {
      const reason = (reasonEl.value || '').trim();
      const err = modal.querySelector('#rj-error');
      err.hidden = true;
      if (reason.length < 5) {
        err.textContent = 'Informe um motivo com pelo menos 5 caracteres.';
        err.hidden = false;
        return;
      }
      const btn = modal.querySelector('#rj-confirm');
      btn.disabled = true;
      try {
        const { error } = await db().rpc('reject_purchase', {
          p_purchase_id: row.id,
          p_reason:      reason
        });
        if (error) throw error;
        close();
        toast('Compra rejeitada. Solicitante notificado.');
        await loadPending();
      } catch (e) {
        console.error(e);
        err.textContent = e.message;
        err.hidden = false;
        btn.disabled = false;
      }
    });
  }

  /* =========================================================
     BOOTSTRAP
     ========================================================= */
  document.addEventListener('DOMContentLoaded', async () => {
    if (document.body.dataset.page !== 'aprovacoes') return;

    const refresh = $('#appr-refresh');
    if (refresh) refresh.addEventListener('click', loadPending);

    await loadCurrentUser();
    await loadPending();
  });

  window.Approvals = { reload: loadPending, state };

})();