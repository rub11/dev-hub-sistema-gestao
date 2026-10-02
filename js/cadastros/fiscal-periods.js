/* =========================================================
   DEV HUB · Cadastros · períodos fiscais
   ========================================================= */
(function () {
  'use strict';
  const CAD = window.CAD;
  const state = CAD.state;
  const FP = state.fiscalPeriods;

  async function fetchAll() {
    FP.loading = true;
    showLoading(true);
    try {
      let query = window.db
        .from('fiscal_periods')
        .select('id, organization_id, year, month, status, closed_at, closed_by, closed_by_name, notes, created_at')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (state.orgId) query = query.eq('organization_id', state.orgId);

      const { data, error } = await query;
      if (error) throw error;

      FP.all = data || [];
      buildYearOptions();
      applyFilters();
    } catch (err) {
      console.error('[CAD] fetch fiscal_periods:', err);
      CAD.toast('Não foi possível carregar os períodos.', 'error');
      FP.all = [];
      applyFilters();
    } finally {
      FP.loading = false;
      showLoading(false);
    }
  }

  function buildYearOptions() {
    const sel = document.getElementById('fp-year');
    if (!sel) return;
    const years = Array.from(new Set(FP.all.map(p => p.year))).sort((a, b) => b - a);

    const current = sel.value;
    sel.innerHTML = '<option value="">Todos os anos</option>';
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      sel.appendChild(opt);
    });
    sel.value = current || '';
  }

  function applyFilters() {
    const year = FP.year;
    const status = FP.status;

    FP.filtered = FP.all.filter(p => {
      if (year && String(p.year) !== String(year)) return false;
      if (status && String(p.status).toLowerCase() !== status) return false;
      return true;
    });

    render();
    updateCount();
  }

  function updateCount() {
    const total = FP.all.length;
    const shown = FP.filtered.length;
    const label = document.getElementById('fp-count');
    const tabCount = document.getElementById('tab-count-fp');
    if (tabCount) tabCount.textContent = total;

    if (!label) return;
    if (total === 0) { label.textContent = 'Nenhum período cadastrado'; return; }
    if (shown === total) {
      label.textContent = total === 1 ? '1 período' : total + ' períodos';
    } else {
      label.textContent = shown + ' de ' + total + ' períodos';
    }
  }

  function showLoading(isLoading) {
    const loading = document.getElementById('fp-loading');
    const wrap = document.getElementById('fp-wrap');
    const empty = document.getElementById('fp-empty');
    if (isLoading) {
      if (loading) loading.hidden = false;
      if (wrap) wrap.hidden = true;
      if (empty) empty.hidden = true;
    } else if (loading) {
      loading.hidden = true;
    }
  }

  function render() {
    const tbody = document.getElementById('fp-body');
    const wrap = document.getElementById('fp-wrap');
    const empty = document.getElementById('fp-empty');
    const emptyText = document.getElementById('fp-empty-text');
    if (!tbody || !wrap || !empty) return;

    if (FP.filtered.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      if (emptyText) {
        emptyText.textContent = FP.all.length === 0
          ? 'Nenhum período cadastrado ainda. Comece criando o mês atual.'
          : 'Nenhum resultado encontrado com os filtros atuais.';
      }
      return;
    }

    empty.hidden = true;
    wrap.hidden = false;
    tbody.innerHTML = '';

    const frag = document.createDocumentFragment();
    FP.filtered.forEach(p => frag.appendChild(buildRow(p)));
    tbody.appendChild(frag);
  }

  function buildRow(p) {
    const tr = document.createElement('tr');

    tr.appendChild(createCell(String(p.year), 'cell-code'));
    tr.appendChild(createCell(CAD.MONTH_NAMES[p.month - 1] || ('Mês ' + p.month), 'cell-name'));

    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    const info = CAD.fpStatusInfo(p.status);
    badge.className = 'badge ' + info.modifier;
    badge.textContent = info.label;
    statusCell.appendChild(badge);
    tr.appendChild(statusCell);

    tr.appendChild(createCell(p.closed_at ? formatDateTime(p.closed_at) : '—', 'cell--muted'));
    tr.appendChild(createCell(p.closed_by_name || '—', 'cell--muted'));

    tr.appendChild(buildActionsCell(p));
    return tr;
  }

  function buildActionsCell(p) {
    const cell = document.createElement('td');
    cell.className = 'cell--num';
    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    const isClosed = String(p.status).toLowerCase() === 'fechado';

    if (CAD.state.perms.edit) {
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'row-action';
      toggleBtn.title = isClosed ? 'Reabrir período' : 'Fechar período';
      toggleBtn.innerHTML = isClosed ? CAD.ICONS.unlock : CAD.ICONS.lock;
      toggleBtn.addEventListener('click', () => toggleStatus(p, isClosed));
      wrap.appendChild(toggleBtn);
    }

    if (CAD.state.perms.remove) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'row-action row-action--danger';
      delBtn.title = 'Excluir período';
      delBtn.innerHTML = CAD.ICONS.trash;
      delBtn.addEventListener('click', () => confirmDelete(p));
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

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  /* -------------------- Form (novo período) -------------------- */
  function openForm() {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const yearOptions = [];
    for (let y = currentYear + 1; y >= currentYear - 5; y--) {
      yearOptions.push({ value: y, label: String(y) });
    }

    const monthOptions = CAD.MONTH_NAMES.map((n, i) => ({ value: i + 1, label: n }));

    CAD.modal.open({
      title: 'Novo período fiscal',
      submitLabel: 'Criar período',
      fields: [
        { name: 'year', label: 'Ano', type: 'select', value: currentYear, required: true, options: yearOptions },
        { name: 'month', label: 'Mês', type: 'select', value: currentMonth, required: true, options: monthOptions }
      ],
      onSubmit: async (values) => {
        const payload = {
          year: Number(values.year),
          month: Number(values.month),
          status: 'aberto'
        };
        if (state.orgId) payload.organization_id = state.orgId;

        const { error } = await window.db.from('fiscal_periods').insert(payload);
        if (error) {
          if (String(error.code) === '23505') {
            throw new Error('Este período já existe.');
          }
          throw error;
        }
        CAD.toast('Período criado.', 'success');
        await fetchAll();
      }
    });
  }

  /* -------------------- Toggle fechar/reabrir -------------------- */
  async function toggleStatus(p, isClosed) {
    if (!CAD.state.perms.edit) { CAD.toast('Sem permissão.', 'error'); return; }

    const action = isClosed ? 'reabrir' : 'fechar';
    const monthName = CAD.MONTH_NAMES[p.month - 1] || ('Mês ' + p.month);

    CAD.modal.openConfirm(
      'Deseja ' + action + ' o período ' + monthName + '/' + p.year + '?',
      async () => {
        let payload;
        if (isClosed) {
          payload = { status: 'aberto', closed_at: null, closed_by: null, closed_by_name: null };
        } else {
          payload = {
            status: 'fechado',
            closed_at: new Date().toISOString(),
            closed_by_name: 'Admin'
          };
        }

        const { error } = await window.db
          .from('fiscal_periods')
          .update(payload)
          .eq('id', p.id);
        if (error) throw error;

        CAD.toast('Período ' + (isClosed ? 'reaberto' : 'fechado') + '.', 'success');
        await fetchAll();
      },
      isClosed ? 'Reabrir' : 'Fechar'
    );
  }

  /* -------------------- Delete -------------------- */
  function confirmDelete(p) {
    const monthName = CAD.MONTH_NAMES[p.month - 1] || ('Mês ' + p.month);
    CAD.modal.openConfirm(
      'Excluir o período ' + monthName + '/' + p.year + '? Isso remove o controle de fechamento deste mês.',
      async () => {
        const { error } = await window.db.from('fiscal_periods').delete().eq('id', p.id);
        if (error) throw error;
        CAD.toast('Período excluído.', 'success');
        await fetchAll();
      },
      'Excluir'
    );
  }

  function setup() {
    const yearSel = document.getElementById('fp-year');
    const statusSel = document.getElementById('fp-status');
    const newBtn = document.getElementById('fp-new');

    if (yearSel) yearSel.addEventListener('change', () => { FP.year = yearSel.value; applyFilters(); });
    if (statusSel) statusSel.addEventListener('change', () => { FP.status = statusSel.value; applyFilters(); });
    if (newBtn) newBtn.addEventListener('click', () => {
      if (!CAD.state.perms.create) { CAD.toast('Sem permissão para criar.', 'error'); return; }
      openForm();
    });
  }

  CAD.fiscalPeriods = { setup, fetchAll, applyFilters };
})();