/* =========================================================
   DEV HUB · Relatórios · import-hub.js
   Hub de importação: Produtos, Parceiros, Vendas históricas.
   ---------------------------------------------------------
   CORREÇÃO APLICADA:
   - setup() sempre anexa o listener (antes bloqueava se a
     permissão não tava setada ainda, e o clique morria).
   - abrir() faz a checagem de permissão e loga debug no
     console pra facilitar rastreio.
   - abrir() reconstrói o modal se o card interno sumiu
     (evita div vazio fantasma).
   ========================================================= */
(function () {
  'use strict';

  const RH = window.RH;
  const state = RH.state;

  const MODULES = [
    {
      id: 'produtos',
      icon: '📦',
      title: 'Produtos',
      desc: 'Importar catálogo via .xlsx ou .csv',
      action: 'redirect',
      href: 'produtos.html',
      enabled: true
    },
    {
      id: 'parceiros',
      icon: '👥',
      title: 'Parceiros',
      desc: 'Clientes, fornecedores e transportadoras',
      action: 'redirect',
      href: 'parceiros.html',
      enabled: true
    },
    {
      id: 'vendas',
      icon: '🛒',
      title: 'Vendas históricas',
      desc: 'Importar vendas antigas via .xlsx',
      action: 'sales-import',
      enabled: true
    },
    {
      id: 'financeiro',
      icon: '💰',
      title: 'Financeiro',
      desc: 'Lançamentos contábeis e fluxo de caixa',
      action: 'soon',
      enabled: false
    }
  ];

  let hubEl = null;

  /* =========================================================
     SETUP — sempre anexa o listener
     ========================================================= */
  function setup() {
    const btn = document.getElementById('import-hub-btn');
    if (!btn) {
      console.warn('[import-hub] Botão #import-hub-btn não encontrado no DOM.');
      return;
    }

    /* Evita duplicar listener se init rodar 2x */
    if (btn.dataset.hubWired === '1') return;
    btn.dataset.hubWired = '1';

    /* Listener SEMPRE é anexado. A checagem de permissão
       vai pra dentro de abrir(). */
    btn.addEventListener('click', abrir);

    console.log('[import-hub] Listener anexado ao botão.');
  }

  /* =========================================================
     ABRIR — valida permissão + reconstrói se precisar
     ========================================================= */
  function abrir() {
    console.log('[import-hub] abrir() chamado.');

    /* Checagem de permissão com fallback */
    const podeImportar = state.perms.import !== false || state.perms.export === true;
    if (!podeImportar) {
      console.warn('[import-hub] Sem permissão. state.perms:', state.perms);
      RH.toast('Você não tem permissão para importar.', 'error');
      return;
    }

    /* Reconstrói se o card interno sumiu (div vazio fantasma) */
    if (!hubEl || !hubEl.querySelector('.dh-imp-hub__card')) {
      document.querySelectorAll('#dh-imp-hub').forEach(el => el.remove());
      hubEl = build();
    }

    if (!hubEl.parentNode) document.body.appendChild(hubEl);
    hubEl.hidden = false;

    console.log('[import-hub] Modal aberto.');
  }

  /* =========================================================
     FECHAR
     ========================================================= */
  function fechar() {
    if (hubEl) hubEl.hidden = true;
  }

  /* =========================================================
     BUILD — cria o DOM do modal
     ========================================================= */
  function build() {
    const el = document.createElement('div');
    el.id = 'dh-imp-hub';
    el.className = 'dh-imp-hub';
    el.hidden = true;

    el.innerHTML = `
      <div class="dh-imp-hub__card" role="dialog" aria-modal="true">
        <header class="dh-imp-hub__head">
          <div>
            <h2>Importar dados</h2>
            <p>Escolha o módulo que deseja importar</p>
          </div>
          <button type="button" class="dh-imp-hub__close" data-close aria-label="Fechar">×</button>
        </header>
        <div class="dh-imp-hub__body">
          <div class="dh-imp-hub__grid" id="dh-imp-hub-grid"></div>
        </div>
      </div>
    `;

    /* Botões de fechar */
    el.querySelectorAll('[data-close]').forEach(b => {
      b.addEventListener('click', fechar);
    });

    /* Clique no backdrop fecha */
    el.addEventListener('click', (e) => {
      if (e.target === el) fechar();
    });

    /* Esc fecha */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && el && !el.hidden) fechar();
    });

    /* Popula grid com os módulos */
    const grid = el.querySelector('#dh-imp-hub-grid');

    MODULES.forEach(m => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dh-imp-hub__item';
      if (!m.enabled) btn.disabled = true;

      const iconClass = m.enabled
        ? (m.action === 'redirect'     ? 'dh-imp-hub__icon--ok'
        : m.action === 'sales-import' ? 'dh-imp-hub__icon--warn'
        : 'dh-imp-hub__icon')
        : 'dh-imp-hub__icon--muted';

      btn.innerHTML = `
        <span class="dh-imp-hub__icon ${iconClass}">${m.icon}</span>
        <span class="dh-imp-hub__title">
          ${m.title}
          ${!m.enabled ? '<span class="dh-imp-hub__badge">Em breve</span>' : ''}
        </span>
        <span class="dh-imp-hub__desc">${m.desc}</span>
      `;

      btn.addEventListener('click', () => {
        if (!m.enabled) return;
        fechar();

        if (m.action === 'redirect') {
          window.location.href = m.href;
        } else if (m.action === 'sales-import') {
          abrirImportVendas();
        }
      });

      grid.appendChild(btn);
    });

    return el;
  }

  /* =========================================================
     Abrir módulo de importação de vendas
     ========================================================= */
  function abrirImportVendas() {
    if (RH.importSales && typeof RH.importSales.open === 'function') {
      RH.importSales.open();
    } else {
      RH.toast('Módulo de importação de vendas não disponível.', 'error');
    }
  }

  /* =========================================================
     Exporta pra API global
     ========================================================= */
  RH.importHub = { setup, abrir, fechar };
})();