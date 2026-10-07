/* =========================================================
   DEV HUB · Scanner Mode (integração Vendas)
   ---------------------------------------------------------
   - Botão "Modo Scanner" na página
   - Cria sessão, mostra QR, pareia com celular
   - Escuta scan_items em tempo real
   - Se o vendas.js registrou listener (scanner:probe),
     dispara 'scanner:item' para cada leitura → integra
     com o carrinho da tela.
   - Caso contrário, cria a venda em sales/sale_items ao
     clicar em "Finalizar venda".
   ========================================================= */

(function () {
  'use strict';

  const state = {
    orgId:      null,
    userId:     null,
    session:    null,
    channel:    null,
    items:      [],
    modal:      null,
    hasCartListener: false,
    finalizing: false
  };

  document.addEventListener('DOMContentLoaded', boot);

  async function boot() {
    const Auth = window.Auth;
    if (!Auth || !window.db || !Auth.isConfigured || !Auth.isConfigured()) return;

    const session = await Auth.requireSession().catch(() => null);
    if (!session) return;

    state.userId = session.user.id;

    let profile = null;
    try { profile = await Auth.getProfile(session.user.id); } catch (e) {}

    state.orgId = (profile && profile.organization_id) || null;
    if (!state.orgId) {
      try {
        const raw = sessionStorage.getItem('devhub_user');
        if (raw) state.orgId = JSON.parse(raw).organization_id || null;
      } catch (e) {}
    }

    detectarCartListener();
    observarBotao();
  }

  /* =========================================================
     Detecta se o vendas.js quer receber os itens.
     Faz um dispatch de teste — se alguém chamar
     preventDefault(), é sinal que quer os itens.
     ========================================================= */
  function detectarCartListener() {
    try {
      const ev = new CustomEvent('scanner:probe', { cancelable: true });
      window.dispatchEvent(ev);
      state.hasCartListener = ev.defaultPrevented;
    } catch (e) {
      state.hasCartListener = false;
    }
  }

  /* =========================================================
     Botão
     ========================================================= */
  function observarBotao() {
    let tentativas = 0;
    const tick = () => {
      const btn = encontrarOuInjetarBotao();
      if (btn && !btn.dataset.scannerWired) {
        btn.dataset.scannerWired = '1';
        btn.addEventListener('click', abrir);
      }
      tentativas += 1;
      if (tentativas < 25 && (!btn || !btn.dataset.scannerWired)) {
        setTimeout(tick, 400);
      }
    };
    tick();
  }

  function encontrarOuInjetarBotao() {
    let btn = document.getElementById('scanner-mode-btn');
    if (btn) return btn;

    const anchor =
      document.querySelector('[data-scanner-mount]') ||
      document.getElementById('product-search') ||
      document.getElementById('buscar-produto') ||
      document.querySelector('input[placeholder*="código de barras"]') ||
      document.querySelector('input[placeholder*="Nome, código"]') ||
      document.querySelector('input[placeholder*="Nome,"]');

    if (!anchor) return null;

    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'scanner-mode-btn';
    btn.className = 'btn btn--ghost';
    btn.style.marginLeft = '8px';
    btn.style.whiteSpace = 'nowrap';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true" ' +
      'style="vertical-align:-3px;margin-right:6px">' +
      '<path d="M3 7V5a2 2 0 0 1 2-2h2"/>' +
      '<path d="M17 3h2a2 2 0 0 1 2 2v2"/>' +
      '<path d="M21 17v2a2 2 0 0 1-2 2h-2"/>' +
      '<path d="M7 21H5a2 2 0 0 1-2-2v-2"/>' +
      '<path d="M7 8v8M11 8v8M15 8v8"/></svg>' +
      '<span>Modo Scanner</span>';
    anchor.insertAdjacentElement('afterend', btn);
    return btn;
  }

  /* =========================================================
     Abrir sessão
     ========================================================= */
  async function abrir() {
    if (!state.orgId) { toast('Empresa não identificada.', 'error'); return; }
    if (state.session) { abrirModal(); return; }

    const token = gerarToken();

    const { data, error } = await window.db
      .from('scan_sessions')
      .insert({
        organization_id: state.orgId,
        user_id: state.userId,
        token: token,
        status: 'active'
      })
      .select('id, token, expires_at')
      .single();

    if (error) {
      console.error('[scanner] insert session:', error);
      toast('Não foi possível iniciar o scanner.', 'error');
      return;
    }

    state.session = data;
    state.items = [];
    abrirModal();
    assinarCanal();
  }

  function gerarToken() {
    const digits = String(Math.floor(100000 + Math.random() * 900000));
    const chars  = Math.random().toString(36).slice(2, 6).toUpperCase();
    return digits + '-' + chars;
  }

  /* =========================================================
     Modal
     ========================================================= */
  function abrirModal() {
    if (!state.modal) state.modal = buildModal();
    if (!state.modal.parentNode) document.body.appendChild(state.modal);

    state.modal.hidden = false;
    document.body.style.overflow = 'hidden';

    const url = location.origin +
                location.pathname.replace(/[^/]*$/, '') +
                'scanner.html?token=' + encodeURIComponent(state.session.token);

    const qrBox = state.modal.querySelector('#scan-qr');
    qrBox.innerHTML = '';
    const img = document.createElement('img');
    img.alt = 'QR para parear celular';
    img.width = 220; img.height = 220;
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' +
              encodeURIComponent(url);
    qrBox.appendChild(img);

    state.modal.querySelector('#scan-token').textContent = state.session.token;

    const hint = state.modal.querySelector('#scan-hint');
    if (hint) {
      hint.textContent = state.hasCartListener
        ? 'Cada item escaneado cai no carrinho da venda atual.'
        : 'Cada item escaneado vai pra uma venda nova ao finalizar.';
    }

    renderItens();
    setTimeout(() => {
      const b = state.modal.querySelector('#scan-close-btn');
      if (b) b.focus();
    }, 40);
  }

  function buildModal() {
    const modal = document.createElement('div');
    modal.id = 'scanner-modal';
    modal.className = 'modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="modal__backdrop" data-close></div>
      <div class="modal__card" role="dialog" aria-modal="true"
           aria-labelledby="scanner-title" style="max-width:520px;">
        <header class="modal__header">
          <h2 class="modal__title" id="scanner-title">Modo Scanner</h2>
          <button type="button" class="modal__close" data-close aria-label="Fechar">×</button>
        </header>

        <div class="modal__body">
          <p class="cell--muted" style="margin:0 0 12px;">
            Abra o <strong>celular</strong>, faça login e escaneie o QR.
          </p>
          <p class="cell--muted" id="scan-hint"
             style="margin:0 0 12px;font-size:12px;color:#8b95a7;"></p>

          <div id="scan-qr"
               style="display:flex;justify-content:center;padding:16px;
                      background:#fff;border-radius:12px;"></div>

          <p class="cell--muted"
             style="text-align:center;font-size:13px;margin:12px 0 20px;">
            Ou digite no celular:
            <br>
            <strong id="scan-token"
                    style="font-size:18px;letter-spacing:2px;">—</strong>
          </p>

          <div style="display:flex;justify-content:space-between;
                      align-items:baseline;margin-bottom:8px;">
            <h3 style="margin:0;font-size:15px;">
              Itens recebidos (<span id="scan-count">0</span>)
            </h3>
            <strong id="scan-total" class="cell--muted"
                    style="font-size:14px;">R$ 0,00</strong>
          </div>

          <div id="scan-items"
               style="max-height:280px;overflow:auto;
                      border:1px solid rgba(255,255,255,.06);
                      border-radius:10px;padding:6px 12px;">
            <div class="state-block state-block--compact">
              <p>Aguardando o primeiro item…</p>
            </div>
          </div>
        </div>

        <footer class="modal__footer">
          <button type="button" class="btn btn--ghost" data-close
                  id="scan-close-btn">Fechar</button>
          <button type="button" class="btn btn--primary" id="scan-flush-btn">
            Inserir no carrinho
          </button>
        </footer>
      </div>
    `;

    modal.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', encerrarSessao);
    });

    modal.querySelector('#scan-flush-btn')
         .addEventListener('click', flushNoCarrinho);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.modal && !state.modal.hidden) encerrarSessao();
    });

    return modal;
  }

  /* =========================================================
     Realtime
     ========================================================= */
  function assinarCanal() {
    if (state.channel) {
      try { window.db.removeChannel(state.channel); } catch (e) {}
      state.channel = null;
    }

    carregarItens().then(renderItens);

    state.channel = window.db
      .channel('scanner:' + state.session.id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scan_items',
          filter: 'session_id=eq.' + state.session.id
        },
        (payload) => {
          const it = payload.new;
          state.items.push(it);

          // Se o carrinho quer os itens, manda direto.
          if (state.hasCartListener) {
            enviarParaCarrinho(it, 'add');
          }
          renderItens();
          piscarTotal();
          toast('+' + (it.product_name || 'item'), 'success');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'scan_items',
          filter: 'session_id=eq.' + state.session.id
        },
        (payload) => {
          state.items = state.items.filter((x) => x.id !== payload.old.id);
          renderItens();
        }
      )
      .subscribe();
  }

  async function carregarItens() {
    const { data, error } = await window.db
      .from('scan_items')
      .select('id, product_id, product_name, barcode, unit_price, quantity, created_at')
      .eq('session_id', state.session.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[scanner] load items:', error);
      return;
    }
    state.items = data || [];

    // Se tiver listener, também injeta o que já veio na retomada.
    if (state.hasCartListener) {
      state.items.forEach((it) => enviarParaCarrinho(it, 'add'));
    }
  }

  /* =========================================================
     Integração com o carrinho do vendas.js
     ---------------------------------------------------------
     Dispara CustomEvent 'scanner:item'.
     O vendas.js escuta assim:

         window.addEventListener('scanner:probe', (e) => {
           e.preventDefault();   // aceita receber itens
         });
         window.addEventListener('scanner:item', (e) => {
           const p = e.detail.product;
           addItemAoCarrinho(p, e.detail.quantity);
         });
     ========================================================= */
  function enviarParaCarrinho(item, action) {
    try {
      const prod = {
        id:         item.product_id,
        product_id: item.product_id,
        name:       item.product_name,
        barcode:    item.barcode,
        price:      Number(item.unit_price) || 0,
        quantity:   Number(item.quantity) || 1
      };
      const ev = new CustomEvent('scanner:item', {
        detail: {
          action:   action || 'add',
          product:  prod,
          quantity: prod.quantity,
          raw:      item
        }
      });
      window.dispatchEvent(ev);
    } catch (e) {
      console.warn('[scanner] dispatch falhou:', e);
    }
  }

  function flushNoCarrinho() {
    if (!state.hasCartListener) {
      // Sem listener: cai no modo "venda nova"
      finalizarVenda();
      return;
    }
    if (state.items.length === 0) {
      toast('Nenhum item recebido ainda.', 'error');
      return;
    }
    state.items.forEach((it) => enviarParaCarrinho(it, 'add'));
    toast(state.items.length + ' itens enviados pro carrinho.', 'success');
  }

  /* =========================================================
     Render
     ========================================================= */
  function renderItens() {
    if (!state.modal) return;

    const wrap    = state.modal.querySelector('#scan-items');
    const countEl = state.modal.querySelector('#scan-count');
    const totalEl = state.modal.querySelector('#scan-total');

    const total = state.items.reduce(
      (a, it) => a + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1),
      0
    );

    countEl.textContent = String(state.items.length);
    totalEl.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');

    if (state.items.length === 0) {
      wrap.innerHTML =
        '<div class="state-block state-block--compact">' +
        '<p>Aguardando o primeiro item…</p></div>';
      return;
    }

    wrap.innerHTML = '';
    state.items.forEach((it) => {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;justify-content:space-between;align-items:center;' +
        'padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06);';
      row.innerHTML =
        '<div style="min-width:0;flex:1;">' +
          '<div style="font-weight:600;white-space:nowrap;overflow:hidden;' +
               'text-overflow:ellipsis;">' + esc(it.product_name || '—') + '</div>' +
          '<div class="cell--muted" style="font-size:12px;">' +
            esc(it.barcode || '') +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;flex-shrink:0;margin-left:12px;">' +
          '<div><strong>' + Number(it.quantity || 1) + '×</strong></div>' +
          '<div class="cell--muted" style="font-size:12px;">R$ ' +
            (Number(it.unit_price) || 0).toFixed(2).replace('.', ',') + '</div>' +
        '</div>';
      wrap.appendChild(row);
    });
  }

  function piscarTotal() {
    if (!state.modal) return;
    const el = state.modal.querySelector('#scan-total');
    if (!el) return;
    el.style.transition = 'color 300ms';
    el.style.color = '#22c55e';
    setTimeout(() => { el.style.color = ''; }, 500);
  }

  /* =========================================================
     Modo "venda nova" (fallback)
     ========================================================= */
  async function finalizarVenda() {
    if (state.finalizing) return;
    if (state.items.length === 0) {
      toast('Nenhum item escaneado.', 'error');
      return;
    }

    const total = state.items.reduce(
      (a, it) => a + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1),
      0
    );

    const ok = window.UI && window.UI.confirm
      ? await window.UI.confirm(
          'Criar venda com ' + state.items.length + ' itens no total de R$ ' +
          total.toFixed(2).replace('.', ',') + '?',
          { title: 'Finalizar venda', confirmLabel: 'Criar venda' }
        )
      : window.confirm('Criar venda?');

    if (!ok) return;

    state.finalizing = true;
    const btn = state.modal.querySelector('#scan-flush-btn');
    if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }

    try {
      const { data: sale, error: saleErr } = await window.db
        .from('sales')
        .insert({
          organization_id: state.orgId,
          user_id:         state.userId,
          total:           total,
          status:          'pending'
        })
        .select('id')
        .single();

      if (saleErr) throw saleErr;

      const payload = state.items.map((it) => ({
        sale_id:    sale.id,
        product_id: it.product_id,
        quantity:   it.quantity,
        unit_price: it.unit_price
      }));

      const { error: itemsErr } = await window.db
        .from('sale_items')
        .insert(payload);

      if (itemsErr) throw itemsErr;

      await window.db.from('scan_items').delete().eq('session_id', state.session.id);
      toast('Venda criada com sucesso.', 'success');
      await encerrarSessao();
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      console.error('[scanner] finalizar:', err);
      toast('Não foi possível finalizar: ' + (err.message || 'erro'), 'error');
      if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); }
    } finally {
      state.finalizing = false;
    }
  }

  /* =========================================================
     Encerrar sessão
     ========================================================= */
  async function encerrarSessao() {
    if (!state.session) return;

    if (state.items.length > 0 && !state.hasCartListener) {
      const ok = window.UI && window.UI.confirm
        ? await window.UI.confirm(
            'Existem ' + state.items.length + ' itens não confirmados. Encerrar mesmo assim?',
            { title: 'Encerrar sessão', danger: true, confirmLabel: 'Encerrar' }
          )
        : window.confirm('Encerrar sessão?');
      if (!ok) return;
    }

    if (state.channel) {
      try { window.db.removeChannel(state.channel); } catch (e) {}
      state.channel = null;
    }

    try {
      await window.db
        .from('scan_sessions')
        .update({ status: 'closed' })
        .eq('id', state.session.id);
      await window.db
        .from('scan_items')
        .delete()
        .eq('session_id', state.session.id);
    } catch (e) {
      console.warn('[scanner] close:', e);
    }

    state.session = null;
    state.items = [];

    if (state.modal) {
      state.modal.hidden = true;
      if (state.modal.parentNode) state.modal.parentNode.removeChild(state.modal);
      state.modal = null;
    }
    document.body.style.overflow = '';
  }

  /* =========================================================
     Helpers
     ========================================================= */
  function toast(msg, type) {
    const region = document.getElementById('toast-region');
    if (!region) { console.log('[scanner]', msg); return; }
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

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  window.ScannerModal = {
    abrir:         abrir,
    encerrar:      encerrarSessao,
    flush:         flushNoCarrinho,
    state:         state,
    temCarrinho:   () => state.hasCartListener
  };
})();