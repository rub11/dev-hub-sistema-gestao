/* =========================================================
   DEV HUB · DRE · filters
   Filtro de centro de custo com fallback de organização.
   ========================================================= */
(function () {
  'use strict';
  const DRE = window.DRE;
  const state = DRE.state;

  DRE.setupFilters = function () {
    const select = document.getElementById('dre-cost-center');
    if (!select) return;
    select.addEventListener('change', () => {
      state.costCenterId = select.value || null;
      DRE.load();
    });
  };

  /* Resolve a org em cascata:
     1) get_user_organization_id() — se a org estiver ATIVA
     2) primeiro membership ativo do usuário (org ativa)
     3) primeira org ativa do sistema
  */
  async function resolveOrgId() {
    // 1) RPC padrão
    try {
      const { data: orgId } = await window.db.rpc('get_user_organization_id');
      if (orgId) {
        const { data: org } = await window.db
          .from('organizations')
          .select('id, active')
          .eq('id', orgId)
          .maybeSingle();

        if (org && org.active === true) return org.id;
        console.warn('[DRE] Org do usuário inativa, caindo pro fallback:', orgId);
      }
    } catch (e) { /* segue */ }

    // 2) Memberships ativos do usuário, filtrando por org ativa
    try {
      const { data: userData } = await window.db.auth.getUser();
      const userId = userData && userData.user ? userData.user.id : null;

      if (userId) {
        const { data: members } = await window.db
          .from('organization_members')
          .select('organization_id, organizations!inner(id, active, created_at)')
          .eq('user_id', userId)
          .eq('active', true);

        const activeMembers = (members || [])
          .filter(m => m.organizations && m.organizations.active === true)
          .sort((a, b) => {
            const da = a.organizations.created_at || '';
            const db = b.organizations.created_at || '';
            return da.localeCompare(db);
          });

        if (activeMembers.length > 0) {
          return activeMembers[0].organization_id;
        }
      }
    } catch (e) { /* segue */ }

    // 3) Primeira org ativa do sistema
    try {
      const { data: orgs } = await window.db
        .from('organizations')
        .select('id, created_at')
        .eq('active', true)
        .order('created_at', { ascending: true })
        .limit(1);

      if (orgs && orgs.length > 0) return orgs[0].id;
    } catch (e) { /* segue */ }

    return null;
  }

  DRE.loadCostCenters = async function () {
    const select = document.getElementById('dre-cost-center');
    if (!select) return;

    try {
      const orgId = await resolveOrgId();

      if (!orgId) {
        console.warn('[DRE] Não foi possível resolver a organização.');
        select.innerHTML = '<option value="">Nenhuma organização encontrada</option>';
        return;
      }

      state.orgId = orgId;
      console.log('[DRE] Org resolvida:', orgId);

      const { data, error } = await window.db
        .from('cost_centers')
        .select('id, code, name')
        .eq('organization_id', orgId)
        .eq('active', true)
        .order('code', { ascending: true });

      if (error) throw error;

      const current = select.value;
      select.innerHTML = '<option value="">Todos os centros de custo</option>';
      (data || []).forEach(cc => {
        const opt = document.createElement('option');
        opt.value = cc.id;
        opt.textContent = (cc.code ? cc.code + ' · ' : '') + cc.name;
        select.appendChild(opt);
      });
      select.value = current || '';

      console.log('[DRE] Centros carregados:', (data || []).length);
    } catch (err) {
      console.warn('[DRE] Falha ao carregar centros de custo:', err);
    }
  };
})();