/* =========================================================
   DEV HUB · DRE · data
   Chama as RPCs dre_monthly e dre_ytd (com filtro de CC)
   + evolução via view.
   ========================================================= */
(function () {
  'use strict';
  const DRE = window.DRE;
  const state = DRE.state;

  DRE.load = async function () {
    if (state.loading) return;
    state.loading = true;
    DRE.showLoading(true);

    try {
      // Garante que temos a org resolvida
      if (!state.orgId) {
        console.warn('[DRE] state.orgId não definido — abortando load.');
        DRE.showLoading(false);
        state.loading = false;
        return;
      }

      const orgId  = state.orgId;
      const ccId   = state.costCenterId || null;

      // Mês atual e mês anterior
      const curStart  = DRE.toISODate(state.currentMonth);
      const curEnd    = DRE.toISODate(
        new Date(state.currentMonth.getFullYear(),
                 state.currentMonth.getMonth() + 1, 0)
      );
      const prevStart = DRE.toISODate(state.compareMonth);
      const prevEnd   = DRE.toISODate(
        new Date(state.compareMonth.getFullYear(),
                 state.compareMonth.getMonth() + 1, 0)
      );
      const year = state.currentMonth.getFullYear();

      const [curRes, prevRes, ytdRes, evoRes] = await Promise.all([
        window.db.rpc('dre_monthly', {
          p_org_id: orgId,
          p_start: curStart,
          p_end: curEnd,
          p_cost_center_id: ccId
        }),
        window.db.rpc('dre_monthly', {
          p_org_id: orgId,
          p_start: prevStart,
          p_end: prevEnd,
          p_cost_center_id: ccId
        }),
        window.db.rpc('dre_ytd', {
          p_org_id: orgId,
          p_year: year,
          p_cost_center_id: ccId
        }),
        // Evolução sempre sem filtro de CC (últimos 12 meses)
        window.db.from('v_dre_evolution').select('*').limit(12)
      ]);

      if (curRes.error)  throw curRes.error;
      if (prevRes.error) throw prevRes.error;
      if (ytdRes.error)  throw ytdRes.error;

      state.current  = (curRes.data  && curRes.data[0])  || null;
      state.previous = (prevRes.data && prevRes.data[0]) || null;
      state.ytd      = (ytdRes.data  && ytdRes.data[0])  || null;
      state.evolution = (evoRes.data || []).slice().reverse();

      DRE.renderTable();
      DRE.renderChart();
    } catch (err) {
      console.error('[DRE] Falha ao carregar:', err);
      DRE.showGlobalAlert('Não foi possível carregar a DRE. ' + DRE.friendlyError(err), 'error');
      DRE.toast('Não foi possível carregar a DRE.', 'error');
    } finally {
      state.loading = false;
      DRE.showLoading(false);
    }
  };
})();