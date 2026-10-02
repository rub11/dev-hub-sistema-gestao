/* =========================================================
   DEV HUB · Financeiro · custom-filters
   ---------------------------------------------------------
   Filtro personalizado (estilo Sankhya simplificado):
   + Catálogo de campos + operadores por tipo
   + Editor de condições
   + Lista de filtros salvos (localStorage)
   + Aplicação (AND entre filtros e entre condições)
   ---------------------------------------------------------
   Depende de: state.js (window.Fin)
   Publica em: window.Fin
   ========================================================= */

(function () {
  'use strict';

  const {
    $, $$, escapeHTML,
    fmtBRL, parseBRLToCents, todayISO,
    toast,
    state
  } = window.Fin;

  /* =========================================================
     CATÁLOGO
     ========================================================= */
  const CUSTOM_FIELDS = [
    { key: 'partner_name',          label: 'Parceiro',          type: 'text' },
    { key: 'partner_doc',           label: 'CNPJ / CPF',        type: 'text' },
    { key: 'title_code',            label: 'Nro Único',         type: 'text' },
    { key: 'doc_number',            label: 'Nro Nota',          type: 'text' },
    { key: 'company_name',          label: 'Empresa',           type: 'text' },
    { key: 'nature_name',           label: 'Natureza',          type: 'text' },
    { key: 'cost_center_name',      label: 'Centro Resultado',  type: 'text' },
    { key: 'notes',                 label: 'Histórico',         type: 'text' },
    { key: 'status',                label: 'Status',            type: 'enum' },
    { key: 'kind',                  label: 'Receita/Despesa',   type: 'enum' },
    { key: 'amount_cents',          label: 'Valor',             type: 'money' },
    { key: 'current_balance_cents', label: 'Saldo',             type: 'money' },
    { key: 'due_date',              label: 'Dt. Vencimento',    type: 'date' },
    { key: 'issue_date',            label: 'Dt. Negociação',    type: 'date' },
    { key: 'settlement_date',       label: 'Dt. Baixa',         type: 'date' }
  ];

  const CUSTOM_ENUM_OPTIONS = {
    status: [
      { v: 'pendente',  l: 'Pendente' },
      { v: 'baixado',   l: 'Baixado' },
      { v: 'provisao',  l: 'Provisão' },
      { v: 'estornado', l: 'Estornado' },
      { v: 'cancelado', l: 'Cancelado' }
    ],
    kind: [
      { v: 'receita', l: 'Receita' },
      { v: 'despesa', l: 'Despesa' }
    ]
  };

  const CUSTOM_OPS = {
    text: [
      { v: 'contains', l: 'Contém' },
      { v: 'eq',       l: 'Igual' },
      { v: 'neq',      l: 'Diferente' },
      { v: 'starts',   l: 'Começa com' },
      { v: 'ends',     l: 'Termina com' },
      { v: 'empty',    l: 'Vazio' },
      { v: 'nempty',   l: 'Preenchido' }
    ],
    enum: [
      { v: 'eq',  l: 'Igual' },
      { v: 'neq', l: 'Diferente' }
    ],
    money: [
      { v: 'eq',      l: 'Igual a' },
      { v: 'neq',     l: 'Diferente de' },
      { v: 'gt',      l: 'Maior que' },
      { v: 'gte',     l: 'Maior ou igual' },
      { v: 'lt',      l: 'Menor que' },
      { v: 'lte',     l: 'Menor ou igual' },
      { v: 'between', l: 'Entre' }
    ],
    date: [
      { v: 'eq',        l: 'Igual a' },
      { v: 'gt',        l: 'Depois de' },
      { v: 'gte',       l: 'A partir de' },
      { v: 'lt',        l: 'Antes de' },
      { v: 'lte',       l: 'Até' },
      { v: 'between',   l: 'Entre' },
      { v: 'today',     l: 'Hoje' },
      { v: 'last7',     l: 'Últimos 7 dias' },
      { v: 'last30',    l: 'Últimos 30 dias' },
      { v: 'thisMonth', l: 'Este mês' }
    ]
  };

  let condSeq = 0;
  const newCondId = () => `c${++condSeq}_${Date.now().toString(36)}`;

  let filterSeq = 0;
  const newFilterId = () => `f${++filterSeq}_${Date.now().toString(36)}`;

  function findField(key) {
    return CUSTOM_FIELDS.find(f => f.key === key) || CUSTOM_FIELDS[0];
  }

  /* =========================================================
     PERSISTÊNCIA
     ========================================================= */
  const CUSTOM_STORAGE_KEY = 'devhub.financeiro.customFilters';

  function persistCustomFilters() {
    try {
      const payload = {
        enabled: state.custom.enabled,
        filters: state.custom.filters.map(f => ({
          id: f.id,
          name: f.name,
          active: f.active,
          conditions: f.conditions.map(c => ({
            id: c.id, active: c.active, field: c.field,
            op: c.op, value: c.value, value2: c.value2
          }))
        }))
      };
      localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('[fin] persistCustomFilters:', e);
    }
  }

  function restoreCustomFilters() {
    try {
      const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data) return;
      state.custom.enabled = !!data.enabled;
      state.custom.filters = Array.isArray(data.filters) ? data.filters : [];
    } catch (e) {
      console.warn('[fin] restoreCustomFilters:', e);
    }
  }

  /* =========================================================
     UI · TOGGLE GERAL
     ========================================================= */
  function syncCustomToggleUI() {
    const root = document.getElementById('fin-custom');
    if (!root) return;
    root.classList.toggle('is-on', state.custom.enabled);

    const body = document.getElementById('fin-custom-body');
    if (body) body.style.pointerEvents = state.custom.enabled ? '' : 'none';

    const toggle = document.getElementById('fin-custom-filter');
    if (toggle) toggle.checked = state.custom.enabled;

    const badge = document.getElementById('fin-filter-count');
    if (badge) {
      const count = state.custom.filters.filter(f => f.active).length;
      badge.textContent = String(count);
      badge.dataset.empty = count === 0 ? 'true' : 'false';
    }
  }

  /* =========================================================
     UI · LISTA DE FILTROS SALVOS
     ========================================================= */
  function renderCustomFilterList() {
    const wrap = document.getElementById('fin-custom-filters');
    const empty = document.getElementById('fin-custom-empty');
    if (!wrap) return;

    if (!state.custom.filters.length) {
      wrap.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    wrap.innerHTML = state.custom.filters.map((f) => {
      const totalConds  = f.conditions.length;
      const activeConds = f.conditions.filter(c => c.active).length;

      let summary;
      let summaryClass = '';

      if (!f.active) {
        summary = totalConds === 0
          ? 'Desativado · sem condições'
          : `Desativado · ${totalConds} condição(ões)`;
        summaryClass = 'fin-saved__meta--off';
      } else if (totalConds === 0) {
        summary = 'Sem condições';
      } else {
        summary = `${activeConds} de ${totalConds} condição(ões) ativa(s)`;
      }

      return `
        <div class="fin-saved ${f.active ? 'is-on' : 'is-off'}" data-filter-id="${f.id}">
          <label class="fin-saved__toggle" title="${f.active ? 'Desativar filtro' : 'Ativar filtro'}">
            <input type="checkbox" ${f.active ? 'checked' : ''} data-role="toggle" />
            <span class="fin-saved__toggle-track"></span>
          </label>

          <div class="fin-saved__info" data-role="edit" title="Clique para editar">
            <span class="fin-saved__name">${escapeHTML(f.name || 'Filtro sem nome')}</span>
            <span class="fin-saved__meta ${summaryClass}">${escapeHTML(summary)}</span>
          </div>

          <div class="fin-saved__actions">
            <button type="button" class="fin-saved__icon-btn" data-role="edit" title="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
              </svg>
            </button>
            <button type="button" class="fin-saved__icon-btn fin-saved__icon-btn--danger" data-role="delete" title="Excluir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /* =========================================================
     UI · EDITOR
     ========================================================= */
  function renderCustomEditor() {
    const listView = document.getElementById('fin-custom-list-view');
    const editor   = document.getElementById('fin-custom-editor');
    const nameInp  = document.getElementById('fin-custom-name');
    const list     = document.getElementById('fin-custom-list');
    const emptyC   = document.getElementById('fin-custom-empty-cond');
    if (!listView || !editor || !list) return;

    const isOpen = state.custom.editor.open;
    listView.hidden = isOpen;
    editor.hidden = !isOpen;

    if (!isOpen) return;

    const draft = state.custom.editor.draft || { conditions: [] };
    if (nameInp) nameInp.value = draft.name || '';

    list.querySelectorAll('.fin-cond').forEach(el => el.remove());

    if (!draft.conditions.length) {
      if (emptyC) emptyC.hidden = false;
      return;
    }
    if (emptyC) emptyC.hidden = true;

    draft.conditions.forEach((cond) => {
      list.appendChild(buildConditionRow(cond));
    });
  }

  function buildConditionRow(cond) {
    const field = findField(cond.field);
    const ops   = CUSTOM_OPS[field.type] || CUSTOM_OPS.text;
    const isBetween = cond.op === 'between';
    const hideValue = ['empty', 'nempty', 'today', 'last7', 'last30', 'thisMonth'].includes(cond.op);

    const wrap = document.createElement('div');
    wrap.className = 'fin-cond' + (cond.active ? '' : ' is-off');
    wrap.dataset.condId = cond.id;

    const toggle = document.createElement('label');
    toggle.className = 'fin-cond__toggle';
    toggle.innerHTML = `
      <input type="checkbox" ${cond.active ? 'checked' : ''} data-role="toggle" />
      <span class="fin-cond__toggle-track"></span>
    `;
    wrap.appendChild(toggle);

    const content = document.createElement('div');
    content.className = 'fin-cond__content';

    const row1 = document.createElement('div');
    row1.className = 'fin-cond__row';

    const fieldSel = document.createElement('select');
    fieldSel.className = 'fin-cond__field';
    fieldSel.dataset.role = 'field';
    fieldSel.innerHTML = CUSTOM_FIELDS.map(f =>
      `<option value="${f.key}" ${f.key === cond.field ? 'selected' : ''}>${f.label}</option>`
    ).join('');

    const opSel = document.createElement('select');
    opSel.className = 'fin-cond__op';
    opSel.dataset.role = 'op';
    opSel.innerHTML = ops.map(o =>
      `<option value="${o.v}" ${o.v === cond.op ? 'selected' : ''}>${o.l}</option>`
    ).join('');

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'fin-cond__del';
    delBtn.dataset.role = 'delete';
    delBtn.title = 'Remover condição';
    delBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
      </svg>`;

    row1.appendChild(fieldSel);
    row1.appendChild(opSel);
    row1.appendChild(delBtn);
    content.appendChild(row1);

    if (!hideValue) {
      const row2 = document.createElement('div');
      row2.className = 'fin-cond__row fin-cond__row--single';

      if (field.type === 'enum') {
        const valSel = document.createElement('select');
        valSel.className = 'fin-cond__value';
        valSel.dataset.role = 'value';
        const opts = CUSTOM_ENUM_OPTIONS[field.key] || [];
        valSel.innerHTML = `<option value="">— selecione —</option>` +
          opts.map(o => `<option value="${o.v}" ${o.v === cond.value ? 'selected' : ''}>${o.l}</option>`).join('');
        row2.appendChild(valSel);
      } else if (field.type === 'date') {
        const inp = document.createElement('input');
        inp.type = 'date';
        inp.className = 'fin-cond__value';
        inp.dataset.role = 'value';
        inp.value = cond.value || '';
        row2.appendChild(inp);
      } else if (field.type === 'money') {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'fin-cond__value';
        inp.dataset.role = 'value';
        inp.placeholder = '0,00';
        inp.value = cond.value || '';
        row2.appendChild(inp);
      } else {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'fin-cond__value';
        inp.dataset.role = 'value';
        inp.placeholder = 'valor';
        inp.value = cond.value || '';
        row2.appendChild(inp);
      }
      content.appendChild(row2);

      if (isBetween && (field.type === 'money' || field.type === 'date')) {
        const row3 = document.createElement('div');
        row3.className = 'fin-cond__row fin-cond__row--single';
        const inp2 = document.createElement('input');
        inp2.type = field.type === 'date' ? 'date' : 'text';
        inp2.className = 'fin-cond__value';
        inp2.dataset.role = 'value2';
        inp2.placeholder = field.type === 'date' ? '' : '0,00';
        inp2.value = cond.value2 || '';
        row3.appendChild(inp2);
        content.appendChild(row3);
      }
    }

    wrap.appendChild(content);
    return wrap;
  }

  /* =========================================================
     AÇÕES DO EDITOR
     ========================================================= */
  function openEditorNew() {
    state.custom.editor = {
      open: true,
      editingId: null,
      draft: {
        name: '',
        conditions: [{
          id: newCondId(),
          active: true,
          field: 'partner_name',
          op: 'contains',
          value: '',
          value2: ''
        }]
      }
    };
    renderCustomEditor();
  }

  function openEditorEdit(id) {
    const f = state.custom.filters.find(x => x.id === id);
    if (!f) return;
    state.custom.editor = {
      open: true,
      editingId: id,
      draft: {
        name: f.name,
        conditions: f.conditions.map(c => ({ ...c }))
      }
    };
    renderCustomEditor();
  }

  function closeEditor() {
    state.custom.editor = { open: false, editingId: null, draft: null };
    renderCustomEditor();
  }

  function saveEditor() {
    const draft = state.custom.editor.draft;
    if (!draft) return;

    const name = (draft.name || '').trim();
    if (!name) { toast('Dê um nome ao filtro.', 'error'); return; }

    const conds = draft.conditions.filter(c => c.active !== false);
    if (!conds.length) { toast('Adicione ao menos uma condição.', 'error'); return; }

    if (state.custom.editor.editingId) {
      const f = state.custom.filters.find(x => x.id === state.custom.editor.editingId);
      if (f) {
        f.name = name;
        f.conditions = draft.conditions;
      }
    } else {
      state.custom.filters.push({
        id: newFilterId(),
        name,
        active: true,
        conditions: draft.conditions
      });
    }

    persistCustomFilters();
    closeEditor();
    renderCustomFilterList();
    syncCustomToggleUI();
    window.Fin.updateFilterBadge?.();
    window.Fin.renderAll?.();
  }

  function deleteFilter(id) {
    const f = state.custom.filters.find(x => x.id === id);
    if (!f) return;
    if (!confirm(`Excluir o filtro "${f.name}"?`)) return;
    state.custom.filters = state.custom.filters.filter(x => x.id !== id);
    persistCustomFilters();
    renderCustomFilterList();
    syncCustomToggleUI();
    window.Fin.updateFilterBadge?.();
    window.Fin.renderAll?.();
  }

  function toggleFilter(id, active) {
    const f = state.custom.filters.find(x => x.id === id);
    if (!f) return;
    f.active = active;
    persistCustomFilters();
    renderCustomFilterList();
    syncCustomToggleUI();
    window.Fin.updateFilterBadge?.();
    window.Fin.renderAll?.();
  }

  /* =========================================================
     BIND
     ========================================================= */
  function bindCustomFilter() {
    const root = document.getElementById('fin-custom');
    if (!root) return;

    restoreCustomFilters();

    const toggle = document.getElementById('fin-custom-filter');
    if (toggle) {
      toggle.checked = state.custom.enabled;
      toggle.addEventListener('change', () => {
        state.custom.enabled = toggle.checked;
        persistCustomFilters();
        syncCustomToggleUI();
        renderCustomFilterList();
        window.Fin.updateFilterBadge?.();
        window.Fin.renderAll?.();
      });
    }

    const newBtn = document.getElementById('fin-custom-new');
    if (newBtn) newBtn.addEventListener('click', openEditorNew);

    const addCond = document.getElementById('fin-custom-add');
    if (addCond) {
      addCond.addEventListener('click', () => {
        if (!state.custom.editor.draft) return;
        state.custom.editor.draft.conditions.push({
          id: newCondId(),
          active: true,
          field: 'partner_name',
          op: 'contains',
          value: '',
          value2: ''
        });
        renderCustomEditor();
      });
    }

    const cancelBtn = document.getElementById('fin-custom-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', closeEditor);

    const saveBtn = document.getElementById('fin-custom-save');
    if (saveBtn) saveBtn.addEventListener('click', saveEditor);

    const nameInp = document.getElementById('fin-custom-name');
    if (nameInp) {
      nameInp.addEventListener('input', () => {
        if (state.custom.editor.draft) {
          state.custom.editor.draft.name = nameInp.value;
        }
      });
    }

    const filtersWrap = document.getElementById('fin-custom-filters');
    if (filtersWrap) {
      filtersWrap.addEventListener('change', (e) => {
        if (e.target.matches('[data-role="toggle"]')) {
          const box = e.target.closest('.fin-saved');
          if (!box) return;
          toggleFilter(box.dataset.filterId, e.target.checked);
        }
      });

      filtersWrap.addEventListener('click', (e) => {
        const box = e.target.closest('.fin-saved');
        if (!box) return;
        if (e.target.closest('[data-role="toggle"]')) return;

        const id = box.dataset.filterId;

        if (e.target.closest('[data-role="delete"]')) { deleteFilter(id); return; }
        if (e.target.closest('[data-role="edit"]'))   { openEditorEdit(id); return; }
      });
    }

    const list = document.getElementById('fin-custom-list');
    if (list) {
      list.addEventListener('change', (e) => {
        const row = e.target.closest('.fin-cond');
        if (!row) return;
        const draft = state.custom.editor.draft;
        if (!draft) return;
        const cond = draft.conditions.find(c => c.id === row.dataset.condId);
        if (!cond) return;
        const role = e.target.dataset.role;

        if (role === 'toggle') {
          cond.active = e.target.checked;
          row.classList.toggle('is-off', !cond.active);
        }
        if (role === 'field') {
          cond.field = e.target.value;
          cond.op = 'contains';
          cond.value = '';
          cond.value2 = '';
          renderCustomEditor();
        }
        if (role === 'op')     { cond.op = e.target.value; renderCustomEditor(); }
        if (role === 'value')  { cond.value = e.target.value; }
        if (role === 'value2') { cond.value2 = e.target.value; }
      });

      list.addEventListener('click', (e) => {
        const delBtn = e.target.closest('[data-role="delete"]');
        if (!delBtn) return;
        const row = e.target.closest('.fin-cond');
        if (!row) return;
        const draft = state.custom.editor.draft;
        if (!draft) return;
        draft.conditions = draft.conditions.filter(c => c.id !== row.dataset.condId);
        renderCustomEditor();
      });
    }

    syncCustomToggleUI();
    renderCustomFilterList();
    renderCustomEditor();
  }

  /* =========================================================
     APLICAÇÃO (chamado por filters.js)
     ========================================================= */
  function applyCustomConditions(rows) {
    if (!state.custom.enabled) return rows;

    const activeFilters = state.custom.filters.filter(f =>
      f.active && f.conditions.some(c => c.active)
    );
    if (!activeFilters.length) return rows;

    return rows.filter((r) =>
      activeFilters.every((f) =>
        f.conditions.filter(c => c.active).every((c) => matchCondition(r, c))
      )
    );
  }

  function matchCondition(row, cond) {
    const field = findField(cond.field);
    const raw = row[cond.field];
    const v = cond.value;
    const v2 = cond.value2;

    if (field.type === 'text') {
      const a = String(raw || '').toLowerCase();
      const b = String(v || '').toLowerCase();
      switch (cond.op) {
        case 'contains': return a.includes(b);
        case 'eq':       return a === b;
        case 'neq':      return a !== b;
        case 'starts':   return a.startsWith(b);
        case 'ends':     return a.endsWith(b);
        case 'empty':    return !a;
        case 'nempty':   return !!a;
        default:         return true;
      }
    }
    if (field.type === 'enum') {
      switch (cond.op) {
        case 'eq':  return String(raw) === v;
        case 'neq': return String(raw) !== v;
        default:    return true;
      }
    }
    if (field.type === 'money') {
      const a  = Number(raw || 0);
      const b  = parseBRLToCents(v);
      const b2 = parseBRLToCents(v2);
      switch (cond.op) {
        case 'eq':      return a === b;
        case 'neq':     return a !== b;
        case 'gt':      return a > b;
        case 'gte':     return a >= b;
        case 'lt':      return a < b;
        case 'lte':     return a <= b;
        case 'between': return a >= b && a <= b2;
        default:        return true;
      }
    }
    if (field.type === 'date') {
      const iso = raw || '';
      const today = todayISO();
      const now = new Date(today + 'T00:00:00');
      switch (cond.op) {
        case 'eq':      return iso === v;
        case 'gt':      return iso > v;
        case 'gte':     return iso >= v;
        case 'lt':      return iso < v;
        case 'lte':     return iso <= v;
        case 'between': return iso >= v && iso <= v2;
        case 'today':   return iso === today;
        case 'last7': {
          const d = new Date(now); d.setDate(d.getDate() - 7);
          return iso >= d.toISOString().slice(0, 10) && iso <= today;
        }
        case 'last30': {
          const d = new Date(now); d.setDate(d.getDate() - 30);
          return iso >= d.toISOString().slice(0, 10) && iso <= today;
        }
        case 'thisMonth': {
          const ym = today.slice(0, 7);
          return iso.startsWith(ym);
        }
        default: return true;
      }
    }
    return true;
  }

  /* =========================================================
     PUBLICA
     ========================================================= */
  Object.assign(window.Fin, {
    CUSTOM_FIELDS,
    CUSTOM_ENUM_OPTIONS,
    CUSTOM_OPS,
    findField,
    bindCustomFilter,
    syncCustomToggleUI,
    renderCustomFilterList,
    renderCustomEditor,
    applyCustomConditions,
    matchCondition
  });

})();