/* =========================================================
   DEV HUB · Parceiros · render
   ---------------------------------------------------------
   Tabela única (grid estilo ERP) + estados vazios.
   ========================================================= */

(function () {
  'use strict';

  const {
    escapeHtml, matches,
    typeLabel, shortCode,
    primaryAddressLine,
    state
  } = window.Parn;

  /* =========================================================
     FILTRO
     ========================================================= */
  function applyFilter() {
    let list = state.all.slice();

    if (state.kind === 'customer') list = list.filter((p) => p.is_customer);
    if (state.kind === 'supplier') list = list.filter((p) => p.is_supplier);
    if (state.kind === 'carrier')  list = list.filter((p) => p.is_carrier);

    if (state.filterType)   list = list.filter((p) => String(p.type || '').toUpperCase() === state.filterType);
    if (state.filterStatus) list = list.filter((p) => String(p.status || 'active').toLowerCase() === state.filterStatus);

    if (state.search) {
      const t = state.search;
      list = list.filter((p) =>
        matches(p.name, t) ||
        matches(p.company_name, t) ||
        matches(p.trade_name, t) ||
        matches(p.cpf_cnpj, t) ||
        matches(p.phone, t) ||
        matches(p.email, t)
      );
    }

    state.filtered = list;
    renderList();
    updateCountLabel();
  }

  /* =========================================================
     RENDER · TABELA
     ========================================================= */
  function renderList() {
    const tbody = document.getElementById('partners-body');
    const tableWrap = document.getElementById('partners-table-wrap');
    if (!tbody || !tableWrap) return;

    if (state.filtered.length === 0) {
      tableWrap.hidden = true;
      showEmptyState(
        state.all.length === 0
          ? 'Nenhum parceiro cadastrado ainda.'
          : 'Nenhum parceiro encontrado.',
        state.all.length === 0
          ? 'Comece adicionando o primeiro parceiro ao sistema.'
          : 'Ajuste o filtro ou a busca para encontrar o registro desejado.',
        state.all.length === 0 && state.perms.create
      );
      return;
    }

    hideEmptyState();
    tableWrap.hidden = false;
    tbody.innerHTML = '';

    const frag = document.createDocumentFragment();
    state.filtered.forEach((p) => frag.appendChild(buildRow(p)));
    tbody.appendChild(frag);
  }

  function buildRow(p) {
    const tr = document.createElement('tr');
    tr.dataset.id = p.id;
    tr.classList.add('parn-row-clickable');

    tr.appendChild(cell(String(shortCode(p)), 'parn-td--cod'));
    tr.appendChild(cell(p.name || '—'));
    tr.appendChild(cell(primaryAddressLine(p), 'cell--muted'));
    tr.appendChild(cell(p.company_name || '—', 'cell--muted'));
    tr.appendChild(cell(typeLabel(p.type), 'cell--muted'));
    tr.appendChild(cell(p.cpf_cnpj || '—', 'cell--muted'));
    tr.appendChild(cell(p.state_registration || '—', 'cell--muted'));
    tr.appendChild(boolCell(p.status !== 'inactive' && p.status !== 'blocked'));
    tr.appendChild(boolCell(!!p.is_customer));
    tr.appendChild(boolCell(!!p.is_supplier));
    tr.appendChild(boolCell(String(p.tax_regime || '').toLowerCase().includes('simples')));
    tr.appendChild(buildActionsCell(p));

    // Clique na linha → abre modal
    tr.addEventListener('click', (e) => {
      if (e.target.closest('button, a, input, select, label')) return;
      const row = state.all.find((x) => x.id === p.id);
      if (row) window.Parn.openEditModal(row);
    });

    // Right-click → menu de contexto
    tr.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const row = state.all.find((x) => x.id === p.id);
      if (!row) return;
      window.Parn.openCtxMenu?.(e.clientX, e.clientY, row, tr);
    });

    return tr;
  }

  /* =========================================================
     HELPERS DE CÉLULA
     ========================================================= */
  function cell(text, className) {
    const td = document.createElement('td');
    td.textContent = text;
    if (className) td.className = className;
    return td;
  }

  function boolCell(v) {
    const td = document.createElement('td');
    td.className = 'parn-td--bool';
    td.textContent = v ? 'Sim' : 'Não';
    if (!v) td.classList.add('cell--muted');
    return td;
  }

  function buildActionsCell(p) {
    const cell = document.createElement('td');
    cell.className = 'parn-td--actions';

    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    if (state.perms.edit) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'row-action';
      btn.title = 'Editar';
      btn.setAttribute('aria-label', 'Editar ' + (p.name || ''));
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
      btn.addEventListener('click', () => window.Parn.openEditModal(p));
      wrap.appendChild(btn);
    }

    if (state.perms.remove) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'row-action row-action--danger';
      btn.title = 'Excluir';
      btn.setAttribute('aria-label', 'Excluir ' + (p.name || ''));
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>';
      btn.addEventListener('click', () => window.Parn.openConfirmModal(p));
      wrap.appendChild(btn);
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
     ESTADOS
     ========================================================= */
  function showLoading(isLoading) {
    const l = document.getElementById('partners-loading');
    const w = document.getElementById('partners-table-wrap');
    const e = document.getElementById('partners-empty');
    if (!l) return;
    if (isLoading) { l.hidden = false; if (w) w.hidden = true; if (e) e.hidden = true; }
    else l.hidden = true;
  }

  function showEmptyState(title, text, showCta) {
    const empty = document.getElementById('partners-empty');
    const t = document.getElementById('partners-empty-title');
    const x = document.getElementById('partners-empty-text');
    const cta = document.getElementById('empty-new-btn');
    if (!empty) return;
    if (t) t.textContent = title;
    if (x) x.textContent = text;
    if (cta) cta.hidden = !showCta;
    empty.hidden = false;
  }

  function hideEmptyState() {
    const e = document.getElementById('partners-empty');
    if (e) e.hidden = true;
  }

  function updateCountLabel() {
    const total = state.all.length;
    const shown = state.filtered.length;
    const label = document.getElementById('partners-count');
    if (!label) return;

    if (total === 0) { label.textContent = 'Nenhum parceiro cadastrado'; return; }
    if (shown === total) {
      label.textContent = total === 1 ? '1 parceiro' : total + ' parceiros';
      return;
    }
    label.textContent = shown + ' de ' + total + ' parceiros';
  }

  function showGlobalAlert(message, type) {
    const el = document.getElementById('global-alert');
    if (!el) return;
    el.textContent = message;
    el.className = 'alert alert--' + (type || 'error');
    el.hidden = false;
  }

  Object.assign(window.Parn, {
    applyFilter,
    renderList,
    showLoading,
    showEmptyState,
    hideEmptyState,
    updateCountLabel,
    showGlobalAlert
  });

})();