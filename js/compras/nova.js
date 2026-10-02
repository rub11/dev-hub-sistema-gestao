/* =========================================================
   DEV HUB · Compras · nova
   ---------------------------------------------------------
   Página compras-nova.html — criar/editar compra.
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

    /* ---------- Código sequencial (só em criação) ---------- */
    if (!isEdit) {
      try {
        const code = await API.nextPurchaseCode();
        setVal('#cmp-code', code);
      } catch (e) { /* ignora */ }
    }

    /* ---------- Data default ---------- */
    const dateInput = document.getElementById('cmp-date');
    if (dateInput && !dateInput.value && !isEdit) dateInput.value = todayISO();

    /* ---------- Fornecedores ---------- */
    const supplierSel = $('#cmp-supplier');
    if (supplierSel) {
      try {
        const list = await API.listSuppliers();
        supplierSel.innerHTML = '<option value="">— Selecione —</option>' +
          list.map((s) =>
            `<option value="${s.id}" data-doc="${escapeHTML(s.doc || '')}">${escapeHTML(s.name)}</option>`
          ).join('');
      } catch (e) {
        console.error(e);
        supplierSel.innerHTML = '<option value="">Erro ao carregar fornecedores</option>';
      }
      initSupplierInline(supplierSel);
    }

    /* ---------- Itens ---------- */
    const itemsWrap = $('#cmp-items-body');
    const products = await API.listProducts().catch(() => []);
    let items = [{ description: '', unit: 'un', quantity: 1, unit_price_cents: 0, discount_cents: 0 }];

    function recalcTotals() {
      let subtotal = 0;
      items.forEach((it, i) => {
        const line = (Number(it.quantity) || 0) * (Number(it.unit_price_cents) || 0)
                   - (Number(it.discount_cents) || 0);
        it.total_cents = Math.max(0, Math.round(line));
        subtotal += it.total_cents;
        const el = document.querySelector(`[data-line-total="${i}"]`);
        if (el) el.textContent = fmtBRL(it.total_cents);
      });
      const disc  = parseBRLToCents(val('#cmp-discount'));
      const ship  = parseBRLToCents(val('#cmp-shipping'));
      const other = parseBRLToCents(val('#cmp-other'));
      const total = Math.max(0, subtotal - disc + ship + other);

      const subEl   = $('#cmp-subtotal');
      const totalEl = $('#cmp-total');
      if (subEl)   subEl.textContent   = fmtBRL(subtotal);
      if (totalEl) totalEl.textContent = fmtBRL(total);

      return { subtotal, disc, ship, other, total };
    }

    function renderItems() {
      if (!itemsWrap) return;
      itemsWrap.innerHTML = items.map((it, i) => `
        <div class="cmp-items__row" data-row="${i}">
          <select data-field="product_id" data-idx="${i}">
            <option value="">Item avulso (digite abaixo)</option>
            ${products.map((p) => `
              <option value="${p.id}" ${it.product_id === p.id ? 'selected' : ''}>${escapeHTML(p.name)}</option>
            `).join('')}
          </select>
          <input type="number" min="0" step="0.001" data-field="quantity" data-idx="${i}" value="${it.quantity}" placeholder="Qtd" />
          <input type="text" data-field="unit" data-idx="${i}" value="${escapeHTML(it.unit || 'un')}" placeholder="un" />
          <input type="text" data-field="unit_price" data-idx="${i}" value="${(it.unit_price_cents / 100).toFixed(2).replace('.', ',')}" placeholder="0,00" />
          <input type="text" data-field="discount" data-idx="${i}" value="${(it.discount_cents / 100).toFixed(2).replace('.', ',')}" placeholder="0,00" />
          <div class="cmp-items__total" data-line-total="${i}">R$ 0,00</div>
          <button type="button" class="cmp-items__remove" data-action="remove" data-idx="${i}" title="Remover linha" aria-label="Remover linha">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      `).join('');

      itemsWrap.querySelectorAll('[data-field]').forEach((el) => {
        el.addEventListener('input', (e) => {
          const idx   = Number(e.target.dataset.idx);
          const field = e.target.dataset.field;
          if (field === 'quantity')        items[idx].quantity = Number(e.target.value) || 0;
          else if (field === 'unit')       items[idx].unit = e.target.value;
          else if (field === 'unit_price') items[idx].unit_price_cents = parseBRLToCents(e.target.value);
          else if (field === 'discount')   items[idx].discount_cents = parseBRLToCents(e.target.value);
          else if (field === 'product_id') {
            items[idx].product_id = e.target.value || null;
            const p = products.find((x) => x.id === e.target.value);
            if (p) {
              items[idx].description = p.name;
              if (!items[idx].unit_price_cents) {
                items[idx].unit_price_cents = Math.round((p.price || 0) * 100);
                const inp = itemsWrap.querySelector(`[data-field="unit_price"][data-idx="${idx}"]`);
                if (inp) inp.value = (p.price || 0).toFixed(2).replace('.', ',');
              }
            }
          }
          recalcTotals();
        });
      });

      itemsWrap.querySelectorAll('[data-action="remove"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.idx);
          if (items.length === 1) { toast('Precisa ter pelo menos 1 item.', 'error'); return; }
          items.splice(idx, 1);
          renderItems();
          recalcTotals();
        });
      });
    }

    const addBtn = $('#cmp-add-item');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        items.push({ description: '', unit: 'un', quantity: 1, unit_price_cents: 0, discount_cents: 0 });
        renderItems();
        recalcTotals();
      });
    }

    ['cmp-discount', 'cmp-shipping', 'cmp-other'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', recalcTotals);
    });

    renderItems();
    recalcTotals();

    if (supplierSel) {
      supplierSel.addEventListener('change', () => {
        const opt = supplierSel.selectedOptions[0];
        setVal('#cmp-supplier-doc', opt ? (opt.dataset.doc || '') : '');
      });
    }

    /* ---------- Sync radios de modo ---------- */
    const modeRadios = document.querySelectorAll('input[name="save-mode"]');
    const modeHidden = document.getElementById('cmp-save-mode');
    if (modeRadios.length && modeHidden) {
      const initial = document.querySelector('input[name="save-mode"]:checked');
      if (initial) modeHidden.value = initial.value;
      modeRadios.forEach((r) => {
        r.addEventListener('change', () => {
          if (r.checked) modeHidden.value = r.value;
        });
      });
    }

    /* ---------- Modo edição ---------- */
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
        setVal('#cmp-discount', ((purchase.discount_cents || 0) / 100).toFixed(2).replace('.', ','));
        setVal('#cmp-shipping', ((purchase.shipping_cents || 0) / 100).toFixed(2).replace('.', ','));
        setVal('#cmp-other',    ((purchase.other_cents    || 0) / 100).toFixed(2).replace('.', ','));
        setVal('#cmp-payment-method', purchase.payment_method || '');
        setVal('#cmp-payment-terms',  purchase.payment_terms  || '');
        setVal('#cmp-installments',   purchase.installments   || 1);
        setVal('#cmp-first-due',      purchase.first_due_date || '');
        setVal('#cmp-notes',          purchase.notes          || '');
        setVal('#cmp-invoice',        purchase.invoice_number || '');

        if (purchase.supplier_id && supplierSel) supplierSel.value = purchase.supplier_id;

        items = existingItems.map((it) => ({
          product_id:       it.product_id || null,
          description:      it.description,
          unit:             it.unit || 'un',
          quantity:         Number(it.quantity),
          unit_price_cents: Number(it.unit_price_cents),
          discount_cents:   Number(it.discount_cents),
          total_cents:      Number(it.total_cents)
        }));
        if (!items.length) items = [{ description: '', unit: 'un', quantity: 1, unit_price_cents: 0, discount_cents: 0 }];
        renderItems();
        recalcTotals();

        const titleEl = document.querySelector('.cmp-page-head__title');
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

    /* ---------- Status alvo ---------- */
    function resolveTargetStatus() {
      const chosen = val('#cmp-save-mode') || 'rascunho';
      if (!isEdit) return chosen;
      if (currentStatus === 'rascunho') {
        if (chosen === 'pendente_recebimento') return 'pendente_recebimento';
        return 'rascunho';
      }
      return currentStatus;
    }

    /* ---------- Submit ---------- */
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

        const validItems = items.filter((it) => it.quantity > 0 && (it.description || it.product_id));
        if (!validItems.length) throw new Error('Adicione pelo menos 1 item com quantidade e descrição.');

        const totals = recalcTotals();
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

        const itemsPayload = validItems.map((it) => ({
          product_id:       it.product_id,
          description:      it.description || (products.find((p) => p.id === it.product_id) || {}).name || 'Item',
          unit:             it.unit || 'un',
          quantity:         it.quantity,
          unit_price_cents: it.unit_price_cents,
          discount_cents:   it.discount_cents,
          total_cents:      it.total_cents
        }));

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