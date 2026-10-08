/* =========================================================
   DEV HUB · Vendas · import-sales-bootstrap.js
   Injeta o botão "Importar histórico" na toolbar de vendas.
   ---------------------------------------------------------
   - Retry até 10s esperando Perms + âncora
   - Espera Perms.isLoaded() antes de checar permissão
   - Só bloqueia se permissão for EXPLICITAMENTE false
   - Idempotente (não duplica o botão)
   ========================================================= */
(function () {
  'use strict';

  const MAX_TENTATIVAS = 50;   // 50 × 200ms = 10s
  const INTERVALO_MS   = 200;
  const DELAY_INICIAL  = 300;

  let tentativas = 0;

  function tentarInjetar() {
    /* Já existe? */
    if (document.getElementById('import-sales-btn')) return 'done';

    /* Módulo carregou? */
    if (!window.ImportSales || typeof window.ImportSales.abrir !== 'function') {
      return 'wait';
    }

    /* Âncora existe? */
    const anchor = document.getElementById('new-sale-btn') ||
                   document.getElementById('new-quote-btn');
    if (!anchor) return 'wait';

    /* Perms carregou? */
    if (!window.Perms || typeof window.Perms.has !== 'function') {
      return 'wait';
    }

    /* Perms terminou de carregar as permissões do usuário? */
    if (typeof window.Perms.isLoaded === 'function' && !window.Perms.isLoaded()) {
      return 'wait';
    }

    /* Permissão explicitamente negada? */
    if (window.Perms.has('sales.create') === false) {
      console.log('[import-sales] Sem permissão sales.create — botão não injetado');
      return 'done';
    }

    /* Cria o botão */
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'import-sales-btn';
    btn.className = 'btn btn--ghost';
    btn.title = 'Importar vendas históricas';
    btn.style.cssText =
      'white-space:nowrap; display:inline-flex; align-items:center; gap:6px;';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
      'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>' +
      '<span>Importar histórico</span>';

    btn.addEventListener('click', function () {
      window.ImportSales.abrir();
    });

    anchor.parentNode.insertBefore(btn, anchor);
    console.log('[import-sales] Botão injetado com sucesso.');
    return 'done';
  }

  function tick() {
    const r = tentarInjetar();
    if (r === 'done') return;

    tentativas += 1;
    if (tentativas < MAX_TENTATIVAS) {
      setTimeout(tick, INTERVALO_MS);
    } else {
      console.warn('[import-sales] Desisti após 10s. Estado:', {
        ImportSales: typeof window.ImportSales,
        Perms:       typeof window.Perms,
        isLoaded:    window.Perms && typeof window.Perms.isLoaded === 'function'
                       ? window.Perms.isLoaded()
                       : 'n/d',
        anchor:      !!document.getElementById('new-sale-btn')
      });
    }
  }

  function boot() {
    setTimeout(tick, DELAY_INICIAL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();