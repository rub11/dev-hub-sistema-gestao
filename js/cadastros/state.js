(function () {
  'use strict';
  const CAD = window.CAD;

  CAD.state = {
    activeTab: 'natures',
    orgId: null,
    perms: {
      view: true,
      create: true,
      edit: true,
      remove: true
    },
    natures: {
      all: [], filtered: [],
      query: '', kind: '', status: '',
      loading: false
    },
    costCenters: {
      all: [], filtered: [],
      query: '', status: '',
      loading: false
    },
    chartOfAccounts: {
      all: [], filtered: [],
      query: '', type: '', status: '',
      loading: false
    },
    financialCategories: {
      all: [], filtered: [],
      query: '', kind: '', status: '',
      loading: false
    },
    fiscalPeriods: {
      all: [], filtered: [],
      year: '', status: '',
      loading: false
    }
  };
})();