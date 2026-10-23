/* =========================================================
   DEV HUB · Autenticação + Guard Global Blindado
   ========================================================= */

(function () {
  'use strict';

  const HOME_URL = 'welcome.html';
  const BLOCKING_STATUSES = ['banned', 'suspended', 'inactive', 'vacation'];

  const Auth = {

    isConfigured() {
      return (
        !!window.devHubSupabase &&
        typeof window.devHubSupabase.auth?.signInWithPassword === 'function'
      );
    },

    isSigningOut() {
      try {
        return sessionStorage.getItem('devhub_signing_out') === '1'
            || localStorage.getItem('devhub_signing_out') === '1';
      } catch (e) {
        return false;
      }
    },

    getClient() {
      return window.devHubSupabase || window.db || null;
    },

    _purgeLocalContext() {
      try { localStorage.removeItem('devhub_user'); } catch (e) { /* ignora */ }
      try { sessionStorage.removeItem('devhub_user'); } catch (e) { /* ignora */ }
    },

    _persistLocalContext(ctx) {
      const serialized = JSON.stringify(ctx);
      try {
        localStorage.setItem('devhub_user', serialized);
      } catch (e) {
        console.warn('[DEV HUB] Falha ao salvar contexto em localStorage.', e);
      }
      try {
        sessionStorage.setItem('devhub_user', serialized);
      } catch (e) {
        console.warn('[DEV HUB] Falha ao salvar contexto em sessionStorage.', e);
      }
    },

    async getSession() {
      const supabase = this.getClient();
      if (!supabase) return null;

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[DEV HUB] Erro ao obter sessão:', error);
        return null;
      }
      return data?.session || null;
    },

    async signIn(companyCode, email, password) {
      const supabase = this.getClient();
      if (!supabase) throw new Error('Supabase não está configurado.');

      const code = String(companyCode || '').trim().toUpperCase();
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const normalizedPassword = String(password || '');

      if (!normalizedEmail) throw new Error('Informe seu e-mail.');
      if (!normalizedPassword) throw new Error('Informe sua senha.');

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: normalizedPassword
        });

      if (authError) {
        console.error('[DEV HUB] Erro no login:', authError);
        throw new Error(this._mapAuthError(authError));
      }

      const user = authData?.user;
      if (!user) {
        await this._safeSignOut(supabase);
        throw new Error('Não foi possível identificar o usuário.');
      }

      if (code) {
        const { data: companyData, error: companyError } =
          await supabase.rpc('validate_company_login', { p_company_code: code });

        if (companyError) {
          console.error('[DEV HUB] Erro ao validar empresa:', companyError);
          await this._safeSignOut(supabase);
          this._purgeLocalContext();
          throw new Error('Não foi possível validar a empresa.');
        }

        const membership = Array.isArray(companyData) ? companyData[0] : companyData;
        if (!membership) {
          await this._safeSignOut(supabase);
          this._purgeLocalContext();
          throw new Error('O código da empresa não corresponde ao seu acesso.');
        }

        return this._applyMembership(supabase, user, membership);
      }

      const { data: list, error: listError } = await supabase.rpc('list_my_memberships');

      if (listError) {
        console.error('[DEV HUB] Erro ao listar empresas:', listError);
        await this._safeSignOut(supabase);
        this._purgeLocalContext();
        throw new Error('Não foi possível identificar suas empresas.');
      }

      const memberships = Array.isArray(list) ? list : (list ? [list] : []);

      if (memberships.length === 0) {
        await this._safeSignOut(supabase);
        this._purgeLocalContext();
        throw new Error('Sua conta não está vinculada a nenhuma empresa. Contate o administrador.');
      }

      if (memberships.length === 1) {
        return this._applyMembership(supabase, user, memberships[0]);
      }

      return {
        needsCompanyChoice: true,
        user: user,
        memberships: memberships
      };
    },

    async completeSignIn(membership) {
      const supabase = this.getClient();
      const session = await this.getSession();
      if (!supabase || !session?.user) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      return this._applyMembership(supabase, session.user, membership);
    },

    async _applyMembership(supabase, user, membership) {
      if (!membership) throw new Error('Empresa inválida.');

      const failAndOut = async (msg) => {
        await this._safeSignOut(supabase);
        this._purgeLocalContext();
        throw new Error(msg);
      };

      const orgActive  = membership.organization_active ?? membership.is_organization_active ?? true;
      const userActive = membership.user_active ?? membership.is_user_active ?? true;

      if (orgActive === false) return failAndOut('Esta empresa está desativada.');
      if (userActive === false) return failAndOut('Seu acesso está desativado. Entre em contato com o administrador da empresa.');

      const statusEffective = String(membership.status_effective || 'active').toLowerCase();

      if (BLOCKING_STATUSES.includes(statusEffective)) {
        if (statusEffective === 'banned') return failAndOut('Sua conta está banida. Entre em contato com o administrador.');
        if (statusEffective === 'suspended') {
          const until = membership.block_until ? new Date(membership.block_until).toLocaleString('pt-BR') : null;
          return failAndOut(until ? 'Sua conta está suspensa até ' + until + '.' : 'Sua conta está suspensa. Entre em contato com o administrador.');
        }
        if (statusEffective === 'inactive') return failAndOut('Sua conta está inativa. Entre em contato com o administrador.');
        if (statusEffective === 'vacation') {
          const start = membership.vacation_start ? new Date(membership.vacation_start).toLocaleDateString('pt-BR') : '—';
          const end = membership.vacation_end ? new Date(membership.vacation_end).toLocaleDateString('pt-BR') : '—';
          return failAndOut('Você está em férias (' + start + ' a ' + end + '). O acesso será liberado automaticamente ao fim do período.');
        }
      }

      if (membership.user_id && membership.user_id !== user.id) {
        console.error('[DEV HUB] Inconsistência de usuário na validação.');
        return failAndOut('Não foi possível validar seu acesso.');
      }

      let avatarUrl = null;
      let isPlatformAdmin = Boolean(membership.is_platform_admin);
      let profileRead = false;

      try {
        const { data: profileRow, error: profileErr } = await supabase
          .from('profiles')
          .select('avatar_url, is_platform_admin')
          .eq('id', user.id)
          .maybeSingle();

        if (!profileErr && profileRow) {
          profileRead = true;
          avatarUrl = profileRow.avatar_url || null;
          if (!isPlatformAdmin) {
            isPlatformAdmin = profileRow.is_platform_admin === true;
          }
        }
      } catch (e) {
        console.warn('[DEV HUB] Não foi possível ler perfil no login:', e);
      }

      if (!isPlatformAdmin && !profileRead) {
        isPlatformAdmin = await this._fetchPlatformAdminFlag(supabase, user.id);
      }

      const sessionUser = {
        user_id: user.id,
        organization_id: membership.organization_id || null,
        organization_name: membership.organization_name || '',
        role: String(membership.user_role || 'user').toLowerCase(),
        role_slug: String(membership.user_role_slug || '').toLowerCase(),
        name: membership.user_name || user.user_metadata?.name || '',
        email: membership.user_email || user.email || '',
        is_platform_admin: isPlatformAdmin,
        avatar_url: avatarUrl
      };

      this._purgeLocalContext();
      this._persistLocalContext(sessionUser);

      return sessionUser;
    },

    async _safeSignOut(supabase) {
      if (!supabase) return;
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('[DEV HUB] signOut falhou (ignorado):', e?.message || e);
      }
    },

    _mapAuthError(authError) {
      const status = authError?.status;
      const code = String(authError?.code || '').toLowerCase();
      const message = String(authError?.message || '').toLowerCase();

      if (message.includes('failed to fetch') || message.includes('network') || message.includes('load failed')) {
        return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
      }
      if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
        return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.';
      }
      if (status === 429 || code === 'over_request_rate_limit' || message.includes('rate limit') || message.includes('too many requests') || message.includes('for security purposes')) {
        return 'Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.';
      }
      if (code === 'user_banned' || message.includes('banned')) {
        return 'Este acesso foi bloqueado. Entre em contato com o administrador.';
      }
      if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
        return 'E-mail ou senha incorretos.';
      }
      return 'Não foi possível realizar o login. Tente novamente em instantes.';
    },

    async _fetchPlatformAdminFlag(supabase, userId) {
      if (!supabase || !userId) return false;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_platform_admin')
          .eq('id', userId)
          .limit(1);

        if (error) {
          console.warn('[DEV HUB] Falha ao ler is_platform_admin:', error);
          return false;
        }
        return Boolean(data && data[0] && data[0].is_platform_admin === true);
      } catch (e) {
        console.warn('[DEV HUB] Erro inesperado ao ler is_platform_admin:', e);
        return false;
      }
    },

    async requireSession() {
      const session = await this.getSession();
      if (!session) {
        if (!this.isSigningOut()) {
          window.location.href = 'index.html';
        }
        return null;
      }

      const blocked = await this._checkStatusGuard(session);
      if (blocked) return null;

      return session;
    },

    async _checkStatusGuard(session) {
      const supabase = this.getClient();
      if (!supabase || !session || !session.user) return false;

      try {
        const { data, error } = await supabase.rpc('check_my_status');
        if (error) {
          console.warn('[DEV HUB] Guard de status indisponível:', error.message);
          return false;
        }

        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return false;

        const status = String(row.status || 'active').toLowerCase();
        if (!BLOCKING_STATUSES.includes(status)) return false;

        try { sessionStorage.setItem('devhub_signing_out', '1'); } catch (e) { /* ignora */ }
        try { localStorage.setItem('devhub_signing_out', '1'); } catch (e) { /* ignora */ }
        this._purgeLocalContext();

        let url = 'index.html?blocked=' + encodeURIComponent(status);

        if (status === 'suspended' && row.block_until) {
          url += '&until=' + encodeURIComponent(new Date(row.block_until).toLocaleString('pt-BR'));
        }
        if (status === 'vacation') {
          if (row.vacation_start) url += '&start=' + encodeURIComponent(new Date(row.vacation_start).toLocaleDateString('pt-BR'));
          if (row.vacation_end) url += '&end=' + encodeURIComponent(new Date(row.vacation_end).toLocaleDateString('pt-BR'));
        }

        await this._safeSignOut(supabase);
        window.location.href = url;
        return true;
      } catch (e) {
        console.warn('[DEV HUB] Erro no guard de status:', e);
        return false;
      }
    },

    async redirectIfAuthenticated() {
      const session = await this.getSession();
      if (session) {
        window.location.href = HOME_URL;
        return true;
      }
      return false;
    },

    getStoredUser() {
      try {
        const raw = localStorage.getItem('devhub_user') || sessionStorage.getItem('devhub_user');
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (error) {
        console.error('[DEV HUB] Erro ao ler usuário:', error);
        return null;
      }
    },

    async getProfile(userId) {
      const session = await this.getSession();
      if (!session?.user) {
        this._purgeLocalContext();
        return null;
      }

      const supabase = this.getClient();
      const uid = session.user.id;

      const stored = this.getStoredUser();
      if (stored && stored.user_id === uid && stored.organization_id && !userId) {
        return stored;
      }

      let profileRow = null;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('organization_id, role, name, email, avatar_url, is_platform_admin')
          .eq('id', uid)
          .maybeSingle();

        if (!error && data) profileRow = data;
        else if (error) console.warn('[DEV HUB] getProfile: falha em profiles.', error);
      } catch (e) {
        console.warn('[DEV HUB] getProfile: erro em profiles.', e);
      }

      if (!profileRow || !profileRow.organization_id) {
        try {
          const { data, error } = await supabase
            .from('organization_members')
            .select('organization_id, role, role_slug, name, email')
            .eq('user_id', uid)
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1);

          if (!error && data && data[0]) {
            profileRow = profileRow || {};
            profileRow.organization_id = profileRow.organization_id || data[0].organization_id;
            profileRow.role = profileRow.role || data[0].role;
            profileRow.role_slug = profileRow.role_slug || data[0].role_slug;
            profileRow.name = profileRow.name || data[0].name;
            profileRow.email = profileRow.email || data[0].email;
          }
        } catch (e) {
          console.warn('[DEV HUB] getProfile: erro em organization_members.', e);
        }
      }

      const orgId = profileRow?.organization_id;
      if (!orgId) {
        console.error('[DEV HUB] getProfile: usuário sem organização vinculada.');
        this._purgeLocalContext();
        return null;
      }

      let organizationName = '';
      try {
        const { data: orgRow, error: orgErr } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', orgId)
          .maybeSingle();

        if (!orgErr && orgRow) organizationName = orgRow.name || '';
      } catch (e) {
        console.warn('[DEV HUB] getProfile: falha ao ler organizations.', e);
      }

      const context = {
        user_id: uid,
        organization_id: orgId,
        organization_name: organizationName,
        role: String(profileRow?.role || 'user').toLowerCase(),
        role_slug: String(profileRow?.role_slug || '').toLowerCase(),
        name: profileRow?.name || session.user.user_metadata?.name || '',
        email: profileRow?.email || session.user.email || '',
        is_platform_admin: profileRow?.is_platform_admin === true,
        avatar_url: profileRow?.avatar_url || null
      };

      this._persistLocalContext(context);
      return context;
    },

    getCurrentRole() {
      const stored = this.getStoredUser();
      if (!stored) return '';
      return String(stored.role || '').toLowerCase();
    },

    getCurrentRoleSlug() {
      const stored = this.getStoredUser();
      if (!stored) return '';
      return String(stored.role_slug || '').toLowerCase();
    },

    hasRole(roles) {
      if (!Array.isArray(roles) || roles.length === 0) return false;
      const current = this.getCurrentRole();
      if (!current) return false;
      const normalized = roles.map(function (r) { return String(r || '').toLowerCase(); });
      return normalized.indexOf(current) !== -1;
    },

    async requireRole(roles) {
      const session = await this.requireSession();
      if (!session) return null;

      let context = this.getStoredUser();
      if (!context || !context.role) {
        context = await this.getProfile(session.user.id);
      }

      if (!context || !this.hasRole(roles)) {
        window.location.replace(HOME_URL);
        return null;
      }
      return context;
    },

    roleLabel(role) {
      const key = String(role || '').trim().toLowerCase();
      if (!key) return '';
      if (key === 'platform_admin') return 'Administrador da Plataforma';
      if (key === 'admin' || key === 'administrador') return 'Administrador';
      if (key === 'gestor' || key === 'manager') return 'Gestor';
      if (key === 'leader' || key === 'lider') return 'Líder';
      if (key === 'user' || key === 'usuario' || key === 'usuário') return 'Funcionário';
      return key.charAt(0).toUpperCase() + key.slice(1);
    },

    isPlatformAdmin() {
      const stored = this.getStoredUser();
      return Boolean(stored && stored.is_platform_admin === true);
    },

    async requirePlatformAdmin() {
      const session = await this.requireSession();
      if (!session) return null;
      const stored = this.getStoredUser();
      if (!stored || stored.is_platform_admin !== true) {
        window.location.replace(HOME_URL);
        return null;
      }
      return stored;
    },

    async signOut() {
      const supabase = this.getClient();
      try {
        try { sessionStorage.setItem('devhub_signing_out', '1'); } catch (e) { /* ignora */ }
        try { localStorage.setItem('devhub_signing_out', '1'); } catch (e) { /* ignora */ }
        this._purgeLocalContext();
        await this._safeSignOut(supabase);
      } finally {
        window.location.href = 'index.html';
      }
    }
  };

  /* =========================================================
     FORMULÁRIO DE LOGIN
     ========================================================= */
  document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('login-form');
    if (!form) return;

    const fieldsWrap       = document.getElementById('login-fields');
    const companyCodeInput = document.getElementById('company-code');
    const emailInput       = document.getElementById('email');
    const passwordInput    = document.getElementById('password');
    const pickerWrap       = document.getElementById('company-picker');
    const companySelect    = document.getElementById('company-select');
    const backBtn          = document.getElementById('back-to-login');
    const submitButton     = document.getElementById('login-submit');
    const feedback         = document.getElementById('login-feedback');
    const togglePassword   = document.getElementById('toggle-password');

    let pendingMemberships = null;

    function showFeedback(message, type) {
      if (!feedback) return;
      feedback.textContent = message;
      feedback.className = 'feedback feedback--' + (type || 'error');
      feedback.hidden = false;
    }

    function hideFeedback() {
      if (!feedback) return;
      feedback.textContent = '';
      feedback.hidden = true;
      feedback.className = 'feedback';
    }

    function setLoading(loading) {
      if (!submitButton) return;
      submitButton.disabled = loading;
      submitButton.classList.toggle('is-loading', loading);
      submitButton.setAttribute('aria-busy', String(loading));
      const buttonLabel = submitButton.querySelector('.btn__label');
      if (buttonLabel) {
        if (pendingMemberships) {
          buttonLabel.textContent = loading ? 'ENTRANDO...' : 'ENTRAR NESTA EMPRESA';
        } else {
          buttonLabel.textContent = loading ? 'ENTRANDO...' : 'ENTRAR';
        }
      }
    }

    function enterChoiceMode(memberships) {
      pendingMemberships = memberships;
      if (fieldsWrap) fieldsWrap.hidden = true;
      if (pickerWrap) pickerWrap.hidden = false;

      if (companySelect) {
        companySelect.innerHTML = '';
        memberships.forEach(function (m) {
          const opt = document.createElement('option');
          opt.value = m.organization_id;
          opt.textContent = (m.organization_name || 'Empresa') + (m.organization_code ? ' (' + m.organization_code + ')' : '');
          companySelect.appendChild(opt);
        });
      }

      if (backBtn) backBtn.hidden = false;
      const label = submitButton.querySelector('.btn__label');
      if (label) label.textContent = 'ENTRAR NESTA EMPRESA';
      if (companySelect && typeof companySelect.focus === 'function') companySelect.focus();
    }

    function exitChoiceMode() {
      pendingMemberships = null;
      if (fieldsWrap) fieldsWrap.hidden = false;
      if (pickerWrap) pickerWrap.hidden = true;
      if (backBtn) backBtn.hidden = true;
      const label = submitButton && submitButton.querySelector('.btn__label');
      if (label) label.textContent = 'ENTRAR';
      hideFeedback();
    }

    if (backBtn) {
      backBtn.addEventListener('click', async function () {
        const supabase = Auth.getClient();
        await Auth._safeSignOut(supabase);
        Auth._purgeLocalContext();
        exitChoiceMode();
        if (emailInput) emailInput.focus();
      });
    }

    if (companyCodeInput) {
      companyCodeInput.addEventListener('input', function () {
        companyCodeInput.value = companyCodeInput.value.toUpperCase().replace(/\s+/g, '');
      });
    }

    if (togglePassword && passwordInput) {
      togglePassword.addEventListener('click', function () {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        togglePassword.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
        togglePassword.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
      });
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      hideFeedback();

      if (pendingMemberships) {
        const orgId = companySelect ? companySelect.value : '';
        const membership = pendingMemberships.find(function (m) { return m.organization_id === orgId; });

        if (!membership) { showFeedback('Escolha uma empresa válida.'); return; }

        setLoading(true);
        try {
          await Auth.completeSignIn(membership);
          try { sessionStorage.removeItem('devhub_signing_out'); } catch (e) {}
          try { localStorage.removeItem('devhub_signing_out'); } catch (e) {}
          window.location.href = HOME_URL;
        } catch (error) {
          console.error('[DEV HUB] Falha ao entrar na empresa:', error);
          showFeedback(error?.message || 'Não foi possível entrar nesta empresa.');
        } finally {
          setLoading(false);
        }
        return;
      }

      const companyCode = (companyCodeInput?.value || '').trim().toUpperCase();
      const email = (emailInput?.value || '').trim().toLowerCase();
      const password = passwordInput?.value || '';

      if (companyCode && !/^[A-Z0-9-]{2,40}$/.test(companyCode)) {
        showFeedback('O código da empresa é inválido.');
        if (companyCodeInput) companyCodeInput.focus();
        return;
      }
      if (!email) { showFeedback('Informe seu e-mail.'); if (emailInput) emailInput.focus(); return; }
      if (!password) { showFeedback('Informe sua senha.'); if (passwordInput) passwordInput.focus(); return; }
      if (!Auth.isConfigured()) {
        showFeedback('Não foi possível conectar ao sistema. Tente novamente.');
        console.error('[DEV HUB] Supabase não configurado.');
        return;
      }

      setLoading(true);
      try {
        const result = await Auth.signIn(companyCode, email, password);
        if (result && result.needsCompanyChoice) {
          enterChoiceMode(result.memberships);
          hideFeedback();
          return;
        }
        try { sessionStorage.removeItem('devhub_signing_out'); } catch (e) {}
        try { localStorage.removeItem('devhub_signing_out'); } catch (e) {}
        window.location.href = HOME_URL;
      } catch (error) {
        console.error('[DEV HUB] Falha no login:', error);
        showFeedback(error?.message || 'Não foi possível realizar o login.');
      } finally {
        setLoading(false);
      }
    });

    try { sessionStorage.removeItem('devhub_signing_out'); } catch (e) {}
    try { localStorage.removeItem('devhub_signing_out'); } catch (e) {}

    (function showBlockedMessage() {
      const params = new URLSearchParams(window.location.search);
      const blocked = params.get('blocked');
      if (!blocked) return;

      const msgs = {
        banned:    'Sua conta está banida. Entre em contato com o administrador.',
        inactive:  'Sua conta está inativa. Entre em contato com o administrador.',
        suspended: 'Sua conta está suspensa' + (params.get('until') ? ' até ' + params.get('until') : '') + '.',
        vacation:  'Você está em férias' + (params.get('start') && params.get('end') ? ' (' + params.get('start') + ' a ' + params.get('end') + ')' : '') + '.'
      };

      const msg = msgs[blocked] || 'Seu acesso foi bloqueado.';
      const fb = document.getElementById('login-feedback');
      if (fb) {
        fb.textContent = msg;
        fb.className = 'feedback feedback--error';
        fb.hidden = false;
      }
      try {
        const clean = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', clean);
      } catch (e) {}
    })();

    Auth.redirectIfAuthenticated().catch(function (error) {
      console.error('[DEV HUB] Erro ao verificar sessão:', error);
    });
  });

  /* =========================================================
     GUARD GLOBAL DE AUTENTICAÇÃO (Blindado)
     ========================================================= */
  Auth.readyPromise = new Promise((resolve, reject) => {
    const file = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const publicFiles = ['index.html', 'login.html', ''];
    
    // Se for página pública, libera na hora
    if (publicFiles.includes(file)) {
      resolve(true);
      return;
    }

    document.documentElement.classList.add('auth-checking');

    // Tenta validar a sessão com timeout de 5 segundos
    const timeout = setTimeout(() => {
      console.warn('[Guard] Timeout na validação. Redirecionando...');
      window.location.replace('index.html');
    }, 5000);

    if (typeof Auth !== 'undefined' && typeof Auth.getSession === 'function') {
      Auth.getSession().then(function(session) {
        clearTimeout(timeout);
        if (!session) {
          if (Auth.isSigningOut && !Auth.isSigningOut()) {
            window.location.replace('index.html');
          }
        } else {
          document.documentElement.classList.remove('auth-checking');
          resolve(true); // Libera a execução das outras páginas
        }
      }).catch(function(err) {
        clearTimeout(timeout);
        console.warn('[Guard] Erro:', err);
        if (Auth.isSigningOut && !Auth.isSigningOut()) {
          window.location.replace('index.html');
        }
      });
    } else {
      clearTimeout(timeout);
      window.location.replace('index.html');
    }
  });

  // Helper para ser usado nos outros JS
  Auth.requireAuth = async function() {
    return Auth.readyPromise;
  };

  /* API GLOBAL */
  window.Auth = Auth;

})();