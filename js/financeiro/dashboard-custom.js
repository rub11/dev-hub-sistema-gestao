(function () {
  'use strict';

  const { state, escapeHTML, fmtBRL, fmtDate } = window.Fin;

  const DEFAULT_ORDER = [
    'saldo-disp', 'receber', 'pagar', 'resultado', 'hoje', 'inadimplencia',
    'receber-total', 'pagar-total', 'vencendo-hoje', 'vencido', 'saldo-previsto'
  ];

  const LABELS = {
    'saldo-disp': 'Saldo Disponível',
    'receber': 'Receitas do Mês',
    'pagar': 'Despesas do Mês',
    'resultado': 'Resultado Líquido',
    'hoje': 'Contas Próximas',
    'inadimplencia': 'Inadimplência',
    'receber-total': 'A Receber (Total)',
    'pagar-total': 'A Pagar (Total)',
    'vencendo-hoje': 'Vencendo Hoje',
    'vencido': 'Total Vencido',
    'saldo-previsto': 'Saldo Previsto'
  };

  function getPrefs() {
    try {
      const saved = localStorage.getItem('devhub_fin_prefs');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { order: DEFAULT_ORDER, hidden: [], compact: false };
  }

  function savePrefs(prefs) {
    localStorage.setItem('devhub_fin_prefs', JSON.stringify(prefs));
  }

  function initSortable() {
    const el = document.getElementById('fin-overview');
    if (!el || !window.Sortable) return;

    new Sortable(el, {
      animation: 250,
      ghostClass: 'fin-kpi--ghost',
      dragClass: 'fin-kpi--drag',
      onEnd: function () {
        const order = Array.from(el.children)
          .filter(child => child.classList.contains('fin-kpi'))
          .map(child => child.dataset.id);
        
        const prefs = getPrefs();
        prefs.order = order;
        savePrefs(prefs);
        window.Fin.toast?.('Ordem dos cartões atualizada!', 'success');
      }
    });
  }

  function setupModal() {
    const modal = document.getElementById('fin-customize-modal');
    const btn = document.getElementById('fin-customize-btn');
    const list = document.getElementById('fin-customize-list');
    const compactToggle = document.getElementById('fin-compact-mode');
    const saveBtn = document.getElementById('fin-customize-save');

    if (!modal || !btn) return;

    btn.addEventListener('click', () => {
      const prefs = getPrefs();
      compactToggle.checked = prefs.compact;

      list.innerHTML = DEFAULT_ORDER.map(id => {
        const isVisible = !prefs.hidden.includes(id);
        return `
          <label class="fin-side__switch" style="padding:8px 12px; border:1px solid var(--border); border-radius:8px;">
            <input type="checkbox" class="card-toggle" data-id="${id}" ${isVisible ? 'checked' : ''} />
            <span class="fin-side__switch-track"></span>
            <span class="fin-side__switch-label">${LABELS[id]}</span>
          </label>
        `;
      }).join('');

      modal.hidden = false;
    });

    modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => modal.hidden = true));

    saveBtn.addEventListener('click', () => {
      const prefs = getPrefs();
      prefs.hidden = [];
      prefs.compact = compactToggle.checked;

      modal.querySelectorAll('.card-toggle').forEach(toggle => {
        if (!toggle.checked) prefs.hidden.push(toggle.dataset.id);
      });

      savePrefs(prefs);
      modal.hidden = true;
      applyPreferences();
      window.Fin.toast?.('Preferências salvas!', 'success');
    });
  }

  function applyPreferences() {
    const prefs = getPrefs();
    document.body.classList.toggle('compact-dashboard', prefs.compact);

    const container = document.getElementById('fin-overview');
    if (!container) return;

    prefs.order.forEach(id => {
      const card = container.querySelector(`[data-id="${id}"]`);
      if (card) container.appendChild(card);
    });

    container.querySelectorAll('.fin-kpi').forEach(card => {
      const id = card.dataset.id;
      card.style.display = prefs.hidden.includes(id) ? 'none' : '';
    });
  }

  function renderActivities() {
    const wrap = document.getElementById('fin-recent-activities');
    if (!wrap || !state.entries) return;

    const recent = state.entries
      .slice()
      .sort((a, b) => new Date(b.created_at || b.due_date) - new Date(a.created_at || a.due_date))
      .slice(0, 5);

    if (!recent.length) {
      wrap.innerHTML = '<span style="font-size:12px; color:var(--text-muted);">Nenhuma atividade recente.</span>';
      return;
    }

    wrap.innerHTML = recent.map(e => {
      const isReceita = e.kind === 'receita';
      const color = isReceita ? 'var(--success)' : 'var(--danger)';
      const icon = isReceita 
        ? '<path d="M12 19V5M5 12l7-7 7 7"/>' 
        : '<path d="M12 5v14M19 12l-7 7-7-7"/>';
      
      return `
        <div style="display:flex; align-items:flex-start; gap:12px; padding-bottom:12px; border-bottom:1px solid var(--border);">
          <div style="width:28px; height:28px; border-radius:6px; background:${color}15; color:${color}; display:grid; place-items:center; flex:none;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;">${icon}</svg>
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:12.5px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(e.title_code || e.doc_number || 'Sem título')}</div>
            <div style="font-size:11.5px; color:var(--text-muted);">${escapeHTML(e.partner_name || 'Sem parceiro')} · ${fmtDate(e.due_date)}</div>
          </div>
          <div style="font-size:12.5px; font-weight:600; color:${color};">${fmtBRL(e.amount_cents)}</div>
        </div>
      `;
    }).join('');
  }

  function init() {
    setupModal();
    
    const observer = new MutationObserver((mutations, obs) => {
      const container = document.getElementById('fin-overview');
      if (container && container.querySelector('.fin-kpi')) {
        initSortable();
        applyPreferences();
        renderActivities();
        obs.disconnect();
      }
    });

    const container = document.getElementById('fin-overview');
    if (container) {
      observer.observe(container, { childList: true });
    }

    const refreshBtn = document.getElementById('fin-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        setTimeout(renderActivities, 1000);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();