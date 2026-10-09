/* =========================================================
   DEV HUB · Vendas · portal-vendas.js
   Carrega os contadores dos 2 cards do Portal de Vendas.
   ---------------------------------------------------------
   - Vendas → tabela `sales`
   - Orçamentos → tabela `quotes`
   ========================================================= */
(function () {
  'use strict';

  function setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  async function resolverOrgId(userId) {
    try {
      const profile = await window.Auth.getProfile(userId);
      if (profile) {
        const orgId = profile.organization_id
                   || profile.org_id
                   || profile.tenant_id
                   || profile.empresa_id;
        if (orgId) return orgId;
      }
    } catch (e) {}

    try {
      const { data } = await window.db
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .maybeSingle();
      if (data?.organization_id) return data.organization_id;
    } catch (e) {}

    return null;
  }

  async function carregarContadores() {
    if (!window.db || !window.Auth) return;

    const session = await window.Auth.requireSession().catch(() => null);
    if (!session) {
      console.warn('[portal-vendas] sem sessão');
      return;
    }

    const orgId = await resolverOrgId(session.user.id);
    if (!orgId) {
      console.warn('[portal-vendas] sem orgId');
      return;
    }

    /* ----- VENDAS (tabela `sales`) ----- */
    try {
      const { count, error } = await window.db
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);

      if (error) {
        console.warn('[portal-vendas] erro contando vendas:', error);
        setText('count-vendas', 0);
      } else {
        setText('count-vendas', count ?? 0);
      }
    } catch (e) {
      console.warn('[portal-vendas] exceção vendas:', e);
      setText('count-vendas', 0);
    }

    /* ----- ORÇAMENTOS (tabela `quotes`) ----- */
    try {
      const { count, error } = await window.db
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);

      if (error) {
        console.warn('[portal-vendas] erro contando orçamentos:', error);
        setText('count-orcamentos', 0);
      } else {
        setText('count-orcamentos', count ?? 0);
      }
    } catch (e) {
      console.warn('[portal-vendas] exceção orçamentos:', e);
      setText('count-orcamentos', 0);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', carregarContadores);
  } else {
    carregarContadores();
  }
})();