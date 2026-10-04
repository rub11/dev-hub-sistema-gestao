/* =========================================================
   DEV HUB · Configurações da Plataforma
   ---------------------------------------------------------
   Apenas platform_admin. Edita:
     - platform_settings (nome da plataforma, e-mail de suporte)
     - próprio perfil (nome, senha)
   ========================================================= */

(function () {
  'use strict';

  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const state = {
    user: null,
    profile: null,
    settings: null,
    savingPlatform: false,
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
      showGlobalAlert('Não foi possível conectar ao Supabase.', 'error');
      return;
    }

    setupSidebar();
    setupUserMenu();
    setupLogout();
    setupPlatformForm();
    setupProfileForm();
    setupPasswordModal();
    setupSignOut();

    const context = await window.Auth.requirePlatformAdmin();
    if (!context) return;

    const session = await window.Auth.getSession();
    if (!session) return;

    state.user = session.user;

    const allowed = await checkPlatformAdmin(session.user.id);
    if (!allowed) {
      window.location.replace('dashboard.html');
      return;
    }

    watchAuthChanges();

    const [profile, settings] = await Promise.all([
      window.Auth.getProfile(session.user.id),
      loadPlatformSettings()
    ]);

    state.profile = profile;
    state.settings = settings;

    renderUser(state.user, state.profile);
    renderPlatformForm();
    renderProfileForm();

    showLoading(false);
  }

  async function checkPlatformAdmin(userId) {
    try {
      const { data, error } = await window.db
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', userId)
        .limit(1);

      if (error) {
        console.error('[DEV HUB] Falha ao verificar platform_admin:', error);
        return false;
      }
      return Boolean(data && data[0] && data[0].is_platform_admin === true);
    } catch (e) {
      console.error('[DEV HUB] Erro inesperado:', e);
      return false;
    }
  }

  function watchAuthChanges() {
    window.db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT' && !window.Auth.isSigningOut()) {
        window.location.replace('index.html?expired=1');
      }
    });
  }

  /* =========================================================
     Carregar platform_settings
     ========================================================= */
  async function loadPlatformSettings() {
    try {
      const { data, error } = await window.db
        .from('platform_settings')
        .select('id, platform_name, support_email, updated_at')
        .eq('id', 1)
        .limit(1);

      if (error) throw error;
      return (data && data[0]) || { id: 1, platform_name: 'DEV HUB', support_email: '' };
    } catch (error) {
      console.error('[DEV HUB] Falha ao carregar platform_settings:', error);
      return { id: 1, platform_name: 'DEV HUB', support_email: '' };
    }
  }

  /* =========================================================
     Topbar
     ========================================================= */
  function renderUser(user, profile) {
    const meta = user.user_metadata || {};
    const fullName =
      (profile && profile.name) ||
      meta.name || meta.full_name ||
      (user.email ? user.email.split('@')[0] : '') ||
      'Usuário';

    const roleText = 'Administrador da Plataforma';
    const firstName = String(fullName).trim().split(/\s+/)[0] || 'Usuário';
    const initial = firstName.charAt(0).toUpperCase() || '?';

    setText('user-avatar', initial);
    setText('user-name', fullName);
    setText('user-role', roleText);
    setText('greeting-name', 'Olá, ' + firstName);

    const roleBadge = document.getElementById('greeting-role');
    if (roleBadge) {
      roleBadge.textContent = roleText;
      roleBadge.hidden = false;
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
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1024) close();
    });
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
    document.querySelectorAll('[data-action="logout"]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        await window.Auth.signOut();
      });
    });
  }

  /* =========================================================
     Plataforma
     ========================================================= */
  function renderPlatformForm() {
    if (!state.settings) return;
    setInputValue('platform-name', state.settings.platform_name || 'DEV HUB');
    setInputValue('platform-support-email', state.settings.support_email || '');
  }

  function setupPlatformForm() {
    const form = document.getElementById('platform-form');
    if (!form) return;
    form.addEventListener('submit', onSubmitPlatform);
  }

  async function onSubmitPlatform(event) {
    event.preventDefault();
    if (state.savingPlatform) return;

    clearPlatformFeedback();

    const nameInput = document.getElementById('platform-name');
    const emailInput = document.getElementById('platform-support-email');
    if (!nameInput || !emailInput) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    if (!name) {
      showPlatformFeedback('Informe o nome da plataforma.');
      nameInput.focus();
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showPlatformFeedback('E-mail de suporte inválido.');
      emailInput.focus();
      return;
    }

    setPlatformBusy(true);

    try {
      const { data, error } = await window.db
        .from('platform_settings')
        .update({
          platform_name: name,
          support_email: email || null
        })
        .eq('id', 1)
        .select('id');

      if (error) throw error;

      if (!data || data.length === 0) {
        const { error: insErr } = await window.db
          .from('platform_settings')
          .insert({
            id: 1,
            platform_name: name,
            support_email: email || null
          });

        if (insErr) throw insErr;
      }

      state.settings = state.settings || {};
      state.settings.platform_name = name;
      state.settings.support_email = email || null;

      showToast('Configurações da plataforma atualizadas.', 'success');
    } catch (error) {
      console.error('[DEV HUB] Falha ao salvar plataforma:', error);
      showPlatformFeedback(mapDbError(error));
    } finally {
      setPlatformBusy(false);
    }
  }

  function setPlatformBusy(busy) {
    state.savingPlatform = busy;
    const btn = document.getElementById('platform-save-btn');
    const nameInput = document.getElementById('platform-name');
    const emailInput = document.getElementById('platform-support-email');

    if (btn) {
      btn.disabled = busy;
      btn.classList.toggle('is-loading', busy);
      btn.setAttribute('aria-busy', String(busy));
      const label = btn.querySelector('.btn__label');
      if (label) label.textContent = busy ? 'Salvando...' : 'Salvar configurações';
    }
    if (nameInput) nameInput.readOnly = busy;
    if (emailInput) emailInput.readOnly = busy;
  }

  function showPlatformFeedback(msg) {
    const el = document.getElementById('platform-feedback');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  function clearPlatformFeedback() {
    const el = document.getElementById('platform-feedback');
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
  }

  /* =========================================================
     Perfil
     ========================================================= */
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
  }

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

    setProfileBusy(true);

    try {
      const { error } = await window.db
        .from('profiles')
        .update({ name: name })
        .eq('id', userId);

      if (error) throw error;

      try {
        await window.db
          .from('organization_members')
          .update({ name: name })
          .eq('user_id', userId);
      } catch (syncErr) {
        console.warn('[DEV HUB] profile sincronizado só em profiles:', syncErr);
      }

      state.profile = Object.assign({}, state.profile || {}, { name: name });
      renderUser(state.user, state.profile);
      renderProfileForm();

      showToast('Nome atualizado com sucesso.', 'success');
    } catch (error) {
      console.error('[DEV HUB] Falha ao salvar perfil:', error);
      showProfileFeedback(mapDbError(error));
    } finally {
      setProfileBusy(false);
    }
  }

  function setProfileBusy(busy) {
    state.savingProfile = busy;
    const btn = document.getElementById('profile-save-btn');
    const input = document.getElementById('profile-name');

    if (btn) {
      btn.disabled = busy;
      btn.classList.toggle('is-loading', busy);
      btn.setAttribute('aria-busy', String(busy));
      const label = btn.querySelector('.btn__label');
      if (label) label.textContent = busy ? 'Salvando...' : 'Salvar';
    }
    if (input) input.readOnly = busy;
  }

  function showProfileFeedback(msg) {
    const el = document.getElementById('profile-feedback');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  function clearProfileFeedback() {
    const el = document.getElementById('profile-feedback');
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
  }

  /* =========================================================
     Modal: alterar senha
     ========================================================= */
  const pwEls = {};

  function setupPasswordModal() {
    pwEls.modal    = document.getElementById('password-modal');
    pwEls.form     = document.getElementById('password-form');
    pwEls.new      = document.getElementById('new-password');
    pwEls.confirm  = document.getElementById('confirm-password');
    pwEls.feedback = document.getElementById('password-feedback');
    pwEls.saveBtn  = document.getElementById('password-save-btn');
    pwEls.openBtn  = document.getElementById('change-password-btn');

    if (!pwEls.modal || !pwEls.form) return;

    if (pwEls.openBtn) pwEls.openBtn.addEventListener('click', openPasswordModal);

    pwEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closePasswordModal);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !pwEls.modal.hidden) closePasswordModal();
    });

    pwEls.modal.querySelectorAll('[data-pw-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const input = document.getElementById(btn.getAttribute('data-pw-toggle'));
        if (!input) return;
        const visible = input.type === 'text';
        input.type = visible ? 'password' : 'text';
        btn.setAttribute('aria-pressed', String(!visible));
        btn.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha');
        input.focus({ preventScroll: true });
      });
    });

    pwEls.form.addEventListener('submit', onSubmitPassword);
  }

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

    if (!newPw) { showPasswordFeedback('Informe a nova senha.'); pwEls.new.focus(); return; }
    if (newPw.length < 8) { showPasswordFeedback('Mínimo de 8 caracteres.'); pwEls.new.focus(); return; }
    if (newPw !== confirmPw) { showPasswordFeedback('As senhas não coincidem.'); pwEls.confirm.focus(); return; }

    setPasswordBusy(true);

    try {
      const { error } = await window.db.auth.updateUser({ password: newPw });
      if (error) throw error;

      closePasswordModal();
      showToast('Senha alterada com sucesso.', 'success');
    } catch (error) {
      console.error('[DEV HUB] Falha ao alterar senha:', error);
      showPasswordFeedback(mapPasswordError(error));
    } finally {
      setPasswordBusy(false);
    }
  }

  function setPasswordBusy(busy) {
    state.savingPassword = busy;
    if (pwEls.saveBtn) {
      pwEls.saveBtn.disabled = busy;
      pwEls.saveBtn.classList.toggle('is-loading', busy);
      pwEls.saveBtn.setAttribute('aria-busy', String(busy));
      const label = pwEls.saveBtn.querySelector('.btn__label');
      if (label) label.textContent = busy ? 'Salvando...' : 'Salvar nova senha';
    }
    if (pwEls.new) pwEls.new.readOnly = busy;
    if (pwEls.confirm) pwEls.confirm.readOnly = busy;
  }

  function showPasswordFeedback(msg) {
    if (!pwEls.feedback) return;
    pwEls.feedback.textContent = msg;
    pwEls.feedback.hidden = false;
  }
  function clearPasswordFeedback() {
    if (!pwEls.feedback) return;
    pwEls.feedback.textContent = '';
    pwEls.feedback.hidden = true;
  }

  function mapPasswordError(error) {
    if (!error) return 'Não foi possível alterar a senha.';
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('same_password')) return 'A nova senha precisa ser diferente da atual.';
    if (msg.includes('weak') || msg.includes('at least')) return 'Senha muito fraca. Use 8+ caracteres.';
    if (msg.includes('failed to fetch') || msg.includes('network')) return 'Não foi possível conectar ao servidor.';
    if (msg.includes('rate limit') || msg.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos.';
    return 'Não foi possível alterar a senha. Tente novamente.';
  }

  /* =========================================================
     Sair
     ========================================================= */
  const outEls = {};

  function setupSignOut() {
    outEls.modal   = document.getElementById('signout-modal');
    outEls.openBtn = document.getElementById('signout-btn');
    outEls.confirm = document.getElementById('signout-confirm-btn');

    if (!outEls.modal) return;

    if (outEls.openBtn) outEls.openBtn.addEventListener('click', openSignOutModal);
    outEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeSignOutModal);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !outEls.modal.hidden) closeSignOutModal();
    });
    if (outEls.confirm) outEls.confirm.addEventListener('click', onConfirmSignOut);
  }

  function openSignOutModal() {
    outEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    if (outEls.confirm) outEls.confirm.focus();
  }

  function closeSignOutModal() {
    if (state.signingOut) return;
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
      await window.db.auth.signOut();
    } catch (error) {
      console.error('[DEV HUB] Falha ao encerrar sessão:', error);
    } finally {
      window.location.replace('index.html');
    }
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

  function mapDbError(error) {
    if (!error) return 'Não foi possível salvar. Tente novamente.';
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('network')) return 'Não foi possível conectar ao servidor.';
    if (msg.includes('row-level security') || msg.includes('permission denied')) return 'Você não tem permissão para esta ação.';
    if (msg.includes('violates not-null')) return 'Preencha todos os campos obrigatórios.';
    if (msg.includes('duplicate') || msg.includes('unique')) return 'Já existe um registro com esses dados.';
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
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>'
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
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
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