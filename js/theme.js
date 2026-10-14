/* =========================================================
   DEV HUB · Tema (light / dark / auto)
   ---------------------------------------------------------
   - Preferência salva em localStorage: 'light' | 'dark' | 'auto'
   - 'auto' segue prefers-color-scheme do sistema
   - Aplica data-theme no <html> ANTES da CSS carregar (sem flash)
   - Dispara `theme:changed` para charts/listeners reagirem
   - API: Theme.get() | Theme.resolved() | Theme.set(pref) | Theme.toggle()
   ========================================================= */

(function () {
  'use strict';

  const STORAGE_KEY = 'dev-hub-theme';
  const MEDIA = window.matchMedia('(prefers-color-scheme: dark)');

  function getStored() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark' || v === 'auto') return v;
    } catch (e) { /* storage indisponível */ }
    return 'auto';
  }

  function resolve(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    return MEDIA.matches ? 'dark' : 'light';
  }

  function apply(pref, silent) {
    const resolved = resolve(pref);
    const root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-pref', pref);

    if (!silent) {
      try {
        document.dispatchEvent(new CustomEvent('theme:changed', {
          detail: { preference: pref, resolved: resolved }
        }));
      } catch (e) { /* CustomEvent indisponível */ }
    }
  }

  /* Aplica imediatamente — antes da CSS carregar */
  apply(getStored(), true);

  /* Reage a mudanças do sistema (só quando pref = 'auto') */
  function onSystemChange() {
    if (getStored() === 'auto') apply('auto', false);
  }
  if (MEDIA.addEventListener) MEDIA.addEventListener('change', onSystemChange);
  else if (MEDIA.addListener) MEDIA.addListener(onSystemChange);

  window.Theme = {
    get: function () { return getStored(); },
    resolved: function () { return resolve(getStored()); },

    set: function (pref) {
      pref = (pref === 'light' || pref === 'dark') ? pref : 'auto';
      try {
        if (pref === 'auto') localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, pref);
      } catch (e) { /* storage indisponível */ }
      apply(pref, false);
    },

    toggle: function () {
      const current = resolve(getStored());
      this.set(current === 'dark' ? 'light' : 'dark');
    }
  };
})();