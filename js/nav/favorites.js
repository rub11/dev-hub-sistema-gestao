/* =========================================================
   DEV HUB · Navegação · favorites.js
   Telas favoritas por usuário (máx 10).
   ========================================================= */
(function () {
  'use strict';

  const NAV = window.NAV = window.NAV || {};
  const MAX_FAVORITES = 10;

  const state = {
    items: [],
    userId: null,
    busy: false
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(msg, type) {
    const region = document.getElementById('toast-region');
    if (!region) return;
    const el = document.createElement('div');
    el.className = 'toast toast--' + (type || 'info');
    el.textContent = msg;
    region.appendChild(el);
    setTimeout(() => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 400); }, 3000);
  }

  function getCurrentPage() {
    const id = (NAV.currentPageId && NAV.currentPageId()) || null;
    const item = id && NAV.findItemById ? NAV.findItemById(id) : null;
    if (item) return { page_id: item.id, label: item.label, href: item.href, icon: null };
    
    const path = (window.location.pathname || '').split('/').pop() || 'index.html';
    return { page_id: path.replace(/\.html?$/i, '').toLowerCase(), label: document.title.split('·')[0].trim(), href: path, icon: null };
  }

  function sb() { return window.db || window.devHubSupabase; }

  async function resolveUserId() {
    if (state.userId) return state.userId;
    const stored = window.Auth && window.Auth.getStoredUser && window.Auth.getStoredUser();
    if (stored && stored.user_id) { state.userId = stored.user_id; return state.userId; }
    try {
      const session = await window.Auth?.requireSession?.();
      if (session?.user?.id) state.userId = session.user.id;
    } catch (e) {}
    return state.userId;
  }

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

    if (!error) state.items = data || [];
  }

  async function addFavorite(page) {
    if (state.busy || state.items.length >= MAX_FAVORITES) {
      if (state.items.length >= MAX_FAVORITES) toast('Limite atingido.', 'error');
      return;
    }
    if (state.items.some(i => i.page_id === page.page_id)) {
      toast('Esta tela já está nos favoritos.', 'info'); return;
    }

    const client = sb();
    const uid = await resolveUserId();
    if (!client || !uid) return;

    state.busy = true;
    const { data, error } = await client.from('user_favorites').insert({
      user_id: uid, page_id: page.page_id, label: page.label, href: page.href, icon: page.icon, sort_order: state.items.length
    }).select().single();
    state.busy = false;

    if (!error && data) {
      state.items.push(data);
      toast('Adicionado aos favoritos.', 'success');
    }
  }

  async function removeFavorite(pageId) {
    if (state.busy) return;
    const client = sb();
    const uid = await resolveUserId();
    if (!client || !uid) return;

    state.busy = true;
    const { error } = await client.from('user_favorites').delete().eq('user_id', uid).eq('page_id', pageId);
    state.busy = false;

    if (!error) {
      state.items = state.items.filter(i => i.page_id !== pageId);
      toast('Removido dos favoritos.', 'success');
    }
  }

  async function init() {
    if (!sb() || !window.Auth) return;
    const uid = await resolveUserId();
    if (!uid) return;
    await loadFavorites();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 300));
  } else {
    setTimeout(init, 300);
  }

  NAV.favorites = {
    getItems: () => state.items,
    add: addFavorite,
    remove: removeFavorite,
    getCurrentPage: getCurrentPage,
    refresh: loadFavorites
  };
})();