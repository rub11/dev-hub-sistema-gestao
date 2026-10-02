/* =========================================================
   DEV HUB · Cadastros · categorias financeiras
   ========================================================= */
(function () {
  'use strict';
  const CAD = window.CAD;
  const state = CAD.state;
  const CAT = state.financialCategories;

  async function fetchAll() {
    CAT.loading = true;
    showLoading(true);
    try {
      let query = window.db
        .from('financial_categories')
        .select('id, organization_id, name, kind, parent_id, active, created_at')
        .order('name', { ascending: true });

      if (state.orgId) query = query.eq('organization_id', state.orgId);

      const { data, error } = await query;
      if (error) throw error;

      CAT.all = data || [];
      applyFilters();
    } catch (err) {
      console.error('[CAD] fetch fincat:', err);
      CAD.toast('Não foi possível carregar as categorias.', 'error');
      CAT.all = [];
      applyFilters();
    } finally {
      CAT.loading = false;
      showLoading(false);
    }
  }

  function applyFilters() {
    const q = CAT.query.toLowerCase();
    const kind = CAT.kind;
    const status = CAT.status;

    CAT.filtered = CAT.all.filter(c => {
      if (kind && c.kind !== kind) return false;
      if (status === 'active' && !c.active) return false;
      if (status === 'inactive' && c.active) return false;
      if (q) {
        if (!(c.name || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });

    render();
    updateCount();
  }

  function updateCount() {
    const total = CAT.all.length;
    const shown = CAT.filtered.length;
    const label = document.getElementById('fincat-count');
    const tabCount = document.getElementById('tab-count-fincat');
    if (tabCount) tabCount.textContent = total;

    if (!label) return;
    if (total === 0) { label.textContent = 'Nenhuma categoria cadastrada'; return; }
    if (shown === total) {
      label.textContent = total === 1 ? '1 categoria' : total + ' categorias';
    } else {
      label.textContent = shown + ' de ' + total + ' categorias';
    }
  }

  function showLoading(isLoading) {
    const loading = document.getElementById('fincat-loading');
    const wrap = document.getElementById('fincat-wrap');
    const empty = document.getElementById('fincat-empty');
    if (isLoading) {
      if (loading) loading.hidden = false;
      if (wrap) wrap.hidden = true;
      if (empty) empty.hidden = true;
    } else if (loading) {
      loading.hidden = true;
    }
  }

  function render() {
    const tbody = document.getElementById('fincat-body');
    const wrap = document.getElementById('fincat-wrap');
    const empty = document.getElementById('fincat-empty');
    const emptyText = document.getElementById('fincat-empty-text');
    if (!tbody || !wrap || !empty) return;

    if (CAT.filtered.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      if (emptyText) {
        emptyText.textContent = CAT.all.length === 0
          ? 'Nenhuma categoria cadastrada ainda. Comece criando a primeira.'
          : 'Nenhum resultado encontrado com os filtros atuais.';
      }
      return;
    }

    empty.hidden = true;
    wrap.hidden = false;
    tbody.innerHTML = '';

    const frag = document.createDocumentFragment();
    CAT.filtered.forEach(c => frag.appendChild(buildRow(c)));
    tbody.appendChild(frag);
  }

  function buildRow(c) {
    const tr = document.createElement('tr');
    if (!c.active) tr.classList.add('row--inactive');

    const nameCell = document.createElement('td');
    nameCell.className = 'cell-name';
    if (c.parent_id) {
      const wrap = document.createElement('span');
      wrap.className = 'cell-hierarchy';
      const ind = document.createElement('span');
      ind.className = 'cell-hierarchy__indent';
      ind.innerHTML = CAD.ICONS.indent;
      wrap.appendChild(ind);
      wrap.appendChild(document.createTextNode(c.name));
      nameCell.appendChild(wrap);
    } else {
      nameCell.textContent = c.name;
    }
    tr.appendChild(nameCell);

    const kindCell = document.createElement('td');
    const badge = document.createElement('span');
    const info = CAD.formatKindBadge(c.kind);
    badge.className = 'badge ' + info.modifier;
    badge.textContent = info.label;
    kindCell.appendChild(badge);
    tr.appendChild(kindCell);

    const parentName = c.parent_id
      ? (CAT.all.find(x => x.id === c.parent_id)?.name || '—')
      : '—';
    tr.appendChild(createCell(parentName, 'cell--muted'));

    const statusCell = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = 'badge ' + (c.active ? 'badge--success' : 'badge--neutral');
    statusBadge.textContent = c.active ? 'Ativa' : 'Inativa';
    statusCell.appendChild(statusBadge);
    tr.appendChild(statusCell);

    tr.appendChild(buildActionsCell(c));
    return tr;
  }

  function buildActionsCell(c) {
    const cell = document.createElement('td');
    cell.className = 'cell--num';
    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    if (CAD.state.perms.edit) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'row-action';
      editBtn.title = 'Editar';
      editBtn.innerHTML = CAD.ICONS.edit;
      editBtn.addEventListener('click', () => openForm(c));
      wrap.appendChild(editBtn);

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'row-action';
      toggleBtn.title = c.active ? 'Desativar' : 'Ativar';
      toggleBtn.innerHTML = c.active ? CAD.ICONS.toggleOn : CAD.ICONS.toggleOff;
      toggleBtn.addEventListener('click', () => toggleActive(c));
      wrap.appendChild(toggleBtn);
    }

    if (CAD.state.perms.remove) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'row-action row-action--danger';
      delBtn.title = 'Excluir';
      delBtn.innerHTML = CAD.ICONS.trash;
      delBtn.addEventListener('click', () => confirmDelete(c));
      wrap.appendChild(delBtn);
    }

    cell.appendChild(wrap);
    return cell;
  }

  function createCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  /* -------------------- Form -------------------- */
  function openForm(record) {
    const isEdit = !!record;

    const parentOptions = [{ value: '', label: '— Nenhuma (raiz) —' }];
    CAT.all.forEach(c => {
      if (isEdit && c.id === record.id) return;
      if (c.parent_id && isEdit && c.parent_id === record.id) return;
      parentOptions.push({ value: c.id, label: c.name });
    });

    CAD.modal.open({
      title: isEdit ? 'Editar categoria' : 'Nova categoria',
      submitLabel: isEdit ? 'Salvar alterações' : 'Criar categoria',
      recordId: isEdit ? record.id : null,
      fields: [
        { name: 'name', label: 'Nome', type: 'text', value: record?.name || '', required: true, maxlength: 120 },
        { name: 'kind', label: 'Tipo', type: 'select', value: record?.kind || 'despesa', required: true, options: [
          { value: 'receita', label: 'Receita' },
          { value: 'despesa', label: 'Despesa' },
          { value: 'custo', label: 'Custo' },
          { value: 'imposto', label: 'Imposto' },
          { value: 'financeiro', label: 'Financeiro' }
        ]},
        { name: 'parent_id', label: 'Categoria pai', type: 'select', value: record?.parent_id || '', options: parentOptions, full: true, hint: 'Opcional — útil para agrupar categorias' },
        { name: 'active', label: 'Ativa', type: 'checkbox', value: record ? record.active !== false : true, full: true }
      ],
      onSubmit: async (values, id) => {
        const payload = {
          name: values.name,
          kind: values.kind,
          parent_id: values.parent_id || null,
          active: values.active
        };

        if (id) {
          const { error } = await window.db.from('financial_categories').update(payload).eq('id', id);
          if (error) throw error;
          CAD.toast('Categoria atualizada.', 'success');
        } else {
          if (state.orgId) payload.organization_id = state.orgId;
          const { error } = await window.db.from('financial_categories').insert(payload);
          if (error) throw error;
          CAD.toast('Categoria criada.', 'success');
        }

        await fetchAll();
      }
    });
  }

  async function toggleActive(c) {
    if (!CAD.state.perms.edit) { CAD.toast('Sem permissão.', 'error'); return; }
    try {
      const { error } = await window.db
        .from('financial_categories')
        .update({ active: !c.active })
        .eq('id', c.id);
      if (error) throw error;

      c.active = !c.active;
      applyFilters();
      CAD.toast(c.active ? 'Categoria ativada.' : 'Categoria desativada.', 'success');
    } catch (err) {
      console.error('[CAD] toggle fincat:', err);
      CAD.toast(CAD.friendlyError(err), 'error');
    }
  }

  function confirmDelete(c) {
    CAD.modal.openConfirm(
      'Excluir a categoria "' + c.name + '"? Se houver vínculos, a operação será bloqueada. Prefira desativar.',
      async () => {
        const { error } = await window.db.from('financial_categories').delete().eq('id', c.id);
        if (error) throw error;
        CAD.toast('Categoria excluída.', 'success');
        await fetchAll();
      },
      'Excluir'
    );
  }

  function setup() {
    const search = document.getElementById('fincat-search');
    const kindSel = document.getElementById('fincat-kind');
    const statusSel = document.getElementById('fincat-status');
    const newBtn = document.getElementById('fincat-new');

    if (search) search.addEventListener('input', () => { CAT.query = search.value.trim(); applyFilters(); });
    if (kindSel) kindSel.addEventListener('change', () => { CAT.kind = kindSel.value; applyFilters(); });
    if (statusSel) statusSel.addEventListener('change', () => { CAT.status = statusSel.value; applyFilters(); });
    if (newBtn) newBtn.addEventListener('click', () => {
      if (!CAD.state.perms.create) { CAD.toast('Sem permissão para criar.', 'error'); return; }
      openForm(null);
    });
  }

  CAD.financialCategories = { setup, fetchAll, applyFilters };
})();