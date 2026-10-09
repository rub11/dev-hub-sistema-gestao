/* =========================================================
   DEV HUB · Vendas · product-picker.js
   Modal de busca de produtos (substitui o dropdown gigante).
   ========================================================= */
(function () {
  'use strict';
  const DH = window.DH = window.DH || {};

  let modalEl = null;
  let inputEl = null;
  let resultsEl = null;
  let timer = null;

  /* ---------------------------------------------------------
     Estilos (injetados)
     --------------------------------------------------------- */
  function injectStyles() {
    if (document.getElementById('dh-pp-styles')) return;
    const s = document.createElement('style');
    s.id = 'dh-pp-styles';
    s.textContent = `
      .dh-pp-backdrop {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(3,6,12,.72);
        backdrop-filter: blur(8px) saturate(140%);
        -webkit-backdrop-filter: blur(8px) saturate(140%);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        animation: dh-pp-fade 180ms ease-out;
      }
      .dh-pp-backdrop[hidden] { display: none; }
      @keyframes dh-pp-fade { from { opacity: 0; } to { opacity: 1; } }

      .dh-pp-card {
        width: 100%; max-width: 620px;
        background: linear-gradient(180deg, #0e1420 0%, #0a0f18 100%);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 18px;
        box-shadow: 0 30px 80px -20px rgba(0,0,0,.8);
        display: flex; flex-direction: column;
        max-height: 80vh;
        overflow: hidden;
        color: #e6eaf2;
        font-family: inherit;
      }

      .dh-pp-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 18px 22px;
        border-bottom: 1px solid rgba(255,255,255,.06);
      }
      .dh-pp-head h2 { margin: 0; font-size: 15px; font-weight: 600; }
      .dh-pp-close {
        appearance: none; border: 0; background: transparent;
        color: #8b95a7; cursor: pointer;
        width: 32px; height: 32px; border-radius: 8px;
        font-size: 22px; line-height: 1;
        display: grid; place-items: center;
      }
      .dh-pp-close:hover { background: rgba(255,255,255,.06); color: #e6eaf2; }

      .dh-pp-body {
        padding: 18px 22px 22px;
        overflow: hidden;
        display: flex; flex-direction: column; gap: 14px;
      }

      .dh-pp-search input {
        width: 100%;
        box-sizing: border-box;
        background: rgba(255,255,255,.04);
        border: 1px solid rgba(99,102,241,.5);
        box-shadow: 0 0 0 3px rgba(99,102,241,.15);
        border-radius: 10px;
        color: #f0f4fa;
        padding: 12px 14px;
        font-size: 14px;
        outline: none;
        font-family: inherit;
      }
      .dh-pp-search input::placeholder { color: #6b7688; }

      .dh-pp-results {
        flex: 1;
        min-height: 0;
        max-height: 420px;
        overflow-y: auto;
        display: flex; flex-direction: column; gap: 4px;
        padding-right: 4px;
      }
      .dh-pp-results::-webkit-scrollbar { width: 6px; }
      .dh-pp-results::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,.1); border-radius: 3px;
      }

      .dh-pp-item {
        appearance: none;
        display: flex; flex-direction: column; gap: 3px;
        text-align: left;
        padding: 11px 14px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,.05);
        background: rgba(255,255,255,.02);
        color: #e6eaf2;
        cursor: pointer;
        font-family: inherit;
        transition: background .12s ease, border-color .12s ease;
      }
      .dh-pp-item:hover {
        background: rgba(99,102,241,.1);
        border-color: rgba(99,102,241,.4);
      }
      .dh-pp-item__name {
        font-size: 13.5px; font-weight: 600; color: #f0f4fa;
      }
      .dh-pp-item__meta {
        font-size: 11.5px; color: #8b95a7;
        font-family: ui-monospace, "SF Mono", Menlo, monospace;
      }
      .dh-pp-item__meta .low {
        color: #fbbf24; font-weight: 600;
      }
      .dh-pp-empty {
        padding: 30px 20px;
        text-align: center;
        color: #6b7688;
        font-size: 13px;
      }

      .product-picker-btn {
        flex: 1;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,.1);
        background: rgba(255,255,255,.03);
        color: #8b95a7;
        font-size: 13.5px;
        font-family: inherit;
        text-align: left;
        cursor: pointer;
        transition: all .15s ease;
        min-width: 0;
      }
      .product-picker-btn:hover {
        border-color: rgba(99,102,241,.5);
        background: rgba(99,102,241,.06);
        color: #a5b4fc;
      }
      .product-picker-btn svg { flex: none; }
      .product-picker-btn span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(s);
  }

  /* ---------------------------------------------------------
     Modal
     --------------------------------------------------------- */
  function build() {
    const m = document.createElement('div');
    m.className = 'dh-pp-backdrop';
    m.hidden = true;
    m.innerHTML = `
      <div class="dh-pp-card" role="dialog" aria-modal="true" aria-labelledby="dh-pp-title">
        <header class="dh-pp-head">
          <h2 id="dh-pp-title">Buscar produto</h2>
          <button type="button" class="dh-pp-close" aria-label="Fechar">×</button>
        </header>
        <div class="dh-pp-body">
          <div class="dh-pp-search">
            <input type="text" placeholder="Buscar por nome, código ou código de barras…"
                   autocomplete="off" spellcheck="false" />
          </div>
          <div class="dh-pp-results"></div>
        </div>
      </div>
    `;

    m.querySelector('.dh-pp-close').addEventListener('click', close);
    m.addEventListener('click', (e) => { if (e.target === m) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !m.hidden) close();
    });

    inputEl = m.querySelector('.dh-pp-search input');
    resultsEl = m.querySelector('.dh-pp-results');
    inputEl.addEventListener('input', onSearch);

    return m;
  }

  function open() {
    if (!modalEl) modalEl = build();
    if (!modalEl.parentNode) document.body.appendChild(modalEl);

    modalEl.hidden = false;
    document.body.style.overflow = 'hidden';

    inputEl.value = '';
    const products = (DH.state && DH.state.products) || [];
    render(products.slice(0, 20));

    setTimeout(() => inputEl.focus(), 80);
  }

  function close() {
    if (!modalEl) return;
    modalEl.hidden = true;
    document.body.style.overflow = '';
  }

  /* ---------------------------------------------------------
     Busca
     --------------------------------------------------------- */
  function onSearch(e) {
    clearTimeout(timer);
    const q = e.target.value.trim().toLowerCase();
    timer = setTimeout(() => {
      const products = (DH.state && DH.state.products) || [];
      if (!q) { render(products.slice(0, 20)); return; }
      const results = products.filter(p => {
        return (p.name || '').toLowerCase().includes(q)
            || (p.code || '').toLowerCase().includes(q)
            || (p.barcode || '').toLowerCase().includes(q);
      });
      render(results.slice(0, 30));
    }, 120);
  }

  /* ---------------------------------------------------------
     Render
     --------------------------------------------------------- */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatMoney(v) {
    return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',');
  }

  function render(products) {
    if (!resultsEl) return;

    if (!products || products.length === 0) {
      resultsEl.innerHTML = '<div class="dh-pp-empty">Nenhum produto encontrado.</div>';
      return;
    }

    resultsEl.innerHTML = products.map(p => {
      const parts = [];
      if (p.barcode) parts.push('EAN ' + p.barcode);
      else if (p.code) parts.push(p.code);

      const low = Number(p.stock) <= 0;
      const price = formatMoney(p.price);

      return `
        <button type="button" class="dh-pp-item" data-id="${escapeHtml(p.id)}">
          <span class="dh-pp-item__name">${escapeHtml(p.name || '—')}</span>
          <span class="dh-pp-item__meta">
            ${parts.join(' · ')}${parts.length ? ' · ' : ''}${price}
            ${low ? ' · <span class="low">em falta</span>' : ''}
          </span>
        </button>
      `;
    }).join('');

    resultsEl.querySelectorAll('.dh-pp-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const p = products.find(x => x.id === id);
        if (p) pick(p);
      });
    });
  }

  /* ---------------------------------------------------------
     Pick — seleciona o produto
     --------------------------------------------------------- */
  function pick(product) {
    close();

    /* Se existir handler global, delega */
    if (DH.productSearch && typeof DH.productSearch.selectProduct === 'function') {
      DH.productSearch.selectProduct(product);
      return;
    }

    /* Fallback: preenche o product-pick diretamente */
    const $ = (id) => document.getElementById(id);

    const pickWrap  = $('product-pick');
    const nameEl    = $('product-pick-name');
    const descEl    = $('product-pick-desc');
    const priceEl   = $('product-pick-price');
    const stockEl   = $('product-pick-stock');
    const codeEl    = $('product-pick-code');
    const barcodeEl = $('product-pick-barcode');
    const qtyEl     = $('product-pick-qty');
    const imgEl     = $('product-pick-image');
    const phEl      = $('product-pick-placeholder');

    if (nameEl)    nameEl.textContent = product.name || '—';
    if (descEl)    descEl.textContent = product.description || '—';
    if (priceEl)   priceEl.textContent = formatMoney(product.price);
    if (stockEl)   stockEl.textContent = String(product.stock || 0);
    if (codeEl)    codeEl.textContent = product.code || '—';
    if (barcodeEl) barcodeEl.textContent = product.barcode || '—';
    if (qtyEl)     qtyEl.value = '1';

    if (imgEl && phEl) {
      const img = product.image_url
        || (Array.isArray(product.image_urls) && product.image_urls[0]);
      if (img) {
        imgEl.src = img;
        imgEl.style.display = '';
        phEl.style.display = 'none';
      } else {
        imgEl.removeAttribute('src');
        imgEl.style.display = 'none';
        phEl.style.display = '';
      }
    }

    if (pickWrap) pickWrap.hidden = false;
    if (DH.state) DH.state.pickedProduct = product;
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  function boot() {
    injectStyles();

    const btn = document.getElementById('open-product-picker');
    if (btn) btn.addEventListener('click', open);
  }

  DH.productPicker = { open, close, pick };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();