/* =========================================================
   DEV HUB · Permissões · render
   Renderização da sidebar de perfis + painel de capabilities
   ---------------------------------------------------------
   IMPORTANTE: o body das ações é SEMPRE renderizado no DOM.
   A visibilidade é controlada por CSS via classe .is-collapsed.
   Isso permite toggle instantâneo sem re-render.
   ========================================================= */
(function () {
  'use strict';

  const PRM = window.PRM;
  const { $, escapeHtml, state, SCREENS, ACTIONS, ALL_ACTIONS, ICONS } = PRM;

  /* ============================================================
     HELPERS
     ============================================================ */
  function isChanged(slug) {
    const d = state.draft[slug], s = state.saved[slug];
    if (!d || !s) return false;
    const eq = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
    return !eq(d.screens, s.screens) || !eq(d.actions, s.actions);
  }
  PRM.isChanged = isChanged;

  /* ============================================================
     SIDEBAR DE PERFIS
     ============================================================ */
  PRM.renderRoleList = function () {
    const root = $('#role-list');
    const q = state.ui.roleQuery.toLowerCase();
    const match = (p) => !q || p.label.toLowerCase().includes(q) || p.slug.includes(q);

    const base   = state.profiles.filter((p) => p.kind === 'base'   && match(p));
    const custom = state.profiles.filter((p) => p.kind === 'custom' && match(p));

    if (base.length === 0 && custom.length === 0) {
      root.innerHTML = `<div class="prm-sidebar__empty">Nenhum perfil encontrado.</div>`;
      return;
    }

    const item = (p) => {
      const d = state.draft[p.slug];
      const active = p.key === state.selected;
      const changed = isChanged(p.slug);
      const count = d ? d.screens.size : 0;
      const isCustom = p.kind === 'custom';

      return `
        <button type="button"
                class="prm-role ${active ? 'is-active' : ''} ${isCustom ? 'is-custom' : ''}"
                data-key="${escapeHtml(p.key)}">
          ${changed ? '<span class="prm-role__dot" title="Alterações não salvas"></span>' : ''}
          <span class="prm-role__main">
            <span class="prm-role__title">
              <span class="prm-role__label">${escapeHtml(p.label)}</span>
              ${isCustom ? '<span class="prm-role__badge">Custom</span>' : ''}
              ${!p.editable ? `<span class="prm-role__lock">${ICONS.lock}</span>` : ''}
            </span>
            <span class="prm-role__meta ${count === 0 ? 'is-empty' : ''}">
              ${count} tela${count !== 1 ? 's' : ''} · ${p.userCount || 0} usuário${p.userCount !== 1 ? 's' : ''}
            </span>
          </span>
          ${isCustom ? `<span class="prm-role__menu" data-menu="${escapeHtml(p.key)}" aria-label="Ações do perfil">${ICONS.more}</span>` : ''}
        </button>
      `;
    };

    let html = '';
    if (base.length)   html += `<div class="prm-group"><div class="prm-group__title">Sistema</div>${base.map(item).join('')}</div>`;
    if (custom.length) html += `<div class="prm-group"><div class="prm-group__title">Personalizados</div>${custom.map(item).join('')}</div>`;

    root.innerHTML = html;
  };

  /* ============================================================
     PAINEL PRINCIPAL
     ============================================================ */
  PRM.renderMain = function () {
    const body = $('#cap-list');
    const p = state.profiles.find((x) => x.key === state.selected);
    if (!p) { body.innerHTML = ''; return; }

    const d = state.draft[p.slug];
    const s = state.saved[p.slug];
    const q = state.ui.capQuery.toLowerCase();

    const changedTotal =
      [...d.screens].filter((x) => !s.screens.has(x)).length +
      [...s.screens].filter((x) => !d.screens.has(x)).length +
      [...d.actions].filter((x) => !s.actions.has(x)).length +
      [...s.actions].filter((x) => !d.actions.has(x)).length;

    /* --- Telas --- */
    const visibleScreens = SCREENS.filter((sc) =>
      !q || sc.label.toLowerCase().includes(q) || sc.id.toLowerCase().includes(q)
    );

    const screensHTML = visibleScreens.length
      ? visibleScreens.map((sc) => {
          const on = d.screens.has(sc.id);
          const changed = on !== s.screens.has(sc.id);
          return `
            <label class="prm-screen ${on ? 'is-on' : 'is-off'} ${changed ? 'is-changed' : ''}">
              <div class="prm-screen__top">
                <span class="prm-screen__icon">${ICONS[sc.icon] || ICONS.grid}</span>
                ${changed
                  ? '<span class="prm-screen__badge prm-screen__badge--custom">Alterado</span>'
                  : '<span class="prm-screen__badge prm-screen__badge--default">Padrão</span>'}
              </div>
              <div class="prm-screen__label">${escapeHtml(sc.label)}</div>
              <div class="prm-screen__desc">${escapeHtml(sc.desc)}</div>
              <span class="prm-toggle prm-screen__toggle">
                <input type="checkbox" data-screen="${sc.id}" ${on ? 'checked' : ''} ${!p.editable ? 'disabled' : ''} />
                <span class="prm-toggle__track"></span>
              </span>
            </label>
          `;
        }).join('')
      : `<div class="prm-empty" style="grid-column:1/-1"><div class="prm-empty__icon">${ICONS.grid}</div><h3 class="prm-empty__title">Nenhuma tela encontrada</h3></div>`;

    /* --- Ações (SEMPRE renderiza o body, CSS controla visibilidade) --- */
    const actionsHTML = ACTIONS.map((group) => {
      const collapsed = !!(state.ui.collapsed && state.ui.collapsed[group.group]);
      const onCount = group.items.filter((i) => d.actions.has(i.cap)).length;

      return `
        <section class="prm-actions-group ${collapsed ? 'is-collapsed' : ''}"
                 data-group="${escapeHtml(group.group)}">
          <button type="button" class="prm-actions-group__head" data-toggle="${escapeHtml(group.group)}" aria-expanded="${!collapsed}">
            <span class="prm-actions-group__head-left">
              <span class="prm-actions-group__icon">${ICONS.shield}</span>
              <span class="prm-actions-group__title">${escapeHtml(group.group)}</span>
            </span>
            <span class="prm-actions-group__head-right">
              <span class="prm-actions-group__count">${onCount}/${group.items.length}</span>
              <span class="prm-actions-group__chevron">${ICONS.chev}</span>
            </span>
          </button>
          <div class="prm-actions-group__body">
            ${group.items.map((i) => {
              const on = d.actions.has(i.cap);
              const changed = on !== s.actions.has(i.cap);
              return `
                <div class="prm-action ${changed ? 'is-changed' : ''}">
                  <div class="prm-action__info">
                    <span class="prm-action__label">${escapeHtml(i.label)}</span>
                    <span class="prm-action__cap">${escapeHtml(i.cap)}</span>
                  </div>
                  <div class="prm-action__side">
                    <span class="prm-action__badge prm-action__badge--${changed ? 'custom' : 'default'}">
                      ${changed ? 'Alterado' : 'Padrão'}
                    </span>
                    <label class="prm-toggle">
                      <input type="checkbox" data-action="${i.cap}" ${on ? 'checked' : ''} ${!p.editable ? 'disabled' : ''} />
                      <span class="prm-toggle__track"></span>
                    </label>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </section>
      `;
    }).join('');

    /* --- HTML final --- */
    body.innerHTML = `
      <div class="prm-profile-head">
        <div class="prm-profile-head__top">
          <div class="prm-profile-head__text">
            <span class="prm-profile-head__eyebrow">Editando permissões do perfil</span>
            <div class="prm-profile-head__title-row">
              <h2 class="prm-profile-head__title">${escapeHtml(p.label)}</h2>
              ${p.editable ? `
                <button type="button" class="prm-profile-head__edit" data-edit-role="${escapeHtml(p.key)}" title="Renomear perfil / alterar papel base">
                  ${ICONS.edit}
                  <span>Editar</span>
                </button>
              ` : ''}
            </div>
            <p class="prm-profile-head__sub">${escapeHtml(p.slug)} · papel base: <strong>${escapeHtml(p.baseRole)}</strong></p>
          </div>
          <div class="prm-profile-head__badges">
            ${p.kind === 'custom' ? '<span class="prm-badge prm-badge--custom">Custom</span>' : ''}
            ${p.editable
              ? '<span class="prm-badge prm-badge--edit">Editável</span>'
              : '<span class="prm-badge prm-badge--readonly">Somente leitura</span>'}
            <button type="button" class="prm-badge prm-badge--custom prm-badge--clickable" data-open-users="${escapeHtml(p.slug)}">
              ${ICONS.user} ${p.userCount || 0} usuário${p.userCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
        <div class="prm-profile-stats">
          <div class="prm-profile-stat">
            <span class="prm-profile-stat__label">Telas liberadas</span>
            <span class="prm-profile-stat__value"><strong>${d.screens.size}</strong> / ${SCREENS.length}</span>
          </div>
          <div class="prm-profile-stat">
            <span class="prm-profile-stat__label">Ações permitidas</span>
            <span class="prm-profile-stat__value"><strong>${d.actions.size}</strong> / ${ALL_ACTIONS.length}</span>
          </div>
        </div>
      </div>

      ${changedTotal ? `
        <div class="prm-notice">
          ${ICONS.info}
          <span><strong>${changedTotal}</strong> alteração(ões) não salva(s) neste perfil.</span>
        </div>
      ` : ''}

      <section class="prm-section prm-section--screens">
        <header class="prm-section__head">
          <div>
            <h3 class="prm-section__title">
              <span class="prm-section__title-icon">${ICONS.grid}</span>
              Telas
            </h3>
            <p class="prm-section__desc">Marque as telas visíveis para este perfil.</p>
          </div>
          <div class="prm-section__actions">
            <button type="button" class="prm-chip" data-bulk="all" ${!p.editable ? 'disabled' : ''}>Todas</button>
            <button type="button" class="prm-chip" data-bulk="none" ${!p.editable ? 'disabled' : ''}>Nenhuma</button>
          </div>
        </header>
        <div class="prm-screens">${screensHTML}</div>
      </section>

      <div class="prm-actions-title">Ações por tela</div>
      ${actionsHTML}
    `;
  };

  /* ============================================================
     FOOTER
     ============================================================ */
  PRM.renderFooter = function () {
    const anyChanged = state.profiles.some((x) => isChanged(x.slug));
    const footer = $('#footer');
    footer.hidden = !anyChanged;

    if (!anyChanged) return;

    let count = 0;
    state.profiles.forEach((x) => {
      const d = state.draft[x.slug], s = state.saved[x.slug];
      if (!d || !s) return;
      [...d.screens].forEach((c) => { if (!s.screens.has(c)) count++; });
      [...s.screens].forEach((c) => { if (!d.screens.has(c)) count++; });
      [...d.actions].forEach((c) => { if (!s.actions.has(c)) count++; });
      [...s.actions].forEach((c) => { if (!d.actions.has(c)) count++; });
    });
    $('#footer-text').textContent = `${count} alteração(ões) não salva(s)`;
  };

  /* ============================================================
     RENDER GERAL
     ============================================================ */
  PRM.render = function () {
    PRM.renderRoleList();
    PRM.renderMain();
    PRM.renderFooter();
  };
})();