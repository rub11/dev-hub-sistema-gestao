/* =========================================================
   DEV HUB · Aprovacoes · api
   ---------------------------------------------------------
   Camada de dados — tudo que fala com o Supabase.
   ---------------------------------------------------------
   Depende de: state.js (window.Appr)
   Publica em: window.Appr
   ========================================================= */

(function () {
  'use strict';

  const { db, state } = window.Appr;

  /* =========================================================
     USUÁRIO ATUAL
     ========================================================= */
  async function loadCurrentUser() {
    try {
      const { data: u } = await db().auth.getUser();
      if (u && u.user) {
        const { data: prof } = await db().from('profiles')
          .select('id, name, email, is_platform_admin')
          .eq('id', u.user.id)
          .maybeSingle();
        state.currentUser = prof || { id: u.user.id, name: u.user.email };
        state.isPlatformAdmin = Boolean(prof && prof.is_platform_admin === true);
      }
    } catch (e) {
      console.warn('[aprovacoes] loadCurrentUser:', e);
    }
  }

  /* =========================================================
     COMPRAS PENDENTES
     ========================================================= */
  async function loadPending() {
    const { data, error } = await db().from('purchases')
      .select(`
        id, code, status, supplier_name, supplier_id, total_cents,
        purchase_date, expected_date, created_at, created_by_name,
        payment_method, invoice_number, notes
      `)
      .eq('status', 'aguardando_aprovacao')
      .order('created_at', { ascending: true })
      .limit(300);

    if (error) throw error;
    return data || [];
  }

  async function fetchItems(purchaseId) {
    const { data, error } = await db()
      .from('purchase_items')
      .select('*')
      .eq('purchase_id', purchaseId)
      .order('created_at');
    if (error) throw error;
    return data || [];
  }

  async function approvePurchase(purchaseId) {
    const { error } = await db().rpc('approve_purchase', {
      p_purchase_id: purchaseId
    });
    if (error) throw error;
  }

  async function rejectPurchase(purchaseId, reason) {
    const { error } = await db().rpc('reject_purchase', {
      p_purchase_id: purchaseId,
      p_reason: reason
    });
    if (error) throw error;
  }

  /* =========================================================
     VENDAS PENDENTES
     ========================================================= */
  async function loadPendingSales() {
    const { data, error } = await db().from('sales')
      .select(`
        id, sale_number, customer_id, subtotal, discount, total,
        payment_method, status, notes, created_at, created_by_name,
        requires_approval, corrected_from_id,
        customers (name)
      `)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: true })
      .limit(300);

    if (error) throw error;
    return data || [];
  }

  async function fetchSaleItems(saleId) {
    const { data, error } = await db()
      .from('sale_items')
      .select('id, product_id, product_name, quantity, unit_price, subtotal')
      .eq('sale_id', saleId)
      .order('created_at');
    if (error) throw error;
    return data || [];
  }

  async function approveSale(saleId, password) {
    const { error } = await db().rpc('approve_sale', {
      p_sale_id: saleId,
      p_password: password
    });
    if (error) throw error;
  }

  async function rejectSale(saleId, password, reason) {
    const { error } = await db().rpc('reject_sale', {
      p_sale_id: saleId,
      p_password: password,
      p_reason: reason
    });
    if (error) throw error;
  }

  /* =========================================================
     PUBLICA
     ========================================================= */
  Object.assign(window.Appr, {
    loadCurrentUser,
    loadPending,
    fetchItems,
    approvePurchase,
    rejectPurchase,
    loadPendingSales,
    fetchSaleItems,
    approveSale,
    rejectSale
  });

})();