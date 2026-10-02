/* =========================================================
   DEV HUB · DRE · period
   Navegação de mês + labels de período.
   ========================================================= */
(function () {
  'use strict';
  const DRE = window.DRE;
  const state = DRE.state;

  DRE.setupPeriod = function () {
    const prev = document.getElementById('dre-prev');
    const next = document.getElementById('dre-next');
    const today = document.getElementById('dre-today');

    if (prev) prev.addEventListener('click', () => shiftMonth(-1));
    if (next) next.addEventListener('click', () => shiftMonth(1));
    if (today) today.addEventListener('click', goToday);

    document.addEventListener('keydown', e => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft')  shiftMonth(-1);
      if (e.key === 'ArrowRight') shiftMonth(1);
    });
  };

  function shiftMonth(delta) {
    if (state.loading) return;
    const base = state.currentMonth || DRE.startOfMonth(new Date());
    DRE.setMonth(DRE.addMonths(base, delta));
    DRE.load();
  }

  function goToday() {
    if (state.loading) return;
    DRE.setMonth(DRE.startOfMonth(new Date()));
    DRE.load();
  }

  DRE.setMonth = function (date) {
    state.currentMonth = DRE.startOfMonth(date);
    state.compareMonth = DRE.addMonths(state.currentMonth, -1);
    updateLabels();
  };

  function updateLabels() {
    const cur = state.currentMonth;
    const prev = state.compareMonth;

    DRE.setText('dre-month-label', DRE.formatMonth(cur));
    DRE.setText('dre-compare-label', 'comparado com ' + DRE.formatMonth(prev));
    DRE.setText('dre-col-current', DRE.formatMonthShort(cur));
    DRE.setText('dre-col-previous', DRE.formatMonthShort(prev));
    DRE.setText('dre-period-sub', 'Competência: ' + DRE.formatMonth(cur));

    const next = document.getElementById('dre-next');
    if (next) {
      const now = DRE.startOfMonth(new Date());
      next.disabled = state.currentMonth.getTime() >= now.getTime();
    }
  }
})();