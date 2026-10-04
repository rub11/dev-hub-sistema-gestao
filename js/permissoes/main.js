/* =========================================================
   DEV HUB · Permissões · main
   Bind de eventos + bootstrap
   ---------------------------------------------------------
   Expandir/Recolher usa DOM direto (instantâneo, sem re-render).
   O estado é atualizado apenas para persistir ao trocar perfil.
   ========================================================= */
(function () {
  'use strict';

  const PRM = window.PRM;
  const { $, state, SCREENS, ACTIONS } = PRM;

  /* ============================================================
     EXPANDIR / RECOLHER — DOM direto
     ============================================================ */
  function setAllCollapsed(shouldCollapse) {
    /* Atualiza o DOM (instantâneo) */
    document.querySelectorAll('.prm-actions-group').forEach((el) => {
      el.classList.toggle('is-collapsed', shouldCollapse);
      const head = el.querySelector('.prm-actions-group__head');
      if (head) head.setAttribute('aria-expanded', String(!shouldCollapse));
    });

    /* Atualiza o estado (persiste ao trocar de perfil) */
    if (!state.ui.collapsed) state.ui.collapsed = {};
    ACTIONS.forEach((g) => { state.ui.collapsed[g.group] = shouldCollapse; });
  }

  function toggleGroup(sectionEl) {
    if (!sectionEl) return;
    sectionEl.classList.toggle('is-collapsed');
    const isNowCollapsed = sectionEl.classList.contains('is-collapsed');

    const head = sectionEl.querySelector('.prm-actions-group__head');
    if (head) head.setAttribute('aria-expanded', String(!isNowCollapsed));

    /* Atualiza o estado */
    const groupName = sectionEl.dataset.group;
    if (groupName) {
      if (!state.ui.collapsed) state.ui.collapsed = {};
      state.ui.collapsed[groupName] = isNowCollapsed;
    }
  }

  /* ============================================================
     BIND DOS BOTÕES DO HEADER
     ============================================================ */
  function bindHeaderButtons() {
    document.addEventListener('click', (e) => {
      /* Expandir tudo */
      if (e.target.closest('#btn-expand')) {
        e.preventDefault();
        setAllCollapsed(false);
        PRM.toast('Todas as seções expandidas.', 'info');
        return;
      }

      /* Recolher tudo */
      if (e.target.closest('#btn-collapse')) {
        e.preventDefault();
        setAllCollapsed(true);
        PRM.toast('Todas as seções recolhidas.', 'info');
        return;
      }
    });
  }

  /* ============================================================
     EVENTOS DO CONTEÚDO
     ============================================================ */
  function bindSearchAndToggles() {
    /* Buscas */
    $('#search-role').addEventListener('input', (e) => {
      state.ui.roleQuery = e.target.value.trim();
      PRM.renderRoleList();
    });

    $('#search-cap').addEventListener('input', (e) => {
      state.ui.capQuery = e.target.value.trim();
      PRM.renderMain();
    });

    /* Clique na sidebar de perfis */
    $('#role-list').addEventListener('click', (e) => {
      const menu = e.target.closest('[data-menu]');
      if (menu) {
        e.stopPropagation();
        PRM.handleRoleMenu(menu.dataset.menu, menu);
        return;
      }
      const btn = e.target.closest('[data-key]');
      if (!btn) return;
      state.selected = btn.dataset.key;
      PRM.render();
    });

    /* Clique no painel principal */
    $('#cap-list').addEventListener('click', (e) => {
      /* Botão "Ver usuários" */
      const openUsers = e.target.closest('[data-open-users]');
      if (openUsers) { PRM.openUsersDrawer(openUsers.dataset.openUsers); return; }

      /* Botão "Editar" (renomear perfil) */
      const editRole = e.target.closest('[data-edit-role]');
      if (editRole) {
        const key = editRole.dataset.editRole;
        const p = state.profiles.find((x) => x.key === key);
        if (p && PRM.openRoleModal) PRM.openRoleModal(p);
        return;
      }

      /* Bulk "Todas" / "Nenhuma" */
      const bulk = e.target.closest('[data-bulk]');
      if (bulk) {
        const p = state.profiles.find((x) => x.key === state.selected);
        if (!p || !p.editable) return;
        const d = state.draft[p.slug];
        if (bulk.dataset.bulk === 'all') SCREENS.forEach((s) => d.screens.add(s.id));
        else d.screens.clear();
        PRM.render();
        return;
      }

      /* Toggle de grupo (accordion) — DOM direto, sem re-render */
      const toggle = e.target.closest('[data-toggle]');
      if (toggle) {
        const section = toggle.closest('.prm-actions-group');
        toggleGroup(section);
        return;
      }
    });

    /* Toggle de telas/ações */
    $('#cap-list').addEventListener('change', (e) => {
      const p = state.profiles.find((x) => x.key === state.selected);
      if (!p || !p.editable) return;
      const d = state.draft[p.slug];

      if (e.target.matches('[data-screen]')) {
        if (e.target.checked) d.screens.add(e.target.dataset.screen);
        else d.screens.delete(e.target.dataset.screen);
        PRM.render();
      } else if (e.target.matches('[data-action]')) {
        if (e.target.checked) d.actions.add(e.target.dataset.action);
        else d.actions.delete(e.target.dataset.action);
        PRM.render();
      }
    });
  }

  /* ============================================================
     EVENTOS DO FOOTER
     ============================================================ */
  function bindFooterButtons() {
    /* Salvar */
    $('#btn-save').addEventListener('click', async () => {
      const p = state.profiles.find((x) => x.key === state.selected);
      if (!p || !p.editable || !state.orgId) return;

      const btn = $('#btn-save');
      btn.classList.add('is-loading');
      btn.disabled = true;

      try {
        await PRM.savePermissions(p);
        PRM.render();
        PRM.toast('Permissões salvas.', 'success');
      } catch (err) {
        console.error('[permissoes] salvar:', err);
        PRM.toast('Não foi possível salvar: ' + (err.message || err), 'error');
      } finally {
        btn.classList.remove('is-loading');
        btn.disabled = false;
      }
    });

    /* Descartar */
    $('#btn-discard').addEventListener('click', () => {
      const p = state.profiles.find((x) => x.key === state.selected);
      if (!p) return;
      state.draft[p.slug] = {
        screens: new Set(state.saved[p.slug].screens),
        actions: new Set(state.saved[p.slug].actions),
      };
      PRM.render();
    });

    /* Atualizar */
    $('#btn-refresh').addEventListener('click', async () => {
      const btn = $('#btn-refresh');
      btn.disabled = true;
      try {
        await PRM.loadAll();
        if (!state.profiles.some((p) => p.key === state.selected)) {
          state.selected = state.profiles[0].key;
        }
        PRM.render();
        PRM.toast('Dados atualizados.', 'success');
      } catch (err) {
        console.error(err);
        PRM.toast('Erro ao atualizar: ' + (err.message || err), 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ============================================================
     BOOTSTRAP
     ============================================================ */
  async function init() {
    if (document.body.dataset.page !== 'permissoes') return;

    const errBox = $('#page-error');

    if (!window.db || !window.Auth || !window.Auth.isConfigured()) {
      errBox.textContent = 'Não foi possível conectar ao Supabase.';
      errBox.hidden = false;
      return;
    }

    bindHeaderButtons();
    bindSearchAndToggles();
    bindFooterButtons();
    PRM.setupDrawerEvents();
    PRM.setupModalEvents();

    try {
      await window.Auth.requireSession();

      if (window.Perms && typeof window.Perms.load === 'function') {
        try {
          await Promise.race([
            window.Perms.load(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Perms.load timeout')), 3000))
          ]);
        } catch (e) {
          console.warn('[permissoes] Perms.load ignorado:', e.message);
        }
      }

      await PRM.loadAll();
      if (!state.profiles.length) return;

      state.selected = state.profiles[0].key;
      PRM.render();
    } catch (err) {
      console.error('[permissoes] init:', err);
      errBox.textContent = err.message || 'Erro ao carregar dados.';
      errBox.hidden = false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();