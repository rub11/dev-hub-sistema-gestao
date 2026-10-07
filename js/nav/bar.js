/* =========================================================
   DEV HUB · Navegação · render da barra
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV;

  function renderBar() {
    const appBody = document.querySelector('.app__body');
    if (!appBody) return;

    const topbar = appBody.querySelector('.topbar');

    let bar = document.getElementById('app-tabs');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'app-tabs';
      bar.className = 'app-tabs';
      bar.setAttribute('role', 'tablist');
      bar.setAttribute('aria-label', 'Abas abertas');

      if (topbar && topbar.nextSibling) {
        appBody.insertBefore(bar, topbar.nextSibling);
      } else if (topbar) {
        appBody.appendChild(bar);
      } else {
        appBody.insertBefore(bar, appBody.firstChild);
      }
    }

    bar.innerHTML =
      '<a class="app-tabs__brand" href="' + NAV.HOME_URL + '" ' +
         'aria-label="Ir para a página inicial" title="Página inicial">' +
        '<span class="app-tabs__brand-mark" aria-hidden="true">' +
          '<img src="' + NAV.BRAND_IMAGE + '" alt="" />' +
        '</span>' +
        '<span class="app-tabs__brand-text">DEV HUB</span>' +
      '</a>' +
      '<div class="app-tabs__scroll" id="app-tabs-scroll"></div>' +
      '<button type="button" class="app-tabs__new" id="app-tabs-new" ' +
              'aria-label="Abrir nova aba" aria-expanded="false" title="Abrir nova aba">' +
        NAV.ICONS.plus +
      '</button>' +
      '<span class="app-tabs__spacer"></span>' +
      /* ⬇️ NOVO — slot do seletor de empresa */
      '<div class="app-tabs__org" id="org-switcher-slot"></div>' +
      '<button type="button" class="app-tabs__bell" id="app-tabs-bell" ' +
              'aria-label="Notificações" aria-expanded="false">' +
        NAV.ICONS.bell +
        '<span class="app-tabs__bell-badge" id="app-tabs-bell-badge" hidden>0</span>' +
      '</button>' +
      '<div class="app-tabs__search" id="tnav-search">' +
        '<span class="tnav-search__icon">' + NAV.ICONS.search + '</span>' +
        '<input type="search" class="tnav-search__input" id="tnav-search-input" ' +
               'placeholder="Buscar… (Ctrl+K)" ' +
               'autocomplete="off" spellcheck="false" ' +
               'aria-label="Buscar opção do menu" ' +
               'aria-autocomplete="list" aria-controls="tnav-search-results" ' +
               'aria-expanded="false" />' +
        '<button type="button" class="tnav-search__clear" id="tnav-search-clear" ' +
                'aria-label="Limpar busca">' + NAV.ICONS.close + '</button>' +
        '<div class="tnav-search__results" id="tnav-search-results" role="listbox" hidden></div>' +
      '</div>' +
      '<div class="app-tabs__user" id="app-tabs-user">' +
        '<button type="button" class="app-tabs__user-btn" id="app-tabs-user-btn" ' +
                'aria-haspopup="menu" aria-expanded="false" ' +
                'aria-label="Menu do usuário">' +
          '<span class="app-tabs__user-avatar" id="user-avatar-bar" aria-hidden="true">–</span>' +
          '<span class="app-tabs__user-info">' +
            '<span class="app-tabs__user-name" id="user-name-bar">Carregando…</span>' +
            '<span class="app-tabs__user-role" id="user-role-bar"></span>' +
          '</span>' +
          '<span class="app-tabs__user-chevron" aria-hidden="true">' + NAV.ICONS.chevron + '</span>' +
        '</button>' +
        '<div class="app-tabs__user-menu" id="app-tabs-user-menu" role="menu" hidden>' +
          '<a class="app-tabs__user-item" role="menuitem" href="configuracoes.html">' +
            NAV.ICONS.configuracoes +
            '<span>Minha Conta</span>' +
          '</a>' +
          '<div class="app-tabs__user-sep" role="separator"></div>' +
          '<button type="button" class="app-tabs__user-item app-tabs__user-item--danger" ' +
                  'role="menuitem" data-action="logout">' +
            NAV.ICONS.logout +
            '<span>Sair</span>' +
          '</button>' +
        '</div>' +
      '</div>';

    document.body.classList.add('layout-topnav');

    (function relocateUserMenu() {
      const menu = document.getElementById('app-tabs-user-menu');
      if (menu && menu.parentNode !== document.body) {
        document.body.appendChild(menu);
      }
    })();

    const plusBtn = document.getElementById('app-tabs-new');
    if (plusBtn) {
      plusBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const willOpen = !NAV.state.menuEl || NAV.state.menuEl.hidden;
        plusBtn.setAttribute('aria-expanded', String(willOpen));
        NAV.moduleMenu.open();
      });
    }

    NAV.tabs.render();
    NAV.search.setup();
    NAV.userMenu.setup();
    NAV.notifications.setup();
    NAV.userMenu.bindLogout(bar);
    NAV.userMenu.bindLogout(document.body);
    NAV.userMenu.syncBarUserInfo();

    const ctx = NAV.roles.readContext();
    document.documentElement.setAttribute(
      'data-role',
      ctx.isPlatform ? 'platform_admin' : (ctx.role || 'guest')
    );

    /* Ativa o scroll horizontal com setas */
    setupTabsScroll();

    /* ⬇️ NOVO — ativa o seletor de empresa */
    if (NAV.orgSwitcher && typeof NAV.orgSwitcher.init === 'function') {
      NAV.orgSwitcher.init();
    }
  }

  /* =========================================================
     ABAS · scroll horizontal com setas + roda do mouse
     ========================================================= */
  function setupTabsScroll() {
    const scroll = document.getElementById('app-tabs-scroll');
    if (!scroll) return;

    if (scroll.dataset.scrollReady === '1') return;
    scroll.dataset.scrollReady = '1';

    /* Wrapper + setas */
    let wrapper = scroll.parentNode;
    if (!wrapper.classList.contains('app-tabs__scroll-wrap')) {
      const newWrap = document.createElement('div');
      newWrap.className = 'app-tabs__scroll-wrap';
      wrapper.insertBefore(newWrap, scroll);
      newWrap.appendChild(scroll);
      wrapper = newWrap;
    }

    const leftBtn = document.createElement('button');
    leftBtn.type = 'button';
    leftBtn.className = 'app-tabs__arrow app-tabs__arrow--left';
    leftBtn.setAttribute('aria-label', 'Rolar abas para a esquerda');
    leftBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';

    const rightBtn = document.createElement('button');
    rightBtn.type = 'button';
    rightBtn.className = 'app-tabs__arrow app-tabs__arrow--right';
    rightBtn.setAttribute('aria-label', 'Rolar abas para a direita');
    rightBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

    wrapper.insertBefore(leftBtn, scroll);
    wrapper.appendChild(rightBtn);

    function updateArrows() {
      const hasOverflow = scroll.scrollWidth > scroll.clientWidth + 2;
      wrapper.classList.toggle('has-overflow', hasOverflow);

      const atStart = scroll.scrollLeft <= 2;
      const atEnd   = scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 2;

      leftBtn.disabled = !hasOverflow || atStart;
      rightBtn.disabled = !hasOverflow || atEnd;
    }

    leftBtn.addEventListener('click', () => {
      scroll.scrollBy({ left: -200, behavior: 'smooth' });
    });
    rightBtn.addEventListener('click', () => {
      scroll.scrollBy({ left: 200, behavior: 'smooth' });
    });

    scroll.addEventListener('wheel', (e) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      scroll.scrollLeft += e.deltaY;
    }, { passive: false });

    scroll.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);

    const mo = new MutationObserver(() => {
      updateArrows();
      scrollToActive();
    });
    mo.observe(scroll, { childList: true, subtree: false });

    function scrollToActive() {
      const active = scroll.querySelector('.is-active');
      if (!active) return;
      const sl = scroll.scrollLeft;
      const cw = scroll.clientWidth;
      const al = active.offsetLeft;
      const aw = active.offsetWidth;
      if (al < sl || al + aw > sl + cw) {
        scroll.scrollTo({ left: Math.max(0, al - 24), behavior: 'smooth' });
      }
    }
    document.addEventListener('app-tab-changed', scrollToActive);
    scroll.addEventListener('click', () => setTimeout(scrollToActive, 100));

    setTimeout(() => {
      updateArrows();
      scrollToActive();
    }, 60);
  }

  NAV.bar = { render: renderBar };
})();