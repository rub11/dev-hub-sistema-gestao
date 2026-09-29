/* =========================================================
   DEV HUB · Navegação horizontal + ABAS TIPO NAVEGADOR
   ---------------------------------------------------------
   - Topnav horizontal com dropdowns por módulo
   - Barra de abas (chrome-style) abaixo do topnav
   - Command palette (busca) que abre itens como abas
   - Guard de permissão por item: mostra modal se negado
   ========================================================= */

(function () {
  'use strict';

  /* =========================================================
     ANTI-FLASH · Aplica o layout topnav o mais cedo possível
     ========================================================= */
  (function applyEarlyTopnavLayout() {
    try {
      if (/[?&]blocked=1/.test(location.search)) return;
      injectStyles();
      document.documentElement.classList.add('layout-topnav');
    } catch (e) { /* nunca deixa isso quebrar a página */ }
  })();

  /* =========================================================
     Fallback por role
     ========================================================= */
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

  const ITEM_PERM = {
    dashboard:        'dashboard.view',
    vendas:           'sales.view',
    notas:            'notes.view',
    'notas-fiscal':   'invoices.view',
    clientes:         'customers.view',
    produtos:         'products.view',
    estoque:          'stock.view',
    relatorios:       'reports.view',
    gestao:           'management.view',
    plataforma:       'platform',
    empresas:         'platform',
    'plat-usuarios':  'platform',
    'plat-config':    'platform'
  };

  /* =========================================================
     Chave de persistência das abas
     ========================================================= */
  const TABS_KEY = 'devhub_tabs';
  const MAX_TABS = 12; // trava de segurança

  /* =========================================================
     Leitura de contexto
     ========================================================= */
  function readContext() {
    let role = '';
    let isPlatform = false;
    let roleSlug = '';
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (raw) {
        const data = JSON.parse(raw);
        role = String(data.role || '').toLowerCase();
        isPlatform = data.is_platform_admin === true;
        roleSlug = String(data.role_slug || '').toLowerCase();
      }
    } catch (e) { /* ignora */ }
    return { role, isPlatform, roleSlug };
  }

  function capsForRole(role, isPlatform) {
    const baseCaps = CAPABILITIES[String(role || '').toLowerCase()] || ['operations'];
    if (isPlatform && baseCaps.indexOf('platform') === -1) {
      return baseCaps.concat(['platform']);
    }
    return baseCaps;
  }

  function currentCapabilities() {
    const ctx = readContext();
    return capsForRole(ctx.role, ctx.isPlatform);
  }

  /* =========================================================
     DHRoles
     ========================================================= */
  const DHRoles = {
    current() { return readContext().role; },
    currentSlug() { return readContext().roleSlug; },
    isPlatformAdmin() { return readContext().isPlatform; },
    isAdmin() { const r = readContext().role; return r === 'admin' || r === 'administrador'; },
    isGestor() { const r = readContext().role; return r === 'gestor' || r === 'manager'; },
    isUser() { const r = readContext().role; return r === 'user' || r === 'usuario' || r === 'usuário'; },
    hasCapability(cap, role) {
      const ctx = readContext();
      const caps = role
        ? capsForRole(role, false)
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

  /* =========================================================
     Permissões
     ========================================================= */
  function hasPermission(cap) {
    if (!cap) return true;
    if (cap === 'platform') return readContext().isPlatform;

    if (window.Perms && typeof window.Perms.has === 'function') {
      if (typeof window.Perms.list === 'function') {
        const list = window.Perms.list();
        if (list && Object.keys(list).length === 0) return true;
      }
      return window.Perms.has(cap);
    }
    return true;
  }

  /* =========================================================
     Ícones
     ========================================================= */
  const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" /></svg>',
    vendas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2.5 3.5h2.3l2.3 11.6a1.8 1.8 0 0 0 1.8 1.4h8.8a1.8 1.8 0 0 0 1.8-1.4L21 7.5H6" /></svg>',
    notas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z" /><path d="M14 2.5v5h5" /><path d="M9 13h6M9 17h4" /></svg>',
    'notas-fiscal': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z" /><path d="M14 2.5v5h5" /><path d="M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" /></svg>',
    clientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7.5" r="3.5" /><path d="M22 20v-1.5a4 4 0 0 0-3-3.87" /><path d="M16.5 4.13a4 4 0 0 1 0 7.75" /></svg>',
    produtos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 8-9-5-9 5v8l9 5 9-5z" /><path d="m3 8 9 5 9-5" /><path d="M12 21v-8" /></svg>',
    estoque: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 2.5 9 5-9 5-9-5z" /><path d="m3 12.5 9 5 9-5" /><path d="m3 17.5 9 5 9-5" /></svg>',
    relatorios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m7 15 3.5-4 3 2.5L20 7" /></svg>',
    gestao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7.5" r="3.5" /><path d="M22 20v-1.5a4 4 0 0 0-3-3.87" /><path d="M16.5 4.13a4 4 0 0 1 0 7.75" /></svg>',
    configuracoes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></svg>',
    empresas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18" /><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" /><path d="M15 21V9h4a2 2 0 0 1 2 2v10" /><path d="M9 7h2M9 11h2M9 15h2" /></svg>',
    usuarios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7.5" r="3.5" /><path d="M22 20v-1.5a4 4 0 0 0-3-3.87" /></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>'
  };

  /* =========================================================
     Estrutura do topnav
     ========================================================= */
  const TOPNAV = [
    { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: 'dashboard' },
    {
      id: 'comercial',
      label: 'Comercial',
      icon: 'vendas',
      items: [
        { id: 'vendas',        label: 'Vendas',        href: 'vendas.html',       icon: 'vendas' },
        { id: 'notas',         label: 'Notas',         href: 'notas.html',        icon: 'notas' },
        { id: 'notas-fiscal',  label: 'Notas fiscais', href: 'notas-fiscal.html', icon: 'notas-fiscal' },
        { id: 'clientes',      label: 'Clientes',      href: 'clientes.html',     icon: 'clientes' }
      ]
    },
    {
      id: 'catalogo',
      label: 'Catálogo',
      icon: 'produtos',
      items: [
        { id: 'produtos', label: 'Produtos', href: 'produtos.html', icon: 'produtos' },
        { id: 'estoque',  label: 'Estoque',  href: 'estoque.html',  icon: 'estoque' }
      ]
    },
    {
      id: 'analise',
      label: 'Análise',
      icon: 'relatorios',
      items: [
        { id: 'relatorios', label: 'Relatórios', href: 'relatorios.html', icon: 'relatorios' }
      ]
    },
    {
      id: 'administracao',
      label: 'Administração',
      capability: 'management',
      icon: 'gestao',
      items: [
        { id: 'gestao', label: 'Gestão de usuários', href: 'gestao.html', icon: 'gestao' }
      ]
    },
    {
      id: 'plataforma',
      label: 'Plataforma',
      capability: 'platform',
      icon: 'configuracoes',
      items: [
        { id: 'plataforma',    label: 'Dashboard da plataforma',     href: 'plataforma.html',               icon: 'dashboard' },
        { id: 'empresas',      label: 'Empresas',                    href: 'plataforma.html#empresas',      icon: 'empresas' },
        { id: 'plat-usuarios', label: 'Usuários da plataforma',      href: 'plataforma-usuarios.html',      icon: 'usuarios' },
        { id: 'plat-config',   label: 'Configurações da plataforma', href: 'plataforma-configuracoes.html', icon: 'configuracoes' }
      ]
    }
  ];

  /* =========================================================
     Página atual
     ========================================================= */
  function currentPageId() {
    const path = (window.location.pathname || '').split('/').pop() || 'index.html';
    const file = path.replace(/\.html?$/i, '').toLowerCase();
    const hash = String(window.location.hash || '').toLowerCase();

    if (file === 'plataforma') return hash === '#empresas' ? 'empresas' : 'plataforma';

    const MAP = {
      dashboard: 'dashboard', vendas: 'vendas', notas: 'notas',
      'notas-fiscal': 'notas-fiscal', clientes: 'clientes',
      produtos: 'produtos', estoque: 'estoque', relatorios: 'relatorios',
      gestao: 'gestao', funcionarios: 'gestao',
      configuracoes: 'configuracoes',
      'plataforma-configuracoes': 'plat-config',
      'plataforma-usuarios': 'plat-usuarios'
    };
    return MAP[file] || file;
  }

  /* =========================================================
     Busca um item do TOPNAV pelo id (retorna entry ou item)
     ========================================================= */
  function findEntryById(id) {
    for (let i = 0; i < TOPNAV.length; i += 1) {
      const entry = TOPNAV[i];
      if (!entry.items) {
        if (entry.id === id) return entry;
        continue;
      }
      for (let j = 0; j < entry.items.length; j += 1) {
        const it = entry.items[j];
        if (it.id === id) return it;
      }
    }
    return null;
  }

  /* =========================================================
     Índice plano para busca
     ========================================================= */
  function buildSearchIndex() {
    const index = [];
    TOPNAV.forEach(function (entry) {
      if (!entry.items) {
        index.push({
          id: entry.id,
          label: entry.label,
          href: entry.href,
          icon: entry.icon,
          module: null
        });
        return;
      }
      entry.items.forEach(function (it) {
        index.push({
          id: it.id,
          label: it.label,
          href: it.href,
          icon: it.icon,
          module: entry.label
        });
      });
    });
    return index;
  }

  /* =========================================================
     ABAS · persistência
     ========================================================= */
  function readTabs() {
    try {
      const raw = sessionStorage.getItem(TABS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function writeTabs(tabs) {
    try {
      sessionStorage.setItem(TABS_KEY, JSON.stringify(tabs.slice(0, MAX_TABS)));
    } catch (e) { /* ignora */ }
  }

  /**
   * Garante que a página atual tem uma aba registrada.
   * Roda no bootstrap. Se a página não estiver no menu (ex.:
   * configuracoes.html), não cria aba — mas também não quebra.
   */
  function syncCurrentTab() {
    const id = currentPageId();
    const entry = findEntryById(id);
    if (!entry) return;

    const tabs = readTabs();
    const exists = tabs.some(function (t) { return t.id === id; });
    if (exists) return;

    tabs.push({
      id: entry.id,
      label: entry.label,
      href: entry.href,
      icon: entry.icon
    });
    writeTabs(tabs);
  }

  /* =========================================================
     ABAS · render
     ========================================================= */
  function renderTabs() {
    const wrap = document.getElementById('app-tabs');
    if (!wrap) return;

    const tabs = readTabs();
    const activeId = currentPageId();

    wrap.innerHTML = '';

    /* -------- faixa rolável de abas -------- */
    const scroll = document.createElement('div');
    scroll.className = 'app-tabs__scroll';

    if (tabs.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'app-tabs__empty';
      empty.textContent = 'Nenhuma aba aberta';
      scroll.appendChild(empty);
    } else {
      tabs.forEach(function (tab) {
        scroll.appendChild(buildTabEl(tab, tab.id === activeId));
      });
    }

    /* -------- botão "+" (abre o picker) -------- */
    const newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'app-tabs__new';
    newBtn.setAttribute('aria-label', 'Abrir nova aba');
    newBtn.title = 'Abrir nova aba';
    newBtn.innerHTML = ICONS.plus;
    newBtn.addEventListener('click', openTabPicker);

    wrap.appendChild(scroll);
    wrap.appendChild(newBtn);
  }

  function buildTabEl(tab, isActive) {
    const el = document.createElement('div');
    el.className = 'app-tab' + (isActive ? ' is-active' : '');
    el.dataset.tabId = tab.id;
    el.setAttribute('role', 'tab');
    el.setAttribute('tabindex', isActive ? '0' : '-1');
    if (isActive) el.setAttribute('aria-current', 'page');

    const iconSvg = ICONS[tab.icon] || '';

    const icon = document.createElement('span');
    icon.className = 'app-tab__icon';
    icon.innerHTML = iconSvg;
    icon.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'app-tab__label';
    label.textContent = tab.label;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'app-tab__close';
    close.setAttribute('aria-label', 'Fechar aba ' + tab.label);
    close.title = 'Fechar';
    close.innerHTML = ICONS.close;
    close.addEventListener('click', function (ev) {
      ev.stopPropagation();
      closeTab(tab.id);
    });

    el.appendChild(icon);
    el.appendChild(label);
    el.appendChild(close);

    el.addEventListener('click', function (ev) {
      if (ev.target.closest('.app-tab__close')) return;
      if (isActive) return;
      window.location.href = tab.href;
    });

    el.addEventListener('auxclick', function (ev) {
      if (ev.button === 1) closeTab(tab.id);   // botão do meio fecha
    });

    return el;
  }

  /* =========================================================
     ABAS · abrir
     ========================================================= */
  function openEntryAsTab(entry) {
    if (!entry) return;

    /* Guard de permissão */
    const cap = ITEM_PERM[entry.id];
    if (cap && !hasPermission(cap)) {
      showPermissionDenied(entry.label);
      return;
    }

    const tabs = readTabs();
    const exists = tabs.some(function (t) { return t.id === entry.id; });
    if (!exists) {
      tabs.push({
        id: entry.id,
        label: entry.label,
        href: entry.href,
        icon: entry.icon
      });
      writeTabs(tabs);
    }

    window.location.href = entry.href;
  }

  /* =========================================================
     ABAS · fechar
     ========================================================= */
  function closeTab(id) {
    const tabs = readTabs();
    const idx = tabs.findIndex(function (t) { return t.id === id; });
    if (idx === -1) return;

    const isActive = id === currentPageId();
    tabs.splice(idx, 1);
    writeTabs(tabs);

    if (isActive) {
      /* Escolhe a próxima aba: direita, esquerda, ou dashboard */
      const next = tabs[idx] || tabs[idx - 1] || tabs[tabs.length - 1];
      if (next) {
        window.location.href = next.href;
      } else {
        window.location.href = 'dashboard.html';
      }
      return;
    }

    renderTabs();
  }

  /* =========================================================
     MODAL · Acesso negado
     ========================================================= */
  function injectPermissionModal() {
    if (document.getElementById('perm-denied-modal')) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'perm-denied-modal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="modal__backdrop" data-close-perm></div>' +
      '<div class="modal__dialog modal__dialog--sm" role="alertdialog" ' +
           'aria-modal="true" aria-labelledby="perm-denied-title">' +
        '<header class="modal__head">' +
          '<h2 class="modal__title" id="perm-denied-title">Acesso negado</h2>' +
          '<button type="button" class="icon-btn modal__close" ' +
                  'aria-label="Fechar" data-close-perm>' + ICONS.close + '</button>' +
        '</header>' +
        '<div class="modal__body">' +
          '<div class="perm-denied__icon" aria-hidden="true">' + ICONS.lock + '</div>' +
          '<p class="perm-denied__text">' +
            'Você não tem permissão para acessar a tela ' +
            '<strong data-perm-label>—</strong>.' +
          '</p>' +
          '<p class="perm-denied__hint">' +
            'Solicite acesso ao gestor ou administrador da plataforma.' +
          '</p>' +
        '</div>' +
        '<footer class="modal__foot">' +
          '<button type="button" class="btn btn--primary" data-close-perm>Entendi</button>' +
        '</footer>' +
      '</div>';

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-close-perm]').forEach(function (el) {
      el.addEventListener('click', closePermissionModal);
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !modal.hidden) closePermissionModal();
    });
  }

  function showPermissionDenied(label) {
    const modal = document.getElementById('perm-denied-modal');
    if (!modal) return;

    const labelEl = modal.querySelector('[data-perm-label]');
    if (labelEl) labelEl.textContent = '“' + (label || 'essa tela') + '”';

    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    const btn = modal.querySelector('.btn');
    if (btn) btn.focus();
  }

  function closePermissionModal() {
    const modal = document.getElementById('perm-denied-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  /* =========================================================
     PICKER · escolher qual aba abrir (menu "+")
     ========================================================= */
  function openTabPicker() {
    /* Estratégia: reusa o command palette — foca a busca
       com um filtro que só mostra itens ainda não abertos.
       Dessa forma não duplicamos UI. */
    const input = document.getElementById('tnav-search-input');
    if (!input) return;

    /* Fecha o modal de permissão se estiver aberto */
    closePermissionModal();

    /* Foca e limpa a busca para o usuário ver tudo */
    input.value = '';
    input.focus();
    input.select();

    /* Dispara o input pra popular os resultados */
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* =========================================================
     Posiciona o dropdown (position: fixed) abaixo do botão
     ========================================================= */
  function positionDropdown(dd, btn) {
    const rect = btn.getBoundingClientRect();
    const margin = 8;
    const gap = 4;

    const ddWidth = Math.max(dd.offsetWidth || 0, 240);

    let left = rect.left;
    if (left + ddWidth > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - ddWidth - margin);
    }

    let top = rect.bottom + gap;
    const ddHeight = dd.offsetHeight || 0;
    if (ddHeight && top + ddHeight > window.innerHeight - margin) {
      const above = rect.top - gap - ddHeight;
      if (above >= margin) top = above;
    }

    dd.style.top = top + 'px';
    dd.style.left = left + 'px';
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.tnav-group').forEach(function (g) {
      const dd = g.querySelector('.tnav-dropdown');
      const btn = g.querySelector('.tnav-item');
      if (dd && !dd.hidden) {
        dd.hidden = true;
        g.classList.remove('is-open');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* =========================================================
     Estilos
     ========================================================= */
  function injectStyles() {
    if (document.getElementById('devhub-topnav-styles')) return;

    const css = `
      /* =====================================================
         ESCONDE O SIDEBAR ANTIGO
         ===================================================== */
      html.layout-topnav .sidebar,
      html.layout-topnav .sidebar-overlay,
      html.layout-topnav .menu-toggle,
      body.layout-topnav .sidebar,
      body.layout-topnav .sidebar-overlay,
      body.layout-topnav .menu-toggle {
        display: none !important;
      }
      html.layout-topnav .app__body,
      body.layout-topnav .app__body {
        margin-left: 0 !important;
      }

      /* =====================================================
         TOPNAV
         ===================================================== */
      .app-topnav {
        display: flex;
        align-items: center;
        gap: 2px;
        height: 48px;
        min-height: 48px;
        padding: 0 16px;
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        overflow: visible;
        position: relative;
        z-index: 30;
      }
      .app-topnav:empty { visibility: hidden; }

      .tnav-scroll {
        display: flex;
        align-items: center;
        gap: 2px;
        flex: 1 1 auto;
        min-width: 0;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: thin;
      }
      .tnav-scroll::-webkit-scrollbar { height: 3px; }
      .tnav-scroll::-webkit-scrollbar-thumb {
        background: var(--border-strong);
        border-radius: 2px;
      }

      .tnav-item {
        position: relative;
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        height: 34px;
        padding: 0 14px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--text-soft);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        text-decoration: none;
        transition: background-color var(--transition), color var(--transition);
      }
      .tnav-item svg { width: 16px; height: 16px; flex: none; }

      .tnav-item:hover {
        background: var(--surface-2);
        color: var(--text);
      }
      .tnav-item.is-active {
        background: var(--accent-soft);
        color: var(--accent-hover);
      }

      .tnav-item .tnav-chevron {
        width: 12px;
        height: 12px;
        opacity: 0.6;
        transition: transform var(--transition);
        display: inline-flex;
      }
      .tnav-group { position: relative; }
      .tnav-group.is-open > .tnav-item .tnav-chevron {
        transform: rotate(180deg);
      }

      /* Dropdown */
      .tnav-dropdown {
        position: fixed;
        top: 0;
        left: 0;
        min-width: 240px;
        padding: 6px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface);
        box-shadow: 0 10px 30px -8px rgba(16, 24, 40, 0.18);
        z-index: 9999;
        animation: tnav-pop 140ms ease-out;
      }
      @keyframes tnav-pop {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .tnav-dropdown[hidden] { display: none !important; }

      .tnav-dropdown__item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 12px;
        border-radius: 7px;
        color: var(--text);
        font-size: 13.5px;
        font-weight: 500;
        text-decoration: none;
        transition: background-color var(--transition), color var(--transition);
        cursor: pointer;
      }
      .tnav-dropdown__item svg {
        width: 16px;
        height: 16px;
        flex: none;
        color: var(--text-muted);
      }
      .tnav-dropdown__item:hover { background: var(--surface-2); }
      .tnav-dropdown__item.is-active {
        background: var(--accent-soft);
        color: var(--accent-hover);
      }
      .tnav-dropdown__item.is-active svg { color: var(--accent); }

      .tnav-item--ghost { color: var(--text-muted); font-weight: 500; }
      .tnav-item--ghost:hover { color: var(--text); }
      .tnav-item--danger:hover {
        color: var(--danger);
        background: var(--danger-soft);
      }

      /* ---------- BUSCA ---------- */
      .tnav-search {
        position: relative;
        flex: 0 0 300px;
        margin-right: 12px;
      }
      .tnav-search__control {
        position: relative;
        display: flex;
        align-items: center;
        height: 36px;
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: 8px;
        transition: border-color var(--transition), box-shadow var(--transition);
      }
      .tnav-search__control:focus-within {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px var(--accent-ring);
        background: var(--surface);
      }
      .tnav-search__icon {
        position: absolute;
        left: 10px;
        display: grid;
        place-items: center;
        width: 16px;
        height: 16px;
        color: var(--text-muted);
        pointer-events: none;
      }
      .tnav-search__icon svg { width: 16px; height: 16px; }

      .tnav-search__input {
        width: 100%;
        height: 100%;
        padding: 0 32px 0 34px;
        border: 0;
        background: transparent;
        font-size: 13.5px;
        color: var(--text);
        outline: none;
      }
      .tnav-search__input::placeholder { color: var(--text-muted); }

      .tnav-search__clear {
        position: absolute;
        right: 6px;
        display: none;
        place-items: center;
        width: 24px;
        height: 24px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
      }
      .tnav-search__clear:hover { background: var(--surface); color: var(--text); }
      .tnav-search__clear svg { width: 14px; height: 14px; }
      .tnav-search.has-value .tnav-search__clear { display: grid; }

      .tnav-search__results {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        right: 0;
        max-height: 400px;
        overflow-y: auto;
        padding: 6px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface);
        box-shadow: 0 10px 30px -8px rgba(16, 24, 40, 0.18);
        z-index: 1000;
        animation: tnav-pop 140ms ease-out;
      }
      .tnav-search__results[hidden] { display: none !important; }

      .tnav-search__empty {
        padding: 18px 12px;
        text-align: center;
        font-size: 13px;
        color: var(--text-muted);
      }

      .tnav-search__item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 12px;
        border-radius: 7px;
        color: var(--text);
        font-size: 13.5px;
        font-weight: 500;
        text-decoration: none;
        cursor: pointer;
        transition: background-color var(--transition), color var(--transition);
      }
      .tnav-search__item svg {
        width: 16px;
        height: 16px;
        flex: none;
        color: var(--text-muted);
      }
      .tnav-search__item:hover,
      .tnav-search__item.is-selected {
        background: var(--accent-soft);
        color: var(--accent-hover);
      }
      .tnav-search__item:hover svg,
      .tnav-search__item.is-selected svg { color: var(--accent); }

      .tnav-search__module {
        margin-left: auto;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--surface-2);
        color: var(--text-muted);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }
      .tnav-search__item.is-selected .tnav-search__module {
        background: var(--surface);
      }

      /* =====================================================
         BARRA DE ABAS (browser-style)
         ===================================================== */
      .app-tabs {
        display: flex;
        align-items: stretch;
        height: 38px;
        min-height: 38px;
        padding: 0 8px;
        background: var(--surface-2);
        border-bottom: 1px solid var(--border);
        overflow: hidden;
        position: relative;
        z-index: 29;
      }
      .app-tabs:empty { display: none; }

      .app-tabs__scroll {
        display: flex;
        align-items: center;
        gap: 2px;
        flex: 1 1 auto;
        min-width: 0;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
        padding: 4px 0;
      }
      .app-tabs__scroll::-webkit-scrollbar { display: none; }

      .app-tabs__empty {
        padding: 0 10px;
        font-size: 12.5px;
        color: var(--text-muted);
      }

      .app-tab {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 30px;
        padding: 0 6px 0 10px;
        border: 1px solid transparent;
        border-radius: 8px 8px 0 0;
        background: transparent;
        color: var(--text-soft);
        font-size: 12.5px;
        font-weight: 500;
        cursor: pointer;
        max-width: 220px;
        min-width: 0;
        transition: background-color var(--transition), color var(--transition),
                    border-color var(--transition);
        position: relative;
      }
      .app-tab:hover {
        background: var(--surface);
        color: var(--text);
        border-color: var(--border);
        border-bottom-color: transparent;
      }
      .app-tab.is-active {
        background: var(--surface);
        color: var(--text);
        border-color: var(--border);
        border-bottom-color: transparent;
        box-shadow: 0 -1px 0 0 var(--accent) inset;
      }
      .app-tab.is-active::before {
        content: "";
        position: absolute;
        inset: -1px -1px auto -1px;
        height: 2px;
        background: var(--accent);
        border-radius: 8px 8px 0 0;
      }

      .app-tab__icon {
        display: inline-flex;
        flex: none;
        width: 14px;
        height: 14px;
        color: var(--text-muted);
      }
      .app-tab__icon svg { width: 14px; height: 14px; }
      .app-tab.is-active .app-tab__icon { color: var(--accent); }

      .app-tab__label {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .app-tab__close {
        flex: none;
        display: grid;
        place-items: center;
        width: 20px;
        height: 20px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        opacity: 0.6;
        transition: opacity var(--transition), background-color var(--transition),
                    color var(--transition);
      }
      .app-tab__close svg { width: 11px; height: 11px; }
      .app-tab__close:hover {
        opacity: 1;
        background: var(--danger-soft);
        color: var(--danger);
      }
      .app-tab.is-active .app-tab__close { opacity: 0.8; }

      .app-tabs__new {
        flex: none;
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        margin: 4px 4px 4px 6px;
        border: 1px solid transparent;
        border-radius: 8px;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        transition: background-color var(--transition), color var(--transition),
                    border-color var(--transition);
      }
      .app-tabs__new svg { width: 14px; height: 14px; }
      .app-tabs__new:hover {
        background: var(--surface);
        border-color: var(--border);
        color: var(--text);
      }
      .app-tabs__new:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      /* =====================================================
         MODAL DE ACESSO NEGADO
         ===================================================== */
      .perm-denied__icon {
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        margin: 0 auto 6px;
        border-radius: 12px;
        background: var(--danger-soft);
        color: var(--danger);
      }
      .perm-denied__icon svg { width: 22px; height: 22px; }

      .perm-denied__text {
        margin: 0;
        text-align: center;
        font-size: 14.5px;
        color: var(--text);
        line-height: 1.55;
      }
      .perm-denied__text strong { color: var(--text); font-weight: 700; }

      .perm-denied__hint {
        margin: 6px 0 0;
        text-align: center;
        font-size: 13px;
        color: var(--text-soft);
        line-height: 1.5;
      }

      /* =====================================================
         Dark mode
         ===================================================== */
      [data-theme="dark"] .app-tabs {
        background: rgba(0, 0, 0, 0.18);
      }
      [data-theme="dark"] .app-tab:hover,
      [data-theme="dark"] .app-tab.is-active {
        background: var(--surface);
      }

      /* =====================================================
         Responsivo
         ===================================================== */
      @media (max-width: 900px) {
        .tnav-search { flex: 1 1 auto; min-width: 160px; margin-right: 6px; }
      }

      @media (max-width: 640px) {
        .app-topnav { padding: 0 8px; gap: 0; }
        .tnav-item { padding: 0 8px; font-size: 12px; }
        .tnav-item span.tnav-label { display: none; }

        .app-tabs { height: 34px; min-height: 34px; padding: 0 4px; }
        .app-tab {
          max-width: 140px;
          font-size: 12px;
          padding: 0 4px 0 8px;
        }
        .app-tab__label { font-size: 11.5px; }
      }
    `;

    const style = document.createElement('style');
    style.id = 'devhub-topnav-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* =========================================================
     Render do topnav + abas
     ========================================================= */
  function renderTopnav() {
    const caps = currentCapabilities();
    const activeId = currentPageId();

    const appBody = document.querySelector('.app__body');
    if (!appBody) return;

    const topbar = appBody.querySelector('.topbar');

    /* -------- topnav -------- */
    let topnav = document.getElementById('app-topnav');
    if (!topnav) {
      topnav = document.createElement('nav');
      topnav.id = 'app-topnav';
      topnav.className = 'app-topnav';
      topnav.setAttribute('aria-label', 'Módulos');

      if (topbar && topbar.nextSibling) {
        appBody.insertBefore(topnav, topbar.nextSibling);
      } else if (topbar) {
        appBody.appendChild(topnav);
      } else {
        appBody.insertBefore(topnav, appBody.firstChild);
      }
    }
    topnav.hidden = false;

    /* -------- barra de abas (abaixo do topnav) -------- */
    let tabsBar = document.getElementById('app-tabs');
    if (!tabsBar) {
      tabsBar = document.createElement('div');
      tabsBar.id = 'app-tabs';
      tabsBar.className = 'app-tabs';
      tabsBar.setAttribute('role', 'tablist');
      tabsBar.setAttribute('aria-label', 'Abas abertas');
      topnav.parentNode.insertBefore(tabsBar, topnav.nextSibling);
    }

    /* ---------- barra de busca ---------- */
    const searchHTML =
      '<div class="tnav-search" id="tnav-search">' +
        '<div class="tnav-search__control">' +
          '<span class="tnav-search__icon">' + ICONS.search + '</span>' +
          '<input type="search" class="tnav-search__input" id="tnav-search-input" ' +
                 'placeholder="Buscar no menu… (Ctrl+K)" ' +
                 'autocomplete="off" spellcheck="false" ' +
                 'aria-label="Buscar opção do menu" ' +
                 'aria-autocomplete="list" aria-controls="tnav-search-results" ' +
                 'aria-expanded="false" />' +
          '<button type="button" class="tnav-search__clear" id="tnav-search-clear" ' +
                  'aria-label="Limpar busca">' + ICONS.close + '</button>' +
        '</div>' +
        '<div class="tnav-search__results" id="tnav-search-results" role="listbox" hidden></div>' +
      '</div>';

    /* ---------- itens do menu ---------- */
    const itemsHTML = [];

    TOPNAV.forEach(function (entry) {
      if (entry.capability && caps.indexOf(entry.capability) === -1) {
        if (!entry.items) return;
        const visible = entry.items.some(function (it) {
          return hasPermission(ITEM_PERM[it.id]);
        });
        if (!visible) return;
      }

      if (!entry.items) {
        if (!hasPermission(ITEM_PERM[entry.id])) return;
        const isActive = entry.id === activeId;
        itemsHTML.push(
          '<a class="tnav-item' + (isActive ? ' is-active' : '') +
          '" href="' + entry.href + '"' +
          ' data-entry-id="' + entry.id + '"' +
          (isActive ? ' aria-current="page"' : '') + '>' +
          ICONS[entry.icon] +
          '<span class="tnav-label">' + entry.label + '</span>' +
          '</a>'
        );
        return;
      }

      const visibleItems = entry.items.filter(function (it) {
        return hasPermission(ITEM_PERM[it.id]);
      });
      if (visibleItems.length === 0) return;

      const isGroupActive = visibleItems.some(function (it) { return it.id === activeId; });

      const dropdownHTML = visibleItems.map(function (it) {
        const isActive = it.id === activeId;
        return (
          '<a class="tnav-dropdown__item' + (isActive ? ' is-active' : '') +
          '" href="' + it.href + '"' +
          ' data-entry-id="' + it.id + '"' +
          (isActive ? ' aria-current="page"' : '') + '>' +
          ICONS[it.icon] +
          '<span>' + it.label + '</span>' +
          '</a>'
        );
      }).join('');

      itemsHTML.push(
        '<div class="tnav-group" data-group="' + entry.id + '">' +
          '<button type="button" class="tnav-item' +
            (isGroupActive ? ' is-active' : '') +
            '" aria-haspopup="true" aria-expanded="false">' +
            ICONS[entry.icon] +
            '<span class="tnav-label">' + entry.label + '</span>' +
            '<span class="tnav-chevron">' + ICONS.chevron + '</span>' +
          '</button>' +
          '<div class="tnav-dropdown" hidden>' + dropdownHTML + '</div>' +
        '</div>'
      );
    });

    const systemHTML =
      '<a class="tnav-item tnav-item--ghost" href="configuracoes.html">' +
        ICONS.configuracoes +
        '<span class="tnav-label">Minha Conta</span>' +
      '</a>' +
      '<button type="button" class="tnav-item tnav-item--ghost tnav-item--danger" data-action="logout">' +
        ICONS.logout +
        '<span class="tnav-label">Sair</span>' +
      '</button>';

    topnav.innerHTML =
      '<div class="tnav-scroll">' + itemsHTML.join('') + '</div>' +
      searchHTML +
      systemHTML;

    document.body.classList.add('layout-topnav');

    /* -------- dropdowns -------- */
    topnav.querySelectorAll('.tnav-group').forEach(function (group) {
      const btn = group.querySelector('.tnav-item');
      const dd = group.querySelector('.tnav-dropdown');
      if (!btn || !dd) return;

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const willOpen = dd.hidden;
        closeAllDropdowns();

        if (willOpen) {
          dd.hidden = false;
          group.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
          positionDropdown(dd, btn);
        }
      });
    });

    /* -------- intercepta cliques em itens para criar aba -------- */
    topnav.addEventListener('click', function (e) {
      const link = e.target.closest('a[data-entry-id]');
      if (!link) return;

      const entryId = link.getAttribute('data-entry-id');
      const entry = findEntryById(entryId);
      if (!entry) return;   /* deixa o browser navegar normalmente */

      e.preventDefault();
      openEntryAsTab(entry);
    });

    bindLogout(topnav);
    setupSearch();

    /* -------- render inicial das abas -------- */
    renderTabs();

    const ctx = readContext();
    document.documentElement.setAttribute(
      'data-role',
      ctx.isPlatform ? 'platform_admin' : (ctx.role || 'guest')
    );
  }

  /* =========================================================
     Busca (command palette)
     ========================================================= */
  const searchState = {
    input: null,
    results: null,
    clear: null,
    wrap: null,
    index: [],
    filtered: [],
    selectedIdx: -1
  };

  function setupSearch() {
    searchState.input = document.getElementById('tnav-search-input');
    searchState.results = document.getElementById('tnav-search-results');
    searchState.clear = document.getElementById('tnav-search-clear');
    searchState.wrap = document.getElementById('tnav-search');

    if (!searchState.input || !searchState.results) return;

    const full = buildSearchIndex();
    searchState.index = full.filter(function (item) {
      return hasPermission(ITEM_PERM[item.id]);
    });

    searchState.input.addEventListener('input', onSearchInput);
    searchState.input.addEventListener('focus', onSearchInput);
    searchState.input.addEventListener('keydown', onSearchKeydown);

    if (searchState.clear) {
      searchState.clear.addEventListener('click', function () {
        clearSearch();
        searchState.input.focus();
      });
    }
  }

  function onSearchInput() {
    const q = String(searchState.input.value || '').trim().toLowerCase();

    if (searchState.wrap) {
      searchState.wrap.classList.toggle('has-value', q.length > 0);
    }

    if (!q) {
      closeResults();
      return;
    }

    const words = q.split(/\s+/).filter(Boolean);

    searchState.filtered = searchState.index.filter(function (item) {
      const haystack = (item.label + ' ' + (item.module || '')).toLowerCase();
      return words.every(function (w) { return haystack.indexOf(w) !== -1; });
    });

    searchState.selectedIdx = searchState.filtered.length > 0 ? 0 : -1;
    renderResults();
  }

  function renderResults() {
    const wrap = searchState.results;
    if (!wrap) return;

    if (searchState.filtered.length === 0) {
      wrap.innerHTML = '<div class="tnav-search__empty">Nenhum resultado encontrado.</div>';
      wrap.hidden = false;
      searchState.input.setAttribute('aria-expanded', 'true');
      return;
    }

    wrap.innerHTML = searchState.filtered.map(function (item, idx) {
      const sel = idx === searchState.selectedIdx ? ' is-selected' : '';
      return (
        '<a class="tnav-search__item' + sel + '" href="' + item.href + '" ' +
           'data-idx="' + idx + '" data-entry-id="' + item.id + '" role="option" ' +
           (sel ? 'aria-selected="true"' : '') + '>' +
          ICONS[item.icon] +
          '<span>' + item.label + '</span>' +
          (item.module ? '<span class="tnav-search__module">' + item.module + '</span>' : '') +
        '</a>'
      );
    }).join('');

    wrap.hidden = false;
    searchState.input.setAttribute('aria-expanded', 'true');

    wrap.querySelectorAll('.tnav-search__item').forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        searchState.selectedIdx = Number(el.dataset.idx);
        updateSelectedHighlight();
      });

      el.addEventListener('click', function (ev) {
        ev.preventDefault();
        const entryId = el.getAttribute('data-entry-id');
        const entry = findEntryById(entryId);
        if (!entry) return;
        clearSearch();
        openEntryAsTab(entry);
      });
    });
  }

  function updateSelectedHighlight() {
    const wrap = searchState.results;
    if (!wrap) return;
    wrap.querySelectorAll('.tnav-search__item').forEach(function (el, idx) {
      el.classList.toggle('is-selected', idx === searchState.selectedIdx);
      if (idx === searchState.selectedIdx) el.setAttribute('aria-selected', 'true');
      else el.removeAttribute('aria-selected');
    });

    const current = wrap.querySelector('.tnav-search__item.is-selected');
    if (current && current.scrollIntoView) {
      current.scrollIntoView({ block: 'nearest' });
    }
  }

  function onSearchKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeResults();
      searchState.input.blur();
      return;
    }

    if (!searchState.results || searchState.results.hidden) return;

    const len = searchState.filtered.length;
    if (len === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      searchState.selectedIdx = (searchState.selectedIdx + 1) % len;
      updateSelectedHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      searchState.selectedIdx = (searchState.selectedIdx - 1 + len) % len;
      updateSelectedHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = searchState.filtered[searchState.selectedIdx];
      if (item) {
        const entry = findEntryById(item.id);
        if (entry) {
          clearSearch();
          openEntryAsTab(entry);
        }
      }
    }
  }

  function closeResults() {
    if (searchState.results) searchState.results.hidden = true;
    if (searchState.input) searchState.input.setAttribute('aria-expanded', 'false');
  }

  function clearSearch() {
    if (searchState.input) searchState.input.value = '';
    if (searchState.wrap) searchState.wrap.classList.remove('has-value');
    closeResults();
  }

  /* =========================================================
     Logout
     ========================================================= */
  function bindLogout(scope) {
    scope.querySelectorAll('[data-action="logout"]').forEach(function (btn) {
      if (btn.dataset.logoutBound === '1') return;
      btn.dataset.logoutBound = '1';

      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');

        /* Limpa as abas ao sair */
        try { sessionStorage.removeItem(TABS_KEY); } catch (e) { /* ignora */ }

        if (window.Auth && typeof window.Auth.signOut === 'function') {
          window.Auth.signOut();
        } else {
          window.location.href = 'index.html';
        }
      });
    });
  }

  /* =========================================================
     Avatar
     ========================================================= */
  function renderTopbarAvatar(url) {
    const el = document.getElementById('user-avatar');
    if (!el) return;
    if (el.dataset.avatarUrl === (url || '')) return;

    el.innerHTML = '';
    el.dataset.avatarUrl = url || '';

    if (url) {
      el.style.background = 'none';
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.onerror = function () {
        el.innerHTML = '';
        el.style.background = '';
        el.dataset.avatarUrl = '';
      };
      el.appendChild(img);
    } else {
      el.style.background = '';
    }
  }

  function readCachedAvatar() {
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (!raw) return null;
      const ctx = JSON.parse(raw);
      return ctx && ctx.avatar_url ? ctx.avatar_url : null;
    } catch (e) { return null; }
  }

  async function fetchAvatarFromDb() {
    if (!window.db) return null;
    try {
      const { data: sess } = await window.db.auth.getSession();
      const uid = sess && sess.session && sess.session.user && sess.session.user.id;
      if (!uid) return null;

      const { data, error } = await window.db
        .from('profiles').select('avatar_url').eq('id', uid).maybeSingle();
      if (error) return null;
      return data && data.avatar_url ? data.avatar_url : null;
    } catch (e) { return null; }
  }

  let avatarPromise = null;

  function applyTopbarAvatar() {
    if (avatarPromise) return avatarPromise;

    avatarPromise = (async function () {
      const el = document.getElementById('user-avatar');
      if (!el) return;

      const cached = readCachedAvatar();
      if (cached) { renderTopbarAvatar(cached); return; }

      const url = await fetchAvatarFromDb();
      if (!url) return;

      renderTopbarAvatar(url);

      try {
        const raw = sessionStorage.getItem('devhub_user');
        const ctx = raw ? JSON.parse(raw) : {};
        ctx.avatar_url = url;
        sessionStorage.setItem('devhub_user', JSON.stringify(ctx));
      } catch (e) { /* ignora */ }
    })().catch(function () { return null; });

    return avatarPromise;
  }

  function scheduleAvatarRefresh() {
    [0, 100, 300, 800, 1500].forEach(function (ms) {
      setTimeout(applyTopbarAvatar, ms);
    });
  }

  /* =========================================================
     Bootstrap
     ========================================================= */
  let navRendered = false;

  function renderTopnavOnce(force) {
    if (navRendered && !force) return;
    navRendered = true;
    renderTopnav();
  }

  function bootstrap() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('blocked')) return;

    injectStyles();
    injectPermissionModal();

    /* Garante que a página atual tem aba registrada */
    syncCurrentTab();

    if (window.Perms && typeof window.Perms.load === 'function') {
      window.Perms.load().catch(function () {
        renderTopnavOnce();
      });
      setTimeout(function () { renderTopnavOnce(); }, 1500);
    } else {
      renderTopnavOnce();
    }

    scheduleAvatarRefresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  window.addEventListener('load', scheduleAvatarRefresh);

  document.addEventListener('perms:ready', function () {
    renderTopnavOnce(true);
  });

  if (window.db && window.db.auth && window.db.auth.onAuthStateChange) {
    window.db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        scheduleAvatarRefresh();
      }
    });
  }

  /* =========================================================
     Listeners globais (registrados UMA vez)
     ========================================================= */
  document.addEventListener('click', function (e) {
    closeAllDropdowns();

    if (!searchState.wrap) return;
    if (searchState.wrap.contains(e.target)) return;
    closeResults();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeAllDropdowns();
    closeResults();
  });

  document.addEventListener('keydown', function (e) {
    const isK = String(e.key || '').toLowerCase() === 'k';
    if (!isK) return;
    if (!(e.ctrlKey || e.metaKey)) return;

    const input = document.getElementById('tnav-search-input');
    if (!input) return;

    e.preventDefault();
    input.focus();
    input.select();
  });

  window.addEventListener('resize', closeAllDropdowns);
  window.addEventListener('scroll', closeAllDropdowns, true);

  /* =========================================================
     API GLOBAL (debug + integração opcional)
     ========================================================= */
  window.DHTabs = {
    open: openEntryAsTab,
    close: closeTab,
    list: readTabs,
    clear: function () { writeTabs([]); renderTabs(); },
    sync: syncCurrentTab
  };

})();