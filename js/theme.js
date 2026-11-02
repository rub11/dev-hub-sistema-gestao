/* =========================================================
   DEV HUB · Theme Engine
   ========================================================= */
(function () {
  'use strict';

  const THEME_KEY = 'devhub_theme';
  
  // 1. Recupera o tema salvo ou define 'dark' como padrão
  let savedTheme = 'dark';
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') {
      savedTheme = stored;
    } else {
      // Se não tem nada salvo, cravamos o dark como padrão do sistema
      localStorage.setItem(THEME_KEY, 'dark');
    }
  } catch (e) {
    console.warn('[Theme] Erro ao acessar localStorage', e);
  }

  // 2. Aplica no HTML o mais rápido possível (evita tela branca)
  document.documentElement.setAttribute('data-theme', savedTheme);

  // 3. API global para ser usada pelo botão no menu do usuário
  window.Theme = {
    current: () => localStorage.getItem(THEME_KEY) || 'dark',
    set: (theme) => {
      if (theme !== 'light' && theme !== 'dark') return;
      localStorage.setItem(THEME_KEY, theme);
      document.documentElement.setAttribute('data-theme', theme);
      
      // Dispara evento para scripts que quiserem ouvir a mudança
      document.dispatchEvent(new CustomEvent('theme:changed', { detail: theme }));
    },
    toggle: () => {
      const next = window.Theme.current() === 'dark' ? 'light' : 'dark';
      window.Theme.set(next);
      return next;
    }
  };
})();