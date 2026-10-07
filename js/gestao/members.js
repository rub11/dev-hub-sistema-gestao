/* =========================================================
   DEV HUB · Gestão · listagem de usuários
   ========================================================= */
(function () {
  'use strict';
  const Gestao = window.Gestao;
  const state = Gestao.state;
  const { setText, createCell, formatDate, showToast, roleLabel } = Gestao.utils;
  const { canEditMember, canManageMember, callerIsAdmin } = Gestao.session;

  async function load() {
    if (state.loading) return;
    state.loading = true;

    showLoading(true);

    try {
      const { data, error } = await window.db
        .from('organization_members')
        .select('id, user_id, organization_id, role, role_slug, active, name, email, created_at')
        .order('created_at', { ascending: true });

      if (error) throw error;

      let rows = data || [];
      if (state.currentUserEmail !== Gestao.HIDDEN_SELF_EMAIL) {
        rows = rows.filter(function (m) {
          return String(m.email || '').toLowerCase() !== Gestao.HIDDEN_SELF_EMAIL;
        });
      }

      state.members = rows;
      render();
      recomputeStats();
      updateCountLabel();
    } catch (error) {
      console.error('[DEV HUB] Falha ao carregar usuários:', error);
      state.members = [];
      showEmptyState('Não foi possível carregar os usuários.',
                     'Tente novamente em alguns instantes.');
      updateCountLabel();
      showToast('Não foi possível carregar os usuários.', 'error');
    } finally {
      state.loading = false;
      showLoading(false);
    }
  }

  function render() {
    const tbody = document.getElementById('users-body');
    const wrap  = document.getElementById('users-table-wrap');
    if (!tbody || !wrap) return;

    if (state.members.length === 0) {
      wrap.hidden = true;
      showEmptyState('Nenhum usuário cadastrado ainda.',
                     'Use o botão acima para adicionar o primeiro usuário.');
      return;
    }

    hideEmptyState();
    wrap.hidden = false;
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    state.members.forEach(function (m) {
      fragment.appendChild(buildRow(m));
    });
    tbody.appendChild(fragment);
  }

  function buildRow(member) {
    const isSelf = member.user_id === state.currentUserId;
    const baseRole = String(member.role || '').toLowerCase();
    const isActive = member.active !== false;

    const row = document.createElement('tr');
    row.dataset.id = member.id;

    const nameCell = document.createElement('td');
    nameCell.className = 'cell-user';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = member.name || '—';
    nameCell.appendChild(nameSpan);
    if (isSelf) {
      const small = document.createElement('small');
      small.textContent = 'Você';
      nameCell.appendChild(small);
    }
    row.appendChild(nameCell);

    row.appendChild(createCell(member.email || '—', 'cell--muted'));

    const roleCell = document.createElement('td');
    const roleTag = document.createElement('span');
    roleTag.className = 'role-tag' + roleModifier(baseRole);
    roleTag.textContent = displayRoleLabel(member);
    roleCell.appendChild(roleTag);
    row.appendChild(roleCell);

    const statusCell = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = 'badge ' + (isActive ? 'badge--success' : 'badge--danger');
    statusBadge.textContent = isActive ? 'Ativo' : 'Inativo';
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);

    row.appendChild(createCell(formatDate(member.created_at), 'cell--muted'));
    row.appendChild(buildActionsCell(member, { isSelf: isSelf, isActive: isActive }));

    return row;
  }

  function roleModifier(roleKey) {
    if (roleKey === 'admin' || roleKey === 'administrador') return ' role-tag--admin';
    if (roleKey === 'gestor' || roleKey === 'manager' ||
        roleKey === 'leader'  || roleKey === 'lider') {
      return ' role-tag--leader';
    }
    return '';
  }

  function displayRoleLabel(member) {
    const slug = String(member.role_slug || '').toLowerCase();
    if (slug) {
      const rt = state.roleTypes.find(function (r) {
        return String(r.slug || '').toLowerCase() === slug;
      });
      if (rt) return rt.label;
    }
    return roleLabel(String(member.role || '').toLowerCase());
  }

  function buildActionsCell(member, meta) {
    const cell = document.createElement('td');
    cell.className = 'cell--num';

    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    if (!meta.isSelf) {
      const canEdit = canEditMember(member);
      const canManage = canManageMember(member);

      if (canEdit) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'row-action';
        editBtn.title = 'Editar';
        editBtn.setAttribute('aria-label', 'Editar ' + (member.name || ''));
        editBtn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
          ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M12 20h9"/>' +
          '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
        editBtn.addEventListener('click', function () {
          Gestao.userModal.open(member);
        });
        wrap.appendChild(editBtn);
      }

      if (canManage) {
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'row-action';
        toggleBtn.title = meta.isActive ? 'Desativar' : 'Ativar';
        toggleBtn.setAttribute('aria-label',
          (meta.isActive ? 'Desativar ' : 'Ativar ') + (member.name || ''));
        toggleBtn.innerHTML = meta.isActive
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
            ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/>' +
            '<path d="M12 2v10"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
            ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M20 6 9 17l-5-5"/></svg>';
        toggleBtn.addEventListener('click', function () {
          Gestao.confirmModal.confirmAction('toggle', member);
        });
        wrap.appendChild(toggleBtn);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'row-action row-action--danger';
        delBtn.title = 'Excluir acesso';
        delBtn.setAttribute('aria-label', 'Excluir acesso de ' + (member.name || ''));
        delBtn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
          ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M3 6h18"/>' +
          '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
          '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
          '<path d="M10 11v6M14 11v6"/></svg>';
        delBtn.addEventListener('click', function () {
          Gestao.confirmModal.confirmAction('delete', member);
        });
        wrap.appendChild(delBtn);
      }
    }

    if (wrap.childNodes.length === 0) {
      const dash = document.createElement('span');
      dash.className = 'cell--muted';
      dash.textContent = '—';
      wrap.appendChild(dash);
    }

    cell.appendChild(wrap);
    return cell;
  }

  function recomputeStats() {
    let active = 0, inactive = 0;
    state.members.forEach(function (m) {
      if (m.active === false) inactive += 1;
      else active += 1;
    });
    setText('stat-total', String(state.members.length));
    setText('stat-active', String(active));
    setText('stat-inactive', String(inactive));
  }

  function updateCountLabel() {
    const label = document.getElementById('users-count');
    if (!label) return;
    const total = state.members.length;
    if (total === 0) { label.textContent = 'Nenhum usuário cadastrado'; return; }
    label.textContent = total === 1 ? '1 usuário' : total + ' usuários';
  }

  function showLoading(isLoading) {
    const loading = document.getElementById('users-loading');
    const wrap    = document.getElementById('users-table-wrap');
    const empty   = document.getElementById('users-empty');
    if (!loading) return;

    if (isLoading) {
      loading.hidden = false;
      if (wrap) wrap.hidden = true;
      if (empty) empty.hidden = true;
    } else {
      loading.hidden = true;
    }
  }

  function showEmptyState(title, text) {
    const empty = document.getElementById('users-empty');
    const titleEl = document.getElementById('users-empty-title');
    const textEl = document.getElementById('users-empty-text');
    if (!empty) return;
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    empty.hidden = false;
  }

  function hideEmptyState() {
    const empty = document.getElementById('users-empty');
    if (empty) empty.hidden = true;
  }

  function showGlobalAlert(message, type) {
    const el = document.getElementById('global-alert');
    if (!el) return;
    el.textContent = message;
    el.className = 'alert alert--' + (type || 'error');
    el.hidden = false;
  }

  Gestao.members = {
    load, render, recomputeStats, updateCountLabel,
    showGlobalAlert, roleLabel
  };
})();