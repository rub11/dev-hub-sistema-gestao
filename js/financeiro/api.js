/* =========================================================
   DEV HUB · Financeiro · api
   ---------------------------------------------------------
   Camada de dados: tudo que fala com o Supabase.
   + Resolve organization_id (sessionStorage / profiles)
   + Carrega user, contas, títulos, movimentações, transferências
   + Gera próximo código de título

   NÃO chama renderAll nem loadFilterOptions. Quem orquestra é
   o loadAll() (que permanece no financeiro.js por enquanto).

   Depende de: state.js (window.Fin)
   Publica em: window.Fin
   ========================================================= */

(function () {
  'use strict';

  const { db, state } = window.Fin;

  /* =========================================================
     ORGANIZAÇÃO
     ========================================================= */
  function resolveOrgIdSync() {
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (raw) {
        const ctx = JSON.parse(raw);
        if (ctx && ctx.organization_id) return ctx.organization_id;
      }
    } catch (e) { /* ignora */ }
    return null;
  }

  async function resolveOrgIdAsync() {
    const fast = resolveOrgIdSync();
    if (fast) return fast;
    try {
      const { data: u } = await db().auth.getUser();
      if (u && u.user) {
        const { data: prof } = await db().from('profiles')
          .select('organization_id').eq('id', u.user.id).maybeSingle();
        if (prof && prof.organization_id) return prof.organization_id;
      }
    } catch (e) { console.warn('[fin] resolveOrgIdAsync:', e); }
    return null;
  }

  /* =========================================================
     CARREGAMENTO · usuário
     ========================================================= */
  async function loadUser() {
    try {
      const { data: u } = await db().auth.getUser();
      if (u && u.user) {
        const { data: prof } = await db().from('profiles')
          .select('id, name, email').eq('id', u.user.id).maybeSingle();
        state.currentUser = prof || { id: u.user.id, name: u.user.email };
      }
    } catch (e) { console.warn(e); }
  }

  /* =========================================================
     CARREGAMENTO · contas
     ========================================================= */
  async function loadAccounts() {
    try {
      const { data, error } = await db().from('financial_accounts')
        .select('id, name, bank_name, account_type, current_balance_cents, active')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      state.accounts = data || [];
    } catch (e) { console.error(e); state.accounts = []; }
  }

  /* =========================================================
     CARREGAMENTO · títulos
     ========================================================= */
  async function loadEntries() {
    try {
      const { data, error } = await db().from('financial_entries')
        .select(`
          *,
          purchase:purchases!financial_entries_purchase_id_fkey (
            id, code, status
          )
        `)
        .order('due_date', { ascending: true })
        .limit(500);
      if (error) throw error;
      state.entries = data || [];
    } catch (e) {
      console.error('[fin] loadEntries (join):', e);
      try {
        const { data } = await db().from('financial_entries')
          .select('*')
          .order('due_date', { ascending: true })
          .limit(500);
        state.entries = data || [];
      } catch (_) {
        state.entries = [];
      }
    }
  }

  /* =========================================================
     CARREGAMENTO · movimentações
     ========================================================= */
  async function loadMovements() {
    try {
      const { data, error } = await db().from('financial_movements')
        .select(`id, account_id, type, amount_cents, movement_date,
                 description, origin_type, balance_after_cents, reconciled, created_at`)
        .order('movement_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      state.movements = data || [];
    } catch (e) { console.error(e); state.movements = []; }
  }

  /* =========================================================
     CARREGAMENTO · transferências
     ========================================================= */
  async function loadTransfers() {
    try {
      const { data, error } = await db().from('financial_transfers')
        .select('*')
        .order('transfer_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      state.transfers = data || [];
    } catch (e) { console.error(e); state.transfers = []; }
  }

  /* =========================================================
     GERAÇÃO · próximo código de título
     ========================================================= */
  async function getNextTitleCode() {
    try {
      const { data, error } = await db().rpc('next_title_code');
      if (error) throw error;
      return data || ('TIT-' + Date.now());
    } catch (e) {
      console.warn('[fin] next_title_code falhou:', e);
      return 'TIT-' + Date.now();
    }
  }

  /* =========================================================
     PUBLICA EM window.Fin
     ========================================================= */
  Object.assign(window.Fin, {
    resolveOrgIdSync,
    resolveOrgIdAsync,
    loadUser,
    loadAccounts,
    loadEntries,
    loadMovements,
    loadTransfers,
    getNextTitleCode
  });

})();