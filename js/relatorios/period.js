(function () {
  'use strict';
  const RH = window.RH;
  const state = RH.state;

  function setup() {
    document.querySelectorAll('.segmented__btn[data-period]').forEach(btn => {
      btn.addEventListener('click', function () {
        const period = btn.dataset.period;
        document.querySelectorAll('.segmented__btn[data-period]').forEach(b => {
          b.classList.toggle('is-active', b === btn);
        });
        state.period = period;
        const custom = document.getElementById('period-custom');
        if (custom) custom.hidden = period !== 'custom';
        if (period === 'custom') { updateRangeLabel(); return; }
        RH.data.refresh();
      });
    });

    const applyBtn = document.getElementById('apply-custom-period');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        const start = RH.utils.getInputValue('period-start');
        const end = RH.utils.getInputValue('period-end');
        if (!start || !end) {
          RH.toast('Informe a data inicial e a data final.', 'error'); return;
        }
        if (start > end) {
          RH.toast('A data inicial não pode ser maior que a final.', 'error'); return;
        }
        state.customStart = start;
        state.customEnd = end;
        RH.data.refresh();
      });
    }
  }

  function getRange() {
    const now = new Date();
    let start, end;

    switch (state.period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case '7d':
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
        break;
      case '30d':
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        start = new Date(end); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case 'custom':
      default:
        start = state.customStart ? new Date(state.customStart + 'T00:00:00')
                                  : new Date(now.getFullYear(), now.getMonth(), 1);
        end = state.customEnd ? new Date(state.customEnd + 'T23:59:59.999') : now;
        break;
    }
    return { start, end };
  }

  function updateRangeLabel() {
    const { start, end } = getRange();
    let label = formatRange(start, end);
    if (RH.filters.hasPriceFilterActive()) {
      label += ' · ' + RH.filters.describePriceRange();
    }
    RH.utils.setText('period-range', label);
  }

  function formatRange(start, end) {
    const sameDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();
    if (sameDay) return 'Período: ' + RH.FULL_DATE.format(start);
    return 'Período: ' + RH.FULL_DATE.format(start) + ' → ' + RH.FULL_DATE.format(end);
  }

  RH.period = { setup, getRange, updateRangeLabel };
})();