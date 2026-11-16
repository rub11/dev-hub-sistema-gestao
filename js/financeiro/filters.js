/* =========================================================
   DEV HUB · Financeiro · filters
   ---------------------------------------------------------
   Filtros rápidos + multi-select (accordion) + drawer +
   bind da seção de ações em massa + atalhos de teclado.
   ---------------------------------------------------------
   Depende de: state.js, custom-filters.js, render.js
   Publica em: window.Fin
   ========================================================= */

(function () {
  'use strict';

  const {
    $, $$, escapeHTML,
    state
  } = window.Fin;

  /* =========================================================
     OPÇÕES DOS FILTROS
     ========================================================= */
  function loadFilterOptions() {
    const companyMap = new Map();
    state.entries.forEach((e) => {
      const name = (e.company_name || '').trim();
      if (!name) return;
      companyMap.set(name, (companyMap.get(name) || 0) + 1);
    });

    const natureMap = new Map();
    state.entries.forEach((e) => {
      const name = (e.nature_name || '').trim();
      if (!name) return;
      natureMap.set(name, (natureMap.get(name) || 0) + 1);
    });

    const movCount = new Map();
    state.movements.forEach((m) => {
      movCount.set(m.account_id, (movCount.get(m.account_id) || 0) + 1);
    });
    const accounts = state.accounts.map((a) => ({
      value: a.id,
      label: a.name + (a.bank_name ? ` · ${a.bank_name}` : ''),
      count: movCount.get(a.id) || 0
    })).sort((a, b) => a.label.localeCompare(b.label));

    state.filterOptions.companies = [...companyMap.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => a.label.localeCompare(b.label));

    state.filterOptions.natures = [...natureMap.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => a.label.localeCompare(b.label));

    state.filterOptions.accounts = accounts;

    renderFilterList('companies', 'empresas');
    renderFilterList('natures',   'naturezas');
    renderFilterList('accounts',  'contas');
    updateAccordionCounts();
  }

  function renderFilterList(key, accTarget) {
    const listEl = document.querySelector(`[data-acc-list="${accTarget}"]`);
    if (!listEl) return;

    const options = state.filterOptions[key] || [];
    const selected = new Set(state.filters[key] || []);
    const search = document.querySelector(`[data-acc-search="${accTarget}"]`);
    const term = (search ? search.value : '').trim().toLowerCase();

    const filtered = term
      ? options.filter((o) => o.label.toLowerCase().includes(term))
      : options;

    if (!filtered.length) {
      listEl.innerHTML = `<div class="fin-side__acc-empty">${
        options.length ? 'Nada encontrado.' : 'Nenhuma opção disponível.'
      }</div>`;
      return;
    }

    listEl.innerHTML = filtered.map((opt) => `
      <label class="fin-side__check">
        <input type="checkbox"
               data-filter-key="${key}"
               value="${escapeHTML(opt.value)}"
               ${selected.has(opt.value) ? 'checked' : ''} />
        <span class="fin-side__check-box"></span>
        <span class="fin-side__check-label" title="${escapeHTML(opt.label)}">${escapeHTML(opt.label)}</span>
        <span class="fin-side__check-count">${opt.count}</span>
      </label>
    `).join('');

    listEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const k = cb.dataset.filterKey;
        const v = cb.value;
        const arr = state.filters[k];
        if (cb.checked) {
          if (!arr.includes(v)) arr.push(v);
        } else {
          const i = arr.indexOf(v);
          if (i >= 0) arr.splice(i, 1);
        }
        window.Fin.updateFilterBadge?.();
        updateAccordionCounts();
      });
    });
  }

  function updateAccordionCounts() {
    const map = {
      empresas:  state.filters.companies.length,
      naturezas: state.filters.natures.length,
      contas:    state.filters.accounts.length
    };
    Object.entries(map).forEach(([key, n]) => {
      const el = document.querySelector(`[data-acc-count="${key}"]`);
      if (!el) return;
      el.textContent = String(n);
      el.dataset.empty = n === 0 ? 'true' : 'false';
    });
  }

  /* =========================================================
     BIND · FILTROS + AÇÕES EM MASSA + ATALHOS
     ========================================================= */
  function bindFilters() {
    $$('.fin-side__acc').forEach((acc) => {
      acc.addEventListener('click', () => {
        const target = acc.dataset.target;
        const body = document.getElementById('acc-' + target);
        if (!body) return;
        const isOpen = acc.getAttribute('aria-expanded') === 'true';
        acc.setAttribute('aria-expanded', String(!isOpen));
        body.hidden = isOpen;
      });
    });

    $$('input[data-quick]').forEach((cb) => {
      cb.addEventListener('change', () => {
        state.filters.quick[cb.dataset.quick] = cb.checked;
      });
    });

    const apply = $('#fin-apply');
    if (apply) {
      apply.addEventListener('click', () => {
        state.filters.dueFrom    = $('#f-due-from')    ? $('#f-due-from').value    : '';
        state.filters.dueTo      = $('#f-due-to')      ? $('#f-due-to').value      : '';
        state.filters.issueFrom  = $('#f-issue-from')  ? $('#f-issue-from').value  : '';
        state.filters.issueTo    = $('#f-issue-to')    ? $('#f-issue-to').value    : '';
        state.filters.settleFrom = $('#f-settle-from') ? $('#f-settle-from').value : '';
        state.filters.settleTo   = $('#f-settle-to')   ? $('#f-settle-to').value   : '';
        window.Fin.renderAll?.();
        if (window.FinCloseDrawer) window.FinCloseDrawer();
      });
    }

    const clear = $('#fin-clear-filters');
    if (clear) {
      clear.addEventListener('click', () => {
        ['f-due-from','f-due-to','f-issue-from','f-issue-to','f-settle-from','f-settle-to']
          .forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
        state.filters.dueFrom = state.filters.dueTo = '';
        state.filters.issueFrom = state.filters.issueTo = '';
        state.filters.settleFrom = state.filters.settleTo = '';
        state.filters.companies = [];
        state.filters.natures   = [];
        state.filters.accounts  = [];
        Object.keys(state.filters.quick).forEach(k => state.filters.quick[k] = false);
        $$('input[data-quick]').forEach(cb => cb.checked = false);
        renderFilterList('companies', 'empresas');
        renderFilterList('natures',   'naturezas');
        renderFilterList('accounts',  'contas');
        updateAccordionCounts();
        window.Fin.renderAll?.();
      });
    }

    $$('[data-acc-search]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const target = inp.dataset.accSearch;
        const key = target === 'empresas' ? 'companies'
                  : target === 'naturezas' ? 'natures'
                  : 'accounts';
        renderFilterList(key, target);
      });
    });

    /* ---- Ações em massa da barra superior ---- */
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('.fin-actions [data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const ids = Array.from(state.selected);
      const rows = ids.map((id) => state.entries.find((x) => x.id === id)).filter(Boolean);

      if (action === 'settle') {
        if (rows.length !== 1) { window.Fin.toast?.('Selecione 1 título para baixar.', 'error'); return; }
        if (rows[0].status !== 'pendente') { window.Fin.toast?.('Só é possível baixar títulos pendentes.', 'error'); return; }
        if (window.Fin.isPurchaseBlocked(rows[0])) {
          window.Fin.toast?.('Esta conta só pode ser baixada após a entrega da compra.', 'error');
          return;
        }
        window.Fin.openSettleModal?.(rows[0]);
      }
      if (action === 'reverse') {
        if (rows.length !== 1) { window.Fin.toast?.('Selecione 1 título para estornar.', 'error'); return; }
        if (rows[0].status !== 'baixado') { window.Fin.toast?.('Só é possível estornar títulos baixados.', 'error'); return; }
        window.Fin.openReverseModal?.(rows[0]);
      }
      if (action === 'edit') {
        if (rows.length !== 1) { window.Fin.toast?.('Selecione 1 título.', 'error'); return; }
        window.Fin.openEntryModal?.(rows[0]);
      }
      if (action === 'delete') {
        if (rows.length !== 1) { window.Fin.toast?.('Selecione 1 título.', 'error'); return; }
        if (!confirm('Excluir este título? Esta ação não pode ser desfeita.')) return;
        try {
          const { error } = await window.Fin.db().from('financial_entries')
            .delete().eq('id', rows[0].id);
          if (error) throw error;
          window.Fin.toast?.('Título excluído.', 'success');
          state.selected.clear();
          await window.Fin.loadAll?.();
        } catch (ex) {
          console.error('[fin] falha ao excluir:', ex);
          window.Fin.toast?.(ex.message || 'Erro ao excluir o título.', 'error');
        }
      }
    });

    const newBtn = document.getElementById('fin-new');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        if (state.tab === 'transferencias') { window.Fin.openTransferModal?.(); return; }
        if (state.tab === 'movimentos')     { window.Fin.toast?.('Lançamento de movimentação em breve.', 'error'); return; }
        window.Fin.openEntryModal?.(null);
      });
    }
  }

  /* =========================================================
     ATALHOS
     ========================================================= */
  function bindShortcuts() {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
                  || (e.target && e.target.isContentEditable);
      if (typing) return;

      if (e.key === 'n' || e.key === 'N') {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        const newBtn = document.getElementById('fin-new');
        if (newBtn) newBtn.click();
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        const openBtn = document.getElementById('fin-open-filters');
        if (openBtn) openBtn.click();
      }
    });
  }

  /* =========================================================
     PUBLICA
     ========================================================= */
  Object.assign(window.Fin, {
    loadFilterOptions,
    renderFilterList,
    updateAccordionCounts,
    bindFilters,
    bindShortcuts
  });

})();