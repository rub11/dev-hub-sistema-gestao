/* =========================================================
   DEV HUB · Autenticação
   ---------------------------------------------------------
   Login: código da empresa (OPCIONAL) + e-mail + senha.
   Fluxo:
     1. signInWithPassword (email, senha)
     2. Resolve empresa:
          - com code → validate_company_login
          - sem code → list_my_memberships
             • 0 → erro
             • 1 → aplica
             • N → pede para escolher (completeSignIn)
     3. Aplica contexto (org, role, role_slug, is_platform_admin, avatar_url)
   Guard de autorização centralizado: requireRole().
   ========================================================= */

(function () {
  'use strict';

  const Auth = {

    /* =====================================================
       CONFIGURAÇÃO
       ===================================================== */
    isConfigured() {
      return (
        !!window.devHubSupabase &&
        typeof window.devHubSupabase.auth?.signInWithPassword === 'function'
      );
    },

    isSigningOut() {
      return sessionStorage.getItem('devhub_signing_out') === '1';
    },

    getClient() {
      return window.devHubSupabase || window.db || null;
    },

    /* =====================================================
       SESSÃO
       ===================================================== */
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

    /* =====================================================
       LOGIN
       Retornos:
         { ...contexto }                      → sucesso
         { needsCompanyChoice: true,
           user: <User>,
           memberships: [...] }               → precisa escolher
       ===================================================== */
    async signIn(companyCode, email, password) {
      const supabase = this.getClient();
      if (!supabase) throw new Error('Supabase não está configurado.');

      const code = String(companyCode || '').trim().toUpperCase();
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const normalizedPassword = String(password || '');

      if (!normalizedEmail) throw new Error('Informe seu e-mail.');
      if (!normalizedPassword) throw new Error('Informe sua senha.');

      /* ----- 1. Autenticação ----- */
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
        await supabase.auth.signOut();
        throw new Error('Não foi possível identificar o usuário.');
      }

      /* ----- 2. Com código: caminho direto ----- */
      if (code) {
        const { data: companyData, error: companyError } =
          await supabase.rpc('validate_company_login', { p_company_code: code });

        if (companyError) {
          console.error('[DEV HUB] Erro ao validar empresa:', companyError);
          await supabase.auth.signOut();
          throw new Error('Não foi possível validar a empresa.');
        }

        const membership = Array.isArray(companyData) ? companyData[0] : companyData;
        if (!membership) {
          await supabase.auth.signOut();
          throw new Error('O código da empresa não corresponde ao seu acesso.');
        }

        return this._applyMembership(supabase, user, membership);
      }

      /* ----- 3. Sem código: descobre empresas ----- */
      const { data: list, error: listError } =
        await supabase.rpc('list_my_memberships');

      if (listError) {
        console.error('[DEV HUB] Erro ao listar empresas:', listError);
        await supabase.auth.signOut();
        throw new Error('Não foi possível identificar suas empresas.');
      }

      const memberships = Array.isArray(list) ? list : (list ? [list] : []);

      if (memberships.length === 0) {
        await supabase.auth.signOut();
        throw new Error(
          'Sua conta não está vinculada a nenhuma empresa. Contate o administrador.'
        );
      }

      // 1 empresa → aplica direto
      if (memberships.length === 1) {
        return this._applyMembership(supabase, user, memberships[0]);
      }

      // 2+ empresas → devolve para o form pedir a escolha
      return {
        needsCompanyChoice: true,
        user: user,
        memberships: memberships
      };
    },

    /* =====================================================
       CONTINUAÇÃO: aplica a empresa escolhida
       ===================================================== */
    async completeSignIn(membership) {
      const supabase = this.getClient();
      const session = await this.getSession();
      if (!supabase || !session?.user) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      return this._applyMembership(supabase, session.user, membership);
    },

    /* =====================================================
       INTERNO: valida + grava contexto
       ===================================================== */
    async _applyMembership(supabase, user, membership) {
      if (!membership) throw new Error('Empresa inválida.');

      if (!membership.organization_active) {
        await supabase.auth.signOut();
        throw new Error('Esta empresa está desativada.');
      }
      if (!membership.user_active) {
        await supabase.auth.signOut();
        throw new Error(
          'Seu acesso está desativado. Entre em contato com o administrador da empresa.'
        );
      }
      if (membership.user_id && membership.user_id !== user.id) {
        console.error('[DEV HUB] Inconsistência de usuário na validação.');
        await supabase.auth.signOut();
        throw new Error('Não foi possível validar seu acesso.');
      }

      /* ----- Busca avatar_url + is_platform_admin ----- */
      let avatarUrl = null;
      let isPlatformAdmin = Boolean(membership.is_platform_admin);

      try {
        const { data: profileRow, error: profileErr } = await supabase
          .from('profiles')
          .select('avatar_url, is_platform_admin')
          .eq('id', user.id)
          .maybeSingle();

        if (!profileErr && profileRow) {
          avatarUrl = profileRow.avatar_url || null;
          if (!isPlatformAdmin) {
            isPlatformAdmin = profileRow.is_platform_admin === true;
          }
        }
      } catch (e) {
        console.warn('[DEV HUB] Não foi possível ler perfil no login:', e);
      }

      if (!isPlatformAdmin) {
        isPlatformAdmin = await this._fetchPlatformAdminFlag(supabase, user.id);
      }

      const sessionUser = {
        user_id: user.id,
        organization_id: membership.organization_id || null,
        organization_name: membership.organization_name || '',
        role: String(membership.user_role || 'user').toLowerCase(),
        role_slug: String(membership.user_role_slug || '').toLowerCase(),   // 👈 NOVO
        name:
          membership.user_name ||
          user.user_metadata?.name ||
          '',
        email:
          membership.user_email ||
          user.email ||
          '',
        is_platform_admin: isPlatformAdmin,
        avatar_url: avatarUrl
      };

      try {
        sessionStorage.setItem('devhub_user', JSON.stringify(sessionUser));
      } catch (e) {
        console.warn('[DEV HUB] Não foi possível salvar contexto local.', e);
      }

      return sessionUser;
    },

    /* =====================================================
       HELPERS INTERNOS
       ===================================================== */
    _mapAuthError(authError) {
      const status = authError?.status;
      const code = String(authError?.code || '').toLowerCase();
      const message = String(authError?.message || '').toLowerCase();

      if (
        message.includes('failed to fetch') ||
        message.includes('network') ||
        message.includes('load failed')
      ) {
        return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
      }

      if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
        return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.';
      }

      if (
        status === 429 ||
        code === 'over_request_rate_limit' ||
        message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('for security purposes')
      ) {
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

    /* =====================================================
       SESSÃO OBRIGATÓRIA
       ===================================================== */
    async requireSession() {
      const session = await this.getSession();
      if (!session) {
        if (!this.isSigningOut()) {
          window.location.href = 'index.html';
        }
        return null;
      }
      return session;
    },

    async redirectIfAuthenticated() {
      const session = await this.getSession();
      if (session) {
        window.location.href = 'dashboard.html';
        return true;
      }
      return false;
    },

    /* =====================================================
       CONTEXTO LOCAL
       ===================================================== */
    getStoredUser() {
      try {
        const raw = sessionStorage.getItem('devhub_user');
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (error) {
        console.error('[DEV HUB] Erro ao ler usuário:', error);
        return null;
      }
    },

    async getProfile(userId) {
      const stored = this.getStoredUser();
      if (stored && (!userId || stored.user_id === userId)) {
        return stored;
      }

      const session = await this.getSession();
      if (!session?.user) return null;

      const supabase = this.getClient();
      const uid = session.user.id;

      let membership = null;
      try {
        const { data, error } = await supabase
          .from('organization_members')
          .select('organization_id, role, role_slug, active, name, email')   // 👈 role_slug
          .eq('user_id', uid)
          .limit(1);

        if (!error && data && data[0]) membership = data[0];
        else if (error) {
          console.warn('[DEV HUB] getProfile: falha em organization_members.', error);
        }
      } catch (e) {
        console.warn('[DEV HUB] getProfile: erro em organization_members.', e);
      }

      const context = {
        user_id: uid,
        organization_id: membership?.organization_id || null,
        organization_name: '',
        role: String(membership?.role || 'user').toLowerCase(),
        role_slug: String(membership?.role_slug || '').toLowerCase(),   // 👈 NOVO
        name: membership?.name || session.user.user_metadata?.name || '',
        email: membership?.email || session.user.email || '',
        is_platform_admin: false,
        avatar_url: null
      };

      // Busca avatar + flag
      try {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('avatar_url, is_platform_admin')
          .eq('id', uid)
          .maybeSingle();

        if (profileRow) {
          context.avatar_url = profileRow.avatar_url || null;
          context.is_platform_admin = profileRow.is_platform_admin === true;
        }
      } catch (e) {
        console.warn('[DEV HUB] getProfile: falha ao ler profiles.', e);
        context.is_platform_admin = await this._fetchPlatformAdminFlag(supabase, uid);
      }

      try {
        sessionStorage.setItem('devhub_user', JSON.stringify(context));
      } catch (e) { /* storage indisponível — ignora */ }

      return context;
    },

    /* =====================================================
       ROLE
       ===================================================== */
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

      const normalized = roles.map(function (r) {
        return String(r || '').toLowerCase();
      });

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
        window.location.replace('dashboard.html');
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

    /* =====================================================
       GUARD: PLATFORM ADMIN
       ===================================================== */
    isPlatformAdmin() {
      const stored = this.getStoredUser();
      return Boolean(stored && stored.is_platform_admin === true);
    },

    async requirePlatformAdmin() {
      const session = await this.requireSession();
      if (!session) return null;

      const stored = this.getStoredUser();
      if (!stored || stored.is_platform_admin !== true) {
        window.location.replace('dashboard.html');
        return null;
      }

      return stored;
    },

    /* =====================================================
       LOGOUT
       ===================================================== */
    async signOut() {
      const supabase = this.getClient();

      try {
        sessionStorage.setItem('devhub_signing_out', '1');
        sessionStorage.removeItem('devhub_user');

        if (supabase) {
          const { error } = await supabase.auth.signOut();
          if (error) {
            console.error('[DEV HUB] Erro ao sair:', error);
          }
        }
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

    const fieldsWrap     = document.getElementById('login-fields');
    const companyCodeInput = document.getElementById('company-code');
    const emailInput     = document.getElementById('email');
    const passwordInput  = document.getElementById('password');
    const pickerWrap     = document.getElementById('company-picker');
    const companySelect  = document.getElementById('company-select');
    const backBtn        = document.getElementById('back-to-login');
    const submitButton   = document.getElementById('login-submit');
    const feedback       = document.getElementById('login-feedback');
    const togglePassword = document.getElementById('toggle-password');

    let pendingMemberships = null;

    /* ---------- Feedback ---------- */
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

    /* ---------- Loading ---------- */
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

    /* ---------- Modo "escolher empresa" ---------- */
    function enterChoiceMode(memberships) {
      pendingMemberships = memberships;

      if (fieldsWrap) fieldsWrap.hidden = true;
      if (pickerWrap) pickerWrap.hidden = false;

      if (companySelect) {
        companySelect.innerHTML = '';
        memberships.forEach(function (m) {
          const opt = document.createElement('option');
          opt.value = m.organization_id;
          opt.textContent =
            (m.organization_name || 'Empresa') +
            (m.organization_code ? ' (' + m.organization_code + ')' : '');
          companySelect.appendChild(opt);
        });
      }

      if (backBtn) backBtn.hidden = false;

      const label = submitButton.querySelector('.btn__label');
      if (label) label.textContent = 'ENTRAR NESTA EMPRESA';

      companySelect?.focus();
    }

    function exitChoiceMode() {
      pendingMemberships = null;

      if (fieldsWrap) fieldsWrap.hidden = false;
      if (pickerWrap) pickerWrap.hidden = true;
      if (backBtn) backBtn.hidden = true;

      const label = submitButton.querySelector('.btn__label');
      if (label) label.textContent = 'ENTRAR';

      hideFeedback();
    }

    /* ---------- Botão "voltar" ---------- */
    if (backBtn) {
      backBtn.addEventListener('click', async function () {
        const supabase = Auth.getClient();
        if (supabase) {
          try { await supabase.auth.signOut(); } catch (e) { /* ignora */ }
        }
        exitChoiceMode();
        emailInput?.focus();
      });
    }

    /* ---------- Máscara do código ---------- */
    if (companyCodeInput) {
      companyCodeInput.addEventListener('input', function () {
        companyCodeInput.value = companyCodeInput.value
          .toUpperCase()
          .replace(/\s+/g, '');
      });
    }

    /* ---------- Mostrar / ocultar senha ---------- */
    if (togglePassword && passwordInput) {
      togglePassword.addEventListener('click', function () {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        togglePassword.setAttribute(
          'aria-label',
          isPassword ? 'Ocultar senha' : 'Mostrar senha'
        );
        togglePassword.setAttribute(
          'aria-pressed',
          isPassword ? 'true' : 'false'
        );
      });
    }

    /* ---------- Submit ---------- */
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      hideFeedback();

      /* ============ MODO ESCOLHA ============ */
      if (pendingMemberships) {
        const orgId = companySelect?.value;
        const membership = pendingMemberships.find(function (m) {
          return m.organization_id === orgId;
        });

        if (!membership) {
          showFeedback('Escolha uma empresa válida.');
          return;
        }

        setLoading(true);
        try {
          await Auth.completeSignIn(membership);
          sessionStorage.removeItem('devhub_signing_out');
          window.location.href = 'dashboard.html';
        } catch (error) {
          console.error('[DEV HUB] Falha ao entrar na empresa:', error);
          showFeedback(error?.message || 'Não foi possível entrar nesta empresa.');
        } finally {
          setLoading(false);
        }
        return;
      }

      /* ============ MODO NORMAL ============ */
      const companyCode = (companyCodeInput?.value || '').trim().toUpperCase();
      const email = (emailInput?.value || '').trim().toLowerCase();
      const password = passwordInput?.value || '';

      if (companyCode && !/^[A-Z0-9-]{2,40}$/.test(companyCode)) {
        showFeedback('O código da empresa é inválido.');
        companyCodeInput?.focus();
        return;
      }
      if (!email) {
        showFeedback('Informe seu e-mail.');
        emailInput?.focus();
        return;
      }
      if (!password) {
        showFeedback('Informe sua senha.');
        passwordInput?.focus();
        return;
      }
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

        sessionStorage.removeItem('devhub_signing_out');
        window.location.href = 'dashboard.html';

      } catch (error) {
        console.error('[DEV HUB] Falha no login:', error);
        showFeedback(
          error?.message || 'Não foi possível realizar o login.'
        );
      } finally {
        setLoading(false);
      }
    });

    /* ---------- Limpa estado de logout ---------- */
    sessionStorage.removeItem('devhub_signing_out');

    /* ---------- Verifica sessão existente ---------- */
    Auth.redirectIfAuthenticated().catch(function (error) {
      console.error('[DEV HUB] Erro ao verificar sessão:', error);
    });
  });

  /* =========================================================
     API GLOBAL
     ========================================================= */
  window.Auth = Auth;

})();