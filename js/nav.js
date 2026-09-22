/* =========================================================
   DEV HUB · Navegação centralizada + Papéis
   ---------------------------------------------------------
   Renderiza a sidebar por role. Marca estado ativo pela URL.
   Também renderiza o painel do usuário (topbar).
   Deve ser carregado APÓS auth.js e ANTES do módulo da página.
   ========================================================= */

(function () {
  'use strict';

  const CAPABILITIES = {
    platform_admin: ['platform'],
    admin: ['operations', 'management', 'admin_settings'],
    administrador: ['operations', 'management', 'admin_settings'],
    gestor: ['operations', 'management'],
    manager: ['operations', 'management'],
    user: ['operations'],
    usuario: ['operations'],
    'usuário': ['operations']
  };

  const ROLE_LABELS = {
    platform_admin: 'Administrador da Plataforma',
    admin: 'Administrador',
    administrador: 'Administrador',
    gestor: 'Gestor',
    manager: 'Gestor',
    user: 'Funcionário',
    usuario: 'Funcionário',
    'usuário': 'Funcionário'
  };

  function readContext() {
    let role = '';
    let isPlatform = false;
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (raw) {
        const data = JSON.parse(raw);
        role = String(data.role || '').toLowerCase();
        isPlatform = data.is_platform_admin === true;
      }
    } catch (e) { /* ignora */ }
    if (role === 'platform_admin') isPlatform = true;
    return { role: role, isPlatform: isPlatform };
  }

  function capsForRole(role, isPlatform) {
    const baseCaps = CAPABILITIES[String(role || '').toLowerCase()] || ['operations'];
    if (isPlatform) {
      return baseCaps.concat(['platform']);
    }
    return baseCaps;
  }

  function currentCapabilities() {
    const ctx = readContext();
    return capsForRole(ctx.role, ctx.isPlatform);
  }

  const DHRoles = {
    current() { return readContext().role; },
    isPlatformAdmin() { return readContext().isPlatform; },
    isAdmin() { const r = readContext().role; return r === 'admin' || r === 'administrador'; },
    isGestor() { const r = readContext().role; return r === 'gestor' || r === 'manager'; },
    isUser() { const r = readContext().role; return r === 'user' || r === 'usuario' || r === 'usuário'; },

    hasCapability(cap, role) {
      const ctx = readContext();
      const caps = role
        ? capsForRole(role, role === 'platform_admin')
        : capsForRole(ctx.role, ctx.isPlatform);
      return caps.indexOf(String(cap || '').toLowerCase()) !== -1;
    },

    canAccessManagement(role) { return DHRoles.hasCapability('management', role); },
    canAccessAdminSettings(role) { return DHRoles.hasCapability('admin_settings', role); },
    canAccessPlatform(role) { return DHRoles.hasCapability('platform', role); },

    label(role) {
      const r = String(role || '').trim().toLowerCase();
      if (ROLE_LABELS[r]) return ROLE_LABELS[r];
      return r ? r.charAt(0).toUpperCase() + r.slice(1) : '';
    }
  };

  window.DHRoles = DHRoles;

  const ICONS = {
    dashboard: '<svg class="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" /></svg>',
    vendas: '<svg class="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2.5 3.5h2.3l2.3 11.6a1.8 1.8 0 0 0 1.8 1.4h8.8a1.8 1.8 0 0 0 1.8-1.4L21 7.5H6" /></svg>',
    notas: '<svg class="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z" /><path d="M14 2.5v5h5" /><path d="M9 13h6M9 17h4" /></svg>',
    clientes: '<svg class="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7.5" r="3.5" /><path d="M22 20v-1.5a4 4 0 0 0-3-3.87" /><path d="M16.5 4.13a4 4 0 0 1 0 7.75" /></svg>',
    produtos: '<svg class="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 8-9-5-9 5v8l9 5 9-5z" /><path d="m3 8 9 5 9-5" /><path d="M12 21v-8" /></svg>',
    estoque: '<svg class="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 2.5 9 5-9 5-9-5z" /><path d="m3 12.5 9 5 9-5" /><path d="m3 17.5 9 5 9-5" /></svg>',
    relatorios: '<svg class="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m7 15 3.5-4 3 2.5L20 7" /></svg>',
    gestao: '<svg class="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7.5" r="3.5" /><path d="M22 20v-1.5a4 4 0 0 0-3-3.87" /><path d="M16.5 4.13a4 4 0 0 1 0 7.75" /></svg>',
    configuracoes: '<svg class="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></svg>',
    empresas: '<svg class="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18" /><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" /><path d="M15 21V9h4a2 2 0 0 1 2 2v10" /><path d="M9 7h2M9 11h2M9 15h2" /></svg>',
    usuarios: '<svg class="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7.5" r="3.5" /><path d="M22 20v-1.5a4 4 0 0 0-3-3.87" /></svg>',
    logout: '<svg class="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>'
  };

  const MENU = [
    {
      section: 'Operação',
      capability: 'operations',
      items: [
        { id: 'dashboard',  label: 'Dashboard',  href: 'dashboard.html',  icon: 'dashboard' },
        { id: 'vendas',     label: 'Vendas',     href: 'vendas.html',     icon: 'vendas' },
        { id: 'notas',      label: 'Notas',      href: 'notas.html',      icon: 'notas' },
        { id: 'clientes',   label: 'Clientes',   href: 'clientes.html',   icon: 'clientes' },
        { id: 'produtos',   label: 'Produtos',   href: 'produtos.html',   icon: 'produtos' },
        { id: 'estoque',    label: 'Estoque',    href: 'estoque.html',    icon: 'estoque' },
        { id: 'relatorios', label: 'Relatórios', href: 'relatorios.html', icon: 'relatorios' }
      ]
    },
    {
      section: 'Administração',
      capability: 'management',
      items: [
        { id: 'gestao', label: 'Gestão', href: 'gestao.html', icon: 'gestao' },
        {
          id: 'configuracoes',
          label: 'Configurações da Empresa',
          href: 'configuracoes.html',
          icon: 'configuracoes',
          requiresCapability: 'admin_settings'
        }
      ]
    },
    {
      section: 'Plataforma',
      capability: 'platform',
      items: [
        { id: 'plataforma',    label: 'Dashboard',                    href: 'plataforma.html',              icon: 'dashboard' },
        { id: 'empresas',      label: 'Empresas',                     href: 'plataforma.html#empresas',     icon: 'empresas' },
        { id: 'plat-usuarios', label: 'Usuários',                     href: 'plataforma-usuarios.html',     icon: 'usuarios' },
        { id: 'plat-config',   label: 'Configurações da Plataforma', href: 'plataforma-configuracoes.html', icon: 'configuracoes' }
      ]
    }
  ];

  function currentPageId() {
    const path = (window.location.pathname || '').split('/').pop() || 'index.html';
    const file = path.replace(/\.html?$/i, '').toLowerCase();
    const hash = String(window.location.hash || '').toLowerCase();

    if (file === 'plataforma') {
      return hash === '#empresas' ? 'empresas' : 'plataforma';
    }

    const MAP = {
      dashboard: 'dashboard',
      vendas: 'vendas',
      notas: 'notas',
      clientes: 'clientes',
      produtos: 'produtos',
      estoque: 'estoque',
      relatorios: 'relatorios',
      gestao: 'gestao',
      funcionarios: 'gestao',
      configuracoes: 'configuracoes',
      'plataforma-configuracoes': 'plat-config',
      'plataforma-usuarios': 'plat-usuarios'
    };

    return MAP[file] || file;
  }

  function buildSection(section, caps, activeId, withTopMargin) {
    if (section.capability && caps.indexOf(section.capability) === -1) return '';

    const parts = [];
    const style = withTopMargin ? ' style="margin-top:10px;"' : '';
    parts.push('<p class="nav__label"' + style + '>' + section.section + '</p>');

    section.items.forEach(function (item) {
      if (item.requiresCapability && caps.indexOf(item.requiresCapability) === -1) return;

      if (item.soon) {
        parts.push(
          '<button type="button" class="nav__item" aria-disabled="true" title="Em breve">' +
          ICONS[item.icon] + '<span>' + item.label + '</span>' +
          '<span class="nav__badge">Em breve</span>' +
          '</button>'
        );
        return;
      }

      const isActive = item.id === activeId;
      const cls = 'nav__item' + (isActive ? ' is-active' : '');
      const aria = isActive ? ' aria-current="page"' : '';

      parts.push(
        '<a class="' + cls + '" href="' + item.href + '"' + aria + '>' +
        ICONS[item.icon] + '<span>' + item.label + '</span>' +
        '</a>'
      );
    });

    return parts.join('');
  }

  function buildSidebarHTML(caps, activeId) {
    const parts = [];

    parts.push(
      '<div class="sidebar__brand">' +
      '<span class="brand__mark" aria-hidden="true">DH</span>' +
      '<span class="brand__name">DEV HUB</span>' +
      '</div>'
    );

    parts.push('<nav class="nav" aria-label="Módulos">');
    MENU.forEach(function (section, idx) {
      parts.push(buildSection(section, caps, activeId, idx > 0));
    });
    parts.push('</nav>');

    parts.push('<div class="sidebar__spacer"></div>');

    parts.push('<nav class="nav" aria-label="Sistema">');
    parts.push('<div class="nav__sep" role="presentation"></div>');

    if (caps.indexOf('operations') !== -1) {
      const isConf = activeId === 'configuracoes';
      parts.push(
        '<a class="nav__item' + (isConf ? ' is-active' : '') + '" href="configuracoes.html"' +
        (isConf ? ' aria-current="page"' : '') + '>' +
        ICONS.configuracoes +
        '<span>Minha Conta</span>' +
        '</a>'
      );
    }

    parts.push(
      '<button type="button" class="nav__item nav__item--danger" data-action="logout">' +
      ICONS.logout + '<span>Sair</span>' +
      '</button>'
    );
    parts.push('</nav>');

    return parts.join('');
  }

  /* ---------------------------------------------------------
     Painel do usuário (topbar)
     --------------------------------------------------------- */
  function buildUserMenuHTML(caps) {
    const parts = [];

    // Item pessoal — sempre presente para roles operacionais
    if (caps.indexOf('operations') !== -1) {
      parts.push(
        '<a class="menu-item" role="menuitem" href="configuracoes.html">' +
        '<span>Minha Conta</span>' +
        '</a>'
      );
    }

    // Platform admin — atalho para Configurações da Plataforma
    if (caps.indexOf('platform') !== -1) {
      parts.push(
        '<a class="menu-item" role="menuitem" href="plataforma-configuracoes.html">' +
        '<span>Configurações da Plataforma</span>' +
        '</a>'
      );
    }

    // Divisor antes de Sair (se houver itens acima)
    if (parts.length > 0) {
      parts.push('<div class="menu-item__sep" role="separator"></div>');
    }

    // Sair — sempre
    parts.push(
      '<button type="button" class="menu-item menu-item--danger" role="menuitem" data-action="logout">' +
      '<span>Sair</span>' +
      '</button>'
    );

    return parts.join('');
  }

  function closeSidebar() {
    if (!document.body.classList.contains('sidebar-open')) return;
    document.body.classList.remove('sidebar-open');
    const toggle = document.getElementById('menu-toggle');
    const overlay = document.getElementById('sidebar-overlay');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menu');
    }
    if (overlay) overlay.hidden = true;
  }

  function bindLogout(scope) {
    scope.querySelectorAll('[data-action="logout"]').forEach(function (btn) {
      // Evita re-bind se já foi ligado
      if (btn.dataset.logoutBound === '1') return;
      btn.dataset.logoutBound = '1';

      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        if (window.Auth && typeof window.Auth.signOut === 'function') {
          window.Auth.signOut();
        } else {
          window.location.href = 'index.html';
        }
      });
    });
  }

  function renderSidebar() {
    const aside = document.getElementById('sidebar');
    if (!aside) return;

    const caps = currentCapabilities();
    const activeId = currentPageId();

    aside.innerHTML = buildSidebarHTML(caps, activeId);
    bindLogout(aside);

    aside.querySelectorAll('a.nav__item').forEach(function (link) {
      link.addEventListener('click', closeSidebar);
    });

    /* ---------- Painel do usuário ---------- */
    const userPanel = document.getElementById('user-menu-panel');
    if (userPanel) {
      userPanel.innerHTML = buildUserMenuHTML(caps);
      bindLogout(userPanel);
    }

    const ctx = readContext();
    document.documentElement.setAttribute(
      'data-role',
      ctx.isPlatform ? 'platform_admin' : (ctx.role || 'guest')
    );
  }

  renderSidebar();
})();