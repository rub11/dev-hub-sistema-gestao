/* =========================================================
   DEV HUB · Compras · nova
   ========================================================= */

(function () {
  'use strict';

  const {
    $, escapeHTML, fmtBRL, todayISO, parseBRLToCents,
    val, setVal, toast,
    STATUS_LABEL,
    API, initSupplierInline
  } = window.Cmp;

  async function pageComprasNova() {
    const form = $('#cmp-form');
    if (!form) return;

    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('id');
    const isEdit = !!editId;

    let currentStatus = 'rascunho';
    let subtotalCents = 0;
    let discountCents = 0;
    let shippingCents = 0;
    let shippingType = 'none';
    let otherCents = 0;

    const elSubtotal = $('#cmp-subtotal');
    const elTotal = $('#cmp-total');
    const elShippingDisplay = $('#cmp-shipping-display');
    const elDiscountDisplay = $('#cmp-discount-display');

    function parseValueToCents(v) {
      if (v === null || v === undefined) return 0;
      if (typeof v === 'number') return Math.round(v * 100);
      let str = String(v).replace(/[^\d,.-]/g, '');
      if (str.includes(',')) str = str.replace(/\./g, '').replace(',', '.');
      return Math.round(parseFloat(str || 0) * 100);
    }

    function updateTotalsUI() {
      const currentItems = window.CompraItemsAPI && typeof window.CompraItemsAPI.getItems === 'function' 
        ? window.CompraItemsAPI.getItems() : [];

      subtotalCents = currentItems.reduce((acc, it) => {
        const qty = Number(it.qty || it.quantity) || 0;
        const priceCents = parseValueToCents(it.price || it.unit_price);
        const itemDiscCents = parseValueToCents(it.discount);
        return acc + Math.max(0, (qty * priceCents) - itemDiscCents);
      }, 0);

      let count = currentItems.length;
      const itemsContainer = document.getElementById('cmp-items-body');
      if (subtotalCents === 0 && itemsContainer && itemsContainer.children.length > 0) {
        let domTotal = 0;
        itemsContainer.querySelectorAll('.cmp-items-card__price').forEach(el => {
          domTotal += parseValueToCents(el.textContent);
        });
        subtotalCents = domTotal;
        count = itemsContainer.children.length;
      }

      if (discountCents > subtotalCents) discountCents = subtotalCents;
      if (discountCents < 0) discountCents = 0;
      if (shippingCents < 0) shippingCents = 0;

      const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents + otherCents);

      if (elSubtotal) elSubtotal.textContent = fmtBRL(subtotalCents);
      if (elTotal) elTotal.textContent = fmtBRL(totalCents);

      const countText = count === 1 ? '1 item' : `${count} itens`;
      if (document.getElementById('items-count-badge')) document.getElementById('items-count-badge').textContent = countText;
      if (document.getElementById('items-footer-count')) document.getElementById('items-footer-count').textContent = countText;
      if (document.getElementById('items-header-total')) document.getElementById('items-header-total').textContent = fmtBRL(subtotalCents);
      if (document.getElementById('items-footer-subtotal')) document.getElementById('items-footer-subtotal').textContent = fmtBRL(subtotalCents);
      
      const footerShipping = document.getElementById('items-footer-shipping');
      if (footerShipping) {
        if (shippingType === 'none') footerShipping.textContent = 'Não informado';
        else if (shippingType === 'free') footerShipping.textContent = 'Grátis';
        else footerShipping.textContent = fmtBRL(shippingCents);
      }

      if (document.getElementById('items-footer-grand-total')) document.getElementById('items-footer-grand-total').textContent = fmtBRL(totalCents);

      if (elShippingDisplay) {
        if (shippingType === 'none') {
          elShippingDisplay.textContent = 'Não informado';
          elShippingDisplay.className = 'cmp-values-value is-empty';
        } else if (shippingType === 'free') {
          elShippingDisplay.textContent = 'Grátis';
          elShippingDisplay.className = 'cmp-values-value is-free';
        } else {
          elShippingDisplay.textContent = fmtBRL(shippingCents);
          elShippingDisplay.className = 'cmp-values-value cmp-values-value--action';
        }
      }

      if (elDiscountDisplay) {
        if (discountCents === 0) {
          elDiscountDisplay.textContent = 'Adicionar desconto';
          elDiscountDisplay.className = 'cmp-values-value is-empty';
        } else {
          elDiscountDisplay.textContent = `- ${fmtBRL(discountCents)}`;
          elDiscountDisplay.className = 'cmp-values-value cmp-values-value--action cmp-values-value--discount';
        }
      }
    }

    updateTotalsUI();

    const itemsContainerObs = document.getElementById('cmp-items-body');
    if (itemsContainerObs) {
      const observer = new MutationObserver(() => { setTimeout(updateTotalsUI, 50); });
      observer.observe(itemsContainerObs, { childList: true, subtree: true, characterData: true });
    }

    document.addEventListener('submit', (e) => {
      if (e.target && e.target.id === 'item-form') {
        setTimeout(() => {
          const itemModal = document.getElementById('item-modal');
          if (itemModal && !itemModal.hidden) itemModal.hidden = true;
          updateTotalsUI();
        }, 100);
      }
    });

    const itemSaveBtn = document.getElementById('item-save-btn');
    if (itemSaveBtn) {
      itemSaveBtn.addEventListener('click', () => {
        setTimeout(() => {
          const itemModal = document.getElementById('item-modal');
          if (itemModal && !itemModal.hidden) itemModal.hidden = true;
          updateTotalsUI();
        }, 150);
      });
    }

    if (!isEdit) {
      try {
        const code = await API.nextPurchaseCode();
        setVal('#cmp-code', code);
      } catch (e) { /* ignora */ }
    }

    const dateInput = document.getElementById('cmp-date');
    if (dateInput && !dateInput.value && !isEdit) dateInput.value = todayISO();

    const supplierSel = $('#cmp-supplier');
    if (supplierSel) {
      try {
        const list = await API.listSuppliers();
        supplierSel.innerHTML = '<option value="">— Selecione —</option>' +
          list.map((s) => `<option value="${s.id}" data-doc="${escapeHTML(s.doc || '')}">${escapeHTML(s.name)}</option>`).join('');
      } catch (e) {
        console.error(e);
        supplierSel.innerHTML = '<option value="">Erro ao carregar fornecedores</option>';
      }
      initSupplierInline(supplierSel);
    }

    const modeRadios = document.querySelectorAll('input[name="save-mode"]');
    const modeHidden = document.getElementById('cmp-save-mode');
    if (modeRadios.length && modeHidden) {
      const initial = document.querySelector('input[name="save-mode"]:checked');
      if (initial) modeHidden.value = initial.value;
      modeRadios.forEach((r) => {
        r.addEventListener('change', () => { if (r.checked) modeHidden.value = r.value; });
      });
    }

    const shipModal = $('#shipping-modal');
    const shipInput = $('#shipping-input');
    const shipRadios = document.querySelectorAll('input[name="shipping-type"]');
    const wrapperShipValue = $('#shipping-value-wrapper');

    if ($('#btn-open-shipping')) {
      $('#btn-open-shipping').addEventListener('click', () => {
        if (shippingType === 'paid') {
          document.querySelector('input[name="shipping-type"][value="paid"]').checked = true;
          shipInput.value = (shippingCents / 100).toFixed(2).replace('.', ',');
          wrapperShipValue.hidden = false;
        } else if (shippingType === 'free') {
          document.querySelector('input[name="shipping-type"][value="free"]').checked = true;
          shipInput.value = '';
          wrapperShipValue.hidden = true;
        } else {
          document.querySelector('input[name="shipping-type"][value="none"]').checked = true;
          shipInput.value = '';
          wrapperShipValue.hidden = true;
        }
        shipModal.hidden = false;
      });
    }

    shipRadios.forEach(r => r.addEventListener('change', (e) => {
      const isPaid = e.target.value === 'paid';
      wrapperShipValue.hidden = !isPaid;
      if (!isPaid) shipInput.value = '';
    }));

    document.querySelectorAll('[data-close-shipping]').forEach(el => {
      el.addEventListener('click', () => { shipModal.hidden = true; });
    });

    if ($('#btn-apply-shipping')) {
      $('#btn-apply-shipping').addEventListener('click', () => {
        const isPaid = document.querySelector('input[name="shipping-type"][value="paid"]').checked;
        const isFree = document.querySelector('input[name="shipping-type"][value="free"]').checked;
        
        if (isPaid) {
          shippingType = 'paid';
          let valCents = parseBRLToCents(shipInput.value);
          if (valCents < 0) valCents = 0;
          shippingCents = valCents;
        } else if (isFree) {
          shippingType = 'free';
          shippingCents = 0;
        } else {
          shippingType = 'none';
          shippingCents = 0;
        }
        updateTotalsUI();
        shipModal.hidden = true;
      });
    }

    const discModal = $('#discount-modal');
    const discInput = $('#discount-input');
    const btnRemoveDisc = $('#btn-remove-discount');
    const elDiscModalSub = $('#disc-modal-subtotal');
    const elDiscModalDisc = $('#disc-modal-discount');
    const elDiscModalTotal = $('#disc-modal-total');

    function updateDiscountPreview() {
      const valCents = parseBRLToCents(discInput.value);
      const previewDisc = Math.min(valCents, subtotalCents);
      const previewTotal = Math.max(0, subtotalCents - previewDisc + shippingCents + otherCents);

      if (elDiscModalSub) elDiscModalSub.textContent = fmtBRL(subtotalCents);
      if (elDiscModalDisc) elDiscModalDisc.textContent = `- ${fmtBRL(previewDisc)}`;
      if (elDiscModalTotal) elDiscModalTotal.textContent = fmtBRL(previewTotal);
      
      if (btnRemoveDisc) btnRemoveDisc.style.display = (valCents > 0 || discountCents > 0) ? 'inline-flex' : 'none';
    }

    if ($('#btn-open-discount')) {
      $('#btn-open-discount').addEventListener('click', () => {
        discInput.value = discountCents > 0 ? (discountCents / 100).toFixed(2).replace('.', ',') : '';
        updateDiscountPreview();
        discModal.hidden = false;
      });
    }

    if (discInput) discInput.addEventListener('input', updateDiscountPreview);

    document.querySelectorAll('[data-close-discount]').forEach(el => {
      el.addEventListener('click', () => { discModal.hidden = true; });
    });

    if (btnRemoveDisc) {
      btnRemoveDisc.addEventListener('click', () => {
        discountCents = 0;
        discInput.value = '';
        updateTotalsUI();
        discModal.hidden = true;
      });
    }

    if ($('#btn-apply-discount')) {
      $('#btn-apply-discount').addEventListener('click', () => {
        let valCents = parseBRLToCents(discInput.value);
        if (valCents < 0) valCents = 0;
        if (valCents > subtotalCents) valCents = subtotalCents;
        discountCents = valCents;
        updateTotalsUI();
        discModal.hidden = true;
      });
    }

    if (isEdit) {
      try {
        const { purchase, items: existingItems } = await API.getPurchase(editId);
        currentStatus = purchase.status || 'rascunho';

        setVal('#cmp-code', purchase.code || '');
        setVal('#cmp-date', purchase.purchase_date || todayISO());
        setVal('#cmp-expected', purchase.expected_date || '');
        setVal('#cmp-supplier-name-manual', purchase.supplier_name || '');
        setVal('#cmp-supplier-doc', purchase.supplier_doc || '');
        setVal('#cmp-supplier-contact', purchase.supplier_contact || '');
        setVal('#cmp-payment-method', purchase.payment_method || '');
        setVal('#cmp-payment-terms',  purchase.payment_terms  || '');
        setVal('#cmp-installments',   purchase.installments   || 1);
        setVal('#cmp-first-due',      purchase.first_due_date || '');
        setVal('#cmp-notes',          purchase.notes          || '');
        setVal('#cmp-invoice',        purchase.invoice_number || '');

        discountCents = purchase.discount_cents || 0;
        shippingCents = purchase.shipping_cents || 0;
        otherCents = purchase.other_cents || 0;
        
        if (shippingCents > 0) shippingType = 'paid';
        else shippingType = 'none';

        if (purchase.supplier_id && supplierSel) supplierSel.value = purchase.supplier_id;

        if (window.CompraItemsAPI) {
          window.CompraItemsAPI.setItems(existingItems || []);
        }
        
        setTimeout(updateTotalsUI, 100);
        updateTotalsUI();

        const titleEl = document.querySelector('.page-head__title');
        if (titleEl) titleEl.textContent = 'Editar compra';
        const submitBtn = $('#cmp-submit');
        if (submitBtn) {
          const label = submitBtn.querySelector('span');
          if (label) label.textContent = 'Salvar alterações';
          else submitBtn.textContent = 'Salvar alterações';
        }

        if (purchase.status === 'pendente_recebimento') {
          const r = document.querySelector('input[name="save-mode"][value="pendente_recebimento"]');
          if (r) { r.checked = true; if (modeHidden) modeHidden.value = 'pendente_recebimento'; }
        } else {
          const r = document.querySelector('input[name="save-mode"][value="rascunho"]');
          if (r) { r.checked = true; if (modeHidden) modeHidden.value = 'rascunho'; }
        }

        const editableStatus = ['rascunho', 'pendente_recebimento', 'aguardando_aprovacao'];
        if (!editableStatus.includes(purchase.status)) {
          toast('Esta compra não pode mais ser editada (status: ' + (STATUS_LABEL[purchase.status] || purchase.status) + ').', 'error');
          if (submitBtn) {
            submitBtn.disabled = true;
            const label = submitBtn.querySelector('span');
            if (label) label.textContent = 'Edição bloqueada';
          }
        }
      } catch (e) {
        console.error('Erro ao carregar compra para edição:', e);
        toast('Não foi possível carregar a compra.', 'error');
      }
    }

    function resolveTargetStatus() {
      const chosen = val('#cmp-save-mode') || 'rascunho';
      if (!isEdit) return chosen;
      if (currentStatus === 'rascunho') {
        if (chosen === 'pendente_recebimento') return 'pendente_recebimento';
        return 'rascunho';
      }
      return currentStatus;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#cmp-submit');
      if (btn) {
        btn.disabled = true;
        const label = btn.querySelector('span');
        if (label) label.textContent = 'Salvando...';
      }

      try {
        const supplierId = supplierSel ? (supplierSel.value || null) : null;
        const supplierName = supplierSel && supplierSel.selectedOptions[0] && supplierSel.value
          ? supplierSel.selectedOptions[0].textContent
          : (val('#cmp-supplier-name-manual') || '');

        if (!supplierId && !supplierName) throw new Error('Selecione um fornecedor.');

        const currentItems = window.CompraItemsAPI ? window.CompraItemsAPI.getItems() : [];
        if (!currentItems.length) throw new Error('Adicione pelo menos 1 item.');

        updateTotalsUI();

        const itemsPayload = currentItems.map((it) => {
          const qty = Number(it.qty || it.quantity) || 0;
          const priceCents = parseValueToCents(it.price || it.unit_price);
          const itemDiscCents = parseValueToCents(it.discount);
          const totalCents = Math.max(0, (qty * priceCents) - itemDiscCents);
          
          return {
            // AQUI ESTÁ A CORREÇÃO: Envia o ID verdadeiro ou nulo
            product_id: it.productId || null,
            description: it.name || 'Item',
            unit: it.unit || 'un',
            quantity: qty,
            unit_price_cents: priceCents,
            discount_cents: itemDiscCents,
            total_cents: totalCents
          };
        });

        const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents + otherCents);
        const totals = { subtotal: subtotalCents, disc: discountCents, ship: shippingCents, other: otherCents, total: totalCents };
        const targetStatus = resolveTargetStatus();
        const purchaseDate = (val('#cmp-date') || '').trim() || todayISO();
        const expectedDate = (val('#cmp-expected') || '').trim() || null;
        const firstDue     = (val('#cmp-first-due') || '').trim() || null;

        const basePayload = {
          status:           targetStatus,
          supplier_id:      supplierId,
          supplier_name:    supplierName,
          supplier_doc:     (val('#cmp-supplier-doc') || '').trim() || null,
          supplier_contact: (val('#cmp-supplier-contact') || '').trim() || null,
          subtotal_cents:   totals.subtotal,
          discount_cents:   totals.disc,
          shipping_cents:   totals.ship,
          other_cents:      totals.other,
          total_cents:      totals.total,
          payment_method:   val('#cmp-payment-method') || null,
          payment_terms:    val('#cmp-payment-terms') || null,
          installments:     Number(val('#cmp-installments')) || 1,
          first_due_date:   firstDue,
          purchase_date:    purchaseDate,
          expected_date:    expectedDate,
          notes:            (val('#cmp-notes') || '').trim() || null,
          invoice_number:   (val('#cmp-invoice') || '').trim() || null
        };

        if (isEdit) {
          await API.updatePurchase(editId, basePayload);
          await API.updatePurchaseItems(editId, itemsPayload);
          if (currentStatus !== targetStatus) {
            toast(`Compra atualizada para "${STATUS_LABEL[targetStatus] || targetStatus}". Gestor notificado.`);
          } else {
            toast('Compra atualizada. Gestor notificado.');
          }
        } else {
          await API.createPurchase({
            ...basePayload,
            code: (val('#cmp-code') || '').trim() || ('COMP-' + Date.now()),
            items: itemsPayload
          });
          toast('Compra salva com sucesso.');
        }

        setTimeout(() => { window.location.href = 'compras.html'; }, 800);
      } catch (err) {
        console.error(err);
        toast('Erro ao salvar: ' + err.message, 'error');
        if (btn) {
          btn.disabled = false;
          const label = btn.querySelector('span');
          if (label) label.textContent = isEdit ? 'Salvar alterações' : 'Salvar compra';
        }
      }
    });
  }

  window.Cmp.pageComprasNova = pageComprasNova;

})();