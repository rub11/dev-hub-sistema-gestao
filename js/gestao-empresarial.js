(function () {
  'use strict';

  const { $, $$, toast } = window.Fin;

  function initGestao() {
    // Controle de Abas
    const tabs = $$('.fin-tabs--main .fin-tab');
    const panes = $$('.fin-tabpane');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Remove active de todos
        tabs.forEach(t => {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        panes.forEach(p => p.hidden = true);

        // Adiciona active no clicado
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');
        
        const targetPane = document.querySelector(`.fin-tabpane[data-ge-pane="${tab.dataset.geTab}"]`);
        if (targetPane) targetPane.hidden = false;

        // Move o indicador visual
        window.Fin.moveIndicator?.();
      });
    });

    // Inicializa o indicador na primeira aba
    setTimeout(() => window.Fin.moveIndicator?.(), 100);

    toast('Módulo de Gestão Empresarial carregado.', 'success');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGestao);
  } else {
    initGestao();
  }
})();