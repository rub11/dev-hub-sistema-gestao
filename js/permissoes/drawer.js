/* =========================================================
   DEV HUB · Permissões · drawer
   ---------------------------------------------------------
   Drawer lateral de usuários.
   Clicar em um usuário seleciona o PERFIL dele na sidebar.
   Publica em: window.PRM
   ========================================================= */
(function () {
  'use strict';

  const PRM = window.PRM;
  const { $, escapeHtml, state, ICONS } = PRM;

  const drawer = $('#users-drawer');

  /* ============================================================
     RENDER DA LISTA DE USUÁRIOS
     ============================================================ */
  function renderUsers() {
    const q = ($('#drawer-search').value || '').toLowerCase().trim();
    const slugFilter = $('#drawer-filter').value;

    const list = state.members.filter((m) => {
      const slug = String(m.role_slug || m.role || 'user').toLowerCase();
      if (slugFilter && slug !== slugFilter) return false;
      if (!q) return true;
      return (m.name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q);
    });

    const body = $('#drawer-body');
    if (!list.length) {
      body.innerHTML = '<div class="prm-empty"><p class="prm-empty__text">Nenhum usuário encontrado.</p></div>';
    } else {
      body.innerHTML = `<ul class="prm-drawer__list">
        ${list.map((m) => {
          const slug = String(m.role_slug || m.role || 'user').toLowerCase();
          const p = state.profiles.find((x) => x.slug === slug);
          const isCustom = p && p.kind === 'custom';
          const initial = String(m.name || '?').charAt(0).toUpperCase();
          const uid = m.user_id || m.id || '';
          const canEdit = !!uid;

          return `
            <li class="prm-user ${canEdit ? 'is-clickable' : ''}"
                ${canEdit ? `data-user-id="${escapeHtml(uid)}" role="button" tabindex="0"` : ''}>
              <div class="prm-user__avatar">${escapeHtml(initial)}</div>
              <div class="prm-user__body">
                <span class="prm-user__name">${escapeHtml(m.name || '—')}</span>
                <span class="prm-user__email">${escapeHtml(m.email || '—')}</span>
              </div>
              <span class="prm-user__role ${isCustom ? 'is-custom' : ''}">${escapeHtml(p ? p.label : slug)}</span>
              ${canEdit ? `<span class="prm-user__chevron" aria-hidden="true">${ICONS.chev}</span>` : ''}
            </li>
          `;
        }).join('')}
      </ul>`;
    }

    $('#drawer-count').textContent = list.length;
  }

  /* ============================================================
     ABRIR / FECHAR
     ============================================================ */
  function openUsersDrawer(slugFilter) {
    const sel = $('#drawer-filter');
    sel.innerHTML = '<option value="">Todos os perfis</option>' +
      state.profiles.map((p) => `<option value="${escapeHtml(p.slug)}">${escapeHtml(p.label)}</option>`).join('');
    sel.value = slugFilter || '';
    $('#drawer-search').value = '';

    renderUsers();
    drawer.hidden = false;
    void drawer.offsetWidth;
    drawer.classList.add('is-open');
    document.body.classList.add('prm-drawer-open');
  }

  function closeUsersDrawer() {
    drawer.classList.remove('is-open');
    document.body.classList.remove('prm-drawer-open');
    setTimeout(() => { drawer.hidden = true; }, 280);
  }

  /* ============================================================
     SELECIONA O PERFIL DE UM USUÁRIO NA SIDEBAR
     ============================================================ */
  function selectProfileOfUser(userId) {
    /* Acha o membro clicado */
    const member = state.members.find(
      (m) => String(m.user_id || m.id) === String(userId)
    );
    if (!member) return;

    /* Descobre o slug do perfil dele */
    const slug = String(member.role_slug || member.role || 'user').toLowerCase();

    /* Acha o profile correspondente */
    const profile = state.profiles.find((p) => p.slug === slug);
    if (!profile) {
      PRM.toast('Perfil "' + slug + '" não encontrado na lista.', 'error');
      return;
    }

    /* Seleciona o perfil */
    state.selected = profile.key;

    /* Fecha o drawer */
    closeUsersDrawer();

    /* Renderiza */
    PRM.render();

    /* Scroll + pulse visual */
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-key="${profile.key}"]`);
      if (el && el.scrollIntoView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (el) {
        el.style.transition = 'box-shadow 0.4s ease';
        el.style.boxShadow = '0 0 0 4px var(--accent-ring)';
        setTimeout(() => { el.style.boxShadow = ''; }, 900);
      }
    });

    /* Feedback */
    PRM.toast(
      `${member.name || 'Usuário'} pertence ao perfil "${profile.label}".`,
      'info'
    );
  }

  /* ============================================================
     BIND DE EVENTOS
     ============================================================ */
  PRM.setupDrawerEvents = function () {
    /* Botão "Ver usuários" no header */
    $('#btn-users').addEventListener('click', () => openUsersDrawer(null));

    /* Fechar drawer */
    drawer.addEventListener('click', (e) => {
      if (e.target.matches('[data-close]')) closeUsersDrawer();
    });

    /* Filtros */
    $('#drawer-search').addEventListener('input', renderUsers);
    $('#drawer-filter').addEventListener('change', renderUsers);

    /* Clique em um usuário → seleciona o perfil dele */
    $('#drawer-body').addEventListener('click', (e) => {
      const card = e.target.closest('[data-user-id]');
      if (!card) return;

      const userId = card.dataset.userId;
      if (!userId) return;

      selectProfileOfUser(userId);
    });

    /* Acessibilidade: Enter / Espaço */
    $('#drawer-body').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('[data-user-id]');
      if (!card) return;
      e.preventDefault();
      card.click();
    });

    /* Escape fecha */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeUsersDrawer();
    });
  };

  /* Exporta para uso externo */
  PRM.openUsersDrawer  = openUsersDrawer;
  PRM.closeUsersDrawer = closeUsersDrawer;
})();