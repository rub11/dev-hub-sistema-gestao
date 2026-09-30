/* =========================================================
   DEV HUB · Tema (FORÇADO PARA DARK)
   ---------------------------------------------------------
   ⚠️ Este projeto agora usa EXCLUSIVAMENTE o tema escuro.
   A opção de alternar claro/escuro foi removida.
   ---------------------------------------------------------
   - Aplica data-theme="dark" no <html> antes da CSS carregar
   - Dispara `theme:changed` (compatível com charts e listeners)
   - Mantém window.Theme para compatibilidade (get/set viram no-op)
   ========================================================= */

(function () {
  'use strict';

  const THEME = 'dark';
  const STORAGE_KEY = 'dev-hub-theme';

  /* Aplica imediatamente — evita flash de tema claro */
  applyTheme();

  /* Limpa qualquer preferência antiga gravada por versões anteriores */
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignora */ }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', THEME);
    document.documentElement.setAttribute('data-theme-pref', THEME);

    try {
      document.dispatchEvent(new CustomEvent('theme:changed', {
        detail: { preference: THEME, resolved: THEME }
      }));
    } catch (e) { /* CustomEvent indisponível — ignora */ }
  }

  /* API mantida para compatibilidade (não faz nada de novo) */
  window.Theme = {
    get: function () { return THEME; },
    set: function () { applyTheme(); },
    resolved: function () { return THEME; }
  };
})();