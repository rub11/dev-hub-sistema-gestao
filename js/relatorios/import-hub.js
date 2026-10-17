/* =========================================================
   DEV HUB · Relatórios · import-hub.js
   Hub de importação: Produtos, Parceiros, Vendas históricas.
   ---------------------------------------------------------
   CORREÇÕES:
   - Checagem de permissão explícita (não libera por padrão).
   - Guarda de window.RH (evita TypeError de ordem de scripts).
   - Listener de ESC anexado uma única vez.
   - Ícones SVG no lugar dos emojis.
   - Removidos logs de debug de produção.
   ========================================================= */
(function () {
  'use strict';

  const RH = window.RH;
  if (!RH) {
    console.error('[relatorios] window.RH não encontrado. Verifique a ordem dos scripts.');
    return;
  }
  const state = RH.state;

  const ICONS = {
    produtos:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8l9 5 9-5Z"/>' +
      '<path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
    parceiros:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/>' +
      '<circle cx="9" cy="7.5" r="3.5"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/>' +
      '<path d="M16.5 4.13a4 4 0 0 1 0 7.75"/></svg>',
    vendas:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"/>' +
      '<circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/></svg>',
    financeiro:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="13" rx="2"/>' +
      '<path d="M2.5 10h19"/><circle cx="17" cy="14.5" r="1.2"/></svg>'
  };

  const MODULES = [
    {
      id: 'produtos',
      icon: ICONS.produtos,
      title: 'Produtos',
      desc: 'Importar catálogo via .xlsx ou .csv',
      action: 'redirect',
      href: 'produtos.html',
      enabled: true
    },
    {
      id: 'parceiros',
      icon: ICONS.parceiros,
      title: 'Parceiros',
      desc: 'Clientes, fornecedores e transportadoras',
      action: 'redirect',
      href: 'parceiros.html',
      enabled: true
    },
    {
      id: 'vendas',
      icon: ICONS.vendas,
      title: 'Vendas históricas',
      desc: 'Importar vendas antigas via .xlsx',
      action: 'sales-import',
      enabled: true
    },
    {
      id: 'financeiro',
      icon: ICONS.financeiro,
      title: 'Financeiro',
      desc: 'Lançamentos contábeis e fluxo de caixa',
      action: 'soon',
      enabled: false
    }
  ];

  let hubEl = null;
  let escBound = false;

  /* =========================================================
     SETUP — sempre anexa o listener
     ========================================================= */
  function setup() {
    const btn = document.getElementById('import-hub-btn');
    if (!btn) {
      console.warn('[import-hub] Botão #import-hub-btn não encontrado no DOM.');
      return;
    }

    if (btn.dataset.hubWired === '1') return;
    btn.dataset.hubWired = '1';

    /* A checagem de permissão acontece dentro de abrir() */
    btn.addEventListener('click', abrir);
  }

  /* =========================================================
     ABRIR — valida permissão + reconstrói se precisar
     ========================================================= */
  function abrir() {
    /* Permissão explícita: só passa com a flag realmente concedida. */
    const podeImportar = state.perms.import === true || state.perms.export === true;
    if (!podeImportar) {
      console.warn('[import-hub] Sem permissão. state.perms:', state.perms);
      RH.toast('Você não tem permissão para importar.', 'error');
      return;
    }

    if (!hubEl || !hubEl.querySelector('.dh-imp-hub__card')) {
      document.querySelectorAll('#dh-imp-hub').forEach(el => el.remove());
      hubEl = build();
    }

    if (!hubEl.parentNode) document.body.appendChild(hubEl);
    hubEl.hidden = false;
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

    el.querySelectorAll('[data-close]').forEach(b => {
      b.addEventListener('click', fechar);
    });

    el.addEventListener('click', (e) => {
      if (e.target === el) fechar();
    });

    /* ESC anexado uma única vez em toda a vida da página */
    if (!escBound) {
      escBound = true;
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && hubEl && !hubEl.hidden) fechar();
      });
    }

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
        <span class="dh-imp-hub__icon ${iconClass}" aria-hidden="true">${m.icon}</span>
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
