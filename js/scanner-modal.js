/* =========================================================
   DEV HUB · Scanner Mode (Vendas) — só QR
   ---------------------------------------------------------
   Estilos autossuficientes: injeta um <style> próprio com
   classes prefixadas dh-scan-* pra não depender do CSS da
   página. Assim não importa onde for carregado, fica certo.
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

    ensureStyles();
    detectarCartListener();
    observarBotao();
  }

  /* =========================================================
     CSS autossuficiente
     ========================================================= */
  function ensureStyles() {
    if (document.getElementById('dh-scan-styles')) return;

    const style = document.createElement('style');
    style.id = 'dh-scan-styles';
    style.textContent = `
      .dh-scan-backdrop{
        position:fixed;inset:0;z-index:9998;
        background:rgba(5,8,14,.78);
        backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);
        display:flex;align-items:center;justify-content:center;
        padding:20px;
        opacity:0;animation:dhScanFade 160ms ease forwards;
      }
      @keyframes dhScanFade{to{opacity:1}}

      .dh-scan-card{
        position:relative;width:100%;max-width:480px;
        background:#0d131c;
        color:#e6eaf2;
        border:1px solid rgba(255,255,255,.10);
        border-radius:16px;
        box-shadow:0 24px 60px rgba(0,0,0,.65);
        display:flex;flex-direction:column;
        max-height:92vh;overflow:hidden;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
        transform:translateY(6px) scale(.98);
        animation:dhScanPop 180ms cubic-bezier(.2,.9,.3,1.2) forwards;
      }
      @keyframes dhScanPop{to{transform:translateY(0) scale(1)}}

      .dh-scan-header{
        display:flex;align-items:center;justify-content:space-between;
        padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);
        flex-shrink:0;
      }
      .dh-scan-header h2{
        margin:0;font-size:16px;font-weight:600;color:#f5f7fb;
      }
      .dh-scan-close{
        appearance:none;border:0;background:transparent;
        color:#8b95a7;font-size:22px;line-height:1;cursor:pointer;
        width:32px;height:32px;border-radius:8px;
        display:flex;align-items:center;justify-content:center;
        transition:background 120ms ease,color 120ms ease;
      }
      .dh-scan-close:hover{background:rgba(255,255,255,.06);color:#e6eaf2;}

      .dh-scan-body{
        padding:20px;overflow-y:auto;
      }
      .dh-scan-body p{
        margin:0 0 12px;font-size:13.5px;line-height:1.5;color:#b7c0cf;
      }
      .dh-scan-body p.dh-scan-center{text-align:center;}

      .dh-scan-qr{
        display:flex;justify-content:center;align-items:center;
        padding:14px;background:#ffffff;border-radius:14px;
        margin:0 auto 14px;width:fit-content;
        box-shadow:0 4px 20px rgba(0,0,0,.4);
      }
      .dh-scan-qr img{
        display:block;
        width:240px;height:240px;
        image-rendering:pixelated;
        image-rendering:crisp-edges;
      }

      .dh-scan-token{
        text-align:center;font-size:12.5px;color:#8b95a7;
        margin:0 0 20px;
      }
      .dh-scan-token strong{
        display:inline-block;margin-top:6px;
        font-size:20px;letter-spacing:3px;color:#e6eaf2;
        font-weight:700;font-family:monospace;
      }

      .dh-scan-listhead{
        display:flex;justify-content:space-between;align-items:baseline;
        margin:0 0 8px;
      }
      .dh-scan-listhead h3{
        margin:0;font-size:14px;font-weight:600;color:#e6eaf2;
      }
      .dh-scan-listhead .dh-scan-total{
        font-size:14px;color:#8b95a7;font-weight:600;
      }

      .dh-scan-items{
        max-height:220px;overflow-y:auto;
        border:1px solid rgba(255,255,255,.08);
        border-radius:10px;padding:4px 14px;
        background:rgba(255,255,255,.015);
      }
      .dh-scan-item{
        display:flex;justify-content:space-between;align-items:center;
        padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);
      }
      .dh-scan-item:last-child{border-bottom:0;}
      .dh-scan-item-name{
        font-weight:600;font-size:13.5px;color:#e6eaf2;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }
      .dh-scan-item-code{
        font-size:11.5px;color:#8b95a7;margin-top:2px;
      }
      .dh-scan-item-right{
        text-align:right;flex-shrink:0;margin-left:12px;
      }
      .dh-scan-item-qty{font-weight:700;font-size:13.5px;}
      .dh-scan-item-price{font-size:11.5px;color:#8b95a7;margin-top:2px;}

      .dh-scan-empty{
        padding:18px 4px;text-align:center;
        font-size:13px;color:#8b95a7;
      }

      .dh-scan-footer{
        display:flex;justify-content:flex-end;gap:10px;
        padding:14px 20px;border-top:1px solid rgba(255,255,255,.08);
        background:#0a0f16;flex-shrink:0;
      }
      .dh-scan-btn{
        appearance:none;border:1px solid transparent;border-radius:9px;
        padding:10px 18px;font-size:13.5px;font-weight:600;
        font-family:inherit;cursor:pointer;
        transition:background 120ms ease,border-color 120ms ease,opacity 120ms ease;
      }
      .dh-scan-btn:disabled{opacity:.6;cursor:not-allowed;}
      .dh-scan-btn--ghost{
        background:transparent;color:#c7d0dd;
        border-color:rgba(255,255,255,.14);
      }
      .dh-scan-btn--ghost:hover{background:rgba(255,255,255,.05);}
      .dh-scan-btn--primary{background:#3b82f6;color:#fff;}
      .dh-scan-btn--primary:hover{background:#2f74e6;}

      body.dh-scan-open{overflow:hidden;}
    `;
    document.head.appendChild(style);
  }

  /* =========================================================
     Detecta se o vendas.js registrou o listener
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
     Sessão + modal
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

  function abrirModal() {
    if (!state.modal) state.modal = buildModal();
    if (!state.modal.parentNode) document.body.appendChild(state.modal);

    state.modal.hidden = false;
    document.body.classList.add('dh-scan-open');

    const url = location.origin +
                location.pathname.replace(/[^/]*$/, '') +
                'scanner.html?token=' + encodeURIComponent(state.session.token);

    const qrBox = state.modal.querySelector('#dh-scan-qr-box');
    qrBox.innerHTML = '';

    // Gera em alta resolução (480) e exibe em 240 → nítido em telas retina
    const img = document.createElement('img');
    img.alt = 'QR para parear celular';
    img.src = 'https://api.qrserver.com/v1/create-qr-code/' +
              '?size=480x480&margin=0&ecc=M&data=' + encodeURIComponent(url);
    qrBox.appendChild(img);

    state.modal.querySelector('#dh-scan-token').textContent = state.session.token;

    renderItens();
    setTimeout(() => {
      const b = state.modal.querySelector('#dh-scan-close-btn');
      if (b) b.focus();
    }, 40);
  }

  function buildModal() {
    const modal = document.createElement('div');
    modal.id = 'dh-scan-modal';
    modal.className = 'dh-scan-backdrop';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="dh-scan-card" role="dialog" aria-modal="true"
           aria-labelledby="dh-scan-title">
        <header class="dh-scan-header">
          <h2 id="dh-scan-title">Modo Scanner</h2>
          <button type="button" class="dh-scan-close" data-close
                  aria-label="Fechar">×</button>
        </header>

        <div class="dh-scan-body">
          <p class="dh-scan-center">
            Abra a câmera do <strong>celular</strong> e aponte pro QR abaixo.
            Depois é só escanear os produtos da venda.
          </p>

          <div class="dh-scan-qr" id="dh-scan-qr-box"></div>

          <p class="dh-scan-token">
            Se preferir, digite no celular:
            <br>
            <strong id="dh-scan-token">—</strong>
          </p>

          <div class="dh-scan-listhead">
            <h3>Itens escaneados (<span id="dh-scan-count">0</span>)</h3>
            <span class="dh-scan-total" id="dh-scan-total">R$ 0,00</span>
          </div>

          <div class="dh-scan-items" id="dh-scan-items">
            <div class="dh-scan-empty">Aguardando o primeiro item…</div>
          </div>
        </div>

        <footer class="dh-scan-footer">
          <button type="button" class="dh-scan-btn dh-scan-btn--ghost"
                  data-close id="dh-scan-close-btn">Fechar</button>
          <button type="button" class="dh-scan-btn dh-scan-btn--primary"
                  id="dh-scan-flush-btn">Enviar para o carrinho</button>
        </footer>
      </div>
    `;

    modal.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', encerrarSessao);
    });

    modal.querySelector('#dh-scan-flush-btn')
         .addEventListener('click', flushNoCarrinho);

    // Fecha clicando fora
    modal.addEventListener('click', (e) => {
      if (e.target === modal) encerrarSessao();
    });

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
      .select('id, product_id, product_name, barcode, unit_price, quantity, stock_available, created_at')
      .eq('session_id', state.session.id)
      .order('created_at', { ascending: true });

    if (error) return;
    state.items = data || [];

    if (state.hasCartListener) {
      state.items.forEach((it) => enviarParaCarrinho(it, 'add'));
    }
  }

  /* =========================================================
     Envia pro carrinho
     ========================================================= */
  function enviarParaCarrinho(item, action) {
    try {
      const prod = {
        id:              item.product_id,
        product_id:      item.product_id,
        name:            item.product_name,
        product_name:    item.product_name,
        barcode:         item.barcode,
        price:           Number(item.unit_price) || 0,
        unit_price:      Number(item.unit_price) || 0,
        quantity:        Number(item.quantity) || 1,
        stock_available: Number(item.stock_available) || 0
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
      console.warn('[scanner] dispatch:', e);
    }
  }

  function flushNoCarrinho() {
    if (!state.hasCartListener) {
      toast('Carrinho não conectado. Criando venda direta.', 'error');
      finalizarVenda();
      return;
    }
    if (state.items.length === 0) {
      toast('Nenhum item recebido ainda.', 'error');
      return;
    }
    state.items.forEach((it) => enviarParaCarrinho(it, 'force'));
    toast(state.items.length + ' itens reenviados pro carrinho.', 'success');
  }

  /* =========================================================
     Render
     ========================================================= */
  function renderItens() {
    if (!state.modal) return;

    const wrap    = state.modal.querySelector('#dh-scan-items');
    const countEl = state.modal.querySelector('#dh-scan-count');
    const totalEl = state.modal.querySelector('#dh-scan-total');

    const total = state.items.reduce(
      (a, it) => a + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1),
      0
    );

    countEl.textContent = String(state.items.length);
    totalEl.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');

    if (state.items.length === 0) {
      wrap.innerHTML = '<div class="dh-scan-empty">Aguardando o primeiro item…</div>';
      return;
    }

    wrap.innerHTML = '';
    state.items.forEach((it) => {
      const row = document.createElement('div');
      row.className = 'dh-scan-item';
      row.innerHTML =
        '<div style="min-width:0;flex:1;">' +
          '<div class="dh-scan-item-name">' + esc(it.product_name || '—') + '</div>' +
          '<div class="dh-scan-item-code">' + esc(it.barcode || '') + '</div>' +
        '</div>' +
        '<div class="dh-scan-item-right">' +
          '<div class="dh-scan-item-qty">' + Number(it.quantity || 1) + '×</div>' +
          '<div class="dh-scan-item-price">R$ ' +
            (Number(it.unit_price) || 0).toFixed(2).replace('.', ',') + '</div>' +
        '</div>';
      wrap.appendChild(row);
    });
  }

  function piscarTotal() {
    if (!state.modal) return;
    const el = state.modal.querySelector('#dh-scan-total');
    if (!el) return;
    el.style.transition = 'color 300ms';
    el.style.color = '#22c55e';
    setTimeout(() => { el.style.color = ''; }, 500);
  }

  /* =========================================================
     Fallback: cria venda direta
     ========================================================= */
  async function finalizarVenda() {
    if (state.finalizing) return;
    if (state.items.length === 0) { toast('Nenhum item escaneado.', 'error'); return; }

    const total = state.items.reduce(
      (a, it) => a + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0
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
    try {
      const { data: sale, error: saleErr } = await window.db
        .from('sales')
        .insert({
          organization_id: state.orgId,
          user_id:         state.userId,
          total:           total,
          status:          'pending'
        })
        .select('id').single();
      if (saleErr) throw saleErr;

      const { error: itemsErr } = await window.db
        .from('sale_items')
        .insert(state.items.map((it) => ({
          sale_id:    sale.id,
          product_id: it.product_id,
          quantity:   it.quantity,
          unit_price: it.unit_price
        })));
      if (itemsErr) throw itemsErr;

      await window.db.from('scan_items').delete().eq('session_id', state.session.id);
      toast('Venda criada com sucesso.', 'success');
      await encerrarSessao();
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      console.error('[scanner] finalizar:', err);
      toast('Não foi possível finalizar: ' + (err.message || 'erro'), 'error');
    } finally {
      state.finalizing = false;
    }
  }

  /* =========================================================
     Encerrar
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
      await window.db.from('scan_sessions')
        .update({ status: 'closed' }).eq('id', state.session.id);
      await window.db.from('scan_items')
        .delete().eq('session_id', state.session.id);
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
    document.body.classList.remove('dh-scan-open');
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
    abrir:       abrir,
    encerrar:    encerrarSessao,
    flush:       flushNoCarrinho,
    state:       state,
    temCarrinho: () => state.hasCartListener
  };
})();