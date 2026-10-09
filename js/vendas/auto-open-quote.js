/* =========================================================
   DEV HUB · Vendas · auto-open-quote.js
   Detecta ?novo=orcamento OU ?editar_orcamento=ID
   e executa a ação apropriada.
   Também remove a classe anti-flash quando o form abre.
   ========================================================= */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const modo = params.get('novo') || params.get('modo');
  const editarId = params.get('editar_orcamento');

  if (modo !== 'orcamento' && !editarId) return;

  console.log('[auto-open-quote] modo detectado:',
    editarId ? ('editar #' + editarId) : 'novo');

  /* Remove a classe anti-flash do <html> */
  function liberarAntiFlash() {
    document.documentElement.classList.remove('dh-form-mode');
  }

  /* ---------------------------------------------------------
     NOVO ORÇAMENTO
     --------------------------------------------------------- */
  function abrirNovo() {
    const btn = document.getElementById('new-quote-btn');
    if (btn) {
      btn.click();

      const url = new URL(window.location.href);
      url.searchParams.delete('novo');
      url.searchParams.delete('modo');
      window.history.replaceState({}, '', url.toString());

      liberarAntiFlash();
      return true;
    }

    const tab = document.querySelector('.sales-tab[data-tab="quotes"]');
    if (tab) {
      tab.click();
      liberarAntiFlash();
      return true;
    }

    return false;
  }

  /* ---------------------------------------------------------
     EDITAR ORÇAMENTO EXISTENTE
     --------------------------------------------------------- */
  function abrirEdicao() {
    if (!window.DH || !DH.quotes || typeof DH.quotes.openEditQuote !== 'function') {
      return false;
    }

    DH.quotes.openEditQuote(editarId).then(() => {
      console.log('[auto-open-quote] orçamento carregado para edição');
      liberarAntiFlash();
    }).catch((e) => {
      console.error('[auto-open-quote] erro ao abrir edição:', e);
      liberarAntiFlash();
    });

    const url = new URL(window.location.href);
    url.searchParams.delete('editar_orcamento');
    window.history.replaceState({}, '', url.toString());

    return true;
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  let tentativas = 0;
  const tick = () => {
    let ok = false;

    if (editarId) {
      if (window.DH && DH.quotes && typeof DH.quotes.openEditQuote === 'function') {
        ok = abrirEdicao();
      }
    } else {
      ok = abrirNovo();
    }

    if (ok) return;

    tentativas++;
    if (tentativas < 30) setTimeout(tick, 250);
    else {
      console.warn('[auto-open-quote] desisti após várias tentativas');
      liberarAntiFlash();  // fallback: mostra a lista se não conseguir abrir
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(tick, 200));
  } else {
    setTimeout(tick, 200);
  }
})();