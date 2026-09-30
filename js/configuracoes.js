/* =========================================================
   DEV HUB · Módulo de Configurações
   ---------------------------------------------------------
   Usa apenas window.db. Protegido por sessão (requireSession).
   ---------------------------------------------------------
   CORREÇÕES APLICADAS:
   1. `init()` usa `Auth.requireSession()` — antes pulava o
      guard de status (banned/suspended/vacation) chamando
      `getUser()` direto.
   2. `setupSignOut()` roda ANTES de `setupLogoutButtons()`
      para garantir que `outEls.modal` esteja populado.
   3. `openPasswordModal` reseta o estado visual dos toggles
      de senha (aria-pressed / aria-label / type).
   4. `onSubmitProfile` sincroniza `organization_members.name`
      e `sessionStorage.devhub_user` (best-effort).
   5. Guards de null em vários pontos.
   6. `mapDbError` trata duplicate/unique.
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Formatadores ---------- */
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  /* ---------- Estado ---------- */
  const state = {
    user: null,
    profile: null,
    savingProfile: false,
    savingPassword: false,
    signingOut: false
  };

  document.addEventListener('DOMContentLoaded', init);

  /* =========================================================
     Init
     ========================================================= */
  async function init() {
    if (!window.db || !window.Auth || !window.Auth.isConfigured()) {
      showGlobalAlert(
        'Não foi possível conectar ao Supabase. Verifique as credenciais em js/supabase.js.',
        'error'
      );
      return;
    }

    /* CORREÇÃO #2: setupSignOut roda antes para popular outEls.modal. */
    setupSignOut();
    setupSidebar();
    setupUserMenu();
    setupProfileForm();
    setupPasswordModal();
    setupAvatar();
    setupLogoutButtons();

    /* CORREÇÃO #1: requireSession roda o guard de status.
       Antes usávamos getUser(), que não bloqueia usuário
       banido/suspenso/em férias. */
    const session = await window.Auth.requireSession();
    if (!session) return;

    state.user = session.user;

    watchAuthChanges();

    // Carrega perfil da tabela profiles
    state.profile = await loadProfile(state.user.id);

    renderUser(state.user, state.profile);
    renderProfileForm();
    renderAccountInfo();

    // Renderiza a foto no card de avatar
    renderAvatarPreview((state.profile && state.profile.avatar_url) || null);

    showLoading(false);
  }

  /* =========================================================
     Sessão / perfil
     ========================================================= */
  function watchAuthChanges() {
    window.db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT' && !isSigningOut()) {
        window.location.replace('index.html?expired=1');
      }
    });
  }

  function isSigningOut() {
    return state.signingOut ||
           (window.Auth && window.Auth.isSigningOut && window.Auth.isSigningOut());
  }

  async function loadProfile(userId) {
    if (!userId) return null;

    const { data, error } = await window.db
      .from('profiles')
      .select('id, name, email, role, created_at, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[DEV HUB] Falha ao carregar o perfil:', error);
      showToast('Não foi possível carregar o perfil.', 'error');
      return null;
    }
    return data || null;
  }

  /* =========================================================
     Renderização
     ========================================================= */
  function renderUser(user, profile) {
    const meta = user.user_metadata || {};
    const fullName =
      (profile && profile.name) ||
      meta.name || meta.full_name ||
      (user.email ? user.email.split('@')[0] : '') ||
      'Usuário';

    const roleText = roleLabel((profile && profile.role) || meta.role || '');
    const firstName = String(fullName).trim().split(/\s+/)[0] || 'Usuário';
    const initial = firstName.charAt(0).toUpperCase() || '?';

    setText('user-avatar', initial);
    setText('user-name', fullName);
    setText('user-role', roleText || user.email || '');
    setText('greeting-name', 'Olá, ' + firstName);

    const roleBadge = document.getElementById('greeting-role');
    if (roleBadge) {
      if (roleText) {
        roleBadge.textContent = roleText;
        roleBadge.hidden = false;
      } else {
        roleBadge.hidden = true;
      }
    }
  }

  function renderProfileForm() {
    const user = state.user;
    const profile = state.profile;
    if (!user) return;

    const displayName =
      (profile && profile.name) ||
      (user.user_metadata && (user.user_metadata.name || user.user_metadata.full_name)) ||
      (user.email ? user.email.split('@')[0] : '');

    const displayEmail =
      (profile && profile.email) ||
      user.email ||
      '';

    setInputValue('profile-name', displayName || '');
    setInputValue('profile-email', displayEmail);
    setInputValue('profile-role', roleLabel((profile && profile.role) || ''));
    setInputValue('profile-created', formatDate((profile && profile.created_at) || user.created_at));
  }

  function renderAccountInfo() {
    const user = state.user;
    const profile = state.profile;
    if (!user) return;

    setText('account-email', user.email || '—');
    setText('account-role', roleLabel((profile && profile.role) || ''));
    setText('account-id', user.id || '—');
  }

  function roleLabel(role) {
    if (!role) return '';
    const key = String(role).trim().toLowerCase();
    if (key === 'admin' || key === 'administrador') return 'Administrador';
    if (key === 'user' || key === 'usuario' || key === 'usuário') return 'Usuário';
    if (window.Auth && typeof window.Auth.roleLabel === 'function') {
      return window.Auth.roleLabel(role);
    }
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  /* =========================================================
     Salvar nome do perfil
     ========================================================= */
  function setupProfileForm() {
    const form = document.getElementById('profile-form');
    if (!form) return;
    form.addEventListener('submit', onSubmitProfile);
  }

  async function onSubmitProfile(event) {
    event.preventDefault();
    if (state.savingProfile) return;

    clearProfileFeedback();

    const input = document.getElementById('profile-name');
    if (!input) return;
    const name = input.value.trim();

    if (!name) {
      showProfileFeedback('Informe seu nome.');
      input.focus();
      return;
    }

    const userId = state.user && state.user.id;
    if (!userId) {
      showProfileFeedback('Sessão inválida. Faça login novamente.');
      return;
    }

    setProfileSaving(true);

    try {
      const { error } = await window.db
        .from('profiles')
        .update({ name: name })
        .eq('id', userId);

      if (error) throw error;

      /* CORREÇÃO #4: sincroniza organization_members (best-effort)
         e sessionStorage.devhub_user — sem isso o topnav continua
         mostrando o nome antigo até próximo login. */
      try {
        await window.db
          .from('organization_members')
          .update({ name: name })
          .eq('user_id', userId);
      } catch (syncErr) {
        console.warn('[DEV HUB] Falha ao sincronizar organization_members:', syncErr);
      }

      syncSessionUserName(name);

      state.profile = Object.assign({}, state.profile || {}, { name: name });

      renderUser(state.user, state.profile);
      renderProfileForm();

      showToast('Nome atualizado com sucesso.', 'success');
    } catch (error) {
      console.error('[DEV HUB] Falha ao salvar perfil:', error);
      showProfileFeedback(mapDbError(error));
    } finally {
      setProfileSaving(false);
    }
  }

  /* CORREÇÃO #4 (continuação): escreve o novo nome no
     sessionStorage usado por nav.js. */
  function syncSessionUserName(name) {
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (!raw) return;
      const ctx = JSON.parse(raw);
      if (!ctx || typeof ctx !== 'object') return;
      ctx.name = name;
      sessionStorage.setItem('devhub_user', JSON.stringify(ctx));
    } catch (e) {
      console.warn('[DEV HUB] Falha ao sincronizar nome no sessionStorage:', e);
    }
  }

  function setProfileSaving(isSaving) {
    state.savingProfile = isSaving;

    const btn = document.getElementById('profile-save-btn');
    const input = document.getElementById('profile-name');

    if (btn) {
      btn.disabled = isSaving;
      btn.classList.toggle('is-loading', isSaving);
      btn.setAttribute('aria-busy', String(isSaving));
      const label = btn.querySelector('.btn__label');
      if (label) label.textContent = isSaving ? 'Salvando...' : 'Salvar alterações';
    }
    if (input) input.readOnly = isSaving;
  }

  function showProfileFeedback(message) {
    const el = document.getElementById('profile-feedback');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  function clearProfileFeedback() {
    const el = document.getElementById('profile-feedback');
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
  }

  /* =========================================================
     Alterar senha
     ========================================================= */
  const pwEls = {};

  function setupPasswordModal() {
    pwEls.modal     = document.getElementById('password-modal');
    pwEls.form      = document.getElementById('password-form');
    pwEls.new       = document.getElementById('new-password');
    pwEls.confirm   = document.getElementById('confirm-password');
    pwEls.feedback  = document.getElementById('password-feedback');
    pwEls.saveBtn   = document.getElementById('password-save-btn');
    pwEls.openBtn   = document.getElementById('change-password-btn');

    if (!pwEls.modal || !pwEls.form) return;

    if (pwEls.openBtn) {
      pwEls.openBtn.addEventListener('click', openPasswordModal);
    }

    pwEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closePasswordModal);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !pwEls.modal.hidden) closePasswordModal();
    });

    // Toggle mostrar/ocultar senha
    pwEls.modal.querySelectorAll('[data-pw-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const targetId = btn.getAttribute('data-pw-toggle');
        const input = document.getElementById(targetId);
        if (!input) return;

        const isVisible = input.type === 'text';
        input.type = isVisible ? 'password' : 'text';
        btn.setAttribute('aria-pressed', String(!isVisible));
        btn.setAttribute('aria-label', isVisible ? 'Mostrar senha' : 'Ocultar senha');
        input.focus({ preventScroll: true });
      });
    });

    pwEls.form.addEventListener('submit', onSubmitPassword);
  }

  /* CORREÇÃO #3: reseta o estado visual dos toggles ao reabrir. */
  function openPasswordModal() {
    pwEls.form.reset();

    if (pwEls.new) pwEls.new.type = 'password';
    if (pwEls.confirm) pwEls.confirm.type = 'password';

    pwEls.modal.querySelectorAll('[data-pw-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'Mostrar senha');
    });

    clearPasswordFeedback();

    pwEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';

    /* CORREÇÃO #5: guard de null */
    if (pwEls.new) pwEls.new.focus();
  }

  function closePasswordModal() {
    if (state.savingPassword) return;
    pwEls.modal.hidden = true;
    document.body.style.overflow = '';
  }

  async function onSubmitPassword(event) {
    event.preventDefault();
    if (state.savingPassword) return;

    clearPasswordFeedback();

    const newPw = pwEls.new.value;
    const confirmPw = pwEls.confirm.value;

    if (!newPw) {
      showPasswordFeedback('Informe a nova senha.');
      pwEls.new.focus();
      return;
    }
    if (newPw.length < 8) {
      showPasswordFeedback('A senha precisa ter pelo menos 8 caracteres.');
      pwEls.new.focus();
      return;
    }
    if (newPw !== confirmPw) {
      showPasswordFeedback('As senhas não coincidem.');
      pwEls.confirm.focus();
      return;
    }

    setPasswordSaving(true);

    try {
      const { error } = await window.db.auth.updateUser({ password: newPw });
      if (error) throw error;

      closePasswordModal();
      showToast('Senha alterada com sucesso.', 'success');
    } catch (error) {
      console.error('[DEV HUB] Falha ao alterar senha:', error);
      showPasswordFeedback(mapPasswordError(error));
    } finally {
      setPasswordSaving(false);
    }
  }

  function setPasswordSaving(isSaving) {
    state.savingPassword = isSaving;

    if (pwEls.saveBtn) {
      pwEls.saveBtn.disabled = isSaving;
      pwEls.saveBtn.classList.toggle('is-loading', isSaving);
      pwEls.saveBtn.setAttribute('aria-busy', String(isSaving));
      const label = pwEls.saveBtn.querySelector('.btn__label');
      if (label) label.textContent = isSaving ? 'Salvando...' : 'Salvar nova senha';
    }
    if (pwEls.new) pwEls.new.readOnly = isSaving;
    if (pwEls.confirm) pwEls.confirm.readOnly = isSaving;
  }

  function showPasswordFeedback(message) {
    if (!pwEls.feedback) return;
    pwEls.feedback.textContent = message;
    pwEls.feedback.hidden = false;
  }

  function clearPasswordFeedback() {
    if (!pwEls.feedback) return;
    pwEls.feedback.textContent = '';
    pwEls.feedback.hidden = true;
  }

  function mapPasswordError(error) {
    if (!error) return 'Não foi possível alterar a senha. Tente novamente.';

    const message = String(error.message || '').toLowerCase();

    if (message.includes('same_password') || message.includes('should be different')) {
      return 'A nova senha precisa ser diferente da senha atual.';
    }
    if (message.includes('weak') || message.includes('at least')) {
      return 'A senha é muito fraca. Use pelo menos 8 caracteres.';
    }
    if (message.includes('failed to fetch') || message.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    if (message.includes('rate limit') || message.includes('too many')) {
      return 'Muitas tentativas. Aguarde alguns minutos.';
    }
    return 'Não foi possível alterar a senha. Tente novamente.';
  }

  /* =========================================================
     Foto do perfil
     ========================================================= */
  const avatarEls = {};

  function setupAvatar() {
    avatarEls.preview  = document.getElementById('avatar-preview');
    avatarEls.input    = document.getElementById('avatar-input');
    avatarEls.upload   = document.getElementById('avatar-upload-btn');
    avatarEls.remove   = document.getElementById('avatar-remove-btn');
    avatarEls.feedback = document.getElementById('avatar-feedback');

    if (!avatarEls.preview || !avatarEls.input) return;

    if (avatarEls.upload) {
      avatarEls.upload.addEventListener('click', function () {
        avatarEls.input.click();
      });
    }

    avatarEls.input.addEventListener('change', onAvatarPick);

    if (avatarEls.remove) {
      avatarEls.remove.addEventListener('click', onAvatarRemove);
    }
  }

  function getUserInitial() {
    const name =
      (state.profile && state.profile.name) ||
      (state.user && state.user.user_metadata && state.user.user_metadata.name) ||
      (state.user && state.user.email ? state.user.email.split('@')[0] : '') ||
      '';
    const first = String(name).trim().split(/\s+/)[0] || '';
    return first.charAt(0).toUpperCase() || '?';
  }

  function renderAvatarPreview(url) {
    if (!avatarEls.preview) return;
    avatarEls.preview.innerHTML = '';

    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      avatarEls.preview.appendChild(img);
      if (avatarEls.remove) avatarEls.remove.hidden = false;
    } else {
      const span = document.createElement('span');
      span.textContent = getUserInitial();
      avatarEls.preview.appendChild(span);
      if (avatarEls.remove) avatarEls.remove.hidden = true;
    }
  }

  async function onAvatarPick(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;

    clearAvatarFeedback();

    if (!file.type || file.type.indexOf('image/') !== 0) {
      showAvatarFeedback('Selecione uma imagem (JPG, PNG ou WEBP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showAvatarFeedback('A imagem precisa ter no máximo 2 MB.');
      return;
    }

    setAvatarBusy(true);

    try {
      const userId = state.user.id;
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = userId + '/avatar-' + Date.now() + '.' + ext;

      // Upload
      const { error: upErr } = await window.db.storage
        .from('avatars')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });
      if (upErr) throw upErr;

      // URL pública
      const { data: urlData } = window.db.storage
        .from('avatars')
        .getPublicUrl(path);

      const publicUrl = urlData && urlData.publicUrl;
      if (!publicUrl) throw new Error('Não foi possível gerar a URL pública.');

      // Persiste em profiles
      const { error: dbErr } = await window.db
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);
      if (dbErr) throw dbErr;

      // Estado local
      state.profile = Object.assign({}, state.profile || {}, { avatar_url: publicUrl });

      syncSessionAvatar(publicUrl);

      renderAvatarPreview(publicUrl);
      applyTopbarAvatar(publicUrl);

      showToast('Foto atualizada com sucesso.', 'success');
    } catch (error) {
      console.error('[DEV HUB] Falha no upload da foto:', error);
      showAvatarFeedback(mapAvatarError(error));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onAvatarRemove() {
    if (!state.user || !state.user.id) return;

    clearAvatarFeedback();

    if (!window.confirm('Remover sua foto de perfil?')) return;

    setAvatarBusy(true);

    try {
      const userId = state.user.id;

      // Limpa no banco
      const { error: dbErr } = await window.db
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId);
      if (dbErr) throw dbErr;

      // Remove do Storage (best-effort)
      try {
        const { data: files } = await window.db.storage
          .from('avatars')
          .list(userId);

        if (files && files.length > 0) {
          const paths = files.map(function (f) { return userId + '/' + f.name; });
          await window.db.storage.from('avatars').remove(paths);
        }
      } catch (e) {
        console.warn('[DEV HUB] Falha ao remover arquivos antigos:', e);
      }

      // Estado local
      state.profile = Object.assign({}, state.profile || {}, { avatar_url: null });

      syncSessionAvatar(null);

      renderAvatarPreview(null);
      applyTopbarAvatar(null);

      showToast('Foto removida.', 'success');
    } catch (error) {
      console.error('[DEV HUB] Falha ao remover foto:', error);
      showAvatarFeedback('Não foi possível remover a foto.');
    } finally {
      setAvatarBusy(false);
    }
  }

  /* Sincroniza sessionStorage.avatar_url com fallback seguro. */
  function syncSessionAvatar(url) {
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (!raw) return;
      const ctx = JSON.parse(raw);
      if (!ctx || typeof ctx !== 'object') return;

      if (url) ctx.avatar_url = url;
      else delete ctx.avatar_url;

      sessionStorage.setItem('devhub_user', JSON.stringify(ctx));
    } catch (e) {
      console.warn('[DEV HUB] Falha ao sincronizar avatar no sessionStorage:', e);
    }
  }

  function applyTopbarAvatar(url) {
    const el = document.getElementById('user-avatar');
    if (!el) return;

    el.innerHTML = '';

    if (url) {
      el.style.background = 'none';
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      el.appendChild(img);
    } else {
      el.style.background = '';
      el.textContent = getUserInitial();
    }
  }

  function setAvatarBusy(busy) {
    if (avatarEls.upload) {
      avatarEls.upload.disabled = busy;
      avatarEls.upload.classList.toggle('is-loading', busy);
      avatarEls.upload.setAttribute('aria-busy', String(busy));
      const lbl = avatarEls.upload.querySelector('.btn__label');
      if (lbl) lbl.textContent = busy ? 'Enviando...' : 'Escolher imagem';
    }
    if (avatarEls.remove) avatarEls.remove.disabled = busy;
    if (avatarEls.input)  avatarEls.input.disabled  = busy;
  }

  function showAvatarFeedback(msg) {
    if (!avatarEls.feedback) return;
    avatarEls.feedback.textContent = msg;
    avatarEls.feedback.hidden = false;
  }

  function clearAvatarFeedback() {
    if (!avatarEls.feedback) return;
    avatarEls.feedback.textContent = '';
    avatarEls.feedback.hidden = true;
  }

  function mapAvatarError(error) {
    if (!error) return 'Não foi possível enviar a foto. Tente novamente.';
    const msg = String(error.message || '').toLowerCase();

    if (msg.includes('payload too large') || msg.includes('maximum allowed size')) {
      return 'A imagem é muito grande. Use no máximo 2 MB.';
    }
    if (msg.includes('row-level security') || msg.includes('permission denied')) {
      return 'Você não tem permissão para enviar imagens.';
    }
    if (msg.includes('bucket') && msg.includes('not found')) {
      return 'Bucket de avatares não configurado. Contate o suporte.';
    }
    if (msg.includes('failed to fetch') || msg.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    return 'Não foi possível enviar a foto. Tente novamente.';
  }

  /* =========================================================
     Preferências / tema
     ========================================================= */
  
  

  /* =========================================================
     Sair da conta
     ========================================================= */
  const outEls = {};

  function setupSignOut() {
    outEls.modal   = document.getElementById('signout-modal');
    outEls.openBtn = document.getElementById('signout-btn');
    outEls.confirm = document.getElementById('signout-confirm-btn');

    if (!outEls.modal) return;

    if (outEls.openBtn) {
      outEls.openBtn.addEventListener('click', openSignOutModal);
    }

    outEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeSignOutModal);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !outEls.modal.hidden) closeSignOutModal();
    });

    if (outEls.confirm) {
      outEls.confirm.addEventListener('click', onConfirmSignOut);
    }
  }

  function openSignOutModal() {
    if (!outEls.modal) return;
    outEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    if (outEls.confirm) outEls.confirm.focus();
  }

  function closeSignOutModal() {
    if (state.signingOut) return;
    if (!outEls.modal) return;
    outEls.modal.hidden = true;
    document.body.style.overflow = '';
  }

  async function onConfirmSignOut() {
    if (state.signingOut) return;
    state.signingOut = true;

    if (outEls.confirm) {
      outEls.confirm.disabled = true;
      outEls.confirm.classList.add('is-loading');
      outEls.confirm.setAttribute('aria-busy', 'true');
      const label = outEls.confirm.querySelector('.btn__label');
      if (label) label.textContent = 'Saindo...';
    }

    try {
      if (window.Auth && typeof window.Auth.signOut === 'function') {
        await window.Auth.signOut();
        return;
      }
      await window.db.auth.signOut();
    } catch (error) {
      console.error('[DEV HUB] Falha ao encerrar sessão:', error);
    } finally {
      window.location.replace('index.html');
    }
  }

  /* =========================================================
     Sidebar / user menu / logout (via data-action)
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

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
    });

    sidebar.querySelectorAll('a.nav__item').forEach(function (link) {
      link.addEventListener('click', close);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1024) close();
    });
  }

  function setupUserMenu() {
    const trigger = document.getElementById('user-menu-trigger');
    const panel = document.getElementById('user-menu-panel');
    if (!trigger || !panel) return;

    function open() {
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      const first = panel.querySelector('.menu-item:not([aria-disabled="true"])');
      if (first) first.focus();
    }
    function close() {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }

    trigger.addEventListener('click', function (event) {
      event.stopPropagation();
      panel.hidden ? open() : close();
    });

    document.addEventListener('click', function (event) {
      if (panel.hidden) return;
      if (panel.contains(event.target) || trigger.contains(event.target)) return;
      close();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hidden) {
        close();
        trigger.focus();
      }
    });
  }

  // Botões data-action="logout" — abrem a confirmação
  function setupLogoutButtons() {
    document.querySelectorAll('[data-action="logout"]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        // Se o modal de saída existir, usa ele; senão desloga direto.
        if (outEls.modal) openSignOutModal();
        else onConfirmSignOut();
      });
    });
  }

  /* =========================================================
     Helpers
     ========================================================= */
  function showLoading(isLoading) {
    const loading = document.getElementById('settings-loading');
    const content = document.getElementById('settings-content');
    if (!loading || !content) return;

    if (isLoading) {
      loading.hidden = false;
      content.hidden = true;
    } else {
      loading.hidden = true;
      content.hidden = false;
    }
  }

  function showGlobalAlert(message, type) {
    const el = document.getElementById('global-alert');
    if (!el) return;
    el.textContent = message;
    el.className = 'alert alert--' + (type || 'error');
    el.hidden = false;
  }

  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return dateFormatter.format(d);
  }

  function mapDbError(error) {
    console.error('[DEV HUB] Erro do Supabase:', error);

    if (!error) return 'Não foi possível salvar. Tente novamente.';

    const message = String(error.message || '').toLowerCase();

    if (message.includes('failed to fetch') || message.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    if (message.includes('row-level security') || message.includes('permission denied')) {
      return 'Você não tem permissão para executar esta ação.';
    }
    if (message.includes('violates not-null')) {
      return 'Preencha todos os campos obrigatórios.';
    }
    /* CORREÇÃO #7: trata duplicate/unique. */
    if (message.includes('duplicate') || message.includes('unique')) {
      return 'Já existe um registro com esses dados.';
    }
    return 'Não foi possível salvar. Tente novamente.';
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
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
})();