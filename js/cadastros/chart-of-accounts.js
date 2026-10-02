/* =========================================================
   DEV HUB · Cadastros · plano de contas
   ========================================================= */
(function () {
  'use strict';
  const CAD = window.CAD;
  const state = CAD.state;
  const COA = state.chartOfAccounts;

  async function fetchAll() {
    COA.loading = true;
    showLoading(true);
    try {
      let query = window.db
        .from('chart_of_accounts')
        .select('id, organization_id, code, name, type, dre_line, parent_id, active, notes, created_at')
        .order('code', { ascending: true })
        .order('name', { ascending: true });

      if (state.orgId) query = query.eq('organization_id', state.orgId);

      const { data, error } = await query;
      if (error) throw error;

      COA.all = data || [];
      applyFilters();
    } catch (err) {
      console.error('[CAD] fetch coa:', err);
      CAD.toast('Não foi possível carregar o plano de contas.', 'error');
      COA.all = [];
      applyFilters();
    } finally {
      COA.loading = false;
      showLoading(false);
    }
  }

  function applyFilters() {
    const q = COA.query.toLowerCase();
    const type = COA.type;
    const status = COA.status;

    COA.filtered = COA.all.filter(c => {
      if (type && c.type !== type) return false;
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
    const total = COA.all.length;
    const shown = COA.filtered.length;
    const label = document.getElementById('coa-count');
    const tabCount = document.getElementById('tab-count-coa');
    if (tabCount) tabCount.textContent = total;

    if (!label) return;
    if (total === 0) { label.textContent = 'Nenhuma conta cadastrada'; return; }
    if (shown === total) {
      label.textContent = total === 1 ? '1 conta' : total + ' contas';
    } else {
      label.textContent = shown + ' de ' + total + ' contas';
    }
  }

  function showLoading(isLoading) {
    const loading = document.getElementById('coa-loading');
    const wrap = document.getElementById('coa-wrap');
    const empty = document.getElementById('coa-empty');
    if (isLoading) {
      if (loading) loading.hidden = false;
      if (wrap) wrap.hidden = true;
      if (empty) empty.hidden = true;
    } else if (loading) {
      loading.hidden = true;
    }
  }

  function render() {
    const tbody = document.getElementById('coa-body');
    const wrap = document.getElementById('coa-wrap');
    const empty = document.getElementById('coa-empty');
    const emptyText = document.getElementById('coa-empty-text');
    if (!tbody || !wrap || !empty) return;

    if (COA.filtered.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      if (emptyText) {
        emptyText.textContent = COA.all.length === 0
          ? 'Nenhuma conta cadastrada ainda. Comece criando a primeira.'
          : 'Nenhum resultado encontrado com os filtros atuais.';
      }
      return;
    }

    empty.hidden = true;
    wrap.hidden = false;
    tbody.innerHTML = '';

    const frag = document.createDocumentFragment();
    COA.filtered.forEach(c => frag.appendChild(buildRow(c)));
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

    const typeCell = document.createElement('td');
    const badge = document.createElement('span');
    const info = CAD.formatCoaTypeBadge(c.type);
    badge.className = 'badge ' + info.modifier;
    badge.textContent = info.label;
    typeCell.appendChild(badge);
    tr.appendChild(typeCell);

    const dreCell = document.createElement('td');
    dreCell.textContent = CAD.DRE_GROUP_LABELS[c.dre_line] || c.dre_line || '—';
    dreCell.className = 'cell--muted';
    tr.appendChild(dreCell);

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
      editBtn.setAttribute('aria-label', 'Editar ' + c.name);
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
    COA.all.forEach(c => {
      if (isEdit && c.id === record.id) return;
      if (c.parent_id && isEdit && c.parent_id === record.id) return;
      parentOptions.push({
        value: c.id,
        label: (c.code ? c.code + ' · ' : '') + c.name
      });
    });

    const dreOptions = [{ value: '', label: '— Nenhuma —' }];
    CAD.COA_DRE_LINE_ORDER.forEach(k => {
      dreOptions.push({ value: k, label: CAD.DRE_GROUP_LABELS[k] });
    });

    CAD.modal.open({
      title: isEdit ? 'Editar conta contábil' : 'Nova conta contábil',
      submitLabel: isEdit ? 'Salvar alterações' : 'Criar conta',
      recordId: isEdit ? record.id : null,
      fields: [
        { name: 'code', label: 'Código', type: 'text', value: record?.code || '', required: true, placeholder: '1.1.1', hint: 'Ex.: 1.1.1.01 (obrigatório)' },
        { name: 'name', label: 'Nome', type: 'text', value: record?.name || '', required: true, maxlength: 150 },
        { name: 'type', label: 'Tipo', type: 'select', value: record?.type || 'despesa', required: true, options: [
          { value: 'ativo', label: 'Ativo' },
          { value: 'passivo', label: 'Passivo' },
          { value: 'patrimonio', label: 'Patrimônio Líquido' },
          { value: 'receita', label: 'Receita' },
          { value: 'despesa', label: 'Despesa' },
          { value: 'custo', label: 'Custo' }
        ]},
        { name: 'dre_line', label: 'Linha DRE', type: 'select', value: record?.dre_line || '', options: dreOptions },
        { name: 'parent_id', label: 'Conta pai', type: 'select', value: record?.parent_id || '', options: parentOptions, full: true, hint: 'Opcional — útil para criar hierarquia de contas' },
        { name: 'notes', label: 'Observações', type: 'textarea', value: record?.notes || '', maxlength: 500, full: true },
        { name: 'active', label: 'Ativa', type: 'checkbox', value: record ? record.active !== false : true, full: true }
      ],
      onSubmit: async (values, id) => {
        const payload = {
          code: values.code,
          name: values.name,
          type: values.type,
          dre_line: values.dre_line || null,
          parent_id: values.parent_id || null,
          notes: values.notes || null,
          active: values.active
        };

        if (id) {
          const { error } = await window.db.from('chart_of_accounts').update(payload).eq('id', id);
          if (error) throw error;
          CAD.toast('Conta atualizada.', 'success');
        } else {
          if (state.orgId) payload.organization_id = state.orgId;
          const { error } = await window.db.from('chart_of_accounts').insert(payload);
          if (error) throw error;
          CAD.toast('Conta criada.', 'success');
        }

        await fetchAll();
      }
    });
  }

  async function toggleActive(c) {
    if (!CAD.state.perms.edit) { CAD.toast('Sem permissão.', 'error'); return; }
    try {
      const { error } = await window.db
        .from('chart_of_accounts')
        .update({ active: !c.active })
        .eq('id', c.id);
      if (error) throw error;

      c.active = !c.active;
      applyFilters();
      CAD.toast(c.active ? 'Conta ativada.' : 'Conta desativada.', 'success');
    } catch (err) {
      console.error('[CAD] toggle coa:', err);
      CAD.toast(CAD.friendlyError(err), 'error');
    }
  }

  function confirmDelete(c) {
    CAD.modal.openConfirm(
      'Excluir a conta "' + c.name + '"? Se houver vínculos, a operação será bloqueada. Prefira desativar.',
      async () => {
        const { error } = await window.db.from('chart_of_accounts').delete().eq('id', c.id);
        if (error) throw error;
        CAD.toast('Conta excluída.', 'success');
        await fetchAll();
      },
      'Excluir'
    );
  }

  function setup() {
    const search = document.getElementById('coa-search');
    const typeSel = document.getElementById('coa-type');
    const statusSel = document.getElementById('coa-status');
    const newBtn = document.getElementById('coa-new');

    if (search) search.addEventListener('input', () => { COA.query = search.value.trim(); applyFilters(); });
    if (typeSel) typeSel.addEventListener('change', () => { COA.type = typeSel.value; applyFilters(); });
    if (statusSel) statusSel.addEventListener('change', () => { COA.status = statusSel.value; applyFilters(); });
    if (newBtn) newBtn.addEventListener('click', () => {
      if (!CAD.state.perms.create) { CAD.toast('Sem permissão para criar.', 'error'); return; }
      openForm(null);
    });
  }

  CAD.chartOfAccounts = { setup, fetchAll, applyFilters };
})();