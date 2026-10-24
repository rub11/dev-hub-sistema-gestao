/* =========================================================
   DEV HUB · Navegação · dropdown de módulos (botão "+")
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV;
  const state = NAV.state;

  function openModuleMenu() {
    if (state.menuEl && !state.menuEl.hidden) { closeModuleMenu(); return; }

    const plusBtn = document.getElementById('app-tabs-new');
    if (!plusBtn) return;

    if (state.menuEl && state.menuEl.parentNode) state.menuEl.parentNode.removeChild(state.menuEl);
    state.menuEl = buildModuleMenu();
    document.body.appendChild(state.menuEl);
    wireMenuPointerGuards(state.menuEl);

    state.menuEl.hidden = false;
    positionMenu(state.menuEl, plusBtn);

    requestAnimationFrame(function () {
      if (state.menuEl && !state.menuEl.hidden) positionMenu(state.menuEl, plusBtn);
    });
  }

  function closeModuleMenu() {
    if (state.menuEl) state.menuEl.hidden = true;
  }

  function wireMenuPointerGuards(menu) {
    menu.addEventListener('mouseenter', function () { state.menuHovered = true; });
    menu.addEventListener('mouseleave', function () { state.menuHovered = false; });
    menu.addEventListener('scroll', function (e) { e.stopPropagation(); }, true);
    menu.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    menu.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  function buildModuleMenu() {
    const el = document.createElement('div');
    el.className = 'tnav-menu';
    el.setAttribute('role', 'menu');
    el.hidden = true;

    const items = NAV.roles.visibleItems();
    const activeId = NAV.currentPageId();
    const openTabs = {};
    NAV.tabs.read().forEach(function (t) { openTabs[t.id] = true; });

    // Dashboard fica solto no topo
    const dashItem = items.find(function (i) { return i.id === 'dashboard'; });
    if (dashItem) {
      el.appendChild(buildMenuItem(dashItem, activeId, openTabs, false));
      el.appendChild(makeSep());
    }

    const groupButtons = []; // Guarda os botões para fechar os outros quando um abrir

    // Renderiza os grupos como Acordeões (Sanfona)
    NAV.GROUP_ORDER.forEach(function (groupName) {
      const groupItems = items.filter(function (i) { return i.group === groupName; });
      if (groupItems.length === 0) return;

      // Se a página atual estiver neste grupo, já abre a pasta
      const hasActive = groupItems.some(i => i.id === activeId);
      const isOpen = hasActive; 

      // Botão da "Pasta" (ex: COMERCIAL)
      const groupBtn = document.createElement('button');
      groupBtn.type = 'button';
      groupBtn.className = 'tnav-menu__group-btn' + (isOpen ? ' is-open' : '');
      groupBtn.innerHTML = `
        <span class="tnav-menu__group-label">${groupName}</span>
        <svg class="tnav-menu__group-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      `;

      // Container com os itens da pasta
      const groupContainer = document.createElement('div');
      groupContainer.className = 'tnav-menu__group-items';
      if (!isOpen) groupContainer.hidden = true;

      groupItems.forEach(function (it) {
        groupContainer.appendChild(buildMenuItem(it, activeId, openTabs, true));
      });

      // Lógica de abrir/fechar a pasta (Sanfona)
      groupBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        
        const nowOpen = !groupBtn.classList.contains('is-open');
        
        // Fecha todos os outros
        groupButtons.forEach(function(btn) {
          btn.classList.remove('is-open');
          const container = btn.nextElementSibling;
          if (container && container.classList.contains('tnav-menu__group-items')) {
            container.hidden = true;
          }
        });

        // Se estava fechado, abre o atual
        if (nowOpen) {
          groupBtn.classList.add('is-open');
          groupContainer.hidden = false;
        }
      });

      groupButtons.push(groupBtn);

      el.appendChild(groupBtn);
      el.appendChild(groupContainer);
    });

    el.appendChild(makeSep());

    // Botão fechar tudo
    const closeAll = document.createElement('button');
    closeAll.type = 'button';
    closeAll.className = 'tnav-menu__item tnav-menu__item--danger';
    closeAll.setAttribute('role', 'menuitem');
    closeAll.innerHTML =
      '<span class="tnav-menu__icon">' + NAV.ICONS.close + '</span>' +
      '<span class="tnav-menu__label">Fechar todas as abas</span>';
    closeAll.addEventListener('click', function () {
      closeModuleMenu();
      NAV.tabs.clearAll();
    });
    el.appendChild(closeAll);

    return el;
  }

  function buildMenuItem(item, activeId, openTabs, indent) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tnav-menu__item';
    if (indent) btn.classList.add('tnav-menu__item--indent');
    if (item.id === activeId) btn.classList.add('is-active');
    if (openTabs[item.id]) btn.classList.add('is-open');
    btn.setAttribute('role', 'menuitem');

    const icon = document.createElement('span');
    icon.className = 'tnav-menu__icon';
    icon.innerHTML = NAV.ICONS[item.icon] || '';

    const label = document.createElement('span');
    label.className = 'tnav-menu__label';
    label.textContent = item.label;

    btn.appendChild(icon);
    btn.appendChild(label);

    if (openTabs[item.id] && item.id !== activeId) {
      const dot = document.createElement('span');
      dot.className = 'tnav-menu__dot';
      dot.title = 'Aba aberta';
      btn.appendChild(dot);
    }

    btn.addEventListener('click', function () {
      closeModuleMenu();
      NAV.tabs.open(item);
    });

    return btn;
  }

  function makeSep() {
    const sep = document.createElement('div');
    sep.className = 'tnav-menu__sep';
    sep.setAttribute('role', 'separator');
    return sep;
  }

  function positionMenu(menu, anchor) {
    if (!menu || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const margin = 8;

    let top = rect.bottom + 6;
    let left = rect.left;

    const mRect = menu.getBoundingClientRect();

    if (left + mRect.width > window.innerWidth - margin) {
      left = window.innerWidth - mRect.width - margin;
    }
    if (left < margin) left = margin;

    if (top + mRect.height > window.innerHeight - margin) {
      const above = rect.top - 6 - mRect.height;
      if (above >= margin) {
        top = above;
      } else {
        top = Math.max(margin, window.innerHeight - mRect.height - margin);
      }
    }

    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
  }

  NAV.moduleMenu = {
    open: openModuleMenu,
    close: closeModuleMenu,
    position: positionMenu
  };
})();