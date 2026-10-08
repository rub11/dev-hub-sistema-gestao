/* =========================================================
   DEV HUB · Vendas · auto-open-quote.js
   Se a URL tiver ?novo=orcamento, abre o form de orçamento
   automaticamente após o carregamento.
   ========================================================= */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  if (params.get('novo') !== 'orcamento') return;

  console.log('[auto-open-quote] detectado ?novo=orcamento');

  function tentarAbrir() {
    const btn = document.getElementById('new-quote-btn');
    if (btn && !btn.hidden) {
      btn.click();
      console.log('[auto-open-quote] form aberto');

      // Limpa o parâmetro da URL pra não reabrir no F5
      const url = new URL(window.location.href);
      url.searchParams.delete('novo');
      window.history.replaceState({}, '', url.toString());
      return true;
    }
    return false;
  }

  let tentativas = 0;
  const tick = () => {
    if (tentarAbrir()) return;
    tentativas++;
    if (tentativas < 30) setTimeout(tick, 200);
    else console.warn('[auto-open-quote] desisti após 6s — botão #new-quote-btn não apareceu');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(tick, 400));
  } else {
    setTimeout(tick, 400);
  }
})();