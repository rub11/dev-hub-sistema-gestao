/* =========================================================
   DEV HUB · Navegação · favorites.js
   Telas favoritas por usuário (máx 10).
   ---------------------------------------------------------
   [CORRIGIDO] Botão alinhado com o sino (#app-tabs-bell).
   ========================================================= */
(function () {
  'use strict';

  const NAV = window.NAV = window.NAV || {};
  const MAX_FAVORITES = 10;

  const state = {
    items: [],
    userId: null,
    panel: null,
    btn: null,
    busy: false
  };

  /* =====================================================
     Helpers
     ===================================================== */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(msg, type) {
    const region = document.getElementById('toast-region');
    if (!region) { console.log('[favorites]', msg); return; }
    const el = document.createElement('div');
    el.className = 'toast toast--' + (type || 'info');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const t = document.createElement('span');
    t.className = 'toast__message';
    t.textContent = msg;
    el.appendChild(t);
    region.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 400);
    }, 3000);
  }

  /* =====================================================
     Página atual
     ===================================================== */
  function getCurrentPage() {
    const id = (NAV.currentPageId && NAV.currentPageId()) || null;
    const item = id && NAV.findItemById ? NAV.findItemById(id) : null;

    if (item) {
      return {
        page_id: item.id,
        label: item.label,
        href: item.href,
        icon: null
      };
    }

    const path = (window.location.pathname || '').split('/').pop() || 'index.html';
    return {
      page_id: path.replace(/\.html?$/i, '').toLowerCase(),
      label: (document.title || path).replace(/\s*·\s*DEV HUB\s*$/i, ''),
      href: path + window.location.search + window.location.hash,
      icon: null
    };
  }

  /* =====================================================
     Supabase
     ===================================================== */
  function sb() {
    return window.db || window.devHubSupabase;
  }

  async function resolveUserId() {
    if (state.userId) return state.userId;

    const stored = window.Auth && window.Auth.getStoredUser && window.Auth.getStoredUser();
    if (stored && stored.user_id) {
      state.userId = stored.user_id;
      return state.userId;
    }

    try {
      const session = await window.Auth?.requireSession?.();
      if (session?.user?.id) {
        state.userId = session.user.id;
      }
    } catch (e) {}

    return state.userId;
  }

  /* =====================================================
     CRUD
     ===================================================== */
  async function loadFavorites() {
    const client = sb();
    const uid = await resolveUserId();
    if (!client || !uid) return;

    const { data, error } = await client
      .from('user_favorites')
      .select('*')
      .eq('user_id', uid)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[favorites] erro ao carregar:', error);
      return;
    }
    state.items = data || [];
  }

  async function addFavorite(page) {
    if (state.busy) return;
    if (state.items.length >= MAX_FAVORITES) {
      toast('Limite de ' + MAX_FAVORITES + ' favoritos atingido.', 'error');
      return;
    }
    if (state.items.some(i => i.page_id === page.page_id)) {
      toast('Esta tela já está nos favoritos.', 'info');
      return;
    }

    const client = sb();
    const uid = await resolveUserId();
    if (!client || !uid) return;

    state.busy = true;
    const { data, error } = await client
      .from('user_favorites')
      .insert({
        user_id: uid,
        page_id: page.page_id,
        label: page.label,
        href: page.href,
        icon: page.icon,
        sort_order: state.items.length
      })
      .select()
      .single();
    state.busy = false;

    if (error) {
      console.error('[favorites] erro ao adicionar:', error);
      toast('Não foi possível adicionar.', 'error');
      return;
    }
    state.items.push(data);
    toast('Adicionado aos favoritos.', 'success');
    renderPanel();
  }

  async function removeFavorite(pageId) {
    if (state.busy) return;
    const client = sb();
    const uid = await resolveUserId();
    if (!client || !uid) return;

    state.busy = true;
    const { error } = await client
      .from('user_favorites')
      .delete()
      .eq('user_id', uid)
      .eq('page_id', pageId);
    state.busy = false;

    if (error) {
      console.error('[favorites] erro ao remover:', error);
      toast('Não foi possível remover.', 'error');
      return;
    }
    state.items = state.items.filter(i => i.page_id !== pageId);
    toast('Removido dos favoritos.', 'success');
    renderPanel();
  }

  /* =====================================================
     Abrir favorito — apenas navega
     ===================================================== */
  function openFavorite(fav) {
    const href = fav.href || (fav.page_id + '.html');
    const currentPath = (window.location.pathname || '').split('/').pop();

    if (currentPath === href.split('?')[0].split('#')[0]) {
      closePanel();
      return;
    }

    window.location.href = href;
  }

  /* =====================================================
     Painel
     ===================================================== */
  function buildPanel() {
    const p = document.createElement('div');
    p.className = 'nav-fav-panel';
    p.hidden = true;
    document.body.appendChild(p);
    return p;
  }

  function renderPanel() {
    if (!state.panel) return;

    const current = getCurrentPage();
    const isCurrentFav = state.items.some(i => i.page_id === current.page_id);
    const canAdd = !isCurrentFav && state.items.length < MAX_FAVORITES;

    state.panel.innerHTML = `
      <header class="nav-fav-head">
        <div class="nav-fav-head__title">
          <span class="nav-fav-head__icon">
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"
                 stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                 width="16" height="16">
              <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9L6.6 19.7l1-6L3.2 9.4l6.1-.9z"/>
            </svg>
          </span>
          <span>Telas favoritas</span>
        </div>
        <span class="nav-fav-head__count">${state.items.length}/${MAX_FAVORITES}</span>
      </header>

      <div class="nav-fav-body">
        ${state.items.length === 0 ? `
          <div class="nav-fav-empty">
            Nenhuma tela favoritada ainda.<br>
            <small>Adicione páginas que você usa com frequência.</small>
          </div>
        ` : `
          <ul class="nav-fav-list">
            ${state.items.map(fav => `
              <li class="nav-fav-item" data-page="${escapeHtml(fav.page_id)}">
                <button type="button" class="nav-fav-item__link" data-action="open">
                  <span class="nav-fav-item__icon">★</span>
                  <span class="nav-fav-item__label">${escapeHtml(fav.label)}</span>
                </button>
                <button type="button" class="nav-fav-item__remove" data-action="remove"
                        title="Remover" aria-label="Remover dos favoritos">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                       stroke-linecap="round" width="14" height="14">
                    <path d="M6 6l12 12M18 6L6 18"/>
                  </svg>
                </button>
              </li>
            `).join('')}
          </ul>
        `}
      </div>

      ${canAdd ? `
        <footer class="nav-fav-foot">
          <button type="button" class="nav-fav-add" data-action="add">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" width="14" height="14">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>Adicionar esta tela</span>
          </button>
        </footer>
      ` : (isCurrentFav ? `
        <footer class="nav-fav-foot nav-fav-foot--hint">
          Esta tela já está nos favoritos.
        </footer>
      ` : '')}
    `;

    state.panel.querySelectorAll('.nav-fav-item').forEach(li => {
      const pageId = li.dataset.page;
      const fav = state.items.find(i => i.page_id === pageId);
      if (!fav) return;

      li.querySelector('[data-action="open"]').addEventListener('click', (e) => {
        e.stopPropagation();
        closePanel();
        openFavorite(fav);
      });

      li.querySelector('[data-action="remove"]').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFavorite(pageId);
      });
    });

    const addBtn = state.panel.querySelector('[data-action="add"]');
    if (addBtn) {
      addBtn.addEventListener('click', () => addFavorite(current));
    }
  }

  function positionPanel() {
    if (!state.btn || !state.panel) return;
    const rect = state.btn.getBoundingClientRect();
    state.panel.style.top = (rect.bottom + 8) + 'px';
    state.panel.style.right = (window.innerWidth - rect.right) + 'px';
  }

  function openPanel() {
    if (!state.panel) return;
    renderPanel();
    positionPanel();
    state.panel.hidden = false;
    setTimeout(() => {
      document.addEventListener('click', onDocClick);
    }, 0);
  }

  function closePanel() {
    if (!state.panel) return;
    state.panel.hidden = true;
    document.removeEventListener('click', onDocClick);
  }

  function onDocClick(e) {
    if (!state.panel || state.panel.hidden) return;
    if (state.panel.contains(e.target)) return;
    if (state.btn && state.btn.contains(e.target)) return;
    closePanel();
  }

  function togglePanel() {
    if (!state.panel) return;
    if (state.panel.hidden) openPanel();
    else closePanel();
  }

  /* =====================================================
     Botão na topbar REAL (.app-tabs) — ALINHADO
     ===================================================== */
  function injectButton() {
    if (document.getElementById('nav-fav-btn')) return;

    const tabsBar = document.querySelector('.app-tabs');
    if (!tabsBar) {
      console.warn('[favorites] .app-tabs não encontrado');
      return;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'app-tabs__fav';
    btn.id = 'nav-fav-btn';
    btn.setAttribute('aria-label', 'Telas favoritas');
    btn.setAttribute('title', 'Telas favoritas');

    /* Estilos alinhados com o sino #app-tabs-bell */
    btn.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'align-self:center',
      'width:36px',
      'height:36px',
      'min-width:36px',
      'flex:0 0 auto',
      'margin:0 2px 0 4px',
      'padding:0',
      'border:0',
      'border-radius:10px',
      'background:transparent',
      'color:#8b95a7',
      'cursor:pointer',
      'line-height:0',
      'vertical-align:middle',
      'transition:background .15s ease, color .15s ease'
    ].join(';') + ';';

    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true"
           width="18" height="18"
           style="display:block;flex:none;">
        <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9L6.6 19.7l1-6L3.2 9.4l6.1-.9z"/>
      </svg>
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(255,255,255,.06)';
      btn.style.color = '#fbbf24';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
      btn.style.color = '#8b95a7';
    });

    const bell = document.getElementById('app-tabs-bell');
    const search = document.getElementById('tnav-search');

    if (search && search.parentNode === tabsBar) {
      tabsBar.insertBefore(btn, search);
    } else if (bell && bell.parentNode === tabsBar) {
      bell.parentNode.insertBefore(btn, bell.nextSibling);
    } else {
      tabsBar.appendChild(btn);
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel();
    });

    state.btn = btn;
  }

  /* =====================================================
     CSS do painel
     ===================================================== */
  function injectStyles() {
    if (document.getElementById('nav-fav-styles')) return;
    const s = document.createElement('style');
    s.id = 'nav-fav-styles';
    s.textContent = `
      .nav-fav-panel {
        position: fixed;
        top: 58px;
        right: 200px;
        z-index: 9999;
        width: 300px;
        max-width: calc(100vw - 24px);
        background: linear-gradient(180deg, #0e1420 0%, #0a0f18 100%);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 14px;
        box-shadow: 0 24px 60px -20px rgba(0,0,0,.8),
                    0 0 60px -30px rgba(99,102,241,.35);
        overflow: hidden;
        animation: navFavIn 160ms ease-out;
        font-family: inherit;
      }
      .nav-fav-panel[hidden] { display: none; }

      @keyframes navFavIn {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .nav-fav-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(255,255,255,.06);
      }
      .nav-fav-head__title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: #e6eaf2;
      }
      .nav-fav-head__icon {
        color: #fbbf24;
        display: grid;
        place-items: center;
      }
      .nav-fav-head__count {
        font-size: 11px;
        font-family: ui-monospace, "SF Mono", Menlo, monospace;
        color: #7a8698;
        background: rgba(255,255,255,.04);
        border: 1px solid rgba(255,255,255,.06);
        padding: 2px 8px;
        border-radius: 6px;
      }

      .nav-fav-body {
        max-height: 340px;
        overflow-y: auto;
        padding: 6px;
      }
      .nav-fav-body::-webkit-scrollbar { width: 6px; }
      .nav-fav-body::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,.1); border-radius: 3px;
      }

      .nav-fav-empty {
        padding: 26px 20px;
        text-align: center;
        color: #8b95a7;
        font-size: 12.5px;
        line-height: 1.5;
      }
      .nav-fav-empty small {
        display: block;
        margin-top: 6px;
        color: #6b7688;
        font-size: 11.5px;
      }

      .nav-fav-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .nav-fav-item {
        display: flex;
        align-items: center;
        gap: 4px;
        border-radius: 8px;
        transition: background .12s ease;
      }
      .nav-fav-item:hover {
        background: rgba(255,255,255,.04);
      }
      .nav-fav-item__link {
        appearance: none;
        border: 0;
        background: transparent;
        flex: 1;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 10px;
        color: #e6eaf2;
        font-family: inherit;
        font-size: 13px;
        text-align: left;
        cursor: pointer;
        min-width: 0;
      }
      .nav-fav-item__icon {
        flex: none;
        color: #fbbf24;
        font-size: 12px;
        line-height: 1;
      }
      .nav-fav-item__label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .nav-fav-item__remove {
        appearance: none;
        border: 0;
        background: transparent;
        color: #6b7688;
        cursor: pointer;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        display: grid;
        place-items: center;
        margin-right: 4px;
        flex: none;
        opacity: 0;
        transition: all .12s ease;
      }
      .nav-fav-item:hover .nav-fav-item__remove { opacity: 1; }
      .nav-fav-item__remove:hover {
        background: rgba(239,68,68,.12);
        color: #f87171;
      }

      .nav-fav-foot {
        padding: 8px;
        border-top: 1px solid rgba(255,255,255,.06);
        background: rgba(0,0,0,.15);
      }
      .nav-fav-foot--hint {
        font-size: 11.5px;
        color: #7a8698;
        text-align: center;
        padding: 12px;
      }
      .nav-fav-add {
        appearance: none;
        border: 1px dashed rgba(255,255,255,.12);
        background: transparent;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 9px 12px;
        border-radius: 8px;
        color: #8b95a7;
        font-family: inherit;
        font-size: 12.5px;
        font-weight: 500;
        cursor: pointer;
        transition: all .12s ease;
      }
      .nav-fav-add:hover {
        border-color: rgba(99,102,241,.5);
        background: rgba(99,102,241,.06);
        color: #a5b4fc;
      }

      @media (max-width: 640px) {
        .nav-fav-panel {
          left: 12px;
          right: 12px;
          width: auto;
        }
      }
    `;
    document.head.appendChild(s);
  }

  /* =====================================================
     Init
     ===================================================== */
  async function init() {
    if (!sb() || !window.Auth) return;

    const uid = await resolveUserId();
    if (!uid) return;

    injectStyles();

    let tentativas = 0;
    const tick = () => {
      if (document.querySelector('.app-tabs')) {
        injectButton();
        state.panel = buildPanel();
        loadFavorites().then(() => renderPanel());
        return;
      }
      tentativas++;
      if (tentativas < 30) setTimeout(tick, 200);
      else console.warn('[favorites] .app-tabs não apareceu em 6s');
    };
    tick();

    window.addEventListener('popstate', renderPanel);
    window.addEventListener('resize', () => {
      if (state.panel && !state.panel.hidden) positionPanel();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 300));
  } else {
    setTimeout(init, 300);
  }

  NAV.favorites = {
    refresh: loadFavorites,
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    inject: injectButton
  };
})();