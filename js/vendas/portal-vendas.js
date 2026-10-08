/* =========================================================
   DEV HUB · Vendas · portal-vendas.js
   Carrega os contadores de cada card do Portal de Vendas.
   ========================================================= */
(function () {
  'use strict';

  function setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  async function carregarContadores() {
    if (!window.db || !window.Auth) return;

    const session = await window.Auth.requireSession().catch(() => null);
    if (!session) return;

    let orgId = null;
    try {
      const { data } = await window.db
        .from('profiles')
        .select('organization_id')
        .eq('id', session.user.id)
        .maybeSingle();
      orgId = data && data.organization_id;
    } catch (e) {}

    if (!orgId) return;

    try {
      const { data: sales } = await window.db
        .from('sales')
        .select('status, total, deposit, created_at, is_quote, kind, type')
        .eq('organization_id', orgId);

      if (!sales) return;

      const totals = {
        vendas: 0,
        orcamentos_pendentes: 0,
        a_receber: 0,
        mes: 0,
        canceladas: 0
      };

      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

      sales.forEach(s => {
        const st = String(s.status || '').toLowerCase();

        const isQuote =
          s.is_quote === true ||
          st === 'quote' ||
          st === 'orcamento' ||
          st === 'orçamento' ||
          (s.kind && String(s.kind).toLowerCase() === 'quote') ||
          (s.type && String(s.type).toLowerCase() === 'quote');

        const cancelada =
          st === 'canceled' ||
          st === 'cancelled' ||
          st === 'rejected' ||
          st === 'devolvida';

        // Canceladas (vendas e orçamentos)
        if (cancelada) {
          totals.canceladas += 1;
          return;
        }

        // Orçamentos pendentes
        if (isQuote) {
          if (st === 'pending' || st === 'pending_approval' || st === 'pendente') {
            totals.orcamentos_pendentes += 1;
          }
          return;
        }

        // Vendas ativas
        totals.vendas += 1;

        // A receber (saldo > 0)
        const total = Number(s.total) || 0;
        const deposit = Number(s.deposit) || 0;
        if (total > deposit + 0.001) totals.a_receber += 1;

        // Vendas do mês
        if (s.created_at) {
          const dt = new Date(s.created_at);
          if (dt >= inicioMes) totals.mes += 1;
        }
      });

      setText('count-vendas', totals.vendas);
      setText('count-orc-pendentes', totals.orcamentos_pendentes);
      setText('count-receber', totals.a_receber);
      setText('count-mes', totals.mes);
      setText('count-canceladas', totals.canceladas);
    } catch (e) {
      console.warn('[portal-vendas] falha ao contar:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', carregarContadores);
  } else {
    carregarContadores();
  }
})();