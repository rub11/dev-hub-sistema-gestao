/* =========================================================
   DEV HUB · Módulo de Configurações
   ---------------------------------------------------------
   Usa apenas window.db. Protegido por sessão (getUser()).
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
    if (!window.db || window.DEV_HUB_CONFIGURED !== true) {
      showGlobalAlert(
        'Não foi possível conectar ao Supabase. Verifique as credenciais em js/supabase.js.',
        'error'
      );
      return;
    }

    setupSidebar();
    setupUserMenu();
    setupLogoutButtons();
    setupProfileForm();
    setupPasswordModal();
    setupThemeControls();
    setupSignOut();

    // Verificação de sessão via getUser (como pedido)
    try {
      const result = await window.db.auth.getUser();
      const user = result && result.data ? result.data.user : null;

      if (!user) {
        window.location.replace('index.html');
        return;
      }
      state.user = user;
    } catch (error) {
      console.error('[DEV HUB] Falha ao verificar sessão:', error);
      window.location.replace('index.html');
      return;
    }

    watchAuthChanges();

    // Carrega perfil da tabela profiles
    state.profile = await loadProfile(state.user.id);

    renderUser(state.user, state.profile);
    renderProfileForm();
    renderAccountInfo();

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
    return state.signingOut || (window.Auth && window.Auth.isSigningOut && window.Auth.isSigningOut());
  }

  async function loadProfile(userId) {
    if (!userId) return null;

    const { data, error } = await window.db
      .from('profiles')
      .select('id, name, email, role, created_at')
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

      // Atualiza estado local
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

  function openPasswordModal() {
    pwEls.form.reset();
    pwEls.new.type = 'password';
    pwEls.confirm.type = 'password';
    clearPasswordFeedback();

    pwEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    pwEls.new.focus();
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
     Preferências / tema
     ========================================================= */
  function setupThemeControls() {
    const inputs = document.querySelectorAll('input[name="theme"]');
    if (!inputs.length || !window.Theme) return;

    const current = window.Theme.get();
    inputs.forEach(function (input) {
      input.checked = input.value === current;
      input.addEventListener('change', function () {
        if (!input.checked) return;
        window.Theme.set(input.value);
        showToast('Preferência de tema atualizada.', 'success');
      });
    });
  }

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

  // Botões data-action="logout" (na sidebar e no user menu) — abrem a confirmação
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