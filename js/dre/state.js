/* =========================================================
   DEV HUB · DRE · state
   ========================================================= */
(function () {
  'use strict';
  const DRE = window.DRE;

  DRE.state = {
    currentMonth: null,
    compareMonth: null,
    current: null,
    previous: null,
    ytd: null,
    evolution: [],
    costCenterId: null,
    loading: false,
    chart: null
  };
})();