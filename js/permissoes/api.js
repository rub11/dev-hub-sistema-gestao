/* =========================================================
   DEV HUB · Permissões · api
   Tudo que fala com o Supabase
   Publica em: window.PRM
   ========================================================= */
(function () {
  'use strict';

  const PRM = window.PRM;
  const { db, state, SCREENS, ALL_ACTIONS, ALL_CAPS, DEFAULTS } = PRM;

  /* ============================================================
     RESOLVER ORG
     ============================================================ */
  PRM.resolveOrgId = async function () {
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (raw) {
        const ctx = JSON.parse(raw);
        if (ctx && ctx.organization_id) return ctx.organization_id;
      }
    } catch (e) { /* ignore */ }

    try {
      const { data } = await db().rpc('get_user_organization_id');
      if (data) return data;
    } catch (e) { /* ignore */ }

    return null;
  };

  /* ============================================================
     CARREGAR TUDO
     ============================================================ */
  PRM.loadAll = async function () {
    state.orgId = await PRM.resolveOrgId();
    if (!state.orgId) throw new Error('Não foi possível identificar a organização.');

    /* 1. role_types */
    const { data: roleTypes } = await db()
      .from('role_types')
      .select('id, slug, label, base_role, active, created_at')
      .eq('organization_id', state.orgId)
      .eq('active', true)
      .order('created_at', { ascending: true });

    /* 2. membros ativos */
    const { data: members } = await db()
      .from('organization_members')
      .select('id, user_id, name, email, role, role_slug, active, created_at')
      .eq('organization_id', state.orgId)
      .eq('active', true)
      .order('name', { ascending: true });
    state.members = members || [];

    /* 3. contagem por slug */
    const counts = {};
    state.members.forEach((m) => {
      const key = String(m.role_slug || m.role || 'user').toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });

    /* 4. monta perfis */
    state.profiles = [
      { key: 'user',   kind: 'base', label: 'Funcionário',   slug: 'user',   baseRole: 'user',   editable: true },
      { key: 'gestor', kind: 'base', label: 'Gestor',        slug: 'gestor', baseRole: 'gestor', editable: true },
      { key: 'admin',  kind: 'base', label: 'Administrador', slug: 'admin',  baseRole: 'admin',  editable: false },
    ];

    (roleTypes || []).forEach((rt) => {
      const slug = String(rt.slug || '').toLowerCase();
      state.profiles.push({
        id: rt.id,
        key: 'custom:' + slug,
        kind: 'custom',
        label: rt.label || rt.slug,
        slug,
        baseRole: String(rt.base_role || 'user').toLowerCase(),
        editable: true,
      });
    });

    state.profiles.forEach((p) => { p.userCount = counts[p.slug] || 0; });

    /* 5. permissões de cada perfil */
    for (const p of state.profiles) {
      const { data: perms } = await db()
        .from('role_permissions')
        .select('capability, allowed')
        .eq('organization_id', state.orgId)
        .eq('role_slug', p.slug);

      const map = {};
      (perms || []).forEach((r) => { map[r.capability] = r.allowed === true; });
      state.overrides[p.slug] = map;

      const defs = DEFAULTS[p.baseRole] || DEFAULTS.user;

      const screens = new Set();
      SCREENS.forEach((sc) => {
        const on = Object.prototype.hasOwnProperty.call(map, sc.id)
          ? map[sc.id] === true
          : defs.indexOf(sc.id) !== -1;
        if (on) screens.add(sc.id);
      });

      const actions = new Set();
      ALL_ACTIONS.forEach((cap) => {
        const on = Object.prototype.hasOwnProperty.call(map, cap)
          ? map[cap] === true
          : defs.indexOf(cap) !== -1;
        if (on) actions.add(cap);
      });

      state.saved[p.slug] = { screens, actions };
      state.draft[p.slug] = { screens: new Set(screens), actions: new Set(actions) };
    }
  };

  /* ============================================================
     SALVAR PERMISSÕES DE UM PERFIL
     ============================================================ */
  PRM.savePermissions = async function (profile) {
    if (!profile || !profile.editable || !state.orgId) return;

    const d = state.draft[profile.slug];
    const overrides = state.overrides[profile.slug] || {};
    const defaults = DEFAULTS[profile.baseRole] || DEFAULTS.user;

    const toUpsert = [];
    const toDelete = [];

    ALL_CAPS.forEach((cap) => {
      const value = d.screens.has(cap) || d.actions.has(cap);
      const hasRow = Object.prototype.hasOwnProperty.call(overrides, cap);
      const dbVal  = hasRow ? overrides[cap] : null;
      const defVal = defaults.indexOf(cap) !== -1;

      if (hasRow && value === dbVal) return;
      if (!hasRow && value === defVal) return;

      if (hasRow && value === defVal) { toDelete.push(cap); return; }

      toUpsert.push({
        organization_id: state.orgId,
        role_slug: profile.slug,
        base_role: profile.baseRole,
        capability: cap,
        allowed: value,
        updated_at: new Date().toISOString(),
      });
    });

    if (toUpsert.length) {
      const { error } = await db().from('role_permissions')
        .upsert(toUpsert, { onConflict: 'organization_id,role_slug,capability' });
      if (error) throw error;
    }

    if (toDelete.length) {
      const { error } = await db().from('role_permissions')
        .delete()
        .eq('organization_id', state.orgId)
        .eq('role_slug', profile.slug)
        .in('capability', toDelete);
      if (error) throw error;
    }

    /* Atualiza estado local */
    state.saved[profile.slug] = {
      screens: new Set(d.screens),
      actions: new Set(d.actions),
    };
    state.overrides[profile.slug] = Object.assign({}, overrides);
    ALL_CAPS.forEach((cap) => {
      const v = d.screens.has(cap) || d.actions.has(cap);
      const defVal = defaults.indexOf(cap) !== -1;
      if (v === defVal) delete state.overrides[profile.slug][cap];
      else state.overrides[profile.slug][cap] = v;
    });
  };

  /* ============================================================
     ROLE TYPES · criar / editar / excluir
     ============================================================ */
  PRM.createRoleType = async function ({ label, slug, baseRole }) {
    const { error } = await db().from('role_types').insert({
      organization_id: state.orgId,
      slug,
      label,
      base_role: baseRole,
      active: true,
    });
    if (error) throw error;
  };

  PRM.updateRoleType = async function (id, { label, baseRole }) {
    const { error } = await db().from('role_types')
      .update({ label, base_role: baseRole })
      .eq('id', id)
      .eq('organization_id', state.orgId);
    if (error) throw error;
  };

  PRM.deleteRoleType = async function (profile) {
    if (!profile || !profile.id) return;

    /* 1. Migra membros para 'user' */
    await db().from('organization_members')
      .update({ role: 'user', role_slug: null })
      .eq('organization_id', state.orgId)
      .eq('role_slug', profile.slug);

    /* 2. Remove permissões */
    await db().from('role_permissions')
      .delete()
      .eq('organization_id', state.orgId)
      .eq('role_slug', profile.slug);

    /* 3. Remove o tipo */
    const { error } = await db().from('role_types')
      .delete()
      .eq('id', profile.id)
      .eq('organization_id', state.orgId);
    if (error) throw error;
  };
})();