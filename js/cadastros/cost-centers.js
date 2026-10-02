/* =========================================================
   DEV HUB · Cadastros · centros de custo
   ========================================================= */
(function () {
  'use strict';
  const CAD = window.CAD;
  const state = CAD.state;
  const CC = state.costCenters;

  async function fetchAll() {
    CC.loading = true;
    showLoading(true);
    try {
      let query = window.db
        .from('cost_centers')
        .select('id, organization_id, code, name, parent_id, active, notes, created_at')
        .order('code', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      if (state.orgId) query = query.eq('organization_id', state.orgId);

      const { data, error } = await query;

      if (error) throw error;
      CC.all = data || [];
      applyFilters();
    } catch (err) {
      console.error('[CAD] fetch cost_centers:', err);
      CAD.toast('Não foi possível carregar os centros de custo.', 'error');
      CC.all = [];
      applyFilters();
    } finally {
      CC.loading = false;
      showLoading(false);
    }
  }

  function applyFilters() {
    const q = CC.query.toLowerCase();
    const status = CC.status;

    CC.filtered = CC.all.filter(c => {
      if (status === 'active' && !c.active) return false;
      if (status === 'inactive' && c.active) return false;
      if (q) {
        const hay = (c.name || '') + ' ' + (c.code || '');
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    render();
    updateCount();
  }

  function updateCount() {
    const total = CC.all.length;
    const shown = CC.filtered.length;
    const label = document.getElementById('cc-count');
    const tabCount = document.getElementById('tab-count-cc');
    if (tabCount) tabCount.textContent = total;

    if (!label) return;
    if (total === 0) { label.textContent = 'Nenhum centro cadastrado'; return; }
    if (shown === total) {
      label.textContent = total === 1 ? '1 centro de custo' : total + ' centros de custo';
    } else {
      label.textContent = shown + ' de ' + total + ' centros';
    }
  }

  function showLoading(isLoading) {
    const loading = document.getElementById('cc-loading');
    const wrap = document.getElementById('cc-wrap');
    const empty = document.getElementById('cc-empty');
    if (isLoading) {
      if (loading) loading.hidden = false;
      if (wrap) wrap.hidden = true;
      if (empty) empty.hidden = true;
    } else if (loading) {
      loading.hidden = true;
    }
  }

  function render() {
    const tbody = document.getElementById('cc-body');
    const wrap = document.getElementById('cc-wrap');
    const empty = document.getElementById('cc-empty');
    const emptyText = document.getElementById('cc-empty-text');
    if (!tbody || !wrap || !empty) return;

    if (CC.filtered.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      if (emptyText) {
        emptyText.textContent = CC.all.length === 0
          ? 'Nenhum centro de custo cadastrado ainda. Comece criando o primeiro.'
          : 'Nenhum resultado encontrado com os filtros atuais.';
      }
      return;
    }

    empty.hidden = true;
    wrap.hidden = false;
    tbody.innerHTML = '';

    const frag = document.createDocumentFragment();
    CC.filtered.forEach(c => frag.appendChild(buildRow(c)));
    tbody.appendChild(frag);
  }

  function buildRow(c) {
    const tr = document.createElement('tr');
    if (!c.active) tr.classList.add('row--inactive');

    tr.appendChild(createCell(c.code || '—', 'cell-code'));

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

    const parentName = c.parent_id
      ? (CC.all.find(x => x.id === c.parent_id)?.name || '—')
      : '—';
    tr.appendChild(createCell(parentName, 'cell--muted'));

    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge ' + (c.active ? 'badge--success' : 'badge--neutral');
    badge.textContent = c.active ? 'Ativo' : 'Inativo';
    statusCell.appendChild(badge);
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
      editBtn.setAttribute('aria-label', 'Editar ' + c.name);
      editBtn.innerHTML = CAD.ICONS.edit;
      editBtn.addEventListener('click', () => openForm(c));
      wrap.appendChild(editBtn);

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'row-action';
      toggleBtn.title = c.active ? 'Desativar' : 'Ativar';
      toggleBtn.setAttribute('aria-label', c.active ? 'Desativar' : 'Ativar');
      toggleBtn.innerHTML = c.active ? CAD.ICONS.toggleOn : CAD.ICONS.toggleOff;
      toggleBtn.addEventListener('click', () => toggleActive(c));
      wrap.appendChild(toggleBtn);
    }

    if (CAD.state.perms.remove) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'row-action row-action--danger';
      delBtn.title = 'Excluir';
      delBtn.setAttribute('aria-label', 'Excluir ' + c.name);
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

    const parentOptions = [{ value: '', label: '— Nenhum (raiz) —' }];
    CC.all.forEach(c => {
      if (isEdit && c.id === record.id) return;
      if (c.parent_id && isEdit && c.parent_id === record.id) return;
      parentOptions.push({
        value: c.id,
        label: (c.code ? c.code + ' · ' : '') + c.name
      });
    });

    CAD.modal.open({
      title: isEdit ? 'Editar centro de custo' : 'Novo centro de custo',
      submitLabel: isEdit ? 'Salvar alterações' : 'Criar centro',
      recordId: isEdit ? record.id : null,
      fields: [
        { name: 'code', label: 'Código', type: 'text', value: record?.code || '', placeholder: 'ADMIN', hint: 'Ex.: ADMIN, COM, OPE (opcional)' },
        { name: 'name', label: 'Nome', type: 'text', value: record?.name || '', required: true, maxlength: 120 },
        { name: 'parent_id', label: 'Centro pai', type: 'select', value: record?.parent_id || '', options: parentOptions, full: true, hint: 'Opcional — útil para criar sub-centros' },
        { name: 'notes', label: 'Observações', type: 'textarea', value: record?.notes || '', maxlength: 500, full: true },
        { name: 'active', label: 'Ativo', type: 'checkbox', value: record ? record.active !== false : true, full: true }
      ],
      onSubmit: async (values, id) => {
        const payload = {
          code: values.code || null,
          name: values.name,
          parent_id: values.parent_id || null,
          notes: values.notes || null,
          active: values.active
        };

        if (id) {
          const { error } = await window.db.from('cost_centers').update(payload).eq('id', id);
          if (error) throw error;
          CAD.toast('Centro de custo atualizado.', 'success');
        } else {
          if (state.orgId) payload.organization_id = state.orgId;
          const { error } = await window.db.from('cost_centers').insert(payload);
          if (error) throw error;
          CAD.toast('Centro de custo criado.', 'success');
        }

        await fetchAll();
      }
    });
  }

  async function toggleActive(c) {
    if (!CAD.state.perms.edit) { CAD.toast('Sem permissão.', 'error'); return; }
    try {
      const { error } = await window.db
        .from('cost_centers')
        .update({ active: !c.active })
        .eq('id', c.id);
      if (error) throw error;

      c.active = !c.active;
      applyFilters();
      CAD.toast(c.active ? 'Centro ativado.' : 'Centro desativado.', 'success');
    } catch (err) {
      console.error('[CAD] toggle cc:', err);
      CAD.toast(CAD.friendlyError(err), 'error');
    }
  }

  function confirmDelete(c) {
    CAD.modal.openConfirm(
      'Excluir o centro de custo "' + c.name + '"? Se houver lançamentos vinculados, a operação será bloqueada. Prefira desativar.',
      async () => {
        const { error } = await window.db.from('cost_centers').delete().eq('id', c.id);
        if (error) throw error;
        CAD.toast('Centro de custo excluído.', 'success');
        await fetchAll();
      },
      'Excluir'
    );
  }

  function setup() {
    const search = document.getElementById('cc-search');
    const statusSel = document.getElementById('cc-status');
    const newBtn = document.getElementById('cc-new');

    if (search) {
      search.addEventListener('input', () => {
        CC.query = search.value.trim();
        applyFilters();
      });
    }
    if (statusSel) {
      statusSel.addEventListener('change', () => {
        CC.status = statusSel.value;
        applyFilters();
      });
    }
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        if (!CAD.state.perms.create) {
          CAD.toast('Sem permissão para criar.', 'error');
          return;
        }
        openForm(null);
      });
    }
  }

  CAD.costCenters = { setup, fetchAll, applyFilters };
})();