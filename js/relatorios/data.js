(function () {
  'use strict';
  const RH = window.RH;
  const state = RH.state;

  async function refresh() {
    if (state.loading) return;
    state.loading = true;

    RH.ui.showLoading(true);
    RH.period.updateRangeLabel();
    RH.exportCSV.setButtonsEnabled(false);

    const { start, end } = RH.period.getRange();
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    try {
      const [
        salesRes, productsRes, movementsRes,
        totalCustomersRes, newCustomersRes
      ] = await Promise.all([
        window.db.from('sales').select('*')
          .gte('created_at', startISO).lte('created_at', endISO)
          .order('created_at', { ascending: false }),
        window.db.from('products')
          .select('id, name, code, stock, minimum_stock, active, price, created_at'),
        window.db.from('stock_movements').select('*')
          .gte('created_at', startISO).lte('created_at', endISO)
          .order('created_at', { ascending: false }).limit(500),
        window.db.from('customers').select('id', { count: 'exact', head: true }),
        window.db.from('customers').select('id', { count: 'exact', head: true })
          .gte('created_at', startISO).lte('created_at', endISO)
      ]);

      if (salesRes.error) throw salesRes.error;
      if (productsRes.error) throw productsRes.error;
      if (movementsRes.error) throw movementsRes.error;

      state.sales = salesRes.data || [];
      state.products = productsRes.data || [];
      state.movements = movementsRes.data || [];
      state.totalCustomers = (totalCustomersRes && totalCustomersRes.count) || 0;
      state.newCustomersInPeriod = (newCustomersRes && newCustomersRes.count) || 0;

      const validSales = state.sales.filter(s => !RH.utils.isCanceled(s.status));
      const saleIds = validSales.map(s => s.id);
      const customerIds = Array.from(new Set(
        validSales.map(s => s.customer_id).filter(Boolean)
      ));

      const [itemsRes, customersRes] = await Promise.all([
        saleIds.length
          ? window.db.from('sale_items').select('*').in('sale_id', saleIds)
          : Promise.resolve({ data: [], error: null }),
        customerIds.length
          ? window.db.from('customers').select('id, name').in('id', customerIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (customersRes.error) throw customersRes.error;

      state.saleItems = itemsRes.data || [];
      state.customersById = {};
      (customersRes.data || []).forEach(c => { state.customersById[c.id] = c.name; });

      RH.kpis.renderSales();
      RH.chart.render();
      RH.payments.render();
      RH.rankings.renderTopProducts();
      RH.rankings.renderTopCustomers();
      RH.kpis.renderCustomers();
      RH.kpis.renderStock();
      RH.stockTable.render();
      RH.movements.render();

      RH.exportCSV.setButtonsEnabled(true);
      RH.ui.hideGlobalAlert();
    } catch (error) {
      console.error('[DEV HUB] Falha ao carregar relatórios:', error);
      RH.ui.showGlobalAlert(
        'Não foi possível carregar os relatórios. ' + RH.utils.friendlyError(error), 'error'
      );
      RH.toast('Não foi possível carregar os relatórios.', 'error');
    } finally {
      state.loading = false;
      RH.ui.showLoading(false);
    }
  }

  RH.data = { refresh };
})();