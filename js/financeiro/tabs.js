/* =========================================================
   DEV HUB · Financeiro · tabs
   ---------------------------------------------------------
   Cuida de:
   + Tabs principais (troca, indicador animado, teclado)
   + Contexto das abas (título, subtítulo, ícone, label do botão)
   + Alternância table/grid (viewMode)
   + Contador numérico com animação (bump)

   Depende de: state.js (window.Fin)
   Publica em: window.Fin
   ========================================================= */

(function () {
  'use strict';

  const { $, $$, state } = window.Fin;

  /* =========================================================
     CONTEXTO DAS ABAS
     ========================================================= */
  const TAB_CONTEXT = {
    pagar: {
      title: 'Contas a pagar',
      subtitle: 'Gerencie seus compromissos financeiros, vencimentos e baixas.',
      newLabel: 'Novo título',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>`
    },
    receber: {
      title: 'Contas a receber',
      subtitle: 'Acompanhe seus recebimentos, vencimentos e valores em aberto.',
      newLabel: 'Novo título',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`
    },
    todos: {
      title: 'Todos os títulos',
      subtitle: 'Visão unificada de contas a pagar, a receber e demais lançamentos.',
      newLabel: 'Novo título',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/></svg>`
    },
    movimentos: {
      title: 'Movimentações financeiras',
      subtitle: 'Acompanhe todas as entradas, saídas e movimentações das suas contas.',
      newLabel: 'Novo lançamento',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>`
    },
    transferencias: {
      title: 'Transferências',
      subtitle: 'Gerencie transferências entre suas contas financeiras.',
      newLabel: 'Nova transferência',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7h12l-4-4"/><path d="M16 17H4l4 4"/></svg>`
    }
  };

  /* =========================================================
     HEADER SWAP (troca com animação)
     ========================================================= */
  let headSwapToken = 0;
  function swapHeadText(title, subtitle) {
    const titleEl = document.getElementById('finHeadTitle');
    const subEl   = document.getElementById('finHeadSub');
    if (!titleEl || !subEl) return;
    headSwapToken += 1;
    const myToken = headSwapToken;
    titleEl.classList.remove('is-leaving', 'is-entering');
    subEl.classList.remove('is-leaving', 'is-entering');
    void titleEl.offsetWidth;
    titleEl.classList.add('is-leaving');
    subEl.classList.add('is-leaving');
    setTimeout(() => {
      if (myToken !== headSwapToken) return;
      titleEl.textContent = title;
      subEl.textContent = subtitle;
      titleEl.classList.remove('is-leaving');
      subEl.classList.remove('is-leaving');
      void titleEl.offsetWidth;
      titleEl.classList.add('is-entering');
      subEl.classList.add('is-entering');
      setTimeout(() => {
        if (myToken !== headSwapToken) return;
        titleEl.classList.remove('is-entering');
        subEl.classList.remove('is-entering');
      }, 320);
    }, 180);
  }

  function swapHeadIcon(svgHTML) {
    const el = document.getElementById('finHeadIcon');
    if (!el) return;
    el.innerHTML = svgHTML;
    el.classList.remove('is-swapping');
    void el.offsetWidth;
    el.classList.add('is-swapping');
    el.addEventListener('animationend', () => el.classList.remove('is-swapping'), { once: true });
  }

  let newLabelToken = 0;
  function swapNewLabel(text) {
    const el = document.getElementById('fin-new-label');
    if (!el || !text) return;
    if (el.textContent === text) return;
    newLabelToken += 1;
    const my = newLabelToken;
    el.classList.add('is-swapping');
    setTimeout(() => {
      if (my !== newLabelToken) return;
      el.textContent = text;
      el.classList.remove('is-swapping');
    }, 160);
  }

  function applyTabContext(tab, animate = true) {
    const ctx = TAB_CONTEXT[tab];
    if (!ctx) return;
    if (animate) {
      swapHeadText(ctx.title, ctx.subtitle);
      swapHeadIcon(ctx.icon);
      swapNewLabel(ctx.newLabel);
    } else {
      const titleEl = document.getElementById('finHeadTitle');
      const subEl   = document.getElementById('finHeadSub');
      const iconEl  = document.getElementById('finHeadIcon');
      const newLbl  = document.getElementById('fin-new-label');
      if (titleEl) titleEl.textContent = ctx.title;
      if (subEl)   subEl.textContent   = ctx.subtitle;
      if (iconEl)  iconEl.innerHTML    = ctx.icon;
      if (newLbl)  newLbl.textContent  = ctx.newLabel;
    }
  }

  /* =========================================================
     INDICADOR DA ABA ATIVA
     ========================================================= */
  function moveIndicator() {
    const nav = document.querySelector('.fin-tabs--main');
    if (!nav) return;
    const ind = nav.querySelector('.fin-tabs__indicator');
    const active = nav.querySelector('.fin-tab.is-active');
    if (!ind || !active) return;
    const navRect = nav.getBoundingClientRect();
    const tabRect = active.getBoundingClientRect();
    const navStyles = getComputedStyle(nav);
    const borderLeft = parseFloat(navStyles.borderLeftWidth) || 0;
    ind.style.width = tabRect.width + 'px';
    ind.style.transform = `translateX(${tabRect.left - navRect.left - borderLeft}px)`;
  }

  /* =========================================================
     CONTADOR (bump)
     ========================================================= */
  function setCount(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const next = String(value);
    if (el.textContent === next) return;
    el.textContent = next;
    el.classList.remove('is-bumping');
    void el.offsetWidth;
    el.classList.add('is-bumping');
    el.addEventListener('animationend', () => el.classList.remove('is-bumping'), { once: true });
  }

  /* =========================================================
     MODO DE VISUALIZAÇÃO (table/grid)
     ========================================================= */
  function setViewMode(mode) {
    if (mode !== 'table' && mode !== 'grid') return;
    state.viewMode = mode;
    $$('.fin-view-btn').forEach((b) => {
      const on = b.dataset.view === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $$('.fin-view-host').forEach((host) => {
      host.querySelectorAll('[data-view]').forEach((el) => {
        el.hidden = el.dataset.view !== mode;
      });
    });
  }

  function setupViewToggles() {
    $$('.fin-view-toggle').forEach((group) => {
      group.addEventListener('click', (e) => {
        const btn = e.target.closest('.fin-view-btn');
        if (!btn) return;
        setViewMode(btn.dataset.view);
      });
    });
    setViewMode(state.viewMode);
  }

  /* =========================================================
     SETUP + TROCA DE ABA
     ========================================================= */
  function setupTabs() {
    const nav = document.querySelector('.fin-tabs--main');
    if (!nav) return;

    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('.fin-tab');
      if (!btn || !btn.dataset.mainTab) return;
      switchTab(btn.dataset.mainTab);
    });

    nav.addEventListener('keydown', (e) => {
      const tabs = Array.from(nav.querySelectorAll('.fin-tab'));
      const idx = tabs.findIndex((t) => t.classList.contains('is-active'));
      let next = -1;
      if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
      if (e.key === 'ArrowLeft')  next = (idx - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home')       next = 0;
      if (e.key === 'End')        next = tabs.length - 1;
      if (next < 0) return;
      e.preventDefault();
      tabs[next].focus();
      switchTab(tabs[next].dataset.mainTab);
    });

    let rafId = null;
    const scheduleMove = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => { rafId = null; moveIndicator(); });
    };
    window.addEventListener('resize', scheduleMove);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleMove).catch(() => {});
    }
    requestAnimationFrame(moveIndicator);
  }

  function switchTab(tab, skipURL) {
    if (state.tab === tab) return;
    const prevTab = state.tab;
    state.tab = tab;
    state.selected.clear();

    // 1) nav: marca/desmarca as abas
    $$('.fin-tabs--main .fin-tab').forEach((b) => {
      const on = b.dataset.mainTab === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
      b.setAttribute('tabindex', on ? '0' : '-1');
    });

    // 2) URL
    if (!skipURL) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        history.replaceState({ tab }, '', url);
      } catch (_) {}
    }

    // 3) header: título, subtítulo, ícone, label do botão
    requestAnimationFrame(moveIndicator);
    applyTabContext(tab, true);

    // 4) panes: esconder TODOS e mostrar só o atual
    const panes = $$('.fin-main > .fin-tabpane');
    const prevPane = panes.find(p => p.dataset.mainPane === prevTab);
    const nextPane = panes.find(p => p.dataset.mainPane === tab);

    const reveal = () => {
      panes.forEach((p) => {
        const on = p.dataset.mainPane === tab;
        p.classList.toggle('is-active', on);
        p.classList.remove('is-leaving');
        if (on) p.removeAttribute('hidden');
        else     p.setAttribute('hidden', '');
      });
    };

    // 5) redesenha os dados (renderAll mora no financeiro.js)
    if (typeof window.Fin.renderAll === 'function') window.Fin.renderAll();

    // 6) animação
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prevPane && prevPane !== nextPane && !reduce) {
      prevPane.classList.add('is-leaving');
      setTimeout(reveal, 170);
    } else {
      reveal();
    }
  }

  /* =========================================================
     PUBLICA EM window.Fin
     ========================================================= */
  Object.assign(window.Fin, {
    TAB_CONTEXT,
    applyTabContext,
    moveIndicator,
    setCount,
    setViewMode,
    setupViewToggles,
    setupTabs,
    switchTab
  });

})();