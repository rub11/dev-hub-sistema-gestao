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
  }

  NAV.bar = { render: renderBar };
})();