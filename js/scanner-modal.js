/* =========================================================
   DEV HUB · Scanner Mode (Vendas) v2
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
    removeModal: null,
    hasCartListener: false,
    finalizing: false,
    syncTimer:  null
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

  function ensureStyles() {
    if (document.getElementById('dh-scan-styles')) return;
    const style = document.createElement('style');
    style.id = 'dh-scan-styles';
    style.textContent = `
      .dh-scan-backdrop{
        position:fixed;inset:0;z-index:9998;
        background:rgba(5,8,14,.78);
        backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);
        display:flex;align-items:center;justify-content:center;padding:20px;
        opacity:0;animation:dhScanFade 160ms ease forwards;
      }
      @keyframes dhScanFade{to{opacity:1}}
      .dh-scan-card{
        position:relative;width:100%;max-width:480px;
        background:#0d131c;color:#e6eaf2;
        border:1px solid rgba(255,255,255,.10);border-radius:16px;
        box-shadow:0 24px 60px rgba(0,0,0,.65);
        display:flex;flex-direction:column;max-height:92vh;overflow:hidden;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
        transform:translateY(6px) scale(.98);
        animation:dhScanPop 180ms cubic-bezier(.2,.9,.3,1.2) forwards;
      }
      @keyframes dhScanPop{to{transform:translateY(0) scale(1)}}
      .dh-scan-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0;}
      .dh-scan-header h2{margin:0;font-size:16px;font-weight:600;color:#f5f7fb;}
      .dh-scan-close{appearance:none;border:0;background:transparent;color:#8b95a7;font-size:22px;line-height:1;cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:background 120ms ease,color 120ms ease;}
      .dh-scan-close:hover{background:rgba(255,255,255,.06);color:#e6eaf2;}
      .dh-scan-body{padding:20px;overflow-y:auto;}
      .dh-scan-body p{margin:0 0 12px;font-size:13.5px;line-height:1.5;color:#b7c0cf;}
      .dh-scan-body p.dh-scan-center{text-align:center;}
      .dh-scan-qr{display:flex;justify-content:center;align-items:center;padding:14px;background:#fff;border-radius:14px;margin:0 auto 14px;width:fit-content;box-shadow:0 4px 20px rgba(0,0,0,.4);}
      .dh-scan-qr img{display:block;width:240px;height:240px;image-rendering:pixelated;image-rendering:crisp-edges;}
      .dh-scan-token{text-align:center;font-size:12.5px;color:#8b95a7;margin:0 0 20px;}
      .dh-scan-token strong{display:inline-block;margin-top:6px;font-size:20px;letter-spacing:3px;color:#e6eaf2;font-weight:700;font-family:monospace;}
      .dh-scan-listhead{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 8px;}
      .dh-scan-listhead h3{margin:0;font-size:14px;font-weight:600;color:#e6eaf2;}
      .dh-scan-total{font-size:14px;color:#8b95a7;font-weight:600;}
      .dh-scan-items{max-height:280px;overflow-y:auto;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:4px 14px;background:rgba(255,255,255,.015);}
      .dh-scan-item{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);gap:12px;}
      .dh-scan-item:last-child{border-bottom:0;}
      .dh-scan-item-main{min-width:0;flex:1;}
      .dh-scan-item-name{font-weight:600;font-size:13.5px;color:#e6eaf2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .dh-scan-item-code{font-size:11.5px;color:#8b95a7;margin-top:2px;}
      .dh-scan-item-right{text-align:right;flex-shrink:0;}
      .dh-scan-item-qty{font-weight:700;font-size:13.5px;}
      .dh-scan-item-price{font-size:11.5px;color:#8b95a7;margin-top:2px;}
      .dh-scan-item-remove{appearance:none;border:1px solid rgba(239,68,68,.28);background:transparent;color:#ef4444;width:30px;height:30px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background 120ms ease,border-color 120ms ease;}
      .dh-scan-item-remove:hover{background:rgba(239,68,68,.10);border-color:rgba(239,68,68,.5);}
      .dh-scan-empty{padding:18px 4px;text-align:center;font-size:13px;color:#8b95a7;}
      .dh-scan-footer{display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid rgba(255,255,255,.08);background:#0a0f16;flex-shrink:0;}
      .dh-scan-btn{appearance:none;border:1px solid transparent;border-radius:9px;padding:10px 18px;font-size:13.5px;font-weight:600;font-family:inherit;cursor:pointer;transition:background 120ms ease,border-color 120ms ease,opacity 120ms ease;}
      .dh-scan-btn:disabled{opacity:.6;cursor:not-allowed;}
      .dh-scan-btn--ghost{background:transparent;color:#c7d0dd;border-color:rgba(255,255,255,.14);}
      .dh-scan-btn--ghost:hover{background:rgba(255,255,255,.05);}
      .dh-scan-btn--primary{background:#3b82f6;color:#fff;}
      .dh-scan-btn--primary:hover{background:#2f74e6;}
      .dh-scan-btn--danger{background:#dc2626;color:#fff;}
      .dh-scan-btn--danger:hover{background:#c81e1e;}
      body.dh-scan-open{overflow:hidden;}
      .dh-scan-trigger{appearance:none;border:1px solid rgba(255,255,255,.14);background:transparent;color:#c7d0dd;border-radius:9px;padding:10px 14px;font-size:13.5px;font-weight:600;font-family:inherit;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;transition:background 120ms ease,border-color 120ms ease;margin-left:8px;}
      .dh-scan-trigger:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.22);}
      .dh-rm-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(5,8,14,.78);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;animation:dhScanFade 140ms ease forwards;}
      .dh-rm-card{width:100%;max-width:440px;background:#0d131c;color:#e6eaf2;border:1px solid rgba(255,255,255,.10);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.65);overflow:hidden;display:flex;flex-direction:column;max-height:92vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
      .dh-rm-header{padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;}
      .dh-rm-header h3{margin:0;font-size:15px;font-weight:600;color:#f5f7fb;}
      .dh-rm-body{padding:20px;overflow-y:auto;}
      .dh-rm-produto{padding:12px;border-radius:10px;background:rgba(255,255,255,.04);margin-bottom:16px;font-size:13px;}
      .dh-rm-produto strong{color:#e6eaf2;display:block;margin-bottom:4px;}
      .dh-rm-produto span{color:#8b95a7;font-size:12px;}
      .dh-rm-field{margin-bottom:12px;}
      .dh-rm-field label{display:block;font-size:12.5px;color:#c7d0dd;font-weight:600;margin-bottom:6px;}
      .dh-rm-field input,.dh-rm-field textarea{width:100%;box-sizing:border-box;padding:10px 12px;background:#131a24;color:#fff;font-family:inherit;font-size:13.5px;border:1px solid rgba(255,255,255,.12);border-radius:9px;transition:border-color 120ms ease,box-shadow 120ms ease;}
      .dh-rm-field input:focus,.dh-rm-field textarea:focus{outline:0;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.18);}
      .dh-rm-field textarea{min-height:70px;resize:vertical;}
      .dh-rm-feedback{padding:10px 12px;border-radius:9px;font-size:12.5px;background:rgba(239,68,68,.10);color:#fca5a5;border:1px solid rgba(239,68,68,.28);margin-bottom:12px;}
      .dh-rm-feedback:empty{display:none;}
      .dh-rm-footer{display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid rgba(255,255,255,.08);background:#0a0f16;}
    `;
    document.head.appendChild(style);
  }

  function detectarCartListener() {
    try {
      const ev = new CustomEvent('scanner:probe', { cancelable: true });
      window.dispatchEvent(ev);
      state.hasCartListener = ev.defaultPrevented;
    } catch (e) {
      state.hasCartListener = false;
    }
  }

  function observarBotao() {
    const existente = document.getElementById('scanner-mode-btn');
    if (existente) { wireBotao(existente); return; }

    let tentativas = 0;
    const tick = () => {
      const btn = encontrarOuInjetarBotao();
      if (btn) { wireBotao(btn); return; }
      tentativas += 1;
      if (tentativas < 25) setTimeout(tick, 400);
    };
    tick();
  }

  function wireBotao(btn) {
    if (btn.dataset.scannerWired) return;
    btn.dataset.scannerWired = '1';
    btn.addEventListener('click', abrir);
  }

  function encontrarOuInjetarBotao() {
    const anchor =
      document.querySelector('[data-scanner-mount]') ||
      document.getElementById('product-search') ||
      document.getElementById('product-search-input') ||
      document.getElementById('buscar-produto') ||
      document.querySelector('input[placeholder*="código de barras"]');

    if (!anchor) return null;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'scanner-mode-btn';
    btn.className = 'dh-scan-trigger';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 7V5a2 2 0 0 1 2-2h2"/>' +
      '<path d="M17 3h2a2 2 0 0 1 2 2v2"/>' +
      '<path d="M21 17v2a2 2 0 0 1-2 2h-2"/>' +
      '<path d="M7 21H5a2 2 0 0 1-2-2v-2"/>' +
      '<path d="M7 8v8M11 8v8M15 8v8"/></svg>' +
      '<span>Modo Scanner</span>';
    anchor.insertAdjacentElement('afterend', btn);
    return btn;
  }

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
      <div class="dh-scan-card" role="dialog" aria-modal="true">
        <header class="dh-scan-header">
          <h2>Modo Scanner</h2>
          <button type="button" class="dh-scan-close" data-close aria-label="Fechar">×</button>
        </header>
        <div class="dh-scan-body">
          <p class="dh-scan-center">Abra a câmera do <strong>celular</strong> e aponte pro QR abaixo.</p>
          <div class="dh-scan-qr" id="dh-scan-qr-box"></div>
          <p class="dh-scan-token">Se preferir, digite no celular:<br><strong id="dh-scan-token">—</strong></p>
          <div class="dh-scan-listhead">
            <h3>Itens escaneados (<span id="dh-scan-count">0</span>)</h3>
            <span class="dh-scan-total" id="dh-scan-total">R$ 0,00</span>
          </div>
          <div class="dh-scan-items" id="dh-scan-items">
            <div class="dh-scan-empty">Aguardando o primeiro item…</div>
          </div>
        </div>
        <footer class="dh-scan-footer">
          <button type="button" class="dh-scan-btn dh-scan-btn--ghost" data-close id="dh-scan-close-btn">Fechar</button>
          <button type="button" class="dh-scan-btn dh-scan-btn--primary" id="dh-scan-flush-btn">Enviar para o carrinho</button>
        </footer>
      </div>
    `;

    modal.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', encerrarSessao);
    });
    modal.querySelector('#dh-scan-flush-btn').addEventListener('click', flushNoCarrinho);
    modal.addEventListener('click', (e) => { if (e.target === modal) encerrarSessao(); });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.modal && !state.modal.hidden && !state.removeModal) {
        encerrarSessao();
      }
    });

    return modal;
  }

  function assinarCanal() {
    if (state.channel) {
      try { window.db.removeChannel(state.channel); } catch (e) {}
      state.channel = null;
    }
    syncFromDB();
    state.channel = window.db
      .channel('scanner:' + state.session.id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'scan_items',
        filter: 'session_id=eq.' + state.session.id
      }, () => { agendarSync(); })
      .subscribe();
  }

  function agendarSync() {
    if (state.syncTimer) clearTimeout(state.syncTimer);
    state.syncTimer = setTimeout(syncFromDB, 180);
  }

  async function syncFromDB() {
    if (!state.session) return;

    const { data, error } = await window.db
      .from('scan_items')
      .select('id, product_id, product_name, barcode, unit_price, quantity, stock_available, created_at')
      .eq('session_id', state.session.id)
      .order('created_at', { ascending: true });

    if (error) { console.error('[scanner] sync:', error); return; }

    const newItems = data || [];
    const oldMap = new Map(state.items.map((x) => [x.id, x]));
    const newMap = new Map(newItems.map((x) => [x.id, x]));

    newItems.forEach((nw) => {
      const old = oldMap.get(nw.id);
      const oldQ = old ? Number(old.quantity) : 0;
      const newQ = Number(nw.quantity);
      const delta = newQ - oldQ;
      if (delta !== 0 && state.hasCartListener) {
        dispatchCart(nw, Math.abs(delta), delta > 0 ? 'add' : 'remove');
      }
    });

    state.items.forEach((old) => {
      if (!newMap.has(old.id) && state.hasCartListener) {
        dispatchCart(old, Number(old.quantity), 'remove');
      }
    });

    state.items = newItems;
    renderItens();
  }

  function dispatchCart(item, quantity, action) {
    try {
      const prod = {
        id:              item.product_id,
        product_id:      item.product_id,
        name:            item.product_name,
        product_name:    item.product_name,
        barcode:         item.barcode,
        price:           Number(item.unit_price) || 0,
        unit_price:      Number(item.unit_price) || 0,
        quantity:        quantity,
        stock_available: Number(item.stock_available) || 0
      };
      window.dispatchEvent(new CustomEvent('scanner:item', {
        detail: { action, product: prod, quantity }
      }));
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
    state.items.forEach((it) => {
      dispatchCart(it, Number(it.quantity), 'force');
    });
    toast(state.items.length + ' produtos reenviados pro carrinho.', 'success');
  }

  function renderItens() {
    if (!state.modal) return;

    const wrap    = state.modal.querySelector('#dh-scan-items');
    const countEl = state.modal.querySelector('#dh-scan-count');
    const totalEl = state.modal.querySelector('#dh-scan-total');

    const totalQty = state.items.reduce((a, it) => a + Number(it.quantity || 1), 0);
    const total = state.items.reduce(
      (a, it) => a + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0
    );

    countEl.textContent = String(totalQty);
    totalEl.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');

    if (state.items.length === 0) {
      wrap.innerHTML = '<div class="dh-scan-empty">Aguardando o primeiro item…</div>';
      return;
    }

    wrap.innerHTML = '';
    state.items.forEach((it) => {
      const row = document.createElement('div');
      row.className = 'dh-scan-item';

      const main = document.createElement('div');
      main.className = 'dh-scan-item-main';
      main.innerHTML =
        '<div class="dh-scan-item-name">' + esc(it.product_name || '—') + '</div>' +
        '<div class="dh-scan-item-code">' + esc(it.barcode || '') + '</div>';

      const right = document.createElement('div');
      right.className = 'dh-scan-item-right';
      right.innerHTML =
        '<div class="dh-scan-item-qty">' + Number(it.quantity || 1) + '×</div>' +
        '<div class="dh-scan-item-price">R$ ' +
          (Number(it.unit_price) || 0).toFixed(2).replace('.', ',') + '</div>';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dh-scan-item-remove';
      btn.title = 'Remover 1 unidade';
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M3 6h18"/>' +
        '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
        '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
        '<path d="M10 11v6M14 11v6"/></svg>';
      btn.addEventListener('click', () => abrirRemocao(it));

      row.appendChild(main);
      row.appendChild(right);
      row.appendChild(btn);
      wrap.appendChild(row);
    });
  }

  function abrirRemocao(item) {
    if (!state.removeModal) state.removeModal = buildRemoveModal();
    if (!state.removeModal.parentNode) document.body.appendChild(state.removeModal);

    state.removeModal.hidden = false;

    const info = state.removeModal.querySelector('#dh-rm-produto');
    info.innerHTML =
      '<strong>' + esc(item.product_name || '—') + '</strong>' +
      '<span>Código: ' + esc(item.barcode || '—') + ' · ' +
      'Quantidade atual: ' + Number(item.quantity || 1) + '× · ' +
      'R$ ' + (Number(item.unit_price) || 0).toFixed(2).replace('.', ',') + '</span>';

    const form = state.removeModal.querySelector('#dh-rm-form');
    form.reset();
    state.removeModal.querySelector('#dh-rm-feedback').textContent = '';
    state.removeModal._targetItem = item;

    setTimeout(() => {
      const first = state.removeModal.querySelector('#dh-rm-reason');
      if (first) first.focus();
    }, 40);
  }

  function buildRemoveModal() {
    const modal = document.createElement('div');
    modal.className = 'dh-rm-backdrop';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="dh-rm-card" role="dialog" aria-modal="true">
        <header class="dh-rm-header">
          <h3>Autorizar remoção</h3>
          <button type="button" class="dh-scan-close" data-rm-close aria-label="Fechar">×</button>
        </header>
        <form id="dh-rm-form" class="dh-rm-body" novalidate>
          <div class="dh-rm-produto" id="dh-rm-produto"></div>

          <div class="dh-rm-field">
            <label for="dh-rm-qty">Quantidade a remover</label>
            <input type="number" id="dh-rm-qty" min="1" step="1" value="1" required>
          </div>
          <div class="dh-rm-field">
            <label for="dh-rm-reason">Motivo da remoção</label>
            <textarea id="dh-rm-reason" placeholder="Ex: bipou duas vezes sem querer, cliente desistiu do item…" required></textarea>
          </div>
          <div class="dh-rm-field">
            <label for="dh-rm-email">E-mail do gestor</label>
            <input type="email" id="dh-rm-email" placeholder="gestor@empresa.com" autocomplete="off" required>
          </div>
          <div class="dh-rm-field">
            <label for="dh-rm-pass">Senha do gestor</label>
            <input type="password" id="dh-rm-pass" placeholder="••••••••" autocomplete="off" required>
          </div>

          <div class="dh-rm-feedback" id="dh-rm-feedback"></div>
        </form>
        <footer class="dh-rm-footer">
          <button type="button" class="dh-scan-btn dh-scan-btn--ghost" data-rm-close>Cancelar</button>
          <button type="button" class="dh-scan-btn dh-scan-btn--danger" id="dh-rm-confirm">Remover</button>
        </footer>
      </div>
    `;

    modal.querySelectorAll('[data-rm-close]').forEach((el) => {
      el.addEventListener('click', fecharRemoveModal);
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) fecharRemoveModal(); });
    modal.querySelector('#dh-rm-confirm').addEventListener('click', confirmarRemocao);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) fecharRemoveModal();
    });

    return modal;
  }

  function fecharRemoveModal() {
    if (!state.removeModal) return;
    state.removeModal.hidden = true;
    state.removeModal._targetItem = null;
  }

  async function confirmarRemocao() {
    const modal = state.removeModal;
    if (!modal) return;

    const item = modal._targetItem;
    if (!item) { fecharRemoveModal(); return; }

    const qtyEl    = modal.querySelector('#dh-rm-qty');
    const reasonEl = modal.querySelector('#dh-rm-reason');
    const emailEl  = modal.querySelector('#dh-rm-email');
    const passEl   = modal.querySelector('#dh-rm-pass');
    const fbEl     = modal.querySelector('#dh-rm-feedback');
    const btnEl    = modal.querySelector('#dh-rm-confirm');

    fbEl.textContent = '';

    const qty    = Math.max(1, Math.floor(Number(qtyEl.value) || 1));
    const reason = String(reasonEl.value || '').trim();
    const email  = String(emailEl.value || '').trim().toLowerCase();
    const pass   = String(passEl.value || '');

    if (qty > Number(item.quantity || 1)) {
      fbEl.textContent = 'Só existem ' + item.quantity + ' unidades deste item.';
      return;
    }
    if (reason.length < 3) {
      fbEl.textContent = 'Descreva o motivo da remoção (mínimo 3 caracteres).';
      reasonEl.focus(); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fbEl.textContent = 'Informe um e-mail de gestor válido.';
      emailEl.focus(); return;
    }
    if (!pass) {
      fbEl.textContent = 'Informe a senha do gestor.';
      passEl.focus(); return;
    }

    btnEl.disabled = true;
    btnEl.textContent = 'Validando…';

    try {
      await validarGestor(email, pass);

      for (let i = 0; i < qty; i++) {
        const { error: decErr } = await window.db
          .rpc('scan_decrement_item', { p_item_id: item.id });
        if (decErr) throw decErr;
      }

      await window.db.from('scan_item_removals').insert({
        session_id:       state.session.id,
        product_id:       item.product_id,
        product_name:     item.product_name,
        barcode:          item.barcode,
        unit_price:       Number(item.unit_price) || 0,
        quantity_removed: qty,
        reason:           reason,
        removed_by:       state.userId,
        manager_email:    email
      });

      toast('Item removido com autorização.', 'success');
      fecharRemoveModal();
      await syncFromDB();
    } catch (err) {
      console.error('[scanner] remoção:', err);
      fbEl.textContent = err && err.message ? err.message : 'Não foi possível remover.';
    } finally {
      btnEl.disabled = false;
      btnEl.textContent = 'Remover';
    }
  }

  async function validarGestor(email, senha) {
    const url = window.SUPABASE_URL;
    const key = window.SUPABASE_ANON_KEY || window.SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key || typeof window.supabase === 'undefined') {
      throw new Error(
        'Credenciais do Supabase não expostas. Adicione window.SUPABASE_URL e ' +
        'window.SUPABASE_ANON_KEY no js/supabase.js.'
      );
    }

    const tempClient = window.supabase.createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    let user = null;
    try {
      const { data, error } = await tempClient.auth.signInWithPassword({
        email: email, password: senha
      });
      if (error || !data || !data.user) {
        throw new Error('E-mail ou senha do gestor inválidos.');
      }
      user = data.user;
    } finally {
      try { await tempClient.auth.signOut(); } catch (e) {}
    }

    const { data: isMgr, error: roleErr } = await window.db
      .rpc('is_manager_of_my_org', { p_user_id: user.id });

    if (roleErr) {
      console.warn('[scanner] role check:', roleErr);
      throw new Error('Não foi possível validar a permissão do gestor.');
    }
    if (!isMgr) {
      throw new Error('Esta conta não é gestor ou administrador da empresa.');
    }

    return user;
  }

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

  async function encerrarSessao() {
    if (!state.session) return;

    if (state.items.length > 0 && !state.hasCartListener) {
      const ok = window.UI && window.UI.confirm
        ? await window.UI.confirm(
            'Existem itens não confirmados. Encerrar mesmo assim?',
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
    } catch (e) { console.warn('[scanner] close:', e); }

    state.session = null;
    state.items = [];

    if (state.modal) {
      state.modal.hidden = true;
      if (state.modal.parentNode) state.modal.parentNode.removeChild(state.modal);
      state.modal = null;
    }
    document.body.classList.remove('dh-scan-open');
  }

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
    sync:        syncFromDB,
    state:       state,
    temCarrinho: () => state.hasCartListener
  };
})();