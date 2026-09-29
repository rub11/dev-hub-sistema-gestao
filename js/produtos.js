/* =========================================================
   DEV HUB · Módulo de Produtos
   ---------------------------------------------------------
   - CRUD de produtos
   - Até 3 fotos (Supabase Storage: bucket `product-images`)
   - Código interno + código de barras (EAN)
   ---------------------------------------------------------
   CORREÇÕES APLICADAS:
   1. Preview de imagem agora usa `previewUrl` cacheado e é
      revogado (URL.revokeObjectURL) em troca/remoção/reset —
      elimina vazamento de memória.
   2. Checkbox "Ativo" usa `disabled` (não aceita `readOnly`)
      durante o salvamento.
   3. Guards de null em `setupProductForm`, `openConfirmModal`,
      `onSubmitProduct` e `setSaving`.
   4. `parseNumber` agora entende o formato brasileiro
      ("1.234,56") e o formato US ("1234.56").
   5. `onPhotoSelected` ignora seleção durante salvamento.
   6. Inputs de foto ficam bloqueados enquanto salva.
   7. Update de produto detecta "0 linhas afetadas" (registro
      removido por outro usuário).
   ========================================================= */

(function () {
  'use strict';

  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  });

  const MAX_PHOTOS = 3;
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  const state = {
    all: [],
    filtered: [],
    search: '',
    editingId: null,
    deletingId: null,
    saving: false,
    deleting: false,

    // Fotos: array de até 3 slots.
    // Cada slot: { url, file, previewUrl, uploading, removing }
    //   url        = URL já persistida no banco
    //   file       = arquivo novo ainda não upado
    //   previewUrl = objectURL temporário (precisa ser revogado)
    photos: []
  };

  document.addEventListener('DOMContentLoaded', init);

  /* =========================================================
     Init
     ========================================================= */
  async function init() {
    const Auth = window.Auth;

    if (!Auth || !Auth.isConfigured() || !window.db) {
      showGlobalAlert('Não foi possível conectar ao Supabase.', 'error');
      return;
    }

    setupSidebar();
    setupUserMenu();
    setupLogout();
    setupSearch();
    setupToolbar();
    setupProductForm();
    setupPhotoSlots();
    setupConfirmModal();

    const session = await Auth.requireSession();
    if (!session) return;

    watchAuthChanges();

    const profile = await Auth.getProfile(session.user.id);
    renderUser(session.user, profile);

    await loadProducts();
  }

  /* =========================================================
     Sessão / usuário
     ========================================================= */
  function watchAuthChanges() {
    window.db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT' && !window.Auth.isSigningOut()) {
        window.location.replace('index.html?expired=1');
      }
    });
  }

  function renderUser(user, profile) {
    const meta = user.user_metadata || {};
    const fullName =
      (profile && profile.name) ||
      meta.name || meta.full_name ||
      (user.email ? user.email.split('@')[0] : '') ||
      'Usuário';

    const roleText = window.Auth.roleLabel((profile && profile.role) || meta.role || '');
    const firstName = String(fullName).trim().split(/\s+/)[0] || 'Usuário';
    const initial = firstName.charAt(0).toUpperCase() || '?';

    setText('user-avatar', initial);
    setText('user-name', fullName);
    setText('user-role', roleText || user.email || '');
    setText('greeting-name', 'Olá, ' + firstName);

    const roleBadge = document.getElementById('greeting-role');
    if (roleBadge) {
      if (roleText) { roleBadge.textContent = roleText; roleBadge.hidden = false; }
      else { roleBadge.hidden = true; }
    }
  }

  /* =========================================================
     Sidebar / user menu / logout
     ========================================================= */
  function setupSidebar() {
    const toggle = document.getElementById('menu-toggle');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('sidebar');
    if (!toggle || !overlay || !sidebar) return;

    function open() {
      document.body.classList.add('sidebar-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Fechar menu');
      overlay.hidden = false;
    }
    function close() {
      if (!document.body.classList.contains('sidebar-open')) return;
      document.body.classList.remove('sidebar-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menu');
      overlay.hidden = true;
    }

    toggle.addEventListener('click', function () {
      document.body.classList.contains('sidebar-open') ? close() : open();
    });
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    window.addEventListener('resize', function () { if (window.innerWidth >= 1024) close(); });
  }

  function setupUserMenu() {
    const trigger = document.getElementById('user-menu-trigger');
    const panel = document.getElementById('user-menu-panel');
    if (!trigger || !panel) return;

    function open() { panel.hidden = false; trigger.setAttribute('aria-expanded', 'true'); }
    function close() { panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.hidden ? open() : close();
    });
    document.addEventListener('click', function (e) {
      if (panel.hidden) return;
      if (panel.contains(e.target) || trigger.contains(e.target)) return;
      close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { close(); trigger.focus(); }
    });
  }

  function setupLogout() {
    document.querySelectorAll('[data-action="logout"]').forEach(function (button) {
      button.addEventListener('click', async function () {
        if (button.disabled) return;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        await window.Auth.signOut();
      });
    });
  }

  /* =========================================================
     Toolbar / busca
     ========================================================= */
  function setupToolbar() {
    const newBtn = document.getElementById('new-product-btn');
    const emptyNewBtn = document.getElementById('empty-new-btn');
    if (newBtn) newBtn.addEventListener('click', openCreateModal);
    if (emptyNewBtn) emptyNewBtn.addEventListener('click', openCreateModal);
  }

  function setupSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    input.addEventListener('input', function () {
      state.search = input.value.trim().toLowerCase();
      applyFilter();
    });
  }

  function applyFilter() {
    if (!state.search) {
      state.filtered = state.all.slice();
    } else {
      const term = state.search;
      state.filtered = state.all.filter(function (p) {
        return matchesTerm(p.name, term) ||
               matchesTerm(p.code, term) ||
               matchesTerm(p.barcode, term) ||
               matchesTerm(p.description, term);
      });
    }
    renderProducts();
  }

  function matchesTerm(value, term) {
    if (!value) return false;
    return String(value).toLowerCase().includes(term);
  }

  /* =========================================================
     Carregar produtos
     ========================================================= */
  async function loadProducts() {
    showLoading(true);

    const { data, error } = await window.db
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    showLoading(false);

    if (error) {
      console.error('[DEV HUB] Falha ao carregar produtos:', error);
      state.all = [];
      state.filtered = [];
      showEmptyState('Não foi possível carregar os produtos.',
                     'Tente novamente em alguns instantes.', false);
      updateCountLabel();
      showToast('Não foi possível carregar os produtos.', 'error');
      return;
    }

    state.all = data || [];
    applyFilter();
    updateCountLabel();
  }

  function updateCountLabel() {
    const total = state.all.length;
    const label = document.getElementById('products-count');
    if (!label) return;

    if (total === 0) { label.textContent = 'Nenhum produto cadastrado'; return; }
    label.textContent = total === 1
      ? '1 produto cadastrado'
      : total + ' produtos cadastrados';
  }

  /* =========================================================
     Renderização
     ========================================================= */
  function renderProducts() {
    const tbody = document.getElementById('products-body');
    const tableWrap = document.getElementById('products-table-wrap');
    if (!tbody || !tableWrap) return;

    if (state.all.length === 0) {
      tableWrap.hidden = true;
      showEmptyState('Nenhum produto cadastrado ainda.',
                     'Comece adicionando o primeiro produto ao catálogo.', true);
      return;
    }
    if (state.filtered.length === 0) {
      tableWrap.hidden = true;
      showEmptyState('Nenhum produto encontrado.',
                     'Ajuste a busca para encontrar o produto desejado.', false);
      return;
    }

    hideEmptyState();
    tableWrap.hidden = false;
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    state.filtered.forEach(function (product) {
      fragment.appendChild(buildRow(product));
    });
    tbody.appendChild(fragment);
  }

  function buildRow(product) {
    const row = document.createElement('tr');
    row.dataset.id = product.id || '';

    row.appendChild(buildProductCell(product));
    row.appendChild(createCell(product.code || '—', 'cell--muted'));
    row.appendChild(createCell(formatPrice(product.price), 'cell--num cell-price'));
    row.appendChild(buildStockCell(product.stock, product.minimum_stock));
    row.appendChild(createCell(formatInteger(product.minimum_stock), 'cell--num cell-stock'));
    row.appendChild(buildStatusCell(product.active));
    row.appendChild(buildActionsCell(product));

    return row;
  }

  function buildProductCell(product) {
    const cell = document.createElement('td');
    cell.className = 'cell-product';

    // Thumb
    const thumb = document.createElement('span');
    thumb.className = 'cell-product__thumb';

    const firstImage = getFirstImage(product);
    if (firstImage) {
      const img = document.createElement('img');
      img.src = firstImage;
      img.alt = '';
      img.loading = 'lazy';
      thumb.appendChild(img);
    } else {
      thumb.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"' +
        ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="m21 8-9-5-9 5v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 21v-8"/></svg>';
    }

    // Info
    const info = document.createElement('div');
    info.className = 'cell-product__info';

    const name = document.createElement('span');
    name.textContent = product.name || '—';
    info.appendChild(name);

    const parts = [];
    if (product.barcode) parts.push('EAN ' + product.barcode);
    if (product.description) parts.push(product.description);

    if (parts.length > 0) {
      const small = document.createElement('small');
      small.textContent = parts.join(' · ');
      info.appendChild(small);
    }

    cell.appendChild(thumb);
    cell.appendChild(info);

    return cell;
  }

  function createCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function buildStockCell(stock, minimumStock) {
    const cell = document.createElement('td');
    cell.className = 'cell--num';

    const quantity = toInteger(stock);
    const minimum = toInteger(minimumStock);

    let modifier = 'stock-indicator--ok';
    let label = '';

    if (quantity === 0) {
      modifier = 'stock-indicator--out';
      label = 'Sem estoque';
    } else if (quantity <= minimum) {
      modifier = 'stock-indicator--low';
      label = 'Estoque baixo';
    }

    const wrapper = document.createElement('span');
    wrapper.className = 'stock-indicator ' + modifier;

    if (label) {
      const dot = document.createElement('span');
      dot.className = 'stock-indicator__dot';
      dot.setAttribute('aria-hidden', 'true');
      wrapper.appendChild(dot);
    }

    const value = document.createElement('span');
    value.textContent = label
      ? formatInteger(quantity) + ' · ' + label
      : formatInteger(quantity);
    wrapper.appendChild(value);

    cell.appendChild(wrapper);
    return cell;
  }

  function buildStatusCell(active) {
    const cell = document.createElement('td');
    const isActive = active === true;

    const badge = document.createElement('span');
    badge.className = 'badge ' + (isActive ? 'badge--success' : 'badge--danger');
    badge.textContent = isActive ? 'Ativo' : 'Inativo';

    cell.appendChild(badge);
    return cell;
  }

  function buildActionsCell(product) {
    const cell = document.createElement('td');
    cell.className = 'cell--num';

    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'row-action';
    editBtn.setAttribute('aria-label', 'Editar produto ' + (product.name || ''));
    editBtn.title = 'Editar';
    editBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 20h9"/>' +
      '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
    editBtn.addEventListener('click', function () { openEditModal(product); });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'row-action row-action--danger';
    delBtn.setAttribute('aria-label', 'Excluir produto ' + (product.name || ''));
    delBtn.title = 'Excluir';
    delBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 6h18"/>' +
      '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
      '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
      '<path d="M10 11v6M14 11v6"/></svg>';
    delBtn.addEventListener('click', function () { openConfirmModal(product); });

    wrap.appendChild(editBtn);
    wrap.appendChild(delBtn);
    cell.appendChild(wrap);
    return cell;
  }

  /* =========================================================
     Estados visuais
     ========================================================= */
  function showLoading(isLoading) {
    const loading = document.getElementById('products-loading');
    const wrap = document.getElementById('products-table-wrap');
    const empty = document.getElementById('products-empty');
    if (!loading) return;

    if (isLoading) {
      loading.hidden = false;
      if (wrap) wrap.hidden = true;
      if (empty) empty.hidden = true;
    } else {
      loading.hidden = true;
    }
  }

  function showEmptyState(title, text, showCta) {
    const empty = document.getElementById('products-empty');
    const titleEl = document.getElementById('products-empty-title');
    const textEl = document.getElementById('products-empty-text');
    const cta = document.getElementById('empty-new-btn');
    if (!empty) return;

    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    if (cta) cta.hidden = !showCta;

    empty.hidden = false;
  }

  function hideEmptyState() {
    const empty = document.getElementById('products-empty');
    if (empty) empty.hidden = true;
  }

  function showGlobalAlert(message, type) {
    const alert = document.getElementById('global-alert');
    if (!alert) return;
    alert.textContent = message;
    alert.className = 'alert alert--' + (type || 'error');
    alert.hidden = false;
  }

  /* =========================================================
     Fotos: setup dos 3 slots
     ========================================================= */
  const photoEls = {};

  function setupPhotoSlots() {
    photoEls.container = document.getElementById('product-photos');
    if (!photoEls.container) return;

    photoEls.container.innerHTML = '';

    // Cria 3 slots vazios
    for (let i = 0; i < MAX_PHOTOS; i += 1) {
      const slot = document.createElement('div');
      slot.className = 'product-photo';
      slot.dataset.index = String(i);
      photoEls.container.appendChild(slot);
    }
  }

  /* =========================================================
     Fotos: helpers (CORRIGIDO — preview cacheado + revogação)
     ========================================================= */
  function makeEmptyPhotoSlot() {
    return {
      url: null,
      file: null,
      previewUrl: null,
      uploading: false,
      removing: false
    };
  }

  /**
   * Revoga todos os objectURLs pendentes. Chamado antes de:
   *   - resetPhotos (novo produto)
   *   - openEditModal (carregar outro produto)
   *   - close do modal (opcional — deixamos pro reset)
   */
  function releasePhotoPreviews() {
    state.photos.forEach(function (slot) {
      if (slot && slot.previewUrl) {
        try { URL.revokeObjectURL(slot.previewUrl); } catch (e) { /* ignora */ }
        slot.previewUrl = null;
      }
    });
  }

  function resetPhotos() {
    releasePhotoPreviews();
    state.photos = [];
    for (let i = 0; i < MAX_PHOTOS; i += 1) {
      state.photos.push(makeEmptyPhotoSlot());
    }
    renderPhotoSlots();
  }

  function renderPhotoSlots() {
    if (!photoEls.container) return;

    Array.prototype.forEach.call(photoEls.container.children, function (slotEl, i) {
      const slot = state.photos[i];
      slotEl.innerHTML = '';
      slotEl.classList.toggle('product-photo--filled', Boolean(slot && (slot.url || slot.file)));

      // Está vazio?
      if (!slot || (!slot.url && !slot.file)) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'product-photo__empty';
        btn.setAttribute('aria-label', 'Adicionar foto ' + (i + 1));
        btn.disabled = state.saving === true;  // bloqueia durante save
        btn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
          ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M12 5v14M5 12h14"/></svg>' +
          '<span>Foto ' + (i + 1) + '</span>';

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = ALLOWED_TYPES.join(',');
        input.className = 'product-photo__input';
        input.setAttribute('aria-hidden', 'true');
        input.disabled = state.saving === true;  // bloqueia durante save

        btn.addEventListener('click', function () { input.click(); });
        input.addEventListener('change', function (e) {
          onPhotoSelected(i, e.target.files[0]);
          e.target.value = '';
        });

        slotEl.appendChild(btn);
        slotEl.appendChild(input);
        return;
      }

      // Preenchido — usa previewUrl cacheado (não cria novo objectURL)
      const url = slot.url || slot.previewUrl;
      if (!url) return;

      const img = document.createElement('img');
      img.className = 'product-photo__img';
      img.src = url;
      img.alt = '';
      slotEl.appendChild(img);

      // Badge "principal" no primeiro slot
      if (i === 0) {
        const badge = document.createElement('span');
        badge.className = 'product-photo__badge';
        badge.textContent = 'Principal';
        slotEl.appendChild(badge);
      }

      // Botão remover
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'product-photo__remove';
      remove.setAttribute('aria-label', 'Remover foto ' + (i + 1));
      remove.disabled = state.saving === true;  // bloqueia durante save
      remove.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"' +
        ' stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      remove.addEventListener('click', function () { onPhotoRemove(i); });
      slotEl.appendChild(remove);

      // Estado de upload
      if (slot.uploading) {
        const overlay = document.createElement('div');
        overlay.className = 'product-photo__progress';
        overlay.textContent = 'Enviando...';
        slotEl.appendChild(overlay);
      }
    });
  }

  function onPhotoSelected(index, file) {
    if (!file) return;
    if (state.saving) return;  // CORREÇÃO #6

    if (ALLOWED_TYPES.indexOf(file.type) === -1) {
      showFormFeedback('Formato inválido. Use JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showFormFeedback('A imagem precisa ter no máximo 2 MB.');
      return;
    }

    // Revoga preview anterior do slot (se houver)
    const prev = state.photos[index];
    if (prev && prev.previewUrl) {
      try { URL.revokeObjectURL(prev.previewUrl); } catch (e) { /* ignora */ }
    }

    clearFormFeedback();
    state.photos[index] = {
      url: null,
      file: file,
      previewUrl: URL.createObjectURL(file),  // cacheado — será revogado depois
      uploading: false,
      removing: false
    };
    renderPhotoSlots();
  }

  function onPhotoRemove(index) {
    if (state.saving) return;

    const prev = state.photos[index];
    if (prev && prev.previewUrl) {
      try { URL.revokeObjectURL(prev.previewUrl); } catch (e) { /* ignora */ }
    }

    state.photos[index] = makeEmptyPhotoSlot();
    renderPhotoSlots();
  }

  /* =========================================================
     Fotos: upload para o Storage
     ========================================================= */
  async function uploadPhoto(file, userId, order) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = userId + '/product-' + Date.now() + '-' + order + '.' + ext;

    const { error } = await window.db.storage
      .from('product-images')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });
    if (error) throw error;

    const { data } = window.db.storage
      .from('product-images')
      .getPublicUrl(path);

    return data && data.publicUrl ? data.publicUrl : null;
  }

  /**
   * Sobe todos os arquivos novos e devolve o array final de URLs
   * (persistidas + novas, na ordem dos slots).
   */
  async function uploadAllPhotos(userId) {
    const urls = [];
    for (let i = 0; i < state.photos.length; i += 1) {
      const slot = state.photos[i];
      if (!slot) continue;

      if (slot.file) {
        const url = await uploadPhoto(slot.file, userId, i);
        if (url) urls.push(url);
      } else if (slot.url) {
        urls.push(slot.url);
      }
    }
    return urls;
  }

  /* =========================================================
     Modal: produto
     ========================================================= */
  const modalEls = {};

  function setupProductForm() {
    modalEls.modal          = document.getElementById('product-modal');
    modalEls.title          = document.getElementById('product-modal-title');
    modalEls.form           = document.getElementById('product-form');
    modalEls.id             = document.getElementById('product-id');
    modalEls.name           = document.getElementById('product-name');
    modalEls.code           = document.getElementById('product-code');
    modalEls.barcode        = document.getElementById('product-barcode');
    modalEls.description    = document.getElementById('product-description');
    modalEls.price          = document.getElementById('product-price');
    modalEls.stock          = document.getElementById('product-stock');
    modalEls.minimumStock   = document.getElementById('product-minimum-stock');
    modalEls.active         = document.getElementById('product-active');
    modalEls.activeLabel    = document.getElementById('product-active-label');
    modalEls.feedback       = document.getElementById('product-form-feedback');
    modalEls.saveBtn        = document.getElementById('product-save-btn');

    if (!modalEls.modal || !modalEls.form) return;

    modalEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeProductModal);
    });

    // CORREÇÃO #3: guard de null no checkbox
    if (modalEls.active && modalEls.activeLabel) {
      modalEls.active.addEventListener('change', function () {
        modalEls.activeLabel.textContent = modalEls.active.checked ? 'Ativo' : 'Inativo';
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modalEls.modal.hidden) closeProductModal();
    });

    modalEls.form.addEventListener('submit', onSubmitProduct);
  }

  function openCreateModal() {
    state.editingId = null;
    if (modalEls.title) modalEls.title.textContent = 'Novo produto';
    modalEls.form.reset();
    if (modalEls.id) modalEls.id.value = '';
    if (modalEls.price) modalEls.price.value = '0';
    if (modalEls.stock) modalEls.stock.value = '0';
    if (modalEls.minimumStock) modalEls.minimumStock.value = '0';
    if (modalEls.active) modalEls.active.checked = true;
    if (modalEls.activeLabel) modalEls.activeLabel.textContent = 'Ativo';
    clearFormFeedback();
    resetPhotos();
    openModal(modalEls.modal);
    if (modalEls.name) modalEls.name.focus();
  }

  function openEditModal(product) {
    state.editingId = product.id;
    if (modalEls.title) modalEls.title.textContent = 'Editar produto';
    if (modalEls.id) modalEls.id.value = product.id || '';
    if (modalEls.name) modalEls.name.value = product.name || '';
    if (modalEls.code) modalEls.code.value = product.code || '';
    if (modalEls.barcode) modalEls.barcode.value = product.barcode || '';
    if (modalEls.description) modalEls.description.value = product.description || '';
    if (modalEls.price) modalEls.price.value = normalizeNumberInput(product.price);
    if (modalEls.stock) modalEls.stock.value = normalizeIntegerInput(product.stock);
    if (modalEls.minimumStock) modalEls.minimumStock.value = normalizeIntegerInput(product.minimum_stock);
    if (modalEls.active) modalEls.active.checked = product.active === true;
    if (modalEls.activeLabel) modalEls.activeLabel.textContent = modalEls.active.checked ? 'Ativo' : 'Inativo';
    clearFormFeedback();

    // Carrega fotos existentes nos slots — CORREÇÃO #1/8: revoga previews antigas
    releasePhotoPreviews();

    const existing = getProductImageUrls(product);
    state.photos = [];
    for (let i = 0; i < MAX_PHOTOS; i += 1) {
      state.photos.push({
        url: existing[i] || null,
        file: null,
        previewUrl: null,
        uploading: false,
        removing: false
      });
    }
    renderPhotoSlots();

    openModal(modalEls.modal);
    if (modalEls.name) modalEls.name.focus();
  }

  function closeProductModal() {
    if (state.saving) return;
    closeModal(modalEls.modal);
  }

  async function onSubmitProduct(event) {
    event.preventDefault();
    if (state.saving) return;

    clearFormFeedback();

    const name = modalEls.name.value.trim();
    const priceRaw = modalEls.price.value.trim();

    if (!name) {
      showFormFeedback('Informe o nome do produto.');
      modalEls.name.focus();
      return;
    }

    const price = parseNumber(priceRaw);
    if (price === null || price < 0) {
      showFormFeedback('Informe um preço válido (maior ou igual a zero).');
      modalEls.price.focus();
      return;
    }

    const stock = parseInteger(modalEls.stock.value, 0);
    const minimumStock = parseInteger(modalEls.minimumStock.value, 0);

    if (stock < 0 || minimumStock < 0) {
      showFormFeedback('Estoque não pode ser negativo.');
      modalEls.stock.focus();
      return;
    }

    const barcode = modalEls.barcode.value.trim();

    setSaving(true);

    try {
      const session = await window.db.auth.getSession();
      const userId = session?.data?.session?.user?.id;
      if (!userId) throw new Error('Sessão expirada.');

      // Upload das fotos novas
      const imageUrls = await uploadAllPhotos(userId);

      const payload = {
        name: name,
        code: modalEls.code.value.trim() || null,
        barcode: barcode || null,
        description: modalEls.description.value.trim() || null,
        price: price,
        stock: stock,
        minimum_stock: minimumStock,
        active: modalEls.active.checked === true,
        image_urls: imageUrls
      };

      if (state.editingId) {
        // CORREÇÃO #7: detecta update de 0 linhas (registro removido)
        const { data, error } = await window.db
          .from('products')
          .update(payload)
          .eq('id', state.editingId)
          .select('id');

        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('PRODUCT_NOT_FOUND');
        }
        showToast('Produto atualizado com sucesso.', 'success');
      } else {
        const { error } = await window.db
          .from('products')
          .insert(payload);
        if (error) throw error;
        showToast('Produto cadastrado com sucesso.', 'success');
      }

      // Antes de fechar, revoga previews (o produto já está persistido)
      releasePhotoPreviews();

      closeModal(modalEls.modal);
      await loadProducts();
    } catch (error) {
      console.error('[DEV HUB] Falha ao salvar produto:', error);

      if (error && error.message === 'PRODUCT_NOT_FOUND') {
        showFormFeedback('Este produto não existe mais. Ele pode ter sido excluído por outro usuário.');
      } else {
        showFormFeedback(mapDbError(error, 'save'));
      }
    } finally {
      setSaving(false);
    }
  }

  function setSaving(isSaving) {
    state.saving = isSaving;

    if (modalEls.saveBtn) {
      modalEls.saveBtn.disabled = isSaving;
      modalEls.saveBtn.classList.toggle('is-loading', isSaving);
      modalEls.saveBtn.setAttribute('aria-busy', String(isSaving));
      const label = modalEls.saveBtn.querySelector('.btn__label');
      if (label) label.textContent = isSaving ? 'Salvando...' : 'Salvar';
    }

    // CORREÇÃO #2: inputs de texto aceitam readOnly
    ['name', 'code', 'barcode', 'description', 'price', 'stock', 'minimumStock']
      .forEach(function (key) {
        if (modalEls[key]) modalEls[key].readOnly = isSaving;
      });

    // CORREÇÃO #2: checkbox NÃO aceita readOnly → usar disabled
    if (modalEls.active) modalEls.active.disabled = isSaving;

    // CORREÇÃO #7: re-renderiza slots pra bloquear botões/inputs de foto
    if (photoEls.container) renderPhotoSlots();
  }

  function showFormFeedback(message) {
    if (!modalEls.feedback) return;
    modalEls.feedback.textContent = message;
    modalEls.feedback.hidden = false;
  }

  function clearFormFeedback() {
    if (!modalEls.feedback) return;
    modalEls.feedback.textContent = '';
    modalEls.feedback.hidden = true;
  }

  /* =========================================================
     Modal: confirmar exclusão
     ========================================================= */
  const confirmEls = {};

  function setupConfirmModal() {
    confirmEls.modal = document.getElementById('confirm-modal');
    confirmEls.text  = document.getElementById('confirm-text');
    confirmEls.btn   = document.getElementById('confirm-delete-btn');
    if (!confirmEls.modal || !confirmEls.btn) return;

    confirmEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeConfirmModal);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !confirmEls.modal.hidden) closeConfirmModal();
    });

    confirmEls.btn.addEventListener('click', onConfirmDelete);
  }

  function openConfirmModal(product) {
    // CORREÇÃO #4: guard de null
    state.deletingId = product.id;
    if (confirmEls.text) {
      confirmEls.text.textContent =
        'Tem certeza que deseja excluir "' + (product.name || 'este produto') +
        '"? Esta ação não pode ser desfeita.';
    }
    openModal(confirmEls.modal);
    if (confirmEls.btn) confirmEls.btn.focus();
  }

  function closeConfirmModal() {
    if (state.deleting) return;
    closeModal(confirmEls.modal);
  }

  async function onConfirmDelete() {
    if (state.deleting || !state.deletingId) return;

    setDeleting(true);

    try {
      const { error } = await window.db
        .from('products')
        .delete()
        .eq('id', state.deletingId);

      if (error) throw error;

      closeModal(confirmEls.modal);
      state.deletingId = null;
      showToast('Produto excluído com sucesso.', 'success');
      await loadProducts();
    } catch (error) {
      console.error('[DEV HUB] Falha ao excluir produto:', error);

      if (isForeignKeyError(error)) {
        closeModal(confirmEls.modal);
        state.deletingId = null;
        showToast(
          'Este produto não pode ser excluído porque está vinculado a uma ou mais vendas.',
          'error'
        );
      } else {
        showToast(mapDbError(error, 'delete'), 'error');
      }
    } finally {
      setDeleting(false);
    }
  }

  function setDeleting(isDeleting) {
    state.deleting = isDeleting;
    if (!confirmEls.btn) return;

    confirmEls.btn.disabled = isDeleting;
    confirmEls.btn.classList.toggle('is-loading', isDeleting);
    confirmEls.btn.setAttribute('aria-busy', String(isDeleting));

    const label = confirmEls.btn.querySelector('.btn__label');
    if (label) label.textContent = isDeleting ? 'Excluindo...' : 'Excluir';
  }

  /* =========================================================
     Helpers de modal
     ========================================================= */
  function openModal(modal) {
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;

    const anyOpen = Array.from(document.querySelectorAll('.modal'))
      .some(function (m) { return !m.hidden; });
    if (!anyOpen) document.body.style.overflow = '';
  }

  /* =========================================================
     Helpers de imagens
     ========================================================= */
  function getProductImageUrls(product) {
    const urls = [];

    if (Array.isArray(product.image_urls)) {
      product.image_urls.forEach(function (u) {
        if (u && typeof u === 'string') urls.push(u);
      });
    }
    // Fallback para image_url antigo
    if (urls.length === 0 && product.image_url) urls.push(product.image_url);

    return urls.slice(0, MAX_PHOTOS);
  }

  function getFirstImage(product) {
    const urls = getProductImageUrls(product);
    return urls[0] || null;
  }

  /* =========================================================
     Toasts
     ========================================================= */
  const TOAST_ICONS = {
    success:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M20 6 9 17l-5-5"/></svg>',
    error:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>',
    info:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>'
  };

  function showToast(message, type) {
    const region = document.getElementById('toast-region');
    if (!region) return;

    const kind = type === 'success' || type === 'error' || type === 'info' ? type : 'info';

    const toast = document.createElement('div');
    toast.className = 'toast toast--' + kind;
    toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'toast__icon';
    icon.innerHTML = TOAST_ICONS[kind];

    const text = document.createElement('span');
    text.className = 'toast__message';
    text.textContent = message;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast__close';
    close.setAttribute('aria-label', 'Fechar notificação');
    close.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
      ' stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    close.addEventListener('click', function () { dismissToast(toast); });

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(close);
    region.appendChild(toast);

    const timer = setTimeout(function () { dismissToast(toast); }, 4200);
    toast.addEventListener('mouseenter', function () { clearTimeout(timer); });
  }

  function dismissToast(toast) {
    if (!toast || toast.classList.contains('is-leaving')) return;
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    });
  }

  /* =========================================================
     Formatação / conversão
     ========================================================= */
  function formatPrice(value) {
    const number = parseNumber(value);
    if (number === null) return 'R$ 0,00';
    return currencyFormatter.format(number);
  }

  function formatInteger(value) {
    return String(toInteger(value));
  }

  function toInteger(value) {
    return parseInteger(value, 0);
  }

  /* CORREÇÃO #5: aceita formato BR e US */
  function parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    let str = String(value).trim();

    // Aceita "1.234,56" (BR) e "1234.56" (US)
    if (str.indexOf(',') !== -1 && str.indexOf('.') !== -1) {
      // Tem os dois → assume BR: remove pontos (milhar), troca vírgula por ponto
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.indexOf(',') !== -1) {
      // Só vírgula → assume decimal BR
      str = str.replace(',', '.');
    }
    // Só ponto ou nada → deixa como está

    const parsed = Number(str);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseInteger(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeNumberInput(value) {
    const number = parseNumber(value);
    return number === null ? '0' : String(number);
  }

  function normalizeIntegerInput(value) {
    return String(parseInteger(value, 0));
  }

  /* =========================================================
     Erros
     ========================================================= */
  function isForeignKeyError(error) {
    if (!error) return false;
    const code = String(error.code || '');
    const message = String(error.message || '').toLowerCase();
    return code === '23503' ||
           message.includes('foreign key') ||
           message.includes('violates foreign key constraint');
  }

  function mapDbError(error, context) {
    console.error('[DEV HUB] Erro do Supabase:', error);

    const fallback = context === 'delete'
      ? 'Não foi possível excluir. Tente novamente.'
      : 'Não foi possível salvar. Tente novamente.';

    if (!error) return fallback;

    const code = String(error.code || '');
    const message = String(error.message || '').toLowerCase();

    if (message.includes('failed to fetch') || message.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    if (message.includes('payload too large') || message.includes('maximum allowed size')) {
      return 'A imagem é muito grande. Use no máximo 2 MB.';
    }
    if (message.includes('bucket') && message.includes('not found')) {
      return 'Bucket de imagens não configurado. Contate o suporte.';
    }
    if (code === '23503' || message.includes('foreign key')) {
      return 'Este produto está vinculado a outros registros e não pode ser excluído.';
    }
    if (code === '23505' || message.includes('duplicate') || message.includes('unique')) {
      return 'Já existe um produto com este código ou código de barras.';
    }
    if (code === '23502' || message.includes('violates not-null')) {
      return 'Preencha todos os campos obrigatórios.';
    }
    if (code === '23514' || message.includes('violates check constraint')) {
      return 'Alguns valores informados não são permitidos.';
    }
    if (message.includes('row-level security') || message.includes('permission denied')) {
      return 'Você não tem permissão para executar esta ação.';
    }

    return fallback;
  }

  /* =========================================================
     Utilidades
     ========================================================= */
  function setText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = text;
  }
})();