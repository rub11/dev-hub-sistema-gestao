/* =========================================================
   DEV HUB · Vendas · product-search.js
   Busca/autocomplete de produto + preview.
   Regras:
     • Modo orçamento → permite adicionar sem estoque (com aviso laranja)
     • Modo venda     → exige toggle "Vender sem estoque"
   ========================================================= */
(function () {
  'use strict';
  const DH = window.DH;
  const { state, utils } = DH;

  const els = {};
  let debounce = null;

  function isQuoteMode() {
    return state.formMode === 'quote';
  }

  function setup() {
    els.wrap            = document.getElementById('product-search-wrap');
    els.input           = document.getElementById('product-search-input');
    els.btn             = document.getElementById('product-search-btn');
    els.clear           = document.getElementById('product-search-clear');
    els.suggestions     = document.getElementById('product-suggestions');
    els.pick            = document.getElementById('product-pick');
    els.pickImage       = document.getElementById('product-pick-image');
    els.pickPlaceholder = document.getElementById('product-pick-placeholder');
    els.pickName        = document.getElementById('product-pick-name');
    els.pickDesc        = document.getElementById('product-pick-desc');
    els.pickPrice       = document.getElementById('product-pick-price');
    els.pickStock       = document.getElementById('product-pick-stock');
    els.pickCode        = document.getElementById('product-pick-code');
    els.pickBarcode     = document.getElementById('product-pick-barcode');
    els.pickQty         = document.getElementById('product-pick-qty');
    els.pickAdd         = document.getElementById('product-pick-add');
    els.pickClose       = document.getElementById('product-pick-close');
    els.pickWarn        = document.getElementById('product-pick-warn');

    if (!els.input) return;

    els.input.addEventListener('input', onInput);
    els.input.addEventListener('focus', onFocus);
    els.input.addEventListener('keydown', onKeydown);
    document.addEventListener('pointerdown', onDocPointerDown, true);

    if (els.btn) els.btn.addEventListener('click', onBtnClick);
    if (els.clear) els.clear.addEventListener('click', clear);
    if (els.pickClose) els.pickClose.addEventListener('click', closePick);
    if (els.pickAdd) els.pickAdd.addEventListener('click', addPicked);

    const noStockEl = document.getElementById('sale-no-stock');
    if (noStockEl) {
      noStockEl.addEventListener('change', () => {
        if (els.pick && !els.pick.hidden) refreshPickState();
      });
    }
  }

  function onInput() {
    state.productQuery = els.input.value.trim();
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(runSearch, 120);
  }

  function onFocus() {
    if (state.productQuery) runSearch();
    else showTop();
    if (window.innerWidth <= 720) {
      setTimeout(() => {
        try { els.input.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        catch (e) {}
      }, 250);
    }
  }

  function onBtnClick(e) {
    if (e) e.preventDefault();
    try { els.input.focus(); } catch (err) {}
    if (state.productQuery) runSearch();
    else showTop();
  }

  function onDocPointerDown(e) {
    if (!els.suggestions || els.suggestions.hidden) return;
    if (els.wrap.contains(e.target)) return;
    closeSuggestions();
  }

  function showTop() {
    const items = (state.products || []).slice(0, 10);
    state.productSuggestions = items;
    state.productSuggestionIndex = items.length > 0 ? 0 : -1;
    renderSuggestions(items, '');
    if (els.clear) els.clear.hidden = true;
  }

  function runSearch() {
    const q = state.productQuery.toLowerCase();
    if (!q) { showTop(); return; }
    els.clear.hidden = false;
    const items = state.products.filter(p =>
      utils.matches(p.name, q) ||
      utils.matches(p.code, q) ||
      utils.matches(p.barcode, q) ||
      utils.matches(p.description, q)
    ).slice(0, 20);
    state.productSuggestions = items;
    state.productSuggestionIndex = items.length > 0 ? 0 : -1;
    renderSuggestions(items, q);
  }

  function renderSuggestions(items, query) {
    const ul = els.suggestions;
    if (!ul) return;
    ul.innerHTML = '';

    if (items.length === 0) {
      const li = document.createElement('li');
      li.className = 'product-suggestions__empty';
      li.textContent = query
        ? 'Nenhum produto encontrado para "' + query + '".'
        : 'Nenhum produto cadastrado.';
      ul.appendChild(li);
      ul.hidden = false;
      els.input.setAttribute('aria-expanded', 'true');
      return;
    }

    items.forEach((p, idx) => {
      const li = document.createElement('li');
      li.className = 'product-suggestions__item';
      li.setAttribute('role', 'option');
      li.dataset.id = p.id;
      if (idx === state.productSuggestionIndex) li.setAttribute('aria-selected', 'true');

      const thumb = document.createElement('div');
      thumb.className = 'product-suggestions__thumb';
      if (p.image_url) {
        const img = document.createElement('img');
        img.src = p.image_url; img.alt = ''; img.loading = 'lazy';
        thumb.appendChild(img);
      } else {
        thumb.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"' +
          ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="m21 8-9-5-9 5v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 21v-8"/></svg>';
      }

      const info = document.createElement('div');
      info.className = 'product-suggestions__info';

      const name = document.createElement('div');
      name.className = 'product-suggestions__name';
      name.textContent = p.name || '(sem nome)';

      const meta = document.createElement('div');
      meta.className = 'product-suggestions__meta';
      const parts = [];
      if (p.barcode) parts.push('EAN ' + p.barcode);
      else if (p.code) parts.push('Cód. ' + p.code);
      parts.push(utils.formatMoney(p.price));
      const stockNum = utils.toInteger(p.stock, 0);
      if (stockNum <= 0) parts.push('em falta');
      meta.textContent = parts.join(' · ');

      info.appendChild(name);
      info.appendChild(meta);
      li.appendChild(thumb);
      li.appendChild(info);

      if (stockNum <= 0) li.classList.add('is-out-of-stock');

      li.addEventListener('mouseenter', () => {
        state.productSuggestionIndex = idx;
        highlight();
      });
      li.addEventListener('pointerdown', e => {
        e.preventDefault();
        pick(p);
      });
      ul.appendChild(li);
    });

    ul.hidden = false;
    els.input.setAttribute('aria-expanded', 'true');
  }

  function highlight() {
    const ul = els.suggestions;
    if (!ul) return;
    Array.prototype.forEach.call(ul.children, (li, idx) => {
      if (idx === state.productSuggestionIndex) li.setAttribute('aria-selected', 'true');
      else li.removeAttribute('aria-selected');
    });
  }

  function onKeydown(e) {
    if (els.suggestions.hidden) {
      if (e.key === 'ArrowDown') { runSearch(); e.preventDefault(); }
      return;
    }
    const len = state.productSuggestions.length;
    if (e.key === 'ArrowDown') {
      state.productSuggestionIndex = (state.productSuggestionIndex + 1) % Math.max(1, len);
      highlight(); e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      state.productSuggestionIndex =
        (state.productSuggestionIndex - 1 + Math.max(1, len)) % Math.max(1, len);
      highlight(); e.preventDefault();
    } else if (e.key === 'Enter') {
      const item = state.productSuggestions[state.productSuggestionIndex];
      if (item) { pick(item); e.preventDefault(); }
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
  }

  function closeSuggestions() {
    if (!els.suggestions) return;
    els.suggestions.hidden = true;
    els.input.setAttribute('aria-expanded', 'false');
  }

  function clear() {
    if (!els.input) return;
    els.input.value = '';
    state.productQuery = '';
    state.productSuggestions = [];
    state.productSuggestionIndex = -1;
    els.clear.hidden = true;
    closeSuggestions();
    closePick();
    try { els.input.focus(); } catch (e) {}
  }

  function pick(product) {
    state.pickedProduct = product;
    closeSuggestions();
    els.input.value = product.name || '';
    state.productQuery = product.name || '';
    els.clear.hidden = false;

    els.pickName.textContent = product.name || '—';
    els.pickDesc.textContent = product.description || 'Sem descrição cadastrada.';
    els.pickPrice.textContent = utils.formatMoney(product.price);
    els.pickStock.textContent = String(utils.toInteger(product.stock, 0));
    els.pickCode.textContent = product.code || '—';
    els.pickBarcode.textContent = product.barcode || '—';
    els.pickQty.value = '1';

    if (product.image_url) {
      els.pickImage.src = product.image_url;
      els.pickImage.hidden = false;
      els.pickPlaceholder.hidden = true;
    } else {
      els.pickImage.hidden = true;
      els.pickPlaceholder.hidden = false;
    }

    els.pick.hidden = false;
    refreshPickState();
  }

  function refreshPickState() {
    const product = state.pickedProduct;
    if (!product) return;

    const stock       = utils.toInteger(product.stock, 0);
    const qty         = utils.toInteger(els.pickQty.value, 0);
    const allowNoStock = !!state.noStock;
    const quoteMode    = isQuoteMode();

    const existing   = state.cart.find(i => i.product_id === product.id);
    const alreadyQty = existing ? existing.quantity : 0;
    const totalQty   = alreadyQty + qty;
    const falta      = totalQty > stock;

    if (els.pickWarn) {
      if (falta && quoteMode) {
        els.pickWarn.hidden = false;
        els.pickWarn.classList.add('product-pick__warn--info');
        els.pickWarn.innerHTML =
          '⚠️ Este item <strong>está em falta</strong> no estoque. ' +
          'Você pode incluir no orçamento normalmente — ' +
          'a falta será considerada na hora de virar venda.';
      } else if (falta && !allowNoStock) {
        els.pickWarn.hidden = false;
        els.pickWarn.classList.remove('product-pick__warn--info');
        els.pickWarn.innerHTML =
          '⚠️ Estoque insuficiente. Marque <strong>"Vender sem estoque"</strong> no resumo ' +
          'para continuar — a venda ficará pendente de aprovação do gestor.';
      } else if (falta && allowNoStock && !quoteMode) {
        els.pickWarn.hidden = false;
        els.pickWarn.classList.remove('product-pick__warn--info');
        els.pickWarn.innerHTML =
          '⚠️ Vendendo <strong>sem estoque</strong>. ' +
          'A venda ficará pendente de aprovação do gestor.';
      } else {
        els.pickWarn.hidden = true;
      }
    }

    if (qty <= 0) { els.pickAdd.disabled = true; return; }
    if (falta && !quoteMode && !allowNoStock) { els.pickAdd.disabled = true; return; }
    els.pickAdd.disabled = false;
  }

  function closePick() {
    state.pickedProduct = null;
    if (els.pick) els.pick.hidden = true;
    if (els.pickWarn) els.pickWarn.hidden = true;
  }

  function addPicked() {
    const product = state.pickedProduct;
    if (!product) return;

    const stock   = utils.toInteger(product.stock, 0);
    const qty     = utils.toInteger(els.pickQty.value, 0);
    const quoteMode    = isQuoteMode();
    const allowNoStock = !!state.noStock;

    if (qty <= 0) {
      DH.cart.showFeedback('Informe uma quantidade válida.');
      els.pickQty.focus();
      return;
    }

    const existing   = state.cart.find(i => i.product_id === product.id);
    const alreadyQty = existing ? existing.quantity : 0;

    if (alreadyQty + qty > stock && !quoteMode && !allowNoStock) {
      DH.cart.showFeedback(
        'Estoque insuficiente para "' + product.name + '". ' +
        'Marque "Vender sem estoque" no resumo se quiser continuar.'
      );
      return;
    }

    const price = utils.toNumber(product.price, 0);
    if (existing) {
      existing.quantity += qty;
      existing.subtotal = utils.round2(existing.quantity * existing.unit_price);
    } else {
      state.cart.push({
        product_id: product.id,
        product_name: product.name || '',
        unit_price: price,
        quantity: qty,
        subtotal: utils.round2(qty * price),
        stock_available: stock
      });
    }

    DH.cart.clearFeedback();
    clear();
    DH.cart.render();
    DH.cart.recalc();
  }

  DH.productSearch = { setup, clear, closePick, onToggleNoStock: refreshPickState };
})();