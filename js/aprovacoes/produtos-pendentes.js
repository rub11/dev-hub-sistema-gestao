/* =========================================================
   DEV HUB · Aprovações · Produtos pendentes
   ---------------------------------------------------------
   Lista produtos com status='pending_approval'.
   Cada item: nome, código de barras, estoque, quem criou.
   Ações:
     - Aprovar → modal pra definir preço + estoque mínimo
     - Rejeitar → modal pra pedir motivo
   ========================================================= */

(function () {
  'use strict';

  const state = {
    produtos: [],
    loading: false,
    target: null,
    aprovando: false,
    rejeitando: false
  };

  document.addEventListener('DOMContentLoaded', boot);

  async function boot() {
    if (!window.db || !window.Auth) return;

    const session = await window.Auth.requireSession().catch(() => null);
    if (!session) return;

    const container = document.getElementById('aprovar-produtos-list');
    if (!container) return;

    setupModais();
    await carregar();
  }

  /* =========================================================
     Carregar produtos pendentes
     ========================================================= */
  async function carregar() {
    if (state.loading) return;
    state.loading = true;

    const container = document.getElementById('aprovar-produtos-list');
    if (container) {
      container.innerHTML =
        '<div class="state-block state-block--compact">' +
        '<span class="spinner" aria-hidden="true"></span>' +
        '<p>Carregando produtos pendentes…</p></div>';
    }

    const { data, error } = await window.db
      .from('products')
      .select('id, name, code, barcode, description, stock, created_by, created_at, image_urls')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false });

    state.loading = false;

    if (error) {
      console.error('[aprovações] erro:', error);
      if (container) {
        container.innerHTML =
          '<div class="state-block state-block--compact">' +
          '<p>Não foi possível carregar os produtos pendentes.</p></div>';
      }
      return;
    }

    state.produtos = data || [];
    render();
    atualizarContador();
  }

  function atualizarContador() {
    const el = document.getElementById('aprovar-produtos-count');
    const badge = document.getElementById('aprovar-produtos-badge');
    const total = state.produtos.length;

    if (el) {
      if (total === 0) el.textContent = 'Nenhum produto pendente';
      else if (total === 1) el.textContent = '1 produto pendente';
      else el.textContent = total + ' produtos pendentes';
    }

    if (badge) {
      badge.textContent = String(total);
      badge.hidden = total === 0;
    }
  }

  /* =========================================================
     Render
     ========================================================= */
  function render() {
    const container = document.getElementById('aprovar-produtos-list');
    if (!container) return;

    if (state.produtos.length === 0) {
      container.innerHTML =
        '<div class="state-block state-block--compact">' +
        '<p>Nenhum produto pendente de aprovação. 🎉</p></div>';
      return;
    }

    container.innerHTML = '';
    state.produtos.forEach(p => {
      container.appendChild(buildItem(p));
    });
  }

  function buildItem(p) {
    const item = document.createElement('div');
    item.style.cssText =
      'display:flex;gap:14px;padding:14px;border-radius:12px;' +
      'background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);' +
      'margin-bottom:10px;align-items:center;flex-wrap:wrap;';

    const thumb = document.createElement('div');
    thumb.style.cssText =
      'flex-shrink:0;width:52px;height:52px;border-radius:10px;' +
      'background:rgba(122,162,255,.10);color:#7aa2ff;' +
      'display:flex;align-items:center;justify-content:center;overflow:hidden;';

    const imgUrl = (Array.isArray(p.image_urls) && p.image_urls[0]) || null;
    if (imgUrl) {
      const img = document.createElement('img');
      img.src = imgUrl;
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      thumb.appendChild(img);
    } else {
      thumb.innerHTML =
        '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" ' +
        'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
        'stroke-linejoin="round"><path d="m21 8-9-5-9 5v8l9 5 9-5z"/>' +
        '<path d="m3 8 9 5 9-5"/><path d="M12 21v-8"/></svg>';
    }

    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:200px;';
    info.innerHTML =
      '<div style="font-weight:600;font-size:14px;color:#e6eaf2;' +
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
        escapeHtml(p.name || '—') +
      '</div>' +
      '<div style="font-size:11.5px;color:#8b95a7;margin-top:3px;">' +
        (p.barcode ? 'EAN ' + escapeHtml(p.barcode) + ' · ' : '') +
        'Estoque: ' + (parseInt(p.stock, 10) || 0) + ' un.' +
        (p.code ? ' · Cód. ' + escapeHtml(p.code) : '') +
      '</div>';

    const actions = document.createElement('div');
    actions.style.cssText = 'flex-shrink:0;display:flex;gap:8px;';

    const btnReject = document.createElement('button');
    btnReject.type = 'button';
    btnReject.className = 'btn btn--ghost';
    btnReject.style.cssText = 'padding:8px 12px;font-size:12.5px;';
    btnReject.textContent = 'Rejeitar';
    btnReject.addEventListener('click', () => abrirRejeitar(p));

    const btnApprove = document.createElement('button');
    btnApprove.type = 'button';
    btnApprove.className = 'btn btn--primary';
    btnApprove.style.cssText = 'padding:8px 12px;font-size:12.5px;';
    btnApprove.textContent = 'Definir preço e aprovar';
    btnApprove.addEventListener('click', () => abrirAprovar(p));

    actions.appendChild(btnReject);
    actions.appendChild(btnApprove);

    item.appendChild(thumb);
    item.appendChild(info);
    item.appendChild(actions);
    return item;
  }

  /* =========================================================
     Modais
     ========================================================= */
  function setupModais() {
    ensureStyles();

    // ---- Aprovar ----
    if (!document.getElementById('aprovar-produto-modal')) {
      const modal = document.createElement('div');
      modal.id = 'aprovar-produto-modal';
      modal.className = 'dh-scan-backdrop';
      modal.hidden = true;
      modal.innerHTML = `
        <div class="dh-scan-card" role="dialog" aria-modal="true" style="max-width:460px;">
          <header class="dh-scan-header">
            <h2>Aprovar produto</h2>
            <button type="button" class="dh-scan-close" data-close aria-label="Fechar">×</button>
          </header>
          <div class="dh-scan-body">
            <div style="padding:12px;border-radius:10px;background:rgba(255,255,255,.04);margin-bottom:16px;">
              <div style="font-weight:600;margin-bottom:4px;" id="ap-name">—</div>
              <div style="font-size:12px;color:#8b95a7;">
                Cód. barras: <b id="ap-barcode">—</b> · Estoque: <b id="ap-stock">—</b>
              </div>
            </div>

            <div style="margin-bottom:14px;">
              <label for="ap-price" style="display:block;font-size:12.5px;font-weight:600;color:#c7d0dd;margin-bottom:6px;">
                Preço de venda (R$) *
              </label>
              <input type="number" id="ap-price" step="0.01" min="0" inputmode="decimal" value="0"
                     style="width:100%;padding:11px 12px;background:#131a24;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:9px;font-size:14px;font-family:inherit;">
            </div>

            <div style="margin-bottom:14px;">
              <label for="ap-min" style="display:block;font-size:12.5px;font-weight:600;color:#c7d0dd;margin-bottom:6px;">
                Estoque mínimo (alerta)
              </label>
              <input type="number" id="ap-min" step="1" min="0" inputmode="numeric" value="0"
                     style="width:100%;padding:11px 12px;background:#131a24;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:9px;font-size:14px;font-family:inherit;">
            </div>

            <p id="ap-feedback" style="padding:10px 12px;border-radius:9px;background:rgba(239,68,68,.10);color:#fca5a5;border:1px solid rgba(239,68,68,.28);font-size:12.5px;margin:0;display:none;"></p>
          </div>
          <footer class="dh-scan-footer">
            <button type="button" class="dh-scan-btn dh-scan-btn--ghost" data-close>Cancelar</button>
            <button type="button" class="dh-scan-btn dh-scan-btn--primary" id="ap-confirm">
              Aprovar e ativar
            </button>
          </footer>
        </div>
      `;
      document.body.appendChild(modal);
    }

    // ---- Rejeitar ----
    if (!document.getElementById('rejeitar-produto-modal')) {
      const modal = document.createElement('div');
      modal.id = 'rejeitar-produto-modal';
      modal.className = 'dh-scan-backdrop';
      modal.hidden = true;
      modal.innerHTML = `
        <div class="dh-scan-card" role="dialog" aria-modal="true" style="max-width:440px;">
          <header class="dh-scan-header">
            <h2>Rejeitar produto</h2>
            <button type="button" class="dh-scan-close" data-close aria-label="Fechar">×</button>
          </header>
          <div class="dh-scan-body">
            <p style="color:#b7c0cf;font-size:13.5px;margin:0 0 14px;">
              Rejeitar "<b id="rj-name">—</b>"? O produto ficará inativo e não aparecerá no catálogo.
            </p>
            <div style="margin-bottom:14px;">
              <label for="rj-reason" style="display:block;font-size:12.5px;font-weight:600;color:#c7d0dd;margin-bottom:6px;">
                Motivo *
              </label>
              <textarea id="rj-reason" rows="3"
                        placeholder="Ex: preço já cadastrado, produto duplicado, código errado…"
                        style="width:100%;padding:11px 12px;background:#131a24;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:9px;font-size:14px;font-family:inherit;resize:vertical;"></textarea>
            </div>
            <p id="rj-feedback" style="padding:10px 12px;border-radius:9px;background:rgba(239,68,68,.10);color:#fca5a5;border:1px solid rgba(239,68,68,.28);font-size:12.5px;margin:0;display:none;"></p>
          </div>
          <footer class="dh-scan-footer">
            <button type="button" class="dh-scan-btn dh-scan-btn--ghost" data-close>Cancelar</button>
            <button type="button" class="dh-scan-btn dh-scan-btn--danger" id="rj-confirm">
              Rejeitar produto
            </button>
          </footer>
        </div>
      `;
      document.body.appendChild(modal);
    }

    ['aprovar-produto-modal','rejeitar-produto-modal'].forEach(id => {
      const modal = document.getElementById(id);
      modal.querySelectorAll('[data-close]').forEach(el => {
        el.addEventListener('click', () => { modal.hidden = true; state.target = null; });
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) { modal.hidden = true; state.target = null; }
      });
    });

    document.getElementById('ap-confirm').addEventListener('click', confirmarAprovar);
    document.getElementById('rj-confirm').addEventListener('click', confirmarRejeitar);
  }

  function abrirAprovar(p) {
    state.target = p;
    const modal = document.getElementById('aprovar-produto-modal');
    modal.querySelector('#ap-name').textContent = p.name || '—';
    modal.querySelector('#ap-barcode').textContent = p.barcode || '—';
    modal.querySelector('#ap-stock').textContent = (parseInt(p.stock, 10) || 0) + ' un.';
    modal.querySelector('#ap-price').value = '0';
    modal.querySelector('#ap-min').value = '0';
    const fb = modal.querySelector('#ap-feedback');
    fb.style.display = 'none';
    modal.hidden = false;
    setTimeout(() => modal.querySelector('#ap-price').focus(), 80);
  }

  function abrirRejeitar(p) {
    state.target = p;
    const modal = document.getElementById('rejeitar-produto-modal');
    modal.querySelector('#rj-name').textContent = p.name || '—';
    modal.querySelector('#rj-reason').value = '';
    const fb = modal.querySelector('#rj-feedback');
    fb.style.display = 'none';
    modal.hidden = false;
    setTimeout(() => modal.querySelector('#rj-reason').focus(), 80);
  }

  async function confirmarAprovar() {
    if (state.aprovando || !state.target) return;

    const modal = document.getElementById('aprovar-produto-modal');
    const price = parseFloat(modal.querySelector('#ap-price').value);
    const minStock = parseInt(modal.querySelector('#ap-min').value, 10) || 0;
    const fb = modal.querySelector('#ap-feedback');
    const btn = modal.querySelector('#ap-confirm');

    if (!Number.isFinite(price) || price < 0) {
      fb.textContent = 'Informe um preço válido.';
      fb.style.display = 'block';
      return;
    }

    state.aprovando = true;
    btn.disabled = true;
    btn.textContent = 'Aprovando…';

    try {
      const { error } = await window.db.rpc('approve_product', {
        p_product_id: state.target.id,
        p_price: price,
        p_minimum_stock: minStock
      });
      if (error) throw error;

      modal.hidden = true;
      state.target = null;
      toast('Produto aprovado e ativado.', 'success');
      await carregar();

      window.dispatchEvent(new CustomEvent('products:reload'));
    } catch (err) {
      console.error('[aprovar] erro:', err);
      fb.textContent = err.message || 'Erro ao aprovar.';
      fb.style.display = 'block';
    } finally {
      state.aprovando = false;
      btn.disabled = false;
      btn.textContent = 'Aprovar e ativar';
    }
  }

  async function confirmarRejeitar() {
    if (state.rejeitando || !state.target) return;

    const modal = document.getElementById('rejeitar-produto-modal');
    const reason = modal.querySelector('#rj-reason').value.trim();
    const fb = modal.querySelector('#rj-feedback');
    const btn = modal.querySelector('#rj-confirm');

    if (reason.length < 3) {
      fb.textContent = 'Descreva o motivo (mínimo 3 caracteres).';
      fb.style.display = 'block';
      return;
    }

    state.rejeitando = true;
    btn.disabled = true;
    btn.textContent = 'Rejeitando…';

    try {
      const { error } = await window.db.rpc('reject_product', {
        p_product_id: state.target.id,
        p_reason: reason
      });
      if (error) throw error;

      modal.hidden = true;
      state.target = null;
      toast('Produto rejeitado.', 'success');
      await carregar();
    } catch (err) {
      console.error('[rejeitar] erro:', err);
      fb.textContent = err.message || 'Erro ao rejeitar.';
      fb.style.display = 'block';
    } finally {
      state.rejeitando = false;
      btn.disabled = false;
      btn.textContent = 'Rejeitar produto';
    }
  }

  /* =========================================================
     CSS (injeta 1x)
     ========================================================= */
  function ensureStyles() {
    if (document.getElementById('dh-ap-styles')) return;
    const style = document.createElement('style');
    style.id = 'dh-ap-styles';
    style.textContent = `
      .dh-scan-backdrop{
        position:fixed;inset:0;z-index:9998;
        background:rgba(5,8,14,.78);
        backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);
        display:flex;align-items:center;justify-content:center;padding:20px;
      }
      .dh-scan-backdrop[hidden]{display:none;}
      .dh-scan-card{
        width:100%;max-width:480px;
        background:#0d131c;color:#e6eaf2;
        border:1px solid rgba(255,255,255,.10);border-radius:16px;
        display:flex;flex-direction:column;max-height:92vh;overflow:hidden;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      }
      .dh-scan-header{
        display:flex;align-items:center;justify-content:space-between;
        padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0;
      }
      .dh-scan-header h2{margin:0;font-size:16px;font-weight:600;}
      .dh-scan-close{
        appearance:none;border:0;background:transparent;color:#8b95a7;
        font-size:22px;cursor:pointer;width:32px;height:32px;border-radius:8px;
      }
      .dh-scan-close:hover{background:rgba(255,255,255,.06);color:#e6eaf2;}
      .dh-scan-body{padding:20px;overflow-y:auto;}
      .dh-scan-footer{
        display:flex;justify-content:flex-end;gap:10px;
        padding:14px 20px;border-top:1px solid rgba(255,255,255,.08);
        background:#0a0f16;flex-shrink:0;
      }
      .dh-scan-btn{
        appearance:none;border:1px solid transparent;border-radius:9px;
        padding:10px 18px;font-size:13.5px;font-weight:600;font-family:inherit;
        cursor:pointer;
      }
      .dh-scan-btn--ghost{background:transparent;color:#c7d0dd;border-color:rgba(255,255,255,.14);}
      .dh-scan-btn--primary{background:#3b82f6;color:#fff;}
      .dh-scan-btn--danger{background:#dc2626;color:#fff;}
      .dh-scan-btn:disabled{opacity:.6;cursor:not-allowed;}
    `;
    document.head.appendChild(style);
  }

  /* =========================================================
     Helpers
     ========================================================= */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function toast(msg, type) {
    const region = document.getElementById('toast-region');
    if (!region) { console.log('[aprovações]', msg); return; }
    const el = document.createElement('div');
    el.className = 'toast toast--' + (type || 'info');
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

  window.AprovarProdutos = { carregar };
})();