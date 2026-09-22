/* =========================================================
   DEV HUB · Tema (claro / escuro / sistema)
   ---------------------------------------------------------
   Aplica data-theme no <html> antes da CSS carregar, evitando
   flash de tema. Deve ser incluído no <head> de TODA página.
   ========================================================= */

(function () {
  'use strict';

  const STORAGE_KEY = 'dev-hub-theme';
  const VALID = ['system', 'light', 'dark'];
  const mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function readPreference() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return VALID.indexOf(value) !== -1 ? value : 'system';
    } catch (e) {
      return 'system';
    }
  }

  function resolveTheme(preference) {
    if (preference === 'light' || preference === 'dark') return preference;
    return mql && mql.matches ? 'dark' : 'light';
  }

  function applyTheme(preference) {
    const resolved = resolveTheme(preference);
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-pref', preference);
  }

  function setPreference(preference) {
    if (VALID.indexOf(preference) === -1) preference = 'system';
    try {
      if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, preference);
    } catch (e) { /* storage indisponível — ignora */ }
    applyTheme(preference);
  }

  // Aplica imediatamente (evita flash)
  applyTheme(readPreference());

  // Reage a mudanças do sistema quando a preferência é "system"
  if (mql) {
    const onChange = function () {
      if (readPreference() === 'system') applyTheme('system');
    };
    if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onChange);
    else if (typeof mql.addListener === 'function') mql.addListener(onChange);
  }

  // API pública
  window.Theme = {
    get: readPreference,
    set: setPreference,
    resolved: function () { return resolveTheme(readPreference()); }
  };
})();
