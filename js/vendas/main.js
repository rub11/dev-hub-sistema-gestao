(function () {
  'use strict';
  const DH = window.DH;
  const state = DH.state;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const Auth = window.Auth;
    if (!Auth || !Auth.isConfigured() || !window.db) {
      DH.ui.showGlobalAlert('Não foi possível conectar ao Supabase.', 'error');
      return;
    }

    /* Bindings */
    DH.session.setupUserMenu();
    DH.session.setupLogout();
    DH.list.setupSearch();
    DH.list.setupToolbar();
    DH.form.setupFormView();
    DH.form.setupSaleForm();
    DH.productSearch.setup();
    DH.stepper.setup();
    DH.modalDetail.setup();
    DH.modalAudit.setup();
    DH.modalPassword.setup();
    if (DH.customerModal)   DH.customerModal.setup();
    if (DH.modalApprovals)  DH.modalApprovals.setup();
    if (DH.quotes)          DH.quotes.setup();
    if (DH.draft)           DH.draft.init();

    /* Import de vendas históricas */
    if (window.ImportSales && typeof window.ImportSales.setup === 'function') {
      window.ImportSales.setup();
    }

    /* Sessão */
    const session = await Auth.requireSession();
    if (!session) return;
    DH.session.watchAuthChanges();

    const profile = await Auth.getProfile(session.user.id);
    DH.session.renderUser(session.user, profile);

    state.isPlatformAdmin = Boolean(profile && profile.is_platform_admin === true);

    /* Permissões */
    if (window.Perms && typeof window.Perms.load === 'function') {
      try { await window.Perms.load(); } catch (e) {}
    }
    state.perms.view    = DH.perms.has('sales.view',    true);
    state.perms.create  = DH.perms.has('sales.create',  true);
    state.perms.edit    = DH.perms.has('sales.edit',    true);
    state.perms.correct = DH.perms.has('sales.correct', false);
    state.perms.approve = DH.perms.has('sales.approve', false);

    if (state.isPlatformAdmin) {
      state.perms.view    = true;
      state.perms.create  = true;
      state.perms.edit    = true;
      state.perms.correct = true;
      state.perms.approve = true;
      state.perms.remove  = true;
    } else {
      state.perms.remove = false;
    }

    if (!state.perms.view) {
      window.location.replace('dashboard.html');
      return;
    }

    DH.perms.applyToUI();
    if (DH.modalApprovals) DH.modalApprovals.applyPermsToUI();

    /* 1. Restaura rascunho */
    let restored = false;
    if (DH.draft && typeof DH.draft.tryRestore === 'function') {
      try { restored = await DH.draft.tryRestore(); }
      catch (e) { console.error('[DEV HUB] draft.tryRestore falhou:', e); }
    }

    /* 2. Carrega listas */
    try {
      await DH.list.loadSales();
    } catch (e) {
      console.error('[DEV HUB] loadSales falhou:', e);
      DH.ui.showLoading(false);
    }
    if (DH.quotes) {
      try { await DH.quotes.loadQuotes(); } catch (e) {}
    }

    /* 3. Aba inicial */
    if (DH.quotes) DH.quotes.switchTab('sales');

    /* 4. Contador de aprovações */
    if (state.perms.approve && DH.modalApprovals) {
      try { await DH.modalApprovals.refreshCount(); } catch (e) {}
    }

    /* 5. Se restaurou rascunho, mostra form */
    if (restored) DH.form.showView('form');
  }
})();

/* =========================================================
   Scanner · ponte com o carrinho
   ========================================================= */
(function setupScannerHook() {
  function getCart() { return (window.DH && window.DH.state && window.DH.state.cart) || null; }
  function getUtils() { return (window.DH && window.DH.utils) || null; }

  window.addEventListener('scanner:probe', (e) => { e.preventDefault(); });

  window.addEventListener('scanner:item', (e) => {
    const detail = e.detail || {};
    const action = detail.action || 'add';
    const p = detail.product || {};
    const q = Math.max(1, Math.floor(Number(detail.quantity) || 1));

    const cart = getCart();
    const utils = getUtils();
    if (!cart) { console.warn('[scanner-hook] DH.state.cart indisponível'); return; }

    const productId = p.product_id || p.id;
    if (!productId) { console.warn('[scanner-hook] item sem product_id'); return; }

    const unitPrice = Number(p.unit_price != null ? p.unit_price : p.price) || 0;
    const stockAvail = Number(p.stock_available) || 0;
    const round2 = utils && utils.round2 ? utils.round2 : (n) => Math.round(n * 100) / 100;

    const idx = cart.findIndex((it) => it.product_id === productId);

    if (action === 'force') {
      if (idx !== -1) {
        cart[idx].quantity = q;
        cart[idx].subtotal = round2(cart[idx].quantity * cart[idx].unit_price);
        if (cart[idx].stock_available == null) cart[idx].stock_available = stockAvail;
      } else {
        cart.push({
          product_id: productId,
          product_name: p.product_name || p.name || '—',
          unit_price: unitPrice,
          quantity: q,
          subtotal: round2(unitPrice * q),
          stock_available: stockAvail
        });
      }
    } else if (action === 'remove') {
      if (idx === -1) return;
      const item = cart[idx];
      item.quantity -= q;
      if (item.quantity <= 0) {
        cart.splice(idx, 1);
      } else {
        item.subtotal = round2(item.quantity * item.unit_price);
      }
    } else {
      if (idx !== -1) {
        cart[idx].quantity += q;
        cart[idx].subtotal = round2(cart[idx].quantity * cart[idx].unit_price);
        if (cart[idx].stock_available == null) cart[idx].stock_available = stockAvail;
      } else {
        cart.push({
          product_id: productId,
          product_name: p.product_name || p.name || '—',
          unit_price: unitPrice,
          quantity: q,
          subtotal: round2(unitPrice * q),
          stock_available: stockAvail
        });
      }
    }

    if (window.DH && window.DH.cart) {
      try {
        window.DH.cart.render();
        window.DH.cart.recalc();
      } catch (err) {
        console.error('[scanner-hook] render/recalc:', err);
      }
    }
  });

  console.log('[scanner-hook] pronto');
})();