/* =========================================================
   DEV HUB · Compras · Items Modal (Com Toggle R$ / %)
   ========================================================= */

(function () {
  'use strict';

  const state = {
    items: [],
    products: [],
    editingIndex: -1,
    currentType: 'produto',
    selectedProduct: null
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const btnAdd = document.getElementById('cmp-add-item');
    const modal = document.getElementById('item-modal');
    const form = document.getElementById('item-form');
    
    const inputSearch = document.getElementById('item-product-search');
    const inputProductManual = document.getElementById('item-product');
    const inputQty = document.getElementById('item-qty');
    const inputUnit = document.getElementById('item-unit');
    const inputPrice = document.getElementById('item-price');
    const inputDiscount = document.getElementById('item-discount');
    const previewTotal = document.getElementById('item-total-preview');
    
    const radioDiscR = document.getElementById('disc-r');
    const radioDiscP = document.getElementById('disc-p');
    
    const dropdown = document.getElementById('product-dropdown');
    const wrapperSearch = document.getElementById('wrapper-product-search');
    const wrapperManual = document.getElementById('wrapper-product-input');
    const typeRadios = document.querySelectorAll('input[name="item-type-radio"]');

    if (!btnAdd || !modal) return;

    try {
      if (window.Cmp && window.Cmp.API) {
        state.products = await window.Cmp.API.listProducts().catch(() => []);
      }
    } catch (e) {
      console.warn('Não foi possível carregar produtos do estoque.', e);
    }

    const maskCurrency = (value) => {
      let v = value.replace(/\D/g, ''); 
      if (!v) return '';
      v = v.slice(0, 13); 
      v = (Number(v) / 100).toFixed(2); 
      v = v.replace('.', ','); 
      v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.'); 
      return v;
    };

    const parseMoney = (val) => {
      if (!val) return 0;
      let str = String(val).replace(/[^\d,]/g, '').replace(',', '.');
      let num = parseFloat(str) || 0;
      return num;
    };

    const formatMoney = (val) => {
      return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const escapeHtml = (s) => {
      return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    };

    const updatePreview = () => {
      const qty = Math.min(parseFloat(inputQty.value) || 0, 999999);
      const price = parseMoney(inputPrice.value);
      const isPercent = radioDiscP.checked;
      const discountInputVal = parseMoney(inputDiscount.value);
      const subtotal = qty * price;
      
      let discountAmount = isPercent ? subtotal * (discountInputVal / 100) : discountInputVal;
      if (discountAmount > subtotal) discountAmount = subtotal;
      
      const total = Math.max(0, subtotal - discountAmount);
      previewTotal.textContent = formatMoney(total);
    };

    function setType(type) {
      state.currentType = type;
      state.selectedProduct = null;
      
      if (type === 'produto') {
        wrapperSearch.hidden = false;
        wrapperManual.hidden = true;
        inputSearch.value = '';
        inputProductManual.value = '';
      } else {
        wrapperSearch.hidden = true;
        wrapperManual.hidden = false;
        inputSearch.value = '';
        inputProductManual.value = '';
        dropdown.hidden = true;
      }
      
      inputQty.value = 1;
      inputUnit.value = 'UN';
      inputPrice.value = '';
      radioDiscR.checked = true;
      inputDiscount.value = '';
      updatePreview();
    }

    typeRadios.forEach(r => {
      r.addEventListener('change', (e) => {
        if (e.target.checked) setType(e.target.value);
      });
    });

    inputPrice.addEventListener('input', (e) => {
      e.target.value = maskCurrency(e.target.value);
      updatePreview();
    });

    inputDiscount.addEventListener('input', (e) => {
      if (radioDiscR.checked) {
        e.target.value = maskCurrency(e.target.value);
      } else {
        let v = e.target.value.replace(/\D/g, '');
        if (Number(v) > 100) v = '100';
        e.target.value = v;
      }
      updatePreview();
    });

    [radioDiscR, radioDiscP].forEach(r => {
      r.addEventListener('change', () => {
        inputDiscount.value = '';
        updatePreview();
      });
    });

    inputSearch.addEventListener('input', () => {
      const term = inputSearch.value.toLowerCase().trim();
      if (!term) {
        dropdown.hidden = true;
        return;
      }

      const filtered = state.products.filter(p => 
        (p.name || '').toLowerCase().includes(term) || 
        (p.code || '').toLowerCase().includes(term)
      ).slice(0, 10);

      if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding:12px; font-size:13px; color:var(--text-muted); text-align:center;">Nenhum produto encontrado no estoque.</div>';
      } else {
        dropdown.innerHTML = filtered.map(p => `
          <div class="item-modal__search-item" data-id="${p.id}">
            <strong>${escapeHtml(p.name)}</strong>
            <span>${p.code ? 'Cód: ' + escapeHtml(p.code) + ' · ' : ''}${formatMoney(p.price || 0)}</span>
          </div>
        `).join('');
      }
      dropdown.hidden = false;
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.item-modal__search-field')) {
        dropdown.hidden = true;
      }
    });

    dropdown.addEventListener('click', (e) => {
      const itemEl = e.target.closest('.item-modal__search-item');
      if (!itemEl) return;

      const productId = itemEl.dataset.id;
      const product = state.products.find(p => p.id === productId);
      if (!product) return;

      state.selectedProduct = product; // Guarda o objeto inteiro com ID
      inputSearch.value = product.name;
      
      const unitStr = (product.unit || 'UN').toUpperCase();
      const hasOption = Array.from(inputUnit.options).some(opt => opt.value === unitStr);
      inputUnit.value = hasOption ? unitStr : 'UN';

      inputPrice.value = maskCurrency((product.price || 0).toFixed(2).replace('.', ''));
      
      dropdown.hidden = true;
      updatePreview();
      inputQty.focus();
    });

    btnAdd.addEventListener('click', () => {
      state.editingIndex = -1;
      document.getElementById('item-modal-title').textContent = 'Adicionar novo item';
      form.reset();
      
      document.querySelector('input[name="item-type-radio"][value="produto"]').checked = true;
      setType('produto');
      
      document.getElementById('item-feedback').hidden = true;
      
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputSearch.focus(), 100);
    });

    const openEditModal = (index) => {
      state.editingIndex = index;
      const item = state.items[index];
      
      document.getElementById('item-modal-title').textContent = 'Editar item';
      
      const type = item.type === 'Produto' ? 'produto' : 'avulso';
      document.querySelector(`input[name="item-type-radio"][value="${type}"]`).checked = true;
      setType(type);

      if (type === 'produto') {
        inputSearch.value = item.name;
        state.selectedProduct = state.products.find(p => p.id === item.productId) || null;
      } else {
        inputProductManual.value = item.name;
      }
      
      inputQty.value = item.qty;
      
      const editUnit = (item.unit || 'UN').toUpperCase();
      const editHasOption = Array.from(inputUnit.options).some(opt => opt.value === editUnit);
      inputUnit.value = editHasOption ? editUnit : 'UN';

      inputPrice.value = maskCurrency(item.price.toFixed(2).replace('.', ''));
      
      if (item.discountType === '%') {
        radioDiscP.checked = true;
        inputDiscount.value = item.discountRaw.toString();
      } else {
        radioDiscR.checked = true;
        inputDiscount.value = maskCurrency(item.discount.toFixed(2).replace('.', ''));
      }
      
      document.getElementById('item-feedback').hidden = true;
      updatePreview();

      modal.hidden = false;
      document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
      modal.hidden = true;
      document.body.style.overflow = '';
    };

    modal.querySelectorAll('[data-close-item]').forEach(el => {
      el.addEventListener('click', closeModal);
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      let name = state.currentType === 'produto' ? inputSearch.value.trim() : inputProductManual.value.trim();
      
      if (state.currentType === 'produto' && state.selectedProduct) {
        name = state.selectedProduct.name;
      }

      const qty = Math.min(parseFloat(inputQty.value), 999999);
      const price = parseMoney(inputPrice.value);
      const isPercent = radioDiscP.checked;
      const discountRaw = parseMoney(inputDiscount.value);
      const unit = inputUnit.value;

      if (!name) {
        document.getElementById('item-feedback').textContent = 'Informe a descrição do produto.';
        document.getElementById('item-feedback').hidden = false;
        return;
      }

      if (qty <= 0 || price < 0) {
        document.getElementById('item-feedback').textContent = 'Valores inválidos. Verifique quantidade e preço.';
        document.getElementById('item-feedback').hidden = false;
        return;
      }

      const subtotal = qty * price;
      
      let discountAmount = 0;
      if (isPercent) {
        discountAmount = subtotal * (discountRaw / 100);
      } else {
        discountAmount = discountRaw;
      }
      if (discountAmount > subtotal) discountAmount = subtotal;

      const total = Math.max(0, subtotal - discountAmount);
      
      // CORREÇÃO CRÍTICA: Salva o productId para alimentar o estoque depois
      const newItem = { 
        name, 
        type: state.currentType === 'produto' ? 'Produto' : 'Item avulso',
        productId: state.selectedProduct ? state.selectedProduct.id : null,
        code: state.selectedProduct ? state.selectedProduct.code : '',
        qty, 
        price, 
        discountType: isPercent ? '%' : 'R$',      
        discountRaw,       
        discount: discountAmount, 
        unit, 
        total 
      };

      if (state.editingIndex >= 0) {
        state.items[state.editingIndex] = newItem;
      } else {
        state.items.push(newItem);
      }

      renderTable();
      closeModal(); 
    });

    inputQty.addEventListener('input', updatePreview);

    function renderTable() {
      const container = document.getElementById('cmp-items-body');
      container.innerHTML = '';

      const countBadge = document.getElementById('items-count-badge');
      if (countBadge) {
        countBadge.textContent = `${state.items.length} ${state.items.length === 1 ? 'item' : 'itens'}`;
      }

      if (state.items.length === 0) {
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted); font-size: 14px;">Nenhum item adicionado. Clique em "+ Adicionar item".</div>';
        return;
      }

      state.items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'cmp-items-card__row';
        
        const itemCodeStr = item.code ? `Código: ${item.code} · ` : '';
        
        let discountStr = '';
        if (item.discount > 0) {
          if (item.discountType === '%') {
            discountStr = ` · Desc: ${item.discountRaw}% (-${formatMoney(item.discount)})`;
          } else {
            discountStr = ` · Desc: -${formatMoney(item.discount)}`;
          }
        }

        row.innerHTML = `
          <div class="cmp-items-card__info">
            <div style="display:flex; align-items:center; gap:12px;">
              <h4 class="cmp-items-card__item-title">${escapeHtml(item.name)}</h4>
              <span class="badge badge--type">${escapeHtml(item.type)}</span>
            </div>
            <span class="cmp-items-card__item-details">${itemCodeStr}Unidade: ${escapeHtml(item.unit)}${discountStr}</span>
          </div>
          
          <div style="display:flex; align-items:center;">
            <div class="cmp-items-card__math">
              <span class="cmp-items-card__calc">${item.qty} × ${formatMoney(item.price)}</span>
              <span class="cmp-items-card__price">${formatMoney(item.total)}</span>
            </div>
            <button type="button" class="cmp-items-card__delete" title="Remover item" aria-label="Remover item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M6 6l12 12M18 6 6 18"/></svg>
            </button>
          </div>
        `;

        row.addEventListener('click', (e) => {
          if (e.target.closest('.cmp-items-card__delete')) return; 
          openEditModal(index);
        });

        row.querySelector('.cmp-items-card__delete').addEventListener('click', (e) => {
          e.stopPropagation();
          state.items.splice(index, 1);
          renderTable();
        });

        container.appendChild(row);
      });
    }
    
    window.CompraItemsAPI = {
      setItems: function(newItems) {
        state.items = newItems.map(it => {
          const qty = Number(it.quantity) || 1;
          const price = (Number(it.unit_price_cents) || 0) / 100;
          const discount = (Number(it.discount_cents) || 0) / 100;
          return {
            name: it.description || 'Item',
            type: it.product_id ? 'Produto' : 'Item avulso',
            productId: it.product_id || null,
            code: it.code || '',
            qty: qty,
            price: price,
            discountType: 'R$', 
            discountRaw: discount,
            discount: discount,
            unit: it.unit || 'UN',
            total: (Number(it.total_cents) || 0) / 100
          };
        });
        renderTable();
      },
      getItems: function() { 
        return state.items; 
      }
    };
  }
})();