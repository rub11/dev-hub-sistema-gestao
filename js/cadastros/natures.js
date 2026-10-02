/* =========================================================
   DEV HUB · Cadastros · naturezas
   ========================================================= */
(function () {
  'use strict';
  const CAD = window.CAD;
  const state = CAD.state;
  const NAT = state.natures;

  /* -------------------- Fetch -------------------- */
  async function fetchAll() {
    NAT.loading = true;
    showLoading(true);
    try {
      let query = window.db
        .from('natures')
        .select('id, organization_id, code, name, kind, dre_group, parent_id, active, notes, created_at')
        .order('code', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      if (state.orgId) query = query.eq('organization_id', state.orgId);

      const { data, error } = await query;

      if (error) throw error;
      NAT.all = data || [];
      applyFilters();
    } catch (err) {
      console.error('[CAD] fetch natures:', err);
      CAD.toast('Não foi possível carregar as naturezas.', 'error');
      NAT.all = [];
      applyFilters();
    } finally {
      NAT.loading = false;
      showLoading(false);
    }
  }

  /* -------------------- Filtro / render -------------------- */
  function applyFilters() {
    const q = NAT.query.toLowerCase();
    const kind = NAT.kind;
    const status = NAT.status;

    NAT.filtered = NAT.all.filter(n => {
      if (kind && n.kind !== kind) return false;
      if (status === 'active' && !n.active) return false;
      if (status === 'inactive' && n.active) return false;
      if (q) {
        const hay = (n.name || '') + ' ' + (n.code || '');
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    render();
    updateCount();
  }

  function updateCount() {
    const total = NAT.all.length;
    const shown = NAT.filtered.length;
    const label = document.getElementById('natures-count');
    const tabCount = document.getElementById('tab-count-natures');
    if (tabCount) tabCount.textContent = total;

    if (!label) return;
    if (total === 0) { label.textContent = 'Nenhuma natureza cadastrada'; return; }
    if (shown === total) {
      label.textContent = total === 1 ? '1 natureza' : total + ' naturezas';
    } else {
      label.textContent = shown + ' de ' + total + ' naturezas';
    }
  }

  function showLoading(isLoading) {
    const loading = document.getElementById('natures-loading');
    const wrap = document.getElementById('natures-wrap');
    const empty = document.getElementById('natures-empty');
    if (isLoading) {
      if (loading) loading.hidden = false;
      if (wrap) wrap.hidden = true;
      if (empty) empty.hidden = true;
    } else if (loading) {
      loading.hidden = true;
    }
  }

  function render() {
    const tbody = document.getElementById('natures-body');
    const wrap = document.getElementById('natures-wrap');
    const empty = document.getElementById('natures-empty');
    const emptyText = document.getElementById('natures-empty-text');
    if (!tbody || !wrap || !empty) return;

    if (NAT.filtered.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      if (emptyText) {
        emptyText.textContent = NAT.all.length === 0
          ? 'Nenhuma natureza cadastrada ainda. Comece criando a primeira.'
          : 'Nenhum resultado encontrado com os filtros atuais.';
      }
      return;
    }

    empty.hidden = true;
    wrap.hidden = false;
    tbody.innerHTML = '';

    const frag = document.createDocumentFragment();
    NAT.filtered.forEach(n => frag.appendChild(buildRow(n)));
    tbody.appendChild(frag);
  }

  function buildRow(n) {
    const tr = document.createElement('tr');
    if (!n.active) tr.classList.add('row--inactive');

    tr.appendChild(createCell(n.code || '—', 'cell-code'));

    const nameCell = document.createElement('td');
    nameCell.className = 'cell-name';
    if (n.parent_id) {
      const wrap = document.createElement('span');
      wrap.className = 'cell-hierarchy';
      const ind = document.createElement('span');
      ind.className = 'cell-hierarchy__indent';
      ind.innerHTML = CAD.ICONS.indent;
      wrap.appendChild(ind);
      wrap.appendChild(document.createTextNode(n.name));
      nameCell.appendChild(wrap);
    } else {
      nameCell.textContent = n.name;
    }
    tr.appendChild(nameCell);

    const kindCell = document.createElement('td');
    const badge = document.createElement('span');
    const info = CAD.formatKindBadge(n.kind);
    badge.className = 'badge ' + info.modifier;
    badge.textContent = info.label;
    kindCell.appendChild(badge);
    tr.appendChild(kindCell);

    const dreCell = document.createElement('td');
    dreCell.textContent = CAD.DRE_GROUP_LABELS[n.dre_group] || n.dre_group || '—';
    dreCell.className = 'cell--muted';
    tr.appendChild(dreCell);

    const statusCell = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = 'badge ' + (n.active ? 'badge--success' : 'badge--neutral');
    statusBadge.textContent = n.active ? 'Ativo' : 'Inativo';
    statusCell.appendChild(statusBadge);
    tr.appendChild(statusCell);

    tr.appendChild(buildActionsCell(n));

    return tr;
  }

  function buildActionsCell(n) {
    const cell = document.createElement('td');
    cell.className = 'cell--num';
    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    if (CAD.state.perms.edit) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'row-action';
      editBtn.title = 'Editar';
      editBtn.setAttribute('aria-label', 'Editar ' + n.name);
      editBtn.innerHTML = CAD.ICONS.edit;
      editBtn.addEventListener('click', () => openForm(n));
      wrap.appendChild(editBtn);

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'row-action';
      toggleBtn.title = n.active ? 'Desativar' : 'Ativar';
      toggleBtn.setAttribute('aria-label', n.active ? 'Desativar' : 'Ativar');
      toggleBtn.innerHTML = n.active ? CAD.ICONS.toggleOn : CAD.ICONS.toggleOff;
      toggleBtn.addEventListener('click', () => toggleActive(n));
      wrap.appendChild(toggleBtn);
    }

    if (CAD.state.perms.remove) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'row-action row-action--danger';
      delBtn.title = 'Excluir';
      delBtn.setAttribute('aria-label', 'Excluir ' + n.name);
      delBtn.innerHTML = CAD.ICONS.trash;
      delBtn.addEventListener('click', () => confirmDelete(n));
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
    NAT.all.forEach(n => {
      if (isEdit && n.id === record.id) return;
      if (n.parent_id && isEdit && n.parent_id === record.id) return;
      parentOptions.push({
        value: n.id,
        label: (n.code ? n.code + ' · ' : '') + n.name
      });
    });

    const dreOptions = [{ value: '', label: '— Selecione —' }];
    CAD.DRE_GROUP_ORDER.forEach(k => {
      dreOptions.push({ value: k, label: CAD.DRE_GROUP_LABELS[k] });
    });

    CAD.modal.open({
      title: isEdit ? 'Editar natureza' : 'Nova natureza',
      submitLabel: isEdit ? 'Salvar alterações' : 'Criar natureza',
      recordId: isEdit ? record.id : null,
      fields: [
        { name: 'code', label: 'Código', type: 'text', value: record?.code || '', placeholder: '1.01', hint: 'Ex.: 1.01, 3.04 (opcional)' },
        { name: 'name', label: 'Nome', type: 'text', value: record?.name || '', required: true, maxlength: 120 },
        { name: 'kind', label: 'Tipo', type: 'select', value: record?.kind || 'despesa', required: true, options: [
          { value: 'receita', label: 'Receita' },
          { value: 'despesa', label: 'Despesa' },
          { value: 'custo', label: 'Custo' },
          { value: 'imposto', label: 'Imposto' },
          { value: 'financeiro', label: 'Financeiro' }
        ]},
        { name: 'dre_group', label: 'Grupo DRE', type: 'select', value: record?.dre_group || '', options: dreOptions },
        { name: 'parent_id', label: 'Natureza pai', type: 'select', value: record?.parent_id || '', options: parentOptions, full: true, hint: 'Opcional — útil para agrupar naturezas' },
        { name: 'notes', label: 'Observações', type: 'textarea', value: record?.notes || '', maxlength: 500, full: true },
        { name: 'active', label: 'Ativa', type: 'checkbox', value: record ? record.active !== false : true, full: true }
      ],
      onSubmit: async (values, id) => {
        const payload = {
          code: values.code || null,
          name: values.name,
          kind: values.kind,
          dre_group: values.dre_group || null,
          parent_id: values.parent_id || null,
          notes: values.notes || null,
          active: values.active
        };

        if (id) {
          const { error } = await window.db.from('natures').update(payload).eq('id', id);
          if (error) throw error;
          CAD.toast('Natureza atualizada.', 'success');
        } else {
          if (state.orgId) payload.organization_id = state.orgId;
          const { error } = await window.db.from('natures').insert(payload);
          if (error) throw error;
          CAD.toast('Natureza criada.', 'success');
        }

        await fetchAll();
      }
    });
  }

  /* -------------------- Toggle -------------------- */
  async function toggleActive(n) {
    if (!CAD.state.perms.edit) {
      CAD.toast('Sem permissão.', 'error');
      return;
    }
    try {
      const { error } = await window.db
        .from('natures')
        .update({ active: !n.active })
        .eq('id', n.id);
      if (error) throw error;

      n.active = !n.active;
      applyFilters();
      CAD.toast(n.active ? 'Natureza ativada.' : 'Natureza desativada.', 'success');
    } catch (err) {
      console.error('[CAD] toggle natures:', err);
      CAD.toast(CAD.friendlyError(err), 'error');
    }
  }

  /* -------------------- Delete -------------------- */
  function confirmDelete(n) {
    CAD.modal.openConfirm(
      'Excluir a natureza "' + n.name + '"? Se houver lançamentos vinculados, a operação será bloqueada. Prefira desativar.',
      async () => {
        const { error } = await window.db.from('natures').delete().eq('id', n.id);
        if (error) throw error;
        CAD.toast('Natureza excluída.', 'success');
        await fetchAll();
      },
      'Excluir'
    );
  }

  /* -------------------- Bindings -------------------- */
  function setup() {
    const search = document.getElementById('natures-search');
    const kindSel = document.getElementById('natures-kind');
    const statusSel = document.getElementById('natures-status');
    const newBtn = document.getElementById('natures-new');

    if (search) {
      search.addEventListener('input', () => {
        NAT.query = search.value.trim();
        applyFilters();
      });
    }
    if (kindSel) {
      kindSel.addEventListener('change', () => {
        NAT.kind = kindSel.value;
        applyFilters();
      });
    }
    if (statusSel) {
      statusSel.addEventListener('change', () => {
        NAT.status = statusSel.value;
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

  CAD.natures = { setup, fetchAll, applyFilters };
})();