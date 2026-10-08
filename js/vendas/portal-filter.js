/* =========================================================
   DEV HUB · Vendas · portal-filter.js
   Lê ?filtro= e ?aba= da URL, aplica filtro na lista de
   vendas ou orçamentos, e troca de aba se necessário.

   Filtros:
     vendas      → vendas ativas (sem canceladas, sem orçamentos)
     pendentes   → orçamentos aguardando aprovação
     a_receber   → vendas com saldo pendente
     mes         → vendas do mês atual
     canceladas  → vendas canceladas/rejeitadas
   ========================================================= */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const filtro = (params.get('filtro') || params.get('tipo') || 'vendas').toLowerCase();
  const aba = (params.get('aba') || '').toLowerCase();

  const CONFIG = {
    vendas: {
      aba: 'sales',
      tbody: 'sales-body',
      title: 'Vendas',
      sub: 'Todas as vendas ativas, sem canceladas.',
      emptyTitle: 'Nenhuma venda ativa',
      emptyText: 'Não há vendas em andamento no momento.',
      match: function (ctx) {
        if (ctx.cancelada) return false;
        if (ctx.isQuote) return false;
        return true;
      }
    },
    pendentes: {
      aba: 'quotes',
      tbody: 'quotes-body',
      title: 'Orçamentos pendentes',
      sub: 'Aguardando aprovação do cliente ou gestor.',
      emptyTitle: 'Nenhum orçamento pendente',
      emptyText: 'Todos os orçamentos estão resolvidos.',
      match: function (ctx) {
        if (ctx.cancelada) return false;
        return ctx.status.includes('pendente') ||
               ctx.status.includes('pending') ||
               ctx.status.includes('aguardando');
      }
    },
    a_receber: {
      aba: 'sales',
      tbody: 'sales-body',
      title: 'A receber',
      sub: 'Vendas com saldo pendente de pagamento.',
      emptyTitle: 'Nada a receber',
      emptyText: 'Todas as vendas estão quitadas.',
      match: function (ctx) {
        if (ctx.cancelada) return false;
        if (ctx.isQuote) return false;
        return ctx.saldo > 0.001;
      }
    },
    mes: {
      aba: 'sales',
      tbody: 'sales-body',
      title: 'Vendas do mês',
      sub: 'Vendas registradas no mês atual.',
      emptyTitle: 'Nenhuma venda este mês',
      emptyText: 'Não houve vendas no mês atual ainda.',
      match: function (ctx) {
        if (ctx.cancelada) return false;
        if (ctx.isQuote) return false;
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        return ctx.dataVenda && ctx.dataVenda >= inicioMes;
      }
    },
    canceladas: {
      aba: 'sales',
      tbody: 'sales-body',
      title: 'Canceladas',
      sub: 'Desistência ou outros motivos.',
      emptyTitle: 'Nenhuma venda cancelada',
      emptyText: 'Não há cancelamentos registrados.',
      match: function (ctx) {
        return ctx.cancelada;
      }
    }
  };

  const cfg = CONFIG[filtro] || CONFIG.vendas;

  /* ---------------------------------------------------------
     Estilos
     --------------------------------------------------------- */
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
      .dh-portal-badge svg { flex: none; }

      @media (max-width: 640px) {
        .dh-portal-badge {
          position: static;
          margin-bottom: 12px;
          display: inline-flex;
        }
      }
    `;
    document.head.appendChild(s);
  }

  /* ---------------------------------------------------------
     Cabeçalho
     --------------------------------------------------------- */
  function atualizarCabecalho() {
    document.title = cfg.title + ' · DEV HUB';

    const h1 = document.querySelector('.page-head__title');
    if (h1) h1.textContent = cfg.title;

    const sub = document.querySelector('.page-head__sub');
    if (sub) sub.textContent = cfg.sub;

    const pageHead = document.querySelector('.page-head');
    if (pageHead && !document.getElementById('dh-portal-back')) {
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
  }

  /* ---------------------------------------------------------
     Trocar de aba (sales ↔ quotes)
     --------------------------------------------------------- */
  function trocarAba(nome) {
    if (!nome) return;
    const tab = document.querySelector('.sales-tab[data-tab="' + nome + '"]');
    if (!tab) return;
    if (!tab.classList.contains('is-active')) {
      tab.click();
    }
  }

  /* ---------------------------------------------------------
     Extrair contexto de uma linha
     --------------------------------------------------------- */
  function extrairContexto(row) {
    const cells = row.children;
    if (cells.length < 7) return null;

    const statusText = (cells[6].textContent || '').trim().toLowerCase();

    const cancelada =
      statusText.includes('cancel') ||
      statusText.includes('rejeit') ||
      statusText.includes('devolv');

    const isQuote =
      statusText.includes('orçamento') ||
      statusText.includes('orcamento') ||
      statusText.includes('quote') ||
      row.dataset.kind === 'quote' ||
      row.dataset.type === 'quote' ||
      row.dataset.isQuote === 'true';

    // Saldo (se o list.js setar data-saldo)
    let saldo = 0;
    if (row.dataset.saldo) saldo = Number(row.dataset.saldo) || 0;

    // Data — coluna 2
    let dataVenda = null;
    const dataText = cells[2] ? (cells[2].textContent || '').trim() : '';
    const m = dataText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) {
      dataVenda = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    }
    if (row.dataset.createdAt) {
      const d = new Date(row.dataset.createdAt);
      if (!isNaN(d)) dataVenda = d;
    }

    return {
      status: statusText,
      cancelada: cancelada,
      isQuote: isQuote,
      saldo: saldo,
      dataVenda: dataVenda
    };
  }

  /* ---------------------------------------------------------
     Aplica filtro
     --------------------------------------------------------- */
  function aplicarFiltro() {
    const tbody = document.getElementById(cfg.tbody);
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length === 0) return;

    let visible = 0;

    rows.forEach(row => {
      const ctx = extrairContexto(row);
      if (!ctx) { row.style.display = ''; visible++; return; }

      const show = cfg.match(ctx);
      row.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    // Contador — escolhe o elemento certo por aba
    const countId = cfg.aba === 'quotes' ? 'quotes-count' : 'sales-count';
    const countEl = document.getElementById(countId) || document.getElementById('sales-count');
    if (countEl) {
      if (visible === 0) countEl.textContent = 'Nenhum registro';
      else if (visible === 1) countEl.textContent = '1 registro';
      else countEl.textContent = visible + ' registros';
    }

    // Estado vazio — escolhe o certo por aba
    const emptyId = cfg.aba === 'quotes' ? 'quotes-empty' : 'sales-empty';
    const wrapId = cfg.aba === 'quotes' ? 'quotes-table-wrap' : 'sales-table-wrap';
    const emptyEl = document.getElementById(emptyId);
    const tableWrap = document.getElementById(wrapId);

    if (visible === 0 && rows.length > 0) {
      if (emptyEl) {
        const titleEl = emptyEl.querySelector('h3');
        const textEl = emptyEl.querySelector('p');
        if (titleEl) titleEl.textContent = cfg.emptyTitle;
        if (textEl) textEl.textContent = cfg.emptyText;
        emptyEl.hidden = false;
      }
      if (tableWrap) tableWrap.hidden = true;
    } else if (visible > 0) {
      if (emptyEl) emptyEl.hidden = true;
      if (tableWrap) tableWrap.hidden = false;
    }
  }

  /* ---------------------------------------------------------
     Observa mudanças
     --------------------------------------------------------- */
  function observarLista() {
    const tbody = document.getElementById(cfg.tbody);
    if (!tbody) return;

    const mo = new MutationObserver(() => {
      clearTimeout(observarLista._t);
      observarLista._t = setTimeout(aplicarFiltro, 30);
    });

    mo.observe(tbody, { childList: true });
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  function boot() {
    injectStyles();
    atualizarCabecalho();

    // Se veio com ?aba=, troca antes
    if (aba && cfg.aba && aba !== 'sales') {
      trocarAba(cfg.aba);
    } else if (cfg.aba === 'quotes') {
      trocarAba('quotes');
    }

    let tentativas = 0;
    const tick = () => {
      const tbody = document.getElementById(cfg.tbody);
      if (tbody) {
        observarLista();
        aplicarFiltro();
        return;
      }
      tentativas++;
      if (tentativas < 30) setTimeout(tick, 200);
    };
    setTimeout(tick, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();