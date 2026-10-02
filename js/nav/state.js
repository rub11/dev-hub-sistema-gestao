/* =========================================================
   DEV HUB · Navegação · state
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV;

  NAV.state = {
    menuEl: null,
    menuHovered: false,
    rendered: false,
    avatarPromise: null,
    search: {
      input: null,
      results: null,
      clear: null,
      wrap: null,
      index: [],
      filtered: [],
      selectedIdx: -1
    },
    notifications: {
      menu: null,
      unread: 0,
      readColumn: null
    }
  };
})();