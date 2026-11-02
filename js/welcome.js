/* =========================================================
   DEV HUB · Tela inicial (Spotlight Search)
   ========================================================= */

(function () {
  'use strict';

  const els = {};

  let index = [];
  let filtered = [];
  let searchQuery = '';

  function getNavConfig() {
    const NAV = window.NAV;
    if (!NAV) return { CAPABILITIES: {}, BASE_CAPS: {} };
    return { CAPABILITIES: NAV.CAPABILITIES || {}, BASE_CAPS: NAV.BASE_CAPS || {} };
  }

  function readContext() {
    let role = '', isPlatform = false;
    try {
      const raw = localStorage.getItem('devhub_user') || sessionStorage.getItem('devhub_user');
      if (raw) {
        const data = JSON.parse(raw);
        role = String(data.role || '').toLowerCase();
        isPlatform = data.is_platform_admin === true;
      }
    } catch (e) {}
    return { role, isPlatform };
  }

  function capsForRole(role, isPlatform) {
    const { CAPABILITIES } = getNavConfig();
    const baseCaps = CAPABILITIES[String(role || '').toLowerCase()] || ['operations'];
    if (isPlatform && baseCaps.indexOf('platform') === -1) return baseCaps.concat(['platform']);
    return baseCaps;
  }

  function baseCapsForRole() {
    const ctx = readContext();
    const { BASE_CAPS } = getNavConfig();
    const fallback = BASE_CAPS.user || ['dashboard.view'];
    const caps = BASE_CAPS[ctx.role] || fallback;
    if (ctx.isPlatform && caps.indexOf('platform') === -1) return caps.concat(['platform']);
    return caps;
  }

  function hasCapWithFallback(cap) {
    if (!cap) return true;
    if (cap === 'platform') return readContext().isPlatform;

    const c = String(cap).toLowerCase();
    const baseCaps = baseCapsForRole();
    const inFallback = baseCaps.indexOf(c) !== -1;

    if (window.Perms && typeof window.Perms.has === 'function') {
      try {
        const list = (typeof window.Perms.list === 'function') ? window.Perms.list() : null;
        const listEmpty = !list || Object.keys(list).length === 0;
        if (!listEmpty) {
          const r = window.Perms.has(c);
          if (r === true)  return true;
          if (r === false) return inFallback;
        }
      } catch (e) {}
    }

    const genericCaps = capsForRole(readContext().role, readContext().isPlatform);
    if (genericCaps.indexOf(c) !== -1) return true;
    return inFallback;
  }

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const Auth = window.Auth;
    if (!Auth || !Auth.isConfigured() || !window.db) return;

    els.search    = document.getElementById('welcome-search');
    els.results   = document.getElementById('welcome-results');
    els.title     = document.getElementById('welcome-title');

    if (!els.search || !els.results) return;

    const session = await Auth.requireSession();
    if (!session) return;

    try {
      let profile = null;
      try { profile = await Auth.getProfile(); } catch (e) {}

      const meta = session.user.user_metadata || {};
      const fullName = (profile && profile.name) || meta.name || meta.full_name || (session.user.email ? session.user.email.split('@')[0] : '') || '';
      const first = String(fullName).trim().split(/\s+/)[0] || '';
      const nameEl = els.title ? els.title.querySelector('.welcome__name') : null;
      if (nameEl) nameEl.textContent = first ? ' ' + first : '';
    } catch (e) {}

    if (window.Perms && typeof window.Perms.load === 'function') {
      try { await window.Perms.load(); } catch (e) {}
    }

    buildIndex();

    els.search.addEventListener('input', onSearchInput);
    els.search.addEventListener('keydown', onSearchKeydown);
    document.addEventListener('click', (e) => {
      if (!els.search.contains(e.target) && !els.results.contains(e.target)) {
        els.results.hidden = true;
      }
    });

    document.addEventListener('keydown', function (e) {
      const isK = String(e.key || '').toLowerCase() === 'k';
      if (!isK || !(e.ctrlKey || e.metaKey)) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      els.search.focus();
      els.search.select();
    });

    document.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const n = parseInt(e.key, 10);
      if (!Number.isInteger(n) || n < 1 || n > 9) return;

      const list = filtered.length > 0 ? filtered : index;
      const item = list[n - 1];
      if (!item) return;

      e.preventDefault();
      openModule(item);
    });
  }

  function buildIndex() {
    const all = Array.isArray(window.DHModules) ? window.DHModules : [];
    const ITEM_PERM = window.DHItemPerm || {};

    index = all.filter(function (item) {
      if (item.capability && !hasCapWithFallback(item.capability)) return false;
      const cap = ITEM_PERM[item.id];
      if (cap && !hasCapWithFallback(cap)) return false;
      return true;
    });

    filtered = index.slice();
  }

  function buildResultItem(item, index) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'welcome__result-item';
    btn.dataset.id = item.id;

    // Ícone
    const icon = document.createElement('span');
    icon.className = 'welcome__result-icon';
    icon.innerHTML = getIcon(item.icon);

    // Textos
    const body = document.createElement('span');
    body.className = 'welcome__result-body';
    
    const title = document.createElement('span');
    title.className = 'welcome__result-title';
    title.innerHTML = highlight(item.label, searchQuery);

    const meta = document.createElement('span');
    meta.className = 'welcome__result-meta';
    meta.textContent = item.group ? item.group : 'Geral';

    body.appendChild(title);
    body.appendChild(meta);

    // Atalho numérico
    const kbd = document.createElement('span');
    kbd.className = 'welcome__result-kbd';
    if (index < 9) kbd.textContent = String(index + 1); else kbd.hidden = true;

    btn.appendChild(icon);
    btn.appendChild(body);
    btn.appendChild(kbd);

    btn.addEventListener('click', function () { openModule(item); });

    return btn;
  }

  function openModule(item) {
    if (window.DHTabs && typeof window.DHTabs.open === 'function') {
      window.DHTabs.open(item);
      return;
    }
    window.location.href = item.href;
  }

  function onSearchInput() {
    searchQuery = String(els.search.value || '').trim();
    const q = normalize(searchQuery);

    if (!q) {
      els.results.hidden = true;
      filtered = index.slice();
      return;
    }

    const words = q.split(/\s+/).filter(Boolean);
    filtered = index.filter(function (item) {
      const haystack = normalize(item.label + ' ' + (item.group || ''));
      return words.every(function (w) { return haystack.indexOf(w) !== -1; });
    });

    renderResults();
  }

  function renderResults() {
    els.results.innerHTML = '';
    
    if (filtered.length === 0) {
      els.results.innerHTML = '<div class="welcome__result-empty">Nenhum módulo encontrado.</div>';
      els.results.hidden = false;
      return;
    }

    filtered.forEach((item, i) => {
      els.results.appendChild(buildResultItem(item, i));
    });

    els.results.hidden = false;
  }

  function onSearchKeydown(e) {
    if (e.key === 'Escape') {
      els.search.value = '';
      searchQuery = '';
      els.results.hidden = true;
      els.search.blur();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0) openModule(filtered[0]);
    }
  }

  function normalize(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function highlight(text, query) {
    const safe = escapeHtml(text);
    if (!query) return safe;
    const hay = normalize(text);
    const needle = normalize(query);
    const i = hay.indexOf(needle);
    if (i === -1) return safe;
    const before = escapeHtml(text.slice(0, i));
    const match  = escapeHtml(text.slice(i, i + needle.length));
    const after  = escapeHtml(text.slice(i + needle.length));
    return before + '<mark>' + match + '</mark>' + after;
  }

  const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/></svg>',
    vendas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h2.3l2.3 11.6a1.8 1.8 0 0 0 1.8 1.4h8.8a1.8 1.8 0 0 0 1.8-1.4L21 7.5H6"/></svg>',
    notas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/><path d="M14 2.5v5h5"/><path d="M9 13h6M9 17h4"/></svg>',
    'notas-fiscal': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/><path d="M14 2.5v5h5"/><path d="M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01"/></svg>',
    clientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7.5" r="3.5"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/><path d="M16.5 4.13a4 4 0 0 1 0 7.75"/></svg>',
    produtos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m21 8-9-5-9 5v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 21v-8"/></svg>',
    estoque: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2.5 9 5-9 5-9-5z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 17.5 9 5 9-5"/></svg>',
    relatorios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m7 15 3.5-4 3 2.5L20 7"/></svg>',
    gestao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7.5" r="3.5"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/><path d="M16.5 4.13a4 4 0 0 1 0 7.75"/></svg>',
    configuracoes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>',
    empresas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M15 21V9h4a2 2 0 0 1 2 2v10"/><path d="M9 7h2M9 11h2M9 15h2"/></svg>',
    usuarios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7.5" r="3.5"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    finance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M2.5 10h19"/><circle cx="17" cy="14" r="1"/></svg>',
    default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>'
  };

  function getIcon(key) { return ICONS[key] || ICONS.default; }
})();