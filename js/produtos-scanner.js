/* =========================================================
   DEV HUB · Produtos · Scanner de código de barras (PC)
   ---------------------------------------------------------
   Papel do PC agora:
     - Abrir o QR pra parear o celular
     - Mostrar em tempo real a ATIVIDADE do celular
       (produtos criados / estoque alterado)
     - Botão pra recarregar a lista de produtos
   O cadastro em si acontece NO CELULAR.
   ========================================================= */

(function () {
  'use strict';

  const state = {
    orgId: null,
    userId: null,
    session: null,
    channel: null,
    modal: null,
    atividade: [],
    conhecidos: new Set()
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
    observarBotao();
  }

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
    state.atividade = [];
    state.conhecidos = new Set();
    abrirModalQR();
    assinarCanal();
  }

  function gerarToken() {
    const digits = String(Math.floor(100000 + Math.random() * 900000));
    const chars  = Math.random().toString(36).slice(2, 6).toUpperCase();
    return digits + '-' + chars;
  }

  function abrirModalQR() {
    if (!state.modal) state.modal = buildModal();
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
    renderAtividade();
  }

  function buildModal() {
    const modal = document.createElement('div');
    modal.id = 'dh-p-scanner-modal';
    modal.className = 'dh-scan-backdrop';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="dh-scan-card" role="dialog" aria-modal="true" style="max-width:520px;">
        <header class="dh-scan-header">
          <h2>Cadastro rápido</h2>
          <button type="button" class="dh-scan-close" data-close aria-label="Fechar">×</button>
        </header>
        <div class="dh-scan-body">
          <p class="dh-scan-center">
            Abra o celular, faça login e aponte pro QR.
            Bipando cada produto, o cadastro acontece <b>no próprio celular</b>.
          </p>

          <div class="dh-scan-qr" id="dh-p-qr"></div>

          <p class="dh-scan-token">
            Se preferir, digite no celular:
            <br>
            <strong id="dh-p-token">—</strong>
          </p>

          <div class="dh-p-head">
            <h3>Atividade recente</h3>
            <button type="button" class="dh-scan-btn dh-scan-btn--ghost" id="dh-p-reload"
                    style="padding:6px 12px; font-size:12.5px;">
              Recarregar produtos
            </button>
          </div>

          <div class="dh-p-activity" id="dh-p-activity">
            <div class="dh-p-empty">Aguardando atividade do celular…</div>
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

    modal.querySelector('#dh-p-reload').addEventListener('click', () => {
      if (window.Produtos && typeof window.Produtos.reload === 'function') {
        window.Produtos.reload();
        toast('Lista recarregada.', 'success');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.modal && !state.modal.hidden) {
        encerrarSessao();
      }
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

    state.channel = window.db
      .channel('scanner-prod:' + state.session.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'scan_items',
        filter: 'session_id=eq.' + state.session.id
      }, (payload) => {
        const item = payload.new;
        if (!item || state.conhecidos.has(item.id)) return;
        state.conhecidos.add(item.id);

        state.atividade.unshift(item);
        if (state.atividade.length > 30) state.atividade.pop();

        renderAtividade();

        if (item.action_type === 'product_created') {
          toast('Novo produto: ' + (item.product_name || ''), 'success');
        } else if (item.action_type === 'stock_added') {
          const qty = item.metadata && item.metadata.qty_added;
          toast('+' + (qty || '') + ' un. de ' + (item.product_name || ''), 'success');
        }
      })
      .subscribe();
  }

  function renderAtividade() {
    if (!state.modal) return;
    const wrap = state.modal.querySelector('#dh-p-activity');
    if (!wrap) return;

    if (state.atividade.length === 0) {
      wrap.innerHTML = '<div class="dh-p-empty">Aguardando atividade do celular…</div>';
      return;
    }

    wrap.innerHTML = '';
    state.atividade.forEach(item => {
      const kind = item.action_type || 'sale';
      const isNew = kind === 'product_created';
      const isStock = kind === 'stock_added';

      const row = document.createElement('div');
      row.className = 'dh-p-item';

      const icon = document.createElement('div');
      icon.className = 'dh-p-item__icon ' +
        (isNew ? 'dh-p-item__icon--new' : isStock ? 'dh-p-item__icon--stock' : '');
      icon.innerHTML = isNew
        ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" ' +
          'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
          'stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>'
        : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" ' +
          'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
          'stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

      const body = document.createElement('div');
      body.className = 'dh-p-item__body';

      const title = document.createElement('div');
      title.className = 'dh-p-item__title';
      title.textContent = item.product_name || '—';

      const meta = document.createElement('div');
      meta.className = 'dh-p-item__meta';
      if (isNew) {
        const p = item.metadata && item.metadata.price;
        meta.textContent = 'Cadastrado · ' +
          (p != null ? 'R$ ' + Number(p).toFixed(2).replace('.', ',') : '');
      } else if (isStock) {
        const qty = (item.metadata && item.metadata.qty_added) || item.quantity || 0;
        const next = item.metadata && item.metadata.new_stock;
        meta.textContent = '+' + qty + ' un.' +
          (next != null ? ' (total ' + next + ')' : '');
      } else {
        meta.textContent = 'Item vendido';
      }

      body.appendChild(title);
      body.appendChild(meta);

      row.appendChild(icon);
      row.appendChild(body);
      wrap.appendChild(row);
    });
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
    document.body.classList.remove('dh-scan-open');

    // Recarrega lista de produtos pra refletir mudanças
    if (window.Produtos && typeof window.Produtos.reload === 'function') {
      window.Produtos.reload();
    }
  }

  /* =========================================================
     CSS
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
        position:relative;width:100%;max-width:520px;
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
      .dh-scan-qr img{display:block;width:220px;height:220px;}
      .dh-scan-token{text-align:center;font-size:12.5px;color:#8b95a7;margin:0 0 20px;}
      .dh-scan-token strong{
        display:inline-block;margin-top:6px;font-size:18px;letter-spacing:2px;
        color:#e6eaf2;font-weight:700;font-family:monospace;
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
      .dh-scan-btn--ghost{background:transparent;color:#c7d0dd;border-color:rgba(255,255,255,.14);}
      .dh-scan-btn--ghost:hover{background:rgba(255,255,255,.05);}
      body.dh-scan-open{overflow:hidden;}

      .dh-p-head{
        display:flex;justify-content:space-between;align-items:center;
        margin:20px 0 10px;
      }
      .dh-p-head h3{margin:0;font-size:13.5px;font-weight:600;}
      .dh-p-activity{
        border:1px solid rgba(255,255,255,.08);
        border-radius:10px;
        background:rgba(255,255,255,.015);
        padding:6px 12px;
        max-height:240px;overflow-y:auto;
      }
      .dh-p-empty{
        padding:24px 4px;text-align:center;
        font-size:13px;color:#8b95a7;
      }
      .dh-p-item{
        display:flex;gap:10px;align-items:flex-start;
        padding:10px 0;
        border-bottom:1px solid rgba(255,255,255,.05);
        animation:dhPItem 200ms ease;
      }
      .dh-p-item:last-child{border-bottom:0;}
      @keyframes dhPItem{from{opacity:0;transform:translateY(-3px);}to{opacity:1;transform:translateY(0);}}
      .dh-p-item__icon{
        flex-shrink:0;
        width:24px;height:24px;border-radius:7px;
        display:flex;align-items:center;justify-content:center;
        background:rgba(255,255,255,.05);color:#8b95a7;
      }
      .dh-p-item__icon--new{background:rgba(34,197,94,.14);color:#22c55e;}
      .dh-p-item__icon--stock{background:rgba(59,130,246,.14);color:#3b82f6;}
      .dh-p-item__body{min-width:0;flex:1;}
      .dh-p-item__title{
        font-weight:600;font-size:13px;color:#e6eaf2;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      }
      .dh-p-item__meta{
        font-size:11.5px;color:#8b95a7;margin-top:2px;
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
})();