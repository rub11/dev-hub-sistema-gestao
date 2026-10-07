/* =========================================================
   DEV HUB · Produtos · Scanner de código de barras
   ---------------------------------------------------------
   Fluxo:
     1. Botão "📷 Scanner" ao lado de "Novo produto"
     2. Modal com QR pra parear o celular (?mode=products)
     3. Quando o celular bipa:
        - Se produto NÃO existe → abre modal "Novo produto"
          com o barcode pré-preenchido (via window.Produtos)
        - Se produto existe → abre modal "Adicionar estoque"
          com nome, código, preço, estoque atual + quantidade
   ========================================================= */

(function () {
  'use strict';

  const state = {
    orgId: null,
    userId: null,
    session: null,
    channel: null,
    modal: null,
    stockModal: null,
    stockTarget: null,
    processing: false,
    lastProcessedId: null
  };

  document.addEventListener('DOMContentLoaded', boot);

  /* =========================================================
     Boot
     ========================================================= */
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
    observarBotao();
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

    const anchor = document.getElementById('new-product-btn');
    if (!anchor) return null;

    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'scanner-mode-btn';
    btn.className = 'btn btn--ghost';
    btn.title = 'Escanear código de barras';
    btn.setAttribute('aria-label', 'Escanear código de barras');
    btn.style.cssText =
      'white-space:nowrap; display:inline-flex; align-items:center; gap:6px;';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 7V5a2 2 0 0 1 2-2h2"/>' +
      '<path d="M17 3h2a2 2 0 0 1 2 2v2"/>' +
      '<path d="M21 17v2a2 2 0 0 1-2 2h-2"/>' +
      '<path d="M7 21H5a2 2 0 0 1-2-2v-2"/>' +
      '<path d="M7 8v8M11 8v8M15 8v8"/></svg>' +
      '<span>Scanner</span>';
    anchor.insertAdjacentElement('afterend', btn);
    return btn;
  }

  /* =========================================================
     Abrir sessão + modal QR
     ========================================================= */
  async function abrir() {
    if (!state.orgId) { toast('Empresa não identificada.', 'error'); return; }
    if (state.session) { abrirModalQR(); return; }

    const token = gerarToken();

    const { data, error } = await window.db
      .from('scan_sessions')
      .insert({
        organization_id: state.orgId,
        user_id: state.userId,
        token: token,
        status: 'active',
        label: 'Produtos'
      })
      .select('id, token, expires_at')
      .single();

    if (error) {
      console.error('[scanner-produtos] erro criar sessão:', error);
      toast('Não foi possível iniciar o scanner.', 'error');
      return;
    }

    state.session = data;
    abrirModalQR();
    assinarCanal();
  }

  function gerarToken() {
    const digits = String(Math.floor(100000 + Math.random() * 900000));
    const chars  = Math.random().toString(36).slice(2, 6).toUpperCase();
    return digits + '-' + chars;
  }

  function abrirModalQR() {
    if (!state.modal) state.modal = buildModalQR();
    if (!state.modal.parentNode) document.body.appendChild(state.modal);

    state.modal.hidden = false;
    document.body.classList.add('dh-scan-open');

    const url = location.origin +
                location.pathname.replace(/[^/]*$/, '') +
                'scanner.html?mode=products&token=' +
                encodeURIComponent(state.session.token);

    const qrBox = state.modal.querySelector('#dh-p-qr');
    qrBox.innerHTML = '';
    const img = document.createElement('img');
    img.alt = 'QR para parear celular';
    img.src = 'https://api.qrserver.com/v1/create-qr-code/' +
              '?size=480x480&margin=0&ecc=M&data=' + encodeURIComponent(url);
    qrBox.appendChild(img);

    state.modal.querySelector('#dh-p-token').textContent = state.session.token;
  }

  function buildModalQR() {
    const modal = document.createElement('div');
    modal.id = 'dh-p-scanner-modal';
    modal.className = 'dh-scan-backdrop';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="dh-scan-card" role="dialog" aria-modal="true" style="max-width:480px;">
        <header class="dh-scan-header">
          <h2>Scanner de produtos</h2>
          <button type="button" class="dh-scan-close" data-close aria-label="Fechar">×</button>
        </header>
        <div class="dh-scan-body">
          <p class="dh-scan-center">
            Abra a câmera do <strong>celular</strong> e aponte pro QR abaixo.
            Ao bipar um código, esta janela abre o cadastro do produto
            ou o modal de adicionar estoque.
          </p>
          <div class="dh-scan-qr" id="dh-p-qr"></div>
          <p class="dh-scan-token">
            Se preferir, digite no celular:
            <br>
            <strong id="dh-p-token">—</strong>
          </p>
          <div class="dh-scan-status" id="dh-p-status">
            Aguardando leitura do primeiro código…
          </div>
        </div>
        <footer class="dh-scan-footer">
          <button type="button" class="dh-scan-btn dh-scan-btn--ghost" data-close>Fechar</button>
        </footer>
      </div>
    `;

    modal.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', encerrarSessao);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) encerrarSessao();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.modal && !state.modal.hidden && !state.stockModal) {
        encerrarSessao();
      }
    });

    return modal;
  }

  function setStatus(txt, kind) {
    if (!state.modal) return;
    const el = state.modal.querySelector('#dh-p-status');
    if (!el) return;
    el.textContent = txt;
    el.style.background =
      kind === 'ok'  ? 'rgba(34,197,94,.10)' :
      kind === 'err' ? 'rgba(239,68,68,.10)' :
                       'rgba(59,130,246,.08)';
    el.style.borderColor =
      kind === 'ok'  ? 'rgba(34,197,94,.22)' :
      kind === 'err' ? 'rgba(239,68,68,.22)' :
                       'rgba(59,130,246,.18)';
    el.style.color =
      kind === 'ok'  ? '#86efac' :
      kind === 'err' ? '#fca5a5' :
                       '#93b6ff';
  }

  /* =========================================================
     Realtime
     ========================================================= */
  function assinarCanal() {
    if (state.channel) {
      try { window.db.removeChannel(state.channel); } catch (e) {}
      state.channel = null;
    }

    state.channel = window.db
      .channel('scanner-prod:' + state.session.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'scan_items',
        filter: 'session_id=eq.' + state.session.id
      }, (payload) => {
        processarScan(payload.new);
      })
      .subscribe();
  }

  async function processarScan(item) {
    if (!item || !item.barcode) return;
    if (state.processing) return;
    if (state.lastProcessedId === item.id) return;

    state.lastProcessedId = item.id;
    state.processing = true;

    const barcode = String(item.barcode).trim();
    setStatus('Lido: ' + barcode, 'ok');

    try {
      await window.db.from('scan_items').delete().eq('id', item.id);
    } catch (e) {}

    const { data: product, error } = await window.db
      .from('products')
      .select('id, name, code, barcode, description, price, stock, minimum_stock, active, image_urls, image_url')
      .eq('barcode', barcode)
      .maybeSingle();

    await encerrarSessao();

    state.processing = false;

    if (error) {
      console.error('[scanner-produtos] erro buscar:', error);
      toast('Erro ao buscar produto.', 'error');
      return;
    }

    if (!product) {
      toast('Produto não cadastrado. Preencha o cadastro.', 'info');
      if (window.Produtos && typeof window.Produtos.openCreateModalWithBarcode === 'function') {
        window.Produtos.openCreateModalWithBarcode(barcode);
      } else {
        toast('Módulo de produtos indisponível.', 'error');
      }
      return;
    }

    abrirModalEstoque(product);
  }

  /* =========================================================
     Modal: adicionar estoque
     ========================================================= */
  function abrirModalEstoque(product) {
    if (!state.stockModal) state.stockModal = buildModalEstoque();
    if (!state.stockModal.parentNode) document.body.appendChild(state.stockModal);

    state.stockTarget = product;

    const thumb = state.stockModal.querySelector('#dh-p-thumb');
    const imgUrl = (Array.isArray(product.image_urls) && product.image_urls[0]) ||
                   product.image_url || null;

    thumb.innerHTML = '';
    if (imgUrl) {
      const img = document.createElement('img');
      img.src = imgUrl;
      img.alt = '';
      thumb.appendChild(img);
    } else {
      thumb.innerHTML =
        '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" ' +
        'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
        'stroke-linejoin="round"><path d="m21 8-9-5-9 5v8l9 5 9-5z"/>' +
        '<path d="m3 8 9 5 9-5"/><path d="M12 21v-8"/></svg>';
    }

    state.stockModal.querySelector('#dh-p-name').textContent    = product.name || '—';
    state.stockModal.querySelector('#dh-p-barcode').textContent = product.barcode || '—';
    state.stockModal.querySelector('#dh-p-code').textContent    = product.code || '—';
    state.stockModal.querySelector('#dh-p-current').textContent = toInt(product.stock) + ' un.';
    state.stockModal.querySelector('#dh-p-price').textContent   =
      'R$ ' + (Number(product.price) || 0).toFixed(2).replace('.', ',');

    const qtyInput = state.stockModal.querySelector('#dh-p-qty');
    qtyInput.value = '1';

    const fb = state.stockModal.querySelector('#dh-p-fb');
    fb.textContent = '';
    fb.hidden = true;

    state.stockModal.hidden = false;
    document.body.classList.add('dh-scan-open');
    setTimeout(() => qtyInput.focus(), 40);
  }

  function buildModalEstoque() {
    const modal = document.createElement('div');
    modal.id = 'dh-p-stock-modal';
    modal.className = 'dh-scan-backdrop';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="dh-scan-card" role="dialog" aria-modal="true" style="max-width:460px;">
        <header class="dh-scan-header">
          <h2>Produto encontrado</h2>
          <button type="button" class="dh-scan-close" data-close aria-label="Fechar">×</button>
        </header>
        <div class="dh-scan-body">
          <div class="dh-p-hero">
            <div class="dh-p-thumb" id="dh-p-thumb" aria-hidden="true"></div>
            <div class="dh-p-hero-info">
              <strong id="dh-p-name">—</strong>
              <span class="dh-p-line"><span>Cód. barras</span><b id="dh-p-barcode">—</b></span>
              <span class="dh-p-line"><span>Cód. interno</span><b id="dh-p-code">—</b></span>
            </div>
          </div>

          <div class="dh-p-grid">
            <div>
              <span>Estoque atual</span>
              <strong id="dh-p-current">—</strong>
            </div>
            <div>
              <span>Preço</span>
              <strong id="dh-p-price">—</strong>
            </div>
          </div>

          <div class="dh-p-field">
            <label for="dh-p-qty">Quantidade a adicionar</label>
            <div class="dh-p-qty">
              <button type="button" data-step="-1" aria-label="Diminuir">−</button>
              <input type="number" id="dh-p-qty" min="1" step="1" value="1" inputmode="numeric">
              <button type="button" data-step="1" aria-label="Aumentar">+</button>
            </div>
          </div>

          <p id="dh-p-fb" class="dh-p-fb" hidden></p>
        </div>
        <footer class="dh-scan-footer">
          <button type="button" class="dh-scan-btn dh-scan-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="dh-scan-btn dh-scan-btn--primary" id="dh-p-confirm">
            Adicionar ao estoque
          </button>
        </footer>
      </div>
    `;

    modal.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', fecharModalEstoque);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) fecharModalEstoque();
    });

    const qtyInput = modal.querySelector('#dh-p-qty');
    modal.querySelectorAll('[data-step]').forEach(btn => {
      btn.addEventListener('click', () => {
        const step = Number(btn.getAttribute('data-step'));
        const cur = Math.max(1, Number(qtyInput.value) || 1);
        qtyInput.value = String(Math.max(1, cur + step));
      });
    });

    modal.querySelector('#dh-p-confirm').addEventListener('click', confirmarEstoque);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) fecharModalEstoque();
    });

    return modal;
  }

  function fecharModalEstoque() {
    if (!state.stockModal) return;
    state.stockModal.hidden = true;
    state.stockTarget = null;
    if (!state.modal || state.modal.hidden) {
      document.body.classList.remove('dh-scan-open');
    }
  }

  async function confirmarEstoque() {
    if (!state.stockTarget) return;

    const input = state.stockModal.querySelector('#dh-p-qty');
    const fb = state.stockModal.querySelector('#dh-p-fb');
    const btn = state.stockModal.querySelector('#dh-p-confirm');

    fb.textContent = '';
    fb.hidden = true;

    const qty = Math.max(1, Math.floor(Number(input.value) || 0));
    if (!qty) {
      fb.textContent = 'Informe uma quantidade válida.';
      fb.hidden = false;
      input.focus();
      return;
    }

    btn.disabled = true;
    btn.classList.add('is-loading');

    try {
      const current = toInt(state.stockTarget.stock);
      const next = current + qty;

      const { error } = await window.db
        .from('products')
        .update({ stock: next })
        .eq('id', state.stockTarget.id);

      if (error) throw error;

      toast('Estoque atualizado: ' + next + ' un.', 'success');
      fecharModalEstoque();

      if (window.Produtos && typeof window.Produtos.reload === 'function') {
        await window.Produtos.reload();
      }
    } catch (err) {
      console.error('[scanner-produtos] erro update stock:', err);
      fb.textContent = 'Não foi possível atualizar o estoque.';
      fb.hidden = false;
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  }

  /* =========================================================
     Encerrar sessão
     ========================================================= */
  async function encerrarSessao() {
    if (state.channel) {
      try { window.db.removeChannel(state.channel); } catch (e) {}
      state.channel = null;
    }

    if (state.session) {
      try {
        await window.db.from('scan_sessions')
          .update({ status: 'closed' }).eq('id', state.session.id);
        await window.db.from('scan_items')
          .delete().eq('session_id', state.session.id);
      } catch (e) {}
      state.session = null;
    }

    if (state.modal) {
      state.modal.hidden = true;
      if (state.modal.parentNode) state.modal.parentNode.removeChild(state.modal);
      state.modal = null;
    }

    if (!state.stockModal || state.stockModal.hidden) {
      document.body.classList.remove('dh-scan-open');
    }
  }

  /* =========================================================
     Estilos
     ========================================================= */
  function ensureStyles() {
    if (document.getElementById('dh-scan-prod-styles')) return;
    const style = document.createElement('style');
    style.id = 'dh-scan-prod-styles';
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
      }
      .dh-scan-header{
        display:flex;align-items:center;justify-content:space-between;
        padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0;
      }
      .dh-scan-header h2{margin:0;font-size:16px;font-weight:600;color:#f5f7fb;}
      .dh-scan-close{
        appearance:none;border:0;background:transparent;color:#8b95a7;
        font-size:22px;line-height:1;cursor:pointer;width:32px;height:32px;
        border-radius:8px;display:flex;align-items:center;justify-content:center;
      }
      .dh-scan-close:hover{background:rgba(255,255,255,.06);color:#e6eaf2;}
      .dh-scan-body{padding:20px;overflow-y:auto;}
      .dh-scan-body p{margin:0 0 12px;font-size:13.5px;line-height:1.5;color:#b7c0cf;}
      .dh-scan-center{text-align:center;}
      .dh-scan-qr{
        display:flex;justify-content:center;align-items:center;
        padding:14px;background:#fff;border-radius:14px;
        margin:0 auto 14px;width:fit-content;
        box-shadow:0 4px 20px rgba(0,0,0,.4);
      }
      .dh-scan-qr img{display:block;width:240px;height:240px;}
      .dh-scan-token{text-align:center;font-size:12.5px;color:#8b95a7;margin:0 0 20px;}
      .dh-scan-token strong{
        display:inline-block;margin-top:6px;font-size:20px;letter-spacing:3px;
        color:#e6eaf2;font-weight:700;font-family:monospace;
      }
      .dh-scan-status{
        padding:10px 12px;border-radius:9px;
        background:rgba(59,130,246,.08);
        border:1px solid rgba(59,130,246,.18);
        color:#93b6ff;font-size:12.5px;text-align:center;
      }
      .dh-scan-footer{
        display:flex;justify-content:flex-end;gap:10px;
        padding:14px 20px;border-top:1px solid rgba(255,255,255,.08);
        background:#0a0f16;flex-shrink:0;
      }
      .dh-scan-btn{
        appearance:none;border:1px solid transparent;border-radius:9px;
        padding:10px 18px;font-size:13.5px;font-weight:600;font-family:inherit;
        cursor:pointer;transition:background 120ms ease,opacity 120ms ease;
      }
      .dh-scan-btn:disabled{opacity:.6;cursor:not-allowed;}
      .dh-scan-btn--ghost{background:transparent;color:#c7d0dd;border-color:rgba(255,255,255,.14);}
      .dh-scan-btn--ghost:hover{background:rgba(255,255,255,.05);}
      .dh-scan-btn--primary{background:#3b82f6;color:#fff;}
      .dh-scan-btn--primary:hover{background:#2f74e6;}
      body.dh-scan-open{overflow:hidden;}

      .dh-p-hero{
        display:flex;gap:14px;padding:14px;border-radius:12px;
        background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.08);
        margin-bottom:14px;
      }
      .dh-p-thumb{
        flex-shrink:0;width:56px;height:56px;border-radius:10px;
        background:rgba(122,162,255,.10);color:#7aa2ff;
        display:flex;align-items:center;justify-content:center;overflow:hidden;
      }
      .dh-p-thumb img{width:100%;height:100%;object-fit:cover;}
      .dh-p-hero-info{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px;}
      .dh-p-hero-info strong{
        font-size:15px;color:#e6eaf2;font-weight:600;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      }
      .dh-p-line{display:flex;justify-content:space-between;font-size:11.5px;color:#8b95a7;}
      .dh-p-line b{color:#c7d0dd;font-weight:500;}
      .dh-p-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}
      .dh-p-grid > div{
        padding:10px 12px;border-radius:9px;
        background:rgba(255,255,255,.03);
        border:1px solid rgba(255,255,255,.06);
        display:flex;flex-direction:column;gap:2px;
      }
      .dh-p-grid span{font-size:11.5px;color:#8b95a7;}
      .dh-p-grid strong{font-size:14px;color:#e6eaf2;}
      .dh-p-field{margin-bottom:12px;}
      .dh-p-field label{
        display:block;font-size:12.5px;color:#c7d0dd;font-weight:600;
        margin-bottom:6px;
      }
      .dh-p-qty{
        display:flex;align-items:stretch;
        border:1px solid rgba(255,255,255,.12);border-radius:9px;
        overflow:hidden;background:#131a24;
      }
      .dh-p-qty button{
        appearance:none;border:0;background:transparent;
        color:#c7d0dd;font-size:18px;font-weight:600;
        cursor:pointer;width:44px;flex-shrink:0;
        transition:background 120ms ease;
      }
      .dh-p-qty button:hover{background:rgba(255,255,255,.05);}
      .dh-p-qty input{
        flex:1;min-width:0;border:0;background:transparent;
        color:#fff;text-align:center;
        font-size:15px;font-weight:600;font-family:inherit;
        padding:10px 8px;
      }
      .dh-p-qty input:focus{outline:0;}
      .dh-p-fb{
        padding:10px 12px;border-radius:9px;font-size:12.5px;
        background:rgba(239,68,68,.10);color:#fca5a5;
        border:1px solid rgba(239,68,68,.28);margin:0;
      }
    `;
    document.head.appendChild(style);
  }

  /* =========================================================
     Helpers
     ========================================================= */
  function toast(msg, type) {
    const region = document.getElementById('toast-region');
    if (!region) { console.log('[scanner-produtos]', msg); return; }
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

  function toInt(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
})();