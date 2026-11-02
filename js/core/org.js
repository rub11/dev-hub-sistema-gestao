/* =========================================================
   DEV HUB · Core · Organização ativa
   ---------------------------------------------------------
   Fonte única de verdade para o organization_id ativo.
   Carregue ANTES de qualquer módulo de negócio.

   Uso:
     const orgId = await Org.get();
     let q = window.db.from('sales').select('*');
     q = Org.withOrg(q, orgId);

   Publica em: window.Org
   ========================================================= */
(function () {
  'use strict';

  let cached = null;

  function readSessionStorage() {
    try {
      const raw =
        sessionStorage.getItem('devhub_user') ||
        localStorage.getItem('devhub_user');
      if (!raw) return null;
      const ctx = JSON.parse(raw);
      if (!ctx) return null;
      return ctx.organization_id || ctx.org_id || ctx.tenant_id || null;
    } catch (e) { return null; }
  }

  async function readProfile() {
    if (!window.db) return null;
    try {
      const { data: u } = await window.db.auth.getUser();
      if (!u || !u.user) return null;
      const { data: prof } = await window.db
        .from('profiles')
        .select('organization_id')
        .eq('id', u.user.id)
        .maybeSingle();
      return (prof && prof.organization_id) || null;
    } catch (e) { return null; }
  }

  async function readRpc() {
    if (!window.db) return null;
    try {
      const { data } = await window.db.rpc('get_user_organization_id');
      return data || null;
    } catch (e) { return null; }
  }

  async function get(force) {
    if (!force && cached) return cached;

    const fast = readSessionStorage();
    if (fast) { cached = fast; return cached; }

    const prof = await readProfile();
    if (prof) { cached = prof; return cached; }

    const rpc = await readRpc();
    if (rpc) { cached = rpc; return cached; }

    return null;
  }

  function reset() {
    cached = null;
  }

  function withOrg(query, orgId) {
    const id = orgId || cached;
    if (!id) {
      console.warn('[Org] withOrg sem organization_id — query seguirá SEM filtro.');
      return query;
    }
    return query.eq('organization_id', id);
  }

  /** Garante que o payload tem organization_id. */
  function attach(payload, orgId) {
    const id = orgId || cached;
    if (!id) return payload;
    return Object.assign({}, payload, { organization_id: id });
  }

  /** Bloqueia a tela se não houver org. Retorna bool. */
  async function require_(redirectHref) {
    const id = await get();
    if (!id) {
      console.error('[Org] Nenhuma organization_id encontrada — redirecionando.');
      if (window.Auth && typeof window.Auth.signOut === 'function') {
        window.Auth.signOut();
      } else {
        window.location.replace(redirectHref || 'index.html');
      }
      return null;
    }
    return id;
  }

  window.Org = {
    get,
    reset,
    withOrg,
    attach,
    require: require_,
    // expõe versões síncronas do cache para conveniência
    currentSync: function () { return cached || readSessionStorage(); }
  };
})();