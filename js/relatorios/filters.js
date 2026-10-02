(function () {
  'use strict';
  const RH = window.RH;
  const state = RH.state;

  function readDashboardFilters() {
    const params = new URLSearchParams(window.location.search);
    return {
      period:   params.get('period'),
      start:    params.get('start'),
      end:      params.get('end'),
      minPrice: params.get('min_price'),
      maxPrice: params.get('max_price'),
      focus:    params.get('focus')
    };
  }

  function applyDashboardFilters() {
    const f = readDashboardFilters();

    if (f.period && ['today', '7d', '30d', 'month', 'last_month', 'custom'].indexOf(f.period) !== -1) {
      state.period = f.period;
      if (f.period === 'custom' && f.start && f.end) {
        state.customStart = f.start;
        state.customEnd = f.end;
      }
      const btn = document.querySelector('.segmented__btn[data-period="' + f.period + '"]');
      if (btn) {
        document.querySelectorAll('.segmented__btn[data-period]').forEach(b => {
          b.classList.toggle('is-active', b === btn);
        });
      }
      const custom = document.getElementById('period-custom');
      if (custom) custom.hidden = f.period !== 'custom';
      if (f.start) RH.utils.setInputValue('period-start', f.start);
      if (f.end)   RH.utils.setInputValue('period-end', f.end);
    }

    let priceFilterActive = false;
    if (f.minPrice !== null && f.minPrice !== '') {
      const n = Number(f.minPrice);
      if (Number.isFinite(n) && n >= 0) { state.priceMin = n; priceFilterActive = true; }
    }
    if (f.maxPrice !== null && f.maxPrice !== '') {
      const n = Number(f.maxPrice);
      if (Number.isFinite(n) && n >= 0) { state.priceMax = n; priceFilterActive = true; }
    }

    if (f.focus) state.focusSection = f.focus;

    try { window.history.replaceState({}, '', window.location.pathname); } catch (e) {}

    if (priceFilterActive) RH.toast('Relatório filtrado por faixa de preço.', 'info');
  }

  function hasPriceFilterActive() {
    return state.priceMin !== null || state.priceMax !== null;
  }

  function describePriceRange() {
    const min = state.priceMin, max = state.priceMax;
    if (min !== null && max !== null) return 'Preço: ' + RH.utils.formatMoney(min) + ' — ' + RH.utils.formatMoney(max);
    if (min !== null) return 'Preço: ≥ ' + RH.utils.formatMoney(min);
    if (max !== null) return 'Preço: ≤ ' + RH.utils.formatMoney(max);
    return '';
  }

  function applyPriceFilterToProducts() {
    if (!hasPriceFilterActive()) return state.products;
    return state.products.filter(function (p) {
      const price = RH.utils.toNumber(p.price, 0);
      if (state.priceMin !== null && price < state.priceMin) return false;
      if (state.priceMax !== null && price > state.priceMax) return false;
      return true;
    });
  }

  function getFilteredProductIds() {
    const set = new Set();
    applyPriceFilterToProducts().forEach(p => { if (p.id) set.add(p.id); });
    return set;
  }

  function scrollToFocusSection() {
    const focus = state.focusSection;
    if (!focus) return;
    const map = {
      sales: '#chart-evolution',
      customers: '#kpi-total-customers',
      finance: '#kpi-revenue',
      products: '#stock-table-title'
    };
    const selector = map[focus];
    if (!selector) return;
    const el = document.querySelector(selector);
    if (el && el.scrollIntoView) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
    }
  }

  RH.filters = {
    applyDashboardFilters, hasPriceFilterActive, describePriceRange,
    applyPriceFilterToProducts, getFilteredProductIds, scrollToFocusSection
  };
})();