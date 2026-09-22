/* =========================================================
   DEV HUB · Usuários da Plataforma
   ---------------------------------------------------------
   Apenas platform_admin. Lista TODOS os usuários de TODAS
   as empresas. Permite editar, mover, ativar/desativar,
   resetar senha e excluir.
   ========================================================= */

(function () {
    'use strict';

    const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const state = {
        users: [],
        filtered: [],
        organizations: {},
        search: '',
        filterOrg: '',
        filterRole: '',
        currentUserId: null,
        currentOrganizationId: null,   // ← ADICIONE
        loading: false,
        editing: false,
        action: null,
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
        setupConfirmModal();
        setupEditModal();

        const session = await Auth.requireSession();
        if (!session) return;
        state.currentUserId = session.user.id;

        const ctx = Auth.getStoredUser && Auth.getStoredUser();
        state.currentOrganizationId = (ctx && ctx.organization_id) || null;

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
       Usuário topbar
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

        function open() {
            panel.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
        }
        function close() {
            panel.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
        }

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
       Busca e filtros
       ========================================================= */
    function setupSearch() {
        const input = document.getElementById('users-search');
        if (!input) return;
        input.addEventListener('input', function () {
            state.search = input.value.trim().toLowerCase();
            applyFilters();
        });
    }

    function setupFilters() {
        const orgSelect = document.getElementById('filter-org');
        const roleSelect = document.getElementById('filter-role');

        if (orgSelect) {
            orgSelect.addEventListener('change', function () {
                state.filterOrg = orgSelect.value;
                applyFilters();
            });
        }
        if (roleSelect) {
            roleSelect.addEventListener('change', function () {
                state.filterRole = roleSelect.value;
                applyFilters();
            });
        }
    }

    function applyFilters() {
        let list = state.users.slice();

        if (state.filterOrg) {
            list = list.filter(function (u) { return u.organization_id === state.filterOrg; });
        }
        if (state.filterRole) {
            list = list.filter(function (u) {
                return String(u.role || '').toLowerCase() === state.filterRole;
            });
        }
        if (state.search) {
            const term = state.search;
            list = list.filter(function (u) {
                return matches(u.name, term) || matches(u.email, term);
            });
        }

        state.filtered = list;
        renderUsers();
        updateCountLabel();
    }

    /* =========================================================
       Carregar
       ========================================================= */
    async function loadAll() {
        if (state.loading) return;
        state.loading = true;
        showLoading(true);

        try {
            const [membersRes, orgsRes] = await Promise.all([
                window.db
                    .from('organization_members')
                    .select('id, user_id, organization_id, role, active, name, email, created_at')
                    .order('created_at', { ascending: true }),

                window.db
                    .from('organizations')
                    .select('id, name, code')
                    .order('name', { ascending: true })
            ]);

            if (membersRes.error) throw membersRes.error;
            if (orgsRes.error) throw orgsRes.error;

            state.users = membersRes.data || [];
            state.organizations = {};

            (orgsRes.data || []).forEach(function (o) {
                state.organizations[o.id] = o;
            });

            populateOrgFilter(orgsRes.data || []);
            applyFilters();
            recomputeStats();
        } catch (error) {
            console.error('[DEV HUB] Falha ao carregar usuários:', error);
            state.users = [];
            state.filtered = [];
            showEmptyState(
                'Não foi possível carregar os usuários.',
                'Tente novamente em alguns instantes.'
            );
            updateCountLabel();
            showToast('Não foi possível carregar os usuários.', 'error');
        } finally {
            state.loading = false;
            showLoading(false);
        }
    }

    function populateOrgFilter(orgs) {
        const select = document.getElementById('filter-org');
        if (!select) return;
        while (select.options.length > 1) select.remove(1);

        orgs.forEach(function (o) {
            const opt = document.createElement('option');
            opt.value = o.id;
            opt.textContent = o.name + (o.code ? ' (' + o.code + ')' : '');
            select.appendChild(opt);
        });
    }

    /* =========================================================
       Render
       ========================================================= */
    function renderUsers() {
        const tbody = document.getElementById('users-body');
        const wrap = document.getElementById('users-table-wrap');
        if (!tbody || !wrap) return;

        if (state.users.length === 0) {
            wrap.hidden = true;
            showEmptyState(
                'Nenhum usuário cadastrado.',
                'Os usuários aparecem aqui quando são criados nas empresas.'
            );
            return;
        }
        if (state.filtered.length === 0) {
            wrap.hidden = true;
            showEmptyState(
                'Nenhum usuário encontrado.',
                'Ajuste a busca ou os filtros.'
            );
            return;
        }

        hideEmptyState();
        wrap.hidden = false;
        tbody.innerHTML = '';

        const fragment = document.createDocumentFragment();
        state.filtered.forEach(function (u) {
            fragment.appendChild(buildRow(u));
        });
        tbody.appendChild(fragment);
    }

    function buildRow(user) {
        const isSelf = user.user_id === state.currentUserId &&
            user.organization_id === state.currentOrganizationId;
        const roleKey = String(user.role || '').toLowerCase();
        const isActive = user.active !== false;
        const org = state.organizations[user.organization_id];

        const row = document.createElement('tr');
        row.dataset.id = user.id;

        // Nome
        const nameCell = document.createElement('td');
        nameCell.className = 'cell-org';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = user.name || '—';
        nameCell.appendChild(nameSpan);
        if (isSelf) {
            const small = document.createElement('small');
            small.textContent = 'Você';
            nameCell.appendChild(small);
        }
        row.appendChild(nameCell);

        // E-mail
        row.appendChild(createCell(user.email || '—', 'cell--muted'));

        // Empresa
        const orgCell = document.createElement('td');
        if (org) {
            const orgName = document.createElement('span');
            orgName.textContent = org.name;
            orgCell.appendChild(orgName);
            if (org.code) {
                const small = document.createElement('small');
                small.className = 'cell--muted';
                small.style.display = 'block';
                small.style.fontSize = '11px';
                small.textContent = org.code;
                orgCell.appendChild(small);
            }
        } else {
            orgCell.textContent = '—';
            orgCell.className = 'cell--muted';
        }
        row.appendChild(orgCell);

        // Perfil
        const roleCell = document.createElement('td');
        const roleTag = document.createElement('span');
        roleTag.className = 'role-tag' + roleModifier(roleKey);
        roleTag.textContent = roleLabel(roleKey);
        roleCell.appendChild(roleTag);
        row.appendChild(roleCell);

        // Status
        const statusCell = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'badge ' + (isActive ? 'badge--success' : 'badge--danger');
        badge.textContent = isActive ? 'Ativo' : 'Inativo';
        statusCell.appendChild(badge);
        row.appendChild(statusCell);

        // Data
        row.appendChild(createCell(formatDate(user.created_at), 'cell--muted'));

        // Ações
        row.appendChild(buildActionsCell(user, { isSelf: isSelf, isActive: isActive }));

        return row;
    }

    function roleModifier(key) {
        if (key === 'admin' || key === 'administrador') return ' role-tag--admin';
        if (key === 'gestor' || key === 'manager') return ' role-tag--leader';
        return '';
    }

    function roleLabel(key) {
        if (window.DHRoles) return window.DHRoles.label(key) || 'Funcionário';
        if (key === 'admin') return 'Administrador';
        if (key === 'gestor') return 'Gestor';
        return 'Funcionário';
    }

    function buildActionsCell(user, meta) {
        const cell = document.createElement('td');
        cell.className = 'cell--num';

        const wrap = document.createElement('div');
        wrap.className = 'row-actions';

        if (!meta.isSelf) {
            // Editar
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'row-action';
            editBtn.title = 'Editar';
            editBtn.setAttribute('aria-label', 'Editar ' + (user.name || ''));
            editBtn.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
                ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<path d="M12 20h9"/>' +
                '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
            editBtn.addEventListener('click', function () { openEditModal(user); });
            wrap.appendChild(editBtn);

            // Resetar senha
            const passBtn = document.createElement('button');
            passBtn.type = 'button';
            passBtn.className = 'row-action';
            passBtn.title = 'Enviar link de redefinição de senha';
            passBtn.setAttribute('aria-label', 'Resetar senha de ' + (user.name || ''));
            passBtn.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
                ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<rect x="3" y="11" width="18" height="10" rx="2"/>' +
                '<path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
            passBtn.addEventListener('click', function () { confirmResetPassword(user); });
            wrap.appendChild(passBtn);

            // Ativar/Desativar
            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'row-action';
            toggleBtn.title = meta.isActive ? 'Desativar' : 'Ativar';
            toggleBtn.setAttribute('aria-label',
                (meta.isActive ? 'Desativar ' : 'Ativar ') + (user.name || ''));
            toggleBtn.innerHTML = meta.isActive
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/><path d="M12 2v10"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
            toggleBtn.addEventListener('click', function () { confirmToggle(user); });
            wrap.appendChild(toggleBtn);

            // Excluir
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'row-action row-action--danger';
            delBtn.title = 'Excluir conta';
            delBtn.setAttribute('aria-label', 'Excluir conta de ' + (user.name || ''));
            delBtn.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"' +
                ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<path d="M3 6h18"/>' +
                '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
                '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
                '<path d="M10 11v6M14 11v6"/></svg>';
            delBtn.addEventListener('click', function () { confirmDelete(user); });
            wrap.appendChild(delBtn);
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

    /* =========================================================
       Stats / estados
       ========================================================= */
    function recomputeStats() {
        let active = 0, inactive = 0;
        state.users.forEach(function (u) {
            if (u.active === false) inactive += 1;
            else active += 1;
        });

        setText('stat-total', String(state.users.length));
        setText('stat-active', String(active));
        setText('stat-inactive', String(inactive));
        setText('stat-orgs', String(Object.keys(state.organizations).length));
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

    function showLoading(isLoading) {
        const loading = document.getElementById('users-loading');
        const wrap = document.getElementById('users-table-wrap');
        const empty = document.getElementById('users-empty');
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

    /* =========================================================
       Modal: confirmar ação
       ========================================================= */
    const confirmEls = {};

    function setupConfirmModal() {
        confirmEls.modal = document.getElementById('confirm-modal');
        confirmEls.text = document.getElementById('confirm-text');
        confirmEls.btn = document.getElementById('confirm-action-btn');
        if (!confirmEls.modal || !confirmEls.btn) return;

        confirmEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
            el.addEventListener('click', closeConfirmModal);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !confirmEls.modal.hidden) closeConfirmModal();
        });
        confirmEls.btn.addEventListener('click', onConfirmAction);
    }

    function confirmToggle(user) {
        state.action = { type: 'toggle', user: user };
        const isActive = user.active !== false;
        const name = user.name || 'este usuário';

        if (isActive) {
            confirmEls.text.textContent =
                'Desativar "' + name + '"? ' +
                'Ele não conseguirá fazer login até ser reativado.';
            setConfirmButton('Desativar', 'danger');
        } else {
            confirmEls.text.textContent = 'Ativar "' + name + '" novamente?';
            setConfirmButton('Ativar', 'primary');
        }

        confirmEls.modal.hidden = false;
        document.body.style.overflow = 'hidden';
        confirmEls.btn.focus();
    }

    function confirmResetPassword(user) {
        state.action = { type: 'reset', user: user };
        const name = user.name || 'este usuário';

        confirmEls.text.textContent =
            'Enviar link de redefinição de senha para "' + name + '"? ' +
            'O usuário receberá um e-mail para criar uma nova senha.';
        setConfirmButton('Enviar e-mail', 'primary');

        confirmEls.modal.hidden = false;
        document.body.style.overflow = 'hidden';
        confirmEls.btn.focus();
    }

    function confirmDelete(user) {
        state.action = { type: 'delete', user: user };
        const name = user.name || 'este usuário';

        confirmEls.text.textContent =
            'Excluir "' + name + '"? ' +
            'A conta de login, o perfil e o vínculo com a empresa serão removidos. ' +
            'Esta ação não pode ser desfeita.';
        setConfirmButton('Excluir conta', 'danger');

        confirmEls.modal.hidden = false;
        document.body.style.overflow = 'hidden';
        confirmEls.btn.focus();
    }

    function setConfirmButton(label, variant) {
        confirmEls.btn.className = 'btn btn--' + variant;
        const lbl = confirmEls.btn.querySelector('.btn__label');
        if (lbl) lbl.textContent = label;
    }

    function closeConfirmModal() {
        if (state.acting) return;
        confirmEls.modal.hidden = true;
        document.body.style.overflow = '';
        state.action = null;
    }

    async function onConfirmAction() {
        if (state.acting || !state.action) return;
        const { type, user } = state.action;
        setConfirmBusy(true);

        try {
            if (type === 'toggle') {
                const newActive = user.active === false;
                const { error } = await window.db
                    .from('organization_members')
                    .update({ active: newActive })
                    .eq('id', user.id);
                if (error) throw error;
                showToast(newActive ? 'Usuário ativado.' : 'Usuário desativado.', 'success');

            } else if (type === 'reset') {
                await callManageUser('reset_password', { user_id: user.user_id });
                showToast('E-mail de redefinição enviado.', 'success');

            } else if (type === 'delete') {
                await callManageUser('delete', { user_id: user.user_id });
                showToast('Usuário excluído com sucesso.', 'success');
            }

            confirmEls.modal.hidden = true;
            document.body.style.overflow = '';
            state.action = null;
            await loadAll();
        } catch (error) {
            console.error('[DEV HUB] Falha na operação:', error);
            showToast(mapActionError(error), 'error');
        } finally {
            setConfirmBusy(false);
        }
    }

    function setConfirmBusy(busy) {
        state.acting = busy;
        if (confirmEls.btn) {
            confirmEls.btn.disabled = busy;
            confirmEls.btn.classList.toggle('is-loading', busy);
            confirmEls.btn.setAttribute('aria-busy', String(busy));
        }
    }

    /* =========================================================
       Modal: editar usuário
       ========================================================= */
    const editEls = {};

    function setupEditModal() {
        editEls.modal = document.getElementById('edit-modal');
        editEls.form = document.getElementById('edit-form');
        editEls.userId = document.getElementById('edit-user-id');
        editEls.name = document.getElementById('edit-name');
        editEls.email = document.getElementById('edit-email');
        editEls.role = document.getElementById('edit-role');
        editEls.active = document.getElementById('edit-active');
        editEls.org = document.getElementById('edit-org');
        editEls.feedback = document.getElementById('edit-form-feedback');
        editEls.saveBtn = document.getElementById('edit-save-btn');

        if (!editEls.modal || !editEls.form) return;

        editEls.modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
            el.addEventListener('click', closeEditModal);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !editEls.modal.hidden) closeEditModal();
        });

        editEls.form.addEventListener('submit', onSubmitEdit);
    }

    function populateEditOrgSelect() {
        if (!editEls.org) return;
        while (editEls.org.options.length > 0) editEls.org.remove(0);

        Object.keys(state.organizations).forEach(function (id) {
            const o = state.organizations[id];
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = o.name + (o.code ? ' (' + o.code + ')' : '');
            editEls.org.appendChild(opt);
        });
    }

    function openEditModal(user) {
        populateEditOrgSelect();

        editEls.userId.value = user.user_id || '';
        editEls.name.value = user.name || '';
        editEls.email.value = user.email || '';
        editEls.role.value = String(user.role || 'user').toLowerCase();
        editEls.active.value = user.active === false ? 'false' : 'true';
        editEls.org.value = user.organization_id || '';

        clearEditFeedback();
        setEditBusy(false);

        editEls.modal.hidden = false;
        document.body.style.overflow = 'hidden';
        editEls.name.focus();
    }

    function closeEditModal() {
        if (state.editing) return;
        editEls.modal.hidden = true;
        document.body.style.overflow = '';
    }

    async function onSubmitEdit(event) {
        event.preventDefault();
        if (state.editing) return;

        clearEditFeedback();

        const targetId = editEls.userId.value;
        const name = editEls.name.value.trim();
        const email = editEls.email.value.trim().toLowerCase();
        const role = editEls.role.value;
        const active = editEls.active.value === 'true';
        const organizationId = editEls.org.value;

        if (!name) { showEditFeedback('Informe o nome.'); editEls.name.focus(); return; }
        if (!email) { showEditFeedback('Informe o e-mail.'); editEls.email.focus(); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showEditFeedback('E-mail inválido.'); editEls.email.focus(); return; }
        if (!organizationId) { showEditFeedback('Selecione uma empresa.'); editEls.org.focus(); return; }

        setEditBusy(true);

        try {


            const { error } = await window.db
                .from('organization_members')
                .update({
                    name: name,
                    email: email,
                    role: role,
                    active: active,
                    organization_id: organizationId
                })
                .eq('user_id', targetId);

            if (error) throw error;

            // Sincroniza o profiles (best-effort)
            await window.db
                .from('profiles')
                .update({ name: name, email: email, role: role })
                .eq('id', targetId);


            closeEditModal();
            showToast('Usuário atualizado com sucesso.', 'success');
            await loadAll();
        } catch (error) {
            console.error('[DEV HUB] Falha ao editar usuário:', error);
            showEditFeedback(mapManageError(error));
        } finally {
            setEditBusy(false);
        }
    }

    function setEditBusy(busy) {
        state.editing = busy;
        if (editEls.saveBtn) {
            editEls.saveBtn.disabled = busy;
            editEls.saveBtn.classList.toggle('is-loading', busy);
            editEls.saveBtn.setAttribute('aria-busy', String(busy));
            const label = editEls.saveBtn.querySelector('.btn__label');
            if (label) label.textContent = busy ? 'Salvando...' : 'Salvar alterações';
        }
        [editEls.name, editEls.email, editEls.role, editEls.active, editEls.org]
            .forEach(function (i) { if (i) i.disabled = busy; });
    }

    function showEditFeedback(message) {
        if (!editEls.feedback) return;
        editEls.feedback.textContent = message;
        editEls.feedback.hidden = false;
    }

    function clearEditFeedback() {
        if (!editEls.feedback) return;
        editEls.feedback.textContent = '';
        editEls.feedback.hidden = true;
    }

    /* =========================================================
       Edge Function helper
       ========================================================= */

    async function callManageUser(action, extra) {
        const client = window.db || window.devHubSupabase;
        if (!client) throw new Error('Supabase não está configurado.');

        const userId = extra && extra.user_id;
        if (!userId) throw new Error('Usuário alvo não informado.');

        // Mapeia a ação para a RPC correspondente
        const rpcMap = {
            delete: 'platform_delete_user',
            reset_password: 'platform_reset_password'
        };

        const rpcName = rpcMap[action];
        if (!rpcName) throw new Error('Ação não suportada via RPC.');

        const { error } = await client.rpc(rpcName, { p_user_id: userId });
        if (error) throw error;

        return { success: true, action: action };
    }

    function mapManageError(error) {
        if (!error) return 'Não foi possível concluir a operação.';
        const msg = String(error.message || '');
        const lower = msg.toLowerCase();

        if (lower.includes('already') || lower.includes('registered') || lower.includes('duplicate')) {
            return 'Este e-mail já está sendo utilizado por outro usuário.';
        }
        if (lower.includes('próprio') || lower.includes('self')) {
            return 'Você não pode executar esta ação sobre sua própria conta.';
        }
        if (lower.includes('platform_admin') || lower.includes('plataforma')) {
            return 'Apenas administradores da plataforma podem executar esta ação.';
        }
        if (lower.includes('row-level security') || lower.includes('permission denied')) {
            return 'Você não tem permissão para executar esta ação.';
        }
        if (lower.includes('failed to fetch') || lower.includes('network')) {
            return 'Não foi possível conectar ao servidor.';
        }
        return msg || 'Não foi possível concluir a operação.';
    }

    function mapActionError(error) {
        if (!error) return 'Não foi possível concluir a operação.';
        const lower = String(error.message || '').toLowerCase();
        if (lower.includes('próprio') || lower.includes('self')) {
            return 'Você não pode alterar seu próprio acesso.';
        }
        if (lower.includes('row-level security') || lower.includes('permission denied')) {
            return 'Você não tem permissão para executar esta ação.';
        }
        if (lower.includes('failed to fetch') || lower.includes('network')) {
            return 'Não foi possível conectar ao servidor.';
        }
        return String(error.message || 'Não foi possível concluir a operação.');
    }

    /* =========================================================
       Helpers
       ========================================================= */
    function createCell(text, className) {
        const cell = document.createElement('td');
        cell.textContent = text;
        if (className) cell.className = className;
        return cell;
    }

    function formatDate(value) {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        return dateFormatter.format(d);
    }

    function matches(value, term) {
        if (!value) return false;
        return String(value).toLowerCase().includes(term);
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
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