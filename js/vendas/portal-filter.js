/* =========================================================
   DEV HUB · Vendas · portal-filter.js
   Apenas adiciona badge "voltar ao portal" e título.
   Filtros internos ficam na própria tela.
   ========================================================= */
(function () {
  'use strict';

  function injectStyles() {
    if (document.getElementById('dh-pf-styles')) return;
    const s = document.createElement('style');
    s.id = 'dh-pf-styles';
    s.textContent = `
      .page-head { position: relative; }
      .dh-portal-badge {
        position: absolute;
        top: 4px;
        right: 0;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(255,255,255,.03);
        border: 1px solid rgba(255,255,255,.08);
        color: #8b95a7;
        font-size: 12px;
        font-weight: 500;
        text-decoration: none;
        transition: all .15s ease;
        white-space: nowrap;
      }
      .dh-portal-badge:hover {
        background: rgba(99,102,241,.08);
        border-color: rgba(99,102,241,.35);
        color: #a5b4fc;
      }
      @media (max-width: 640px) {
        .dh-portal-badge {
          position: static;
          margin-bottom: 12px;
        }
      }
    `;
    document.head.appendChild(s);
  }

  function adicionarBadge() {
    const pageHead = document.querySelector('.page-head');
    if (!pageHead || document.getElementById('dh-portal-back')) return;

    const badge = document.createElement('a');
    badge.id = 'dh-portal-back';
    badge.href = 'portal-vendas.html';
    badge.className = 'dh-portal-badge';
    badge.innerHTML =
      '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" ' +
      'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>' +
      '<span>Portal de Vendas</span>';
    pageHead.appendChild(badge);
  }

  function boot() {
    injectStyles();
    setTimeout(adicionarBadge, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();