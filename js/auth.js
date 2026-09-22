/* =========================================================
   DEV HUB · Autenticação
   ---------------------------------------------------------
   Login: código da empresa + e-mail + senha
   Fluxo:
     1. signInWithPassword (email, senha)
     2. validate_company_login (código da empresa)
     3. Verifica organization_active, user_active, user_id
     4. Salva contexto em sessionStorage.devhub_user
     5. Inclui is_platform_admin quando aplicável
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

    /* =====================================================
       CLIENTE SUPABASE
       ===================================================== */

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
       ===================================================== */

    async signIn(companyCode, email, password) {
      const supabase = this.getClient();
      if (!supabase) throw new Error('Supabase não está configurado.');

      const code = String(companyCode || '').trim().toUpperCase();
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const normalizedPassword = String(password || '');

      if (!code) throw new Error('Informe o código da empresa.');
      if (!normalizedEmail) throw new Error('Informe seu e-mail.');
      if (!normalizedPassword) throw new Error('Informe sua senha.');

      /* ----- 1. Autenticação do usuário ----- */
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: normalizedPassword
        });

      if (authError) {
        console.error('[DEV HUB] Erro no login:', authError);
        throw new Error('E-mail ou senha incorretos.');
      }

      const user = authData?.user;
      if (!user) {
        await supabase.auth.signOut();
        throw new Error('Não foi possível identificar o usuário.');
      }

      /* ----- 2. Valida empresa + vínculo ----- */
      const { data: companyData, error: companyError } =
        await supabase.rpc('validate_company_login', { p_company_code: code });

      if (companyError) {
        console.error('[DEV HUB] Erro ao validar empresa:', companyError);
        await supabase.auth.signOut();
        throw new Error('Não foi possível validar a empresa.');
      }

      const membership = Array.isArray(companyData)
        ? companyData[0]
        : companyData;

      if (!membership) {
        await supabase.auth.signOut();
        throw new Error('O código da empresa não corresponde ao seu acesso.');
      }

      /* ----- 3. Empresa ativa? ----- */
      if (!membership.organization_active) {
        await supabase.auth.signOut();
        throw new Error('Esta empresa está desativada.');
      }

      /* ----- 4. Usuário ativo? ----- */
      if (!membership.user_active) {
        await supabase.auth.signOut();
        throw new Error(
          'Seu acesso está desativado. Entre em contato com o administrador da empresa.'
        );
      }

      /* ----- 5. Consistência de identidade ----- */
      if (membership.user_id !== user.id) {
        console.error('[DEV HUB] Inconsistência de usuário na validação.');
        await supabase.auth.signOut();
        throw new Error('Não foi possível validar seu acesso.');
      }

      /* ----- 6. Flag de platform_admin (best effort) ----- */
      let isPlatformAdmin = Boolean(membership.is_platform_admin);
      if (!isPlatformAdmin) {
        isPlatformAdmin = await this._fetchPlatformAdminFlag(supabase, user.id);
      }

      /* ----- 7. Salva contexto da sessão ----- */
      const sessionUser = {
        user_id: user.id,
        organization_id: membership.organization_id || null,
        organization_name: membership.organization_name || '',
        role: String(membership.user_role || 'user').toLowerCase(),
        name:
          membership.user_name ||
          user.user_metadata?.name ||
          '',
        email:
          membership.user_email ||
          user.email ||
          '',
        is_platform_admin: isPlatformAdmin
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
       REQUIRE SESSION
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

    /* =====================================================
       REDIRECT SE JÁ ESTIVER LOGADO
       ===================================================== */

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

    /**
     * Retorna o contexto do usuário atual.
     * Ordem:
     *   1. sessionStorage (rápido)
     *   2. reconstrói via organization_members + profiles
     *      (útil quando a sessão persiste em localStorage mas
     *       o sessionStorage está vazio — ex.: nova aba)
     *   3. fallback mínimo (user_id + email)
     *
     * Aceita um `userId` opcional por compatibilidade com os
     * módulos (eles passam `session.user.id`), mas não é obrigatório.
     */
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
          .select('organization_id, role, active, name, email')
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
        name: membership?.name || session.user.user_metadata?.name || '',
        email: membership?.email || session.user.email || '',
        is_platform_admin: false
      };

      context.is_platform_admin = await this._fetchPlatformAdminFlag(supabase, uid);

      try {
        sessionStorage.setItem('devhub_user', JSON.stringify(context));
      } catch (e) {
        /* storage indisponível — ignora */
      }

      return context;
    },

    /* =====================================================
       ROLE
       ===================================================== */

    /**
     * Lê o role atual direto do contexto local (rápido, sem Promise).
     * Retorna string vazia se não houver contexto.
     */
    getCurrentRole() {
      const stored = this.getStoredUser();
      if (!stored) return '';
      return String(stored.role || '').toLowerCase();
    },

    /**
     * Verifica se o role atual está entre os roles passados.
     * hasRole(['admin'])          → true se for admin
     * hasRole(['admin', 'gestor']) → true se for admin OU gestor
     */
    hasRole(roles) {
      if (!Array.isArray(roles) || roles.length === 0) return false;

      const current = this.getCurrentRole();
      if (!current) return false;

      const normalized = roles.map(function (r) {
        return String(r || '').toLowerCase();
      });

      return normalized.indexOf(current) !== -1;
    },

    /**
     * Guard centralizado de autorização de página.
     *
     * Uso típico no início do init() de cada módulo:
     *
     *   const context = await Auth.requireRole(['admin', 'gestor']);
     *   if (!context) return; // foi redirecionado
     *
     * Comportamento:
     *   - Sem sessão → redireciona para index.html
     *   - Com sessão mas sem o role exigido → redireciona para dashboard.html
     *   - Com permissão → retorna o contexto do usuário
     *
     * @param {string[]} roles Lista de roles permitidos
     * @returns {Promise<object|null>} Contexto do usuário ou null se redirecionou
     */
    async requireRole(roles) {
      const session = await this.requireSession();
      if (!session) return null;

      // Reconstrói contexto se o sessionStorage estiver vazio (ex.: nova aba)
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
       Diferente de requireRole: o platform_admin é um FLAG
       (is_platform_admin), não um role.
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

    const companyCodeInput = document.getElementById('company-code');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitButton = document.getElementById('login-submit');
    const feedback = document.getElementById('login-feedback');
    const togglePassword = document.getElementById('toggle-password');

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
        buttonLabel.textContent = loading ? 'ENTRANDO...' : 'ENTRAR';
      }
    }

    /* ---------- Máscara do código da empresa ---------- */
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

      const companyCode = (companyCodeInput?.value || '').trim().toUpperCase();
      const email = (emailInput?.value || '').trim().toLowerCase();
      const password = passwordInput?.value || '';

      if (!companyCode) {
        showFeedback('Informe o código da empresa.');
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
        await Auth.signIn(companyCode, email, password);

        // Limpa flag de logout e redireciona
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