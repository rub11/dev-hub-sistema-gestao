/* =========================================================
   DEV HUB · Usuários da plataforma
   ---------------------------------------------------------
   Listagem agrupada por usuário (1 linha por e-mail).
   Perfil mostra todos os vínculos (empresas).
   Ações são por vínculo (empresa).
   ---------------------------------------------------------
   CORREÇÕES APLICADAS:
   1. Escape fecha apenas o modal mais ao topo (evita fechar
      perfil + férias/bloqueio juntos).
   2. Modal de confirmação agora reage a Escape.
   3. refreshProfile preserva a aba ativa do usuário.
   4. Guards de null em vários pontos.
   ========================================================= */

(function () {
  'use strict';

  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const STATUS_INFO = {
    active:    { label: 'Ativo',      modifier: 'status-badge--active'    },
    vacation:  { label: 'Em férias',  modifier: 'status-badge--vacation'  },
    banned:    { label: 'Banido',     modifier: 'status-badge--banned'    },
    suspended: { label: 'Suspenso',   modifier: 'status-badge--suspended' },
    inactive:  { label: 'Inativo',    modifier: 'status-badge--inactive'  }
  };

  const state = {
    users: [],              // agrupados (1 por e-mail)
    filtered: [],
    organizationsList: [],
    organizations: {},
    search: '',
    filterRole: '',
    filterStatus: '',
    currentUserId: null,
    currentUserEmail: '',
    loading: false,
    currentProfile: null,   // usuário aberto no modal (com memberships)
    acting: false
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
    setupFilters();
    setupProfileModal();
    setupVacationModal();
    setupBlockModal();
    setupConfirmModal();

    const session = await Auth.requireSession();
    if (!session) return;
    state.currentUserId = session.user.id;
    state.currentUserEmail = String(session.user.email || '').toLowerCase();

    const profile = await Auth.getProfile(session.user.id);
    renderUser(session.user, profile);

    const allowed = await checkPlatformAdmin(session.user.id);
    if (!allowed) {
      window.location.replace('dashboard.html');
      return;
    }

    watchAuthChanges();
    await loadAll();
  }

  async function checkPlatformAdmin(userId) {
    try {
      const { data, error } = await window.db
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', userId)
        .limit(1);
      if (error) return false;
      return Boolean(data && data[0] && data[0].is_platform_admin === true);
    } catch (e) { return false; }
  }

  function watchAuthChanges() {
    window.db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT' && !window.Auth.isSigningOut()) {
        window.location.replace('index.html?expired=1');
      }
    });
  }

  /* =========================================================
     Helpers de modal (pilha)
     =========================================================
     Como os modais se empilham (perfil → férias/bloqueio),
     precisamos saber qual é o topo pra não fechar tudo com Esc.
     A ordem no DOM define quem fica em cima (mesmo z-index,
     último vence).
     ========================================================= */
  function isTopmostModal(modal) {
    if (!modal || modal.hidden) return false;
    const open = Array.from(document.querySelectorAll('.modal'))
      .filter(function (m) { return !m.hidden; });
    if (open.length === 0) return false;
    return open[open.length - 1] === modal;
  }

  /* =========================================================
     Carregar dados
     ========================================================= */
  async function loadAll() {
    if (state.loading) return;
    state.loading = true;
    showLoading(true);

    try {
      const [usersRes, orgsRes] = await Promise.all([
        window.db.from('v_users_grouped').select('*').order('name', { ascending: true }),
        window.db.from('organizations').select('id, name, code, cnpj, active').order('name')
      ]);

      if (usersRes.error) throw usersRes.error;
      if (orgsRes.error) throw orgsRes.error;

      state.users = usersRes.data || [];
      state.organizationsList = orgsRes.data || [];
      state.organizations = {};
      state.organizationsList.forEach(function (o) { state.organizations[o.id] = o; });

      applyFilter();
      recomputeStats();
    } catch (error) {
      console.error('[DEV HUB] Falha ao carregar:', error);
      state.users = [];
      state.filtered = [];
      showEmpty('Não foi possível carregar os usuários.', 'Tente novamente.');
      updateCountLabel();
      showToast('Não foi possível carregar os usuários.', 'error');
    } finally {
      state.loading = false;
      showLoading(false);
    }
  }

  /* =========================================================
     Filtros e busca
     ========================================================= */
  function setupSearch() {
    const input = document.getElementById('users-search');
    if (!input) return;
    input.addEventListener('input', function () {
      state.search = input.value.trim().toLowerCase();
      applyFilter();
    });
  }

  function setupFilters() {
    const roleSel = document.getElementById('filter-role');
    const statusSel = document.getElementById('filter-status');
    if (roleSel) roleSel.addEventListener('change', function () {
      state.filterRole = roleSel.value; applyFilter();
    });
    if (statusSel) statusSel.addEventListener('change', function () {
      state.filterStatus = statusSel.value; applyFilter();
    });
  }

  function applyFilter() {
    let list = state.users.slice();

    if (state.filterRole) {
      list = list.filter(function (u) {
        return String(u.primary_role || '').toLowerCase() === state.filterRole;
      });
    }
    if (state.filterStatus) {
      list = list.filter(function (u) {
        return String(u.status_effective || 'active') === state.filterStatus;
      });
    }
    if (state.search) {
      const t = state.search;
      list = list.filter(function (u) {
        return matches(u.name, t) || matches(u.email, t);
      });
    }

    state.filtered = list;
    renderUsers();
    updateCountLabel();
  }

  /* =========================================================
     Render listagem
     ========================================================= */
  function renderUsers() {
    const tbody = document.getElementById('users-body');
    const wrap = document.getElementById('users-table-wrap');
    if (!tbody || !wrap) return;

    if (state.filtered.length === 0) {
      wrap.hidden = true;
      showEmpty('Nenhum usuário encontrado.', 'Ajuste os filtros ou a busca.');
      return;
    }

    hideEmpty();
    wrap.hidden = false;
    tbody.innerHTML = '';

    const frag = document.createDocumentFragment();
    state.filtered.forEach(function (u) { frag.appendChild(buildRow(u)); });
    tbody.appendChild(frag);
  }

  function buildRow(user) {
    const isSelf = user.user_id === state.currentUserId;
    const statusInfo = STATUS_INFO[user.status_effective] || STATUS_INFO.active;
    const count = user.memberships_count || 0;

    const tr = document.createElement('tr');

    /* Usuário */
    const userCell = document.createElement('td');
    userCell.className = 'cell-user';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = user.name || '—';
    userCell.appendChild(nameSpan);
    if (isSelf) {
      const small = document.createElement('small');
      small.textContent = 'Você';
      userCell.appendChild(small);
    }
    tr.appendChild(userCell);

    /* E-mail */
    tr.appendChild(createCell(user.email || '—', 'cell--muted'));

    /* Empresas — badge com contagem */
    const countCell = document.createElement('td');
    countCell.className = 'cell--num';
    const badge = document.createElement('span');
    badge.className = 'cell-count';
    badge.textContent = count === 1 ? '1 empresa' : count + ' empresas';
    countCell.appendChild(badge);
    tr.appendChild(countCell);

    /* Função principal */
    const roleCell = document.createElement('td');
    const roleTag = document.createElement('span');
    roleTag.className = 'role-tag' + roleModifier(user.primary_role);
    roleTag.textContent = roleLabel(user.primary_role);
    roleCell.appendChild(roleTag);
    tr.appendChild(roleCell);

    /* Status geral */
    const statusCell = document.createElement('td');
    const sBadge = document.createElement('span');
    sBadge.className = 'status-badge ' + statusInfo.modifier;
    sBadge.textContent = statusInfo.label;
    statusCell.appendChild(sBadge);
    tr.appendChild(statusCell);

    /* Desde (cadastro mais antigo) */
    tr.appendChild(createCell(formatDate(user.created_at), 'cell--muted'));

    /* Ações */
    const actCell = document.createElement('td');
    actCell.className = 'cell--num';
    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'row-action';
    viewBtn.title = 'Ver perfil';
    viewBtn.setAttribute('aria-label', 'Ver perfil de ' + (user.name || ''));
    viewBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
    viewBtn.addEventListener('click', function () { openProfile(user); });
    wrap.appendChild(viewBtn);

    actCell.appendChild(wrap);
    tr.appendChild(actCell);

    return tr;
  }

  function roleModifier(roleKey) {
    const k = String(roleKey || '').toLowerCase();
    if (k === 'admin' || k === 'administrador') return ' role-tag--admin';
    if (k === 'gestor' || k === 'manager') return ' role-tag--leader';
    return '';
  }
  function roleLabel(roleKey) {
    if (window.DHRoles) return window.DHRoles.label(roleKey) || 'Funcionário';
    const k = String(roleKey || '').toLowerCase();
    if (k === 'admin') return 'Administrador';
    if (k === 'gestor') return 'Gestor';
    return 'Funcionário';
  }

  function recomputeStats() {
    let active = 0, blocked = 0, links = 0;
    state.users.forEach(function (u) {
      const s = u.status_effective || 'active';
      if (s === 'active') active += 1;
      if (s === 'banned' || s === 'suspended') blocked += 1;
      links += (u.memberships_count || 0);
    });
    setText('stat-total', String(state.users.length));
    setText('stat-active', String(active));
    setText('stat-blocked', String(blocked));
    setText('stat-links', String(links));
  }

  function updateCountLabel() {
    const label = document.getElementById('users-count');
    if (!label) return;
    const total = state.users.length;
    const shown = state.filtered.length;
    if (total === 0) { label.textContent = 'Nenhum usuário cadastrado'; return; }
    if (shown === total) {
      label.textContent = total === 1 ? '1 usuário' : total + ' usuários';
      return;
    }
    label.textContent = shown + ' de ' + total + ' usuários';
  }

  function showLoading(b) {
    const l = document.getElementById('users-loading');
    const w = document.getElementById('users-table-wrap');
    const e = document.getElementById('users-empty');
    if (!l) return;
    if (b) { l.hidden = false; if (w) w.hidden = true; if (e) e.hidden = true; }
    else l.hidden = true;
  }
  function showEmpty(t, x) {
    const empty = document.getElementById('users-empty');
    const title = document.getElementById('users-empty-title');
    const text = document.getElementById('users-empty-text');
    if (!empty) return;
    if (title) title.textContent = t;
    if (text) text.textContent = x;
    empty.hidden = false;
  }
  function hideEmpty() {
    const empty = document.getElementById('users-empty');
    if (empty) empty.hidden = true;
  }

  /* =========================================================
     Modal de perfil
     ========================================================= */
  function setupProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;

    modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeProfile);
    });

    /* CORREÇÃO #1: só fecha se for o modal do topo */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!isTopmostModal(modal)) return;
      closeProfile();
    });

    modal.querySelectorAll('.pf-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        const key = tab.dataset.tab;
        modal.querySelectorAll('.pf-tab').forEach(function (t) {
          t.classList.toggle('is-active', t === tab);
        });
        modal.querySelectorAll('.pf-panel').forEach(function (p) {
          p.classList.toggle('is-active', p.dataset.panel === key);
        });
      });
    });

    const moveBtn = document.getElementById('pf-move-btn');
    if (moveBtn) moveBtn.addEventListener('click', onMoveUser);
  }

  /* Lê a aba ativa atual — usado pelo refreshProfile */
  function getActiveProfileTab() {
    const modal = document.getElementById('profile-modal');
    if (!modal) return 'empresas';
    const active = modal.querySelector('.pf-tab.is-active');
    return (active && active.dataset.tab) || 'empresas';
  }

  /**
   * Abre (ou re-renderiza) o perfil.
   * @param {object} user
   * @param {string} [preserveTab] se passado, mantém essa aba ativa
   *   em vez de resetar pra "empresas".
   */
  function openProfile(user, preserveTab) {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;

    state.currentProfile = user;

    /* Header */
    setText('pf-name', user.name || '—');
    setText('pf-email', user.email || '—');
    const avatar = document.getElementById('pf-avatar');
    if (avatar) avatar.textContent = (user.name || '?').charAt(0).toUpperCase();

    const statusInfo = STATUS_INFO[user.status_effective] || STATUS_INFO.active;
    const statusBadge = document.getElementById('pf-status-badge');
    if (statusBadge) {
      statusBadge.className = 'status-badge ' + statusInfo.modifier;
      statusBadge.textContent = statusInfo.label;
    }

    /* Aba Empresas */
    setText('pf-empresas-nome', user.name || 'este usuário');
    renderEmpresas(user.memberships || []);
    populateMoveOrgSelect(user);

    /* Aba Info */
    setText('pf-info-name', user.name || '—');
    setText('pf-info-email', user.email || '—');
    setText('pf-info-userid', user.user_id || '—');
    setText('pf-info-role', roleLabel(user.primary_role));
    setText('pf-info-count', (user.memberships_count || 0) + ' empresa(s)');
    setText('pf-info-created', formatDate(user.created_at));
    setText('pf-info-lastlogin', user.last_login_at ? formatDateTime(user.last_login_at) : '—');

    /* CORREÇÃO #3: preserva a aba atual quando faz refresh */
    const tabToShow = preserveTab || 'empresas';
    modal.querySelectorAll('.pf-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.tab === tabToShow);
    });
    modal.querySelectorAll('.pf-panel').forEach(function (p) {
      p.classList.toggle('is-active', p.dataset.panel === tabToShow);
    });

    /* Reset form de mover */
    const reason = document.getElementById('pf-move-reason');
    if (reason) reason.value = '';

    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    loadOrgHistory(user);
    loadStatusHistory(user);
  }

  function closeProfile() {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    state.currentProfile = null;
  }

  /* =========================================================
     Lista de empresas dentro do perfil
     ========================================================= */
  function renderEmpresas(memberships) {
    const wrap = document.getElementById('pf-empresas-list');
    if (!wrap) return;
    wrap.innerHTML = '';

    if (!memberships || memberships.length === 0) {
      wrap.innerHTML = '<div class="state-block state-block--compact"><p>Nenhum vínculo ativo.</p></div>';
      return;
    }

    const frag = document.createDocumentFragment();
    memberships.forEach(function (m) {
      frag.appendChild(buildEmpresaCard(m));
    });
    wrap.appendChild(frag);
  }

  function buildEmpresaCard(m) {
    const card = document.createElement('div');
    card.className = 'pf-empresa';

    /* Ícone */
    const icon = document.createElement('span');
    icon.className = 'pf-empresa__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M15 21V9h4a2 2 0 0 1 2 2v10"/></svg>';
    card.appendChild(icon);

    /* Corpo */
    const body = document.createElement('div');
    body.className = 'pf-empresa__body';

    const name = document.createElement('div');
    name.className = 'pf-empresa__name';
    name.textContent = m.organization_name || '—';
    body.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'pf-empresa__meta';
    const parts = [];
    if (m.organization_code) parts.push(m.organization_code);
    parts.push(roleLabel(m.role));
    if (m.created_at) parts.push('desde ' + formatDate(m.created_at));
    if (m.last_login_at) parts.push('último acesso ' + formatDate(m.last_login_at));
    meta.textContent = parts.join(' · ');
    body.appendChild(meta);

    card.appendChild(body);

    /* Status — envolve em .pf-empresa__status pra casar com o CSS */
    const statusInfo = STATUS_INFO[m.status_effective] || STATUS_INFO.active;
    const statusWrap = document.createElement('span');
    statusWrap.className = 'pf-empresa__status';
    const sBadge = document.createElement('span');
    sBadge.className = 'status-badge ' + statusInfo.modifier;
    sBadge.textContent = statusInfo.label;
    statusWrap.appendChild(sBadge);
    card.appendChild(statusWrap);

    /* Ações */
    const actions = document.createElement('div');
    actions.className = 'pf-empresa__actions';

    /* Mudar função */
    const roleBtn = document.createElement('button');
    roleBtn.type = 'button';
    roleBtn.className = 'btn btn--ghost btn--micro';
    roleBtn.title = 'Alterar função';
    roleBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>' +
      '<span>Função</span>';
    roleBtn.addEventListener('click', function () { promptChangeRole(m); });
    actions.appendChild(roleBtn);

    /* Ativar / Suspender / Banir / Férias conforme status */
    const status = m.status_effective || 'active';

    if (status === 'active') {
      const vacBtn = document.createElement('button');
      vacBtn.type = 'button';
      vacBtn.className = 'btn btn--ghost btn--micro';
      vacBtn.title = 'Colocar em férias';
      vacBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
        ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M3 12h18M12 3v18"/></svg>' +
        '<span>Férias</span>';
      vacBtn.addEventListener('click', function () { openVacationModal(m); });
      actions.appendChild(vacBtn);

      const blockBtn = document.createElement('button');
      blockBtn.type = 'button';
      blockBtn.className = 'btn btn--danger btn--micro';
      blockBtn.title = 'Suspender / banir';
      blockBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
        ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></svg>' +
        '<span>Bloquear</span>';
      blockBtn.addEventListener('click', function () { openBlockModal(m, 'suspend'); });
      actions.appendChild(blockBtn);
    } else {
      const activateBtn = document.createElement('button');
      activateBtn.type = 'button';
      activateBtn.className = 'btn btn--primary btn--micro';
      activateBtn.title = 'Reativar';
      activateBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
        ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M20 6 9 17l-5-5"/></svg>' +
        '<span>Ativar</span>';
      activateBtn.addEventListener('click', function () { activateMembership(m); });
      actions.appendChild(activateBtn);
    }

    /* Remover vínculo */
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn--ghost btn--micro';
    removeBtn.title = 'Remover desta empresa';
    removeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
      '<path d="M10 11v6M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
      '<span>Remover</span>';
    removeBtn.addEventListener('click', function () { confirmRemoveMembership(m); });
    actions.appendChild(removeBtn);

    card.appendChild(actions);

    return card;
  }

  /* =========================================================
     Mover usuário (vincular a nova empresa)
     ========================================================= */
  function populateMoveOrgSelect(user) {
    const sel = document.getElementById('pf-move-target');
    if (!sel) return;

    const alreadyLinked = {};
    (user.memberships || []).forEach(function (m) { alreadyLinked[m.organization_id] = true; });

    while (sel.options.length > 0) sel.remove(0);
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'Selecione a empresa…';
    sel.appendChild(blank);

    state.organizationsList.forEach(function (o) {
      if (alreadyLinked[o.id]) return;
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.name + (o.code ? ' (' + o.code + ')' : '');
      sel.appendChild(opt);
    });
  }

  async function onMoveUser() {
    const user = state.currentProfile;
    if (!user) return;

    const targetSel = document.getElementById('pf-move-target');
    const roleSel = document.getElementById('pf-move-role');
    const reasonEl = document.getElementById('pf-move-reason');
    if (!targetSel || !roleSel) return;

    const target = targetSel.value;
    const role = roleSel.value;
    const reason = reasonEl ? (reasonEl.value.trim() || null) : null;

    if (!target) {
      showToast('Selecione a empresa de destino.', 'error');
      return;
    }
    const targetOrg = state.organizations[target];
    const targetName = targetOrg ? targetOrg.name : 'esta empresa';

    openConfirm({
      title: 'Vincular a nova empresa',
      text: 'Vincular "' + (user.name || 'usuário') + '" a "' + targetName + '" como ' + roleLabel(role) + '?',
      label: 'Vincular',
      variant: 'primary',
      onConfirm: async function () {
        try {
          const { error } = await window.db.rpc('platform_assign_user_org', {
            p_user_id: user.user_id,
            p_organization_id: target,
            p_role: role,
            p_reason: reason
          });
          if (error) throw error;
          showToast('Usuário vinculado.', 'success');
          await refreshProfile();
        } catch (e) {
          console.error(e);
          showToast(e.message || 'Não foi possível vincular.', 'error');
        }
      }
    });
  }

  /* =========================================================
     Alterar função do vínculo
     ========================================================= */
  function promptChangeRole(m) {
    const current = String(m.role || 'user').toLowerCase();
    const next = window.prompt(
      'Nova função para ' + (m.organization_name || 'a empresa') + ' (admin | gestor | user):',
      current
    );
    if (!next) return;
    const clean = String(next).trim().toLowerCase();
    if (['admin','gestor','user'].indexOf(clean) === -1) {
      showToast('Função inválida. Use admin, gestor ou user.', 'error');
      return;
    }
    changeMembershipRole(m, clean);
  }

  async function changeMembershipRole(m, role) {
    try {
      const { error } = await window.db
        .from('organization_members')
        .update({ role: role })
        .eq('id', m.member_id);
      if (error) throw error;
      showToast('Função atualizada.', 'success');
      await refreshProfile();
    } catch (e) {
      console.error(e);
      showToast(e.message || 'Erro ao atualizar.', 'error');
    }
  }

  /* =========================================================
     Ativar vínculo
     ========================================================= */
  function activateMembership(m) {
    openConfirm({
      title: 'Reativar vínculo',
      text: 'Reativar "' + (m.organization_name || 'esta empresa') + '"? O usuário voltará a ter acesso por esta empresa.',
      label: 'Reativar',
      variant: 'primary',
      onConfirm: async function () {
        try {
          const { error } = await window.db.rpc('platform_set_user_status', {
            p_member_id: m.member_id,
            p_status: 'active',
            p_block_until: null,
            p_reason: 'Reativado manualmente'
          });
          if (error) throw error;
          showToast('Vínculo reativado.', 'success');
          await refreshProfile();
        } catch (e) {
          showToast(e.message || 'Erro.', 'error');
        }
      }
    });
  }

  /* =========================================================
     Remover vínculo
     ========================================================= */
  function confirmRemoveMembership(m) {
    openConfirm({
      title: 'Remover vínculo',
      text: 'Remover "' + (m.organization_name || 'esta empresa') + '"? O usuário perderá acesso a esta empresa, mas continuará nas demais.',
      label: 'Remover',
      variant: 'danger',
      onConfirm: async function () {
        try {
          const { error } = await window.db.rpc('platform_remove_user_org', {
            p_member_id: m.member_id
          });
          if (error) throw error;
          showToast('Vínculo removido.', 'success');
          await refreshProfile();
        } catch (e) {
          showToast(e.message || 'Erro.', 'error');
        }
      }
    });
  }

  /* =========================================================
     Refresh do perfil atual
     ========================================================= */
  async function refreshProfile() {
    if (!state.currentProfile) return;
    const userId = state.currentProfile.user_id;

    /* CORREÇÃO #3: preserva a aba ativa */
    const activeTab = getActiveProfileTab();

    const { data } = await window.db
      .from('v_users_grouped')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!data) { closeProfile(); return; }

    /* Atualiza na lista */
    const idx = state.users.findIndex(function (u) { return u.user_id === userId; });
    if (idx >= 0) state.users[idx] = data;

    openProfile(data, activeTab);
    applyFilter();
    recomputeStats();
  }

  /* =========================================================
     Modal: Férias
     ========================================================= */
  let vacationContext = null;

  function setupVacationModal() {
    const modal = document.getElementById('vacation-modal');
    if (!modal) return;
    modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeVacationModal);
    });
    /* CORREÇÃO #1: só fecha se for o do topo */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!isTopmostModal(modal)) return;
      closeVacationModal();
    });
    const form = document.getElementById('vacation-form');
    if (form) form.addEventListener('submit', onVacationConfirm);
  }

  function openVacationModal(m) {
    vacationContext = m;
    const modal = document.getElementById('vacation-modal');
    if (!modal) return;

    setText('vacation-user-name', state.currentProfile ? state.currentProfile.name : '—');
    setText('vacation-org-name', m.organization_name || '—');

    const form = document.getElementById('vacation-form');
    if (form) form.reset();
    const fb = document.getElementById('vacation-feedback');
    if (fb) fb.hidden = true;

    const d = new Date();
    d.setDate(d.getDate() + 1);
    const startEl = document.getElementById('vacation-start');
    const endEl = document.getElementById('vacation-end');
    if (startEl) startEl.value = d.toISOString().slice(0,10);
    d.setDate(d.getDate() + 14);
    if (endEl) endEl.value = d.toISOString().slice(0,10);

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeVacationModal() {
    const modal = document.getElementById('vacation-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    vacationContext = null;
  }

  async function onVacationConfirm(e) {
    e.preventDefault();
    if (!vacationContext) return;
    const startEl = document.getElementById('vacation-start');
    const endEl = document.getElementById('vacation-end');
    const notesEl = document.getElementById('vacation-notes');
    const fb = document.getElementById('vacation-feedback');
    if (!startEl || !endEl) return;

    const start = startEl.value;
    const end = endEl.value;
    const notes = notesEl ? (notesEl.value.trim() || null) : null;

    if (!start || !end || end < start) {
      if (fb) { fb.textContent = 'Período inválido.'; fb.hidden = false; }
      return;
    }

    setVacationBusy(true);
    try {
      const { error } = await window.db.rpc('platform_set_user_vacation', {
        p_member_id: vacationContext.member_id,
        p_start: start,
        p_end: end,
        p_notes: notes
      });
      if (error) throw error;
      showToast('Férias registradas.', 'success');
      closeVacationModal();
      await refreshProfile();
    } catch (err) {
      if (fb) { fb.textContent = err.message || 'Erro.'; fb.hidden = false; }
    } finally {
      setVacationBusy(false);
    }
  }
  function setVacationBusy(b) {
    const btn = document.getElementById('vacation-confirm-btn');
    if (!btn) return;
    btn.disabled = b;
    btn.classList.toggle('is-loading', b);
    btn.setAttribute('aria-busy', String(b));
  }

  /* =========================================================
     Modal: Bloqueio
     ========================================================= */
  let blockContext = null;

  function setupBlockModal() {
    const modal = document.getElementById('block-modal');
    if (!modal) return;
    modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeBlockModal);
    });
    /* CORREÇÃO #1: só fecha se for o do topo */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!isTopmostModal(modal)) return;
      closeBlockModal();
    });
    const durSel = document.getElementById('block-duration');
    if (durSel) {
      durSel.addEventListener('change', function () {
        const custom = document.getElementById('block-custom-dates');
        if (custom) custom.hidden = durSel.value !== 'custom';
      });
    }
    const form = document.getElementById('block-form');
    if (form) form.addEventListener('submit', onBlockConfirm);
  }

  function openBlockModal(m, mode) {
    blockContext = { m: m, mode: mode };
    const modal = document.getElementById('block-modal');
    if (!modal) return;

    setText('block-user-name', state.currentProfile ? state.currentProfile.name : '—');
    setText('block-org-name', m.organization_name || '—');

    const form = document.getElementById('block-form');
    if (form) form.reset();
    const dur = document.getElementById('block-duration');
    if (dur) dur.value = '3d';
    const customDates = document.getElementById('block-custom-dates');
    if (customDates) customDates.hidden = true;
    const fb = document.getElementById('block-feedback');
    if (fb) fb.hidden = true;

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      const r = document.getElementById('block-reason');
      if (r) r.focus();
    }, 60);
  }
  function closeBlockModal() {
    const modal = document.getElementById('block-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    blockContext = null;
  }

  async function onBlockConfirm(e) {
    e.preventDefault();
    if (!blockContext) return;

    const durSel = document.getElementById('block-duration');
    const reasonEl = document.getElementById('block-reason');
    const fb = document.getElementById('block-feedback');
    if (!durSel || !reasonEl) return;

    const duration = durSel.value;
    const reason = reasonEl.value.trim();
    if (!reason) {
      if (fb) { fb.textContent = 'Informe o motivo.'; fb.hidden = false; }
      return;
    }

    let until = null;
    if (duration === 'custom') {
      const startEl = document.getElementById('block-start');
      const endEl = document.getElementById('block-end');
      const start = startEl ? startEl.value : '';
      const end = endEl ? endEl.value : '';
      if (!start || !end) {
        if (fb) { fb.textContent = 'Preencha início e fim.'; fb.hidden = false; }
        return;
      }
      until = new Date(end).toISOString();
    } else {
      const ms = {
        '1h': 3600e3, '6h': 6*3600e3, '12h': 12*3600e3,
        '1d': 86400e3, '3d': 3*86400e3, '7d': 7*86400e3,
        '15d': 15*86400e3, '30d': 30*86400e3
      }[duration] || 3*86400e3;
      until = new Date(Date.now() + ms).toISOString();
    }

    const newStatus = blockContext.mode === 'ban' ? 'banned' : 'suspended';

    setBlockBusy(true);
    try {
      const { error } = await window.db.rpc('platform_set_user_status', {
        p_member_id: blockContext.m.member_id,
        p_status: newStatus,
        p_block_until: until,
        p_reason: reason
      });
      if (error) throw error;
      showToast(newStatus === 'banned' ? 'Banido.' : 'Suspenso.', 'success');
      closeBlockModal();
      await refreshProfile();
    } catch (err) {
      if (fb) { fb.textContent = err.message || 'Erro.'; fb.hidden = false; }
    } finally {
      setBlockBusy(false);
    }
  }
  function setBlockBusy(b) {
    const btn = document.getElementById('block-confirm-btn');
    if (!btn) return;
    btn.disabled = b;
    btn.classList.toggle('is-loading', b);
    btn.setAttribute('aria-busy', String(b));
  }

  /* =========================================================
     Histórico (dentro do perfil)
     ========================================================= */
  async function loadOrgHistory(user) {
    const list = document.getElementById('pf-org-history-list');
    if (!list) return;
    list.innerHTML = '<li class="pf-org-history__empty">Carregando…</li>';

    try {
      const { data, error } = await window.db
        .from('user_organization_history')
        .select('*')
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        list.innerHTML = '<li class="pf-org-history__empty">Nenhuma movimentação registrada.</li>';
        return;
      }

      list.innerHTML = '';
      data.forEach(function (h) {
        const li = document.createElement('li');
        li.innerHTML =
          '<div><strong>' + escapeHtml(h.from_organization_name || '—') + '</strong>' +
          ' → <strong>' + escapeHtml(h.to_organization_name || '—') + '</strong></div>' +
          '<div class="cell--muted" style="font-size:12px;margin-top:2px">' +
            formatDateTime(h.created_at) +
            ' · por ' + escapeHtml(h.moved_by_name || '—') +
            (h.reason ? ' · ' + escapeHtml(h.reason) : '') +
          '</div>';
        list.appendChild(li);
      });
    } catch (e) {
      console.error(e);
      list.innerHTML = '<li class="pf-org-history__empty">Erro ao carregar.</li>';
    }
  }

  async function loadStatusHistory(user) {
    const list = document.getElementById('pf-status-history-list');
    if (!list) return;
    list.innerHTML = '<li class="pf-history__empty">Carregando…</li>';

    try {
      const memberIds = (user.memberships || []).map(function (m) { return m.member_id; });
      if (memberIds.length === 0) {
        list.innerHTML = '<li class="pf-history__empty">Nenhuma alteração registrada.</li>';
        return;
      }

      const { data, error } = await window.db
        .from('user_status_history')
        .select('*')
        .in('organization_member_id', memberIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        list.innerHTML = '<li class="pf-history__empty">Nenhuma alteração registrada.</li>';
        return;
      }

      list.innerHTML = '';
      data.forEach(function (h) {
        const fromInfo = STATUS_INFO[h.old_status];
        const toInfo = STATUS_INFO[h.new_status] || { label: h.new_status };
        const li = document.createElement('li');
        li.innerHTML =
          '<div class="pf-history__item-head">' +
            '<span class="pf-history__item-who">' +
              (fromInfo ? fromInfo.label : (h.old_status || '—')) +
              ' → ' + toInfo.label +
            '</span>' +
            '<span class="pf-history__item-when">' + formatDateTime(h.created_at) + '</span>' +
          '</div>' +
          '<div class="pf-history__item-body">' +
            'Por <strong>' + escapeHtml(h.actor_name || '—') + '</strong>' +
            (h.reason ? ' · ' + escapeHtml(h.reason) : '') +
            (h.block_until ? ' · até ' + formatDateTime(h.block_until) : '') +
            (h.vacation_start ? ' · ' + formatDate(h.vacation_start) + ' a ' + formatDate(h.vacation_end) : '') +
          '</div>';
        list.appendChild(li);
      });
    } catch (e) {
      console.error(e);
      list.innerHTML = '<li class="pf-history__empty">Erro ao carregar.</li>';
    }
  }

  /* =========================================================
     Confirm
     ========================================================= */
  let confirmCallback = null;

  function setupConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;
    modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', closeConfirm);
    });
    const btn = document.getElementById('confirm-action-btn');
    if (btn) btn.addEventListener('click', function () {
      const cb = confirmCallback;
      closeConfirm();
      if (cb) cb();
    });

    /* CORREÇÃO #2: Escape fecha o confirm se for o do topo */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!isTopmostModal(modal)) return;
      closeConfirm();
    });
  }

  function openConfirm(opts) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;
    setText('confirm-title', opts.title || 'Confirmar');
    setText('confirm-text', opts.text || '');
    const btn = document.getElementById('confirm-action-btn');
    if (btn) {
      btn.className = 'btn btn--' + (opts.variant || 'danger');
      const lbl = btn.querySelector('.btn__label');
      if (lbl) lbl.textContent = opts.label || 'Confirmar';
    }
    confirmCallback = opts.onConfirm || null;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeConfirm() {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    confirmCallback = null;
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
      overlay.hidden = false;
    }
    function close() {
      if (!document.body.classList.contains('sidebar-open')) return;
      document.body.classList.remove('sidebar-open');
      toggle.setAttribute('aria-expanded', 'false');
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
    trigger.addEventListener('click', function (e) { e.stopPropagation(); panel.hidden ? open() : close(); });
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
    document.querySelectorAll('[data-action="logout"]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (b.disabled) return;
        b.disabled = true;
        await window.Auth.signOut();
      });
    });
  }

  function renderUser(user, profile) {
    const meta = user.user_metadata || {};
    const name = (profile && profile.name) || meta.name || (user.email ? user.email.split('@')[0] : '') || 'Usuário';
    const first = String(name).trim().split(/\s+/)[0] || 'Usuário';
    setText('user-avatar', first.charAt(0).toUpperCase());
    setText('user-name', name);
    setText('user-role', 'Administrador da Plataforma');
    setText('greeting-name', 'Olá, ' + first);
    const badge = document.getElementById('greeting-role');
    if (badge) { badge.textContent = 'Administrador da Plataforma'; badge.hidden = false; }
  }

  /* =========================================================
     Util
     ========================================================= */
  function createCell(text, cls) {
    const c = document.createElement('td');
    c.textContent = text;
    if (cls) c.className = cls;
    return c;
  }
  function formatDate(v) {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '—' : dateFormatter.format(d);
  }
  function formatDateTime(v) {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '—' : dateTimeFormatter.format(d);
  }
  function matches(v, t) {
    if (!v) return false;
    return String(v).toLowerCase().includes(t);
  }
  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function showGlobalAlert(msg, type) {
    const el = document.getElementById('global-alert');
    if (!el) return;
    el.textContent = msg;
    el.className = 'alert alert--' + (type || 'error');
    el.hidden = false;
  }

  const TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>'
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
    close.setAttribute('aria-label', 'Fechar');
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    close.addEventListener('click', function () { dismissToast(toast); });
    toast.appendChild(icon); toast.appendChild(text); toast.appendChild(close);
    region.appendChild(toast);
    const t = setTimeout(function () { dismissToast(toast); }, 4200);
    toast.addEventListener('mouseenter', function () { clearTimeout(t); });
  }

  function dismissToast(toast) {
    if (!toast || toast.classList.contains('is-leaving')) return;
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    });
  }
})();