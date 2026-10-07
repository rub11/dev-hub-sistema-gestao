(function () {
  'use strict';
  const DH = window.DH;
  const { utils } = DH;
  const els = {};

  function setup() {
    els.modal = document.getElementById('audit-modal');
    els.body  = document.getElementById('audit-body');
    if (!els.modal) return;

    els.modal.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', close);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !els.modal.hidden) close();
    });
  }

  async function open(sale) {
    els.body.innerHTML =
      '<div class="state-block"><span class="spinner" aria-hidden="true"></span>' +
      '<p>Carregando histórico...</p></div>';
    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';

    const { data, error } = await window.db
      .from('sale_audit').select('*').eq('sale_id', sale.id)
      .order('created_at', { ascending: false });

    if (error) {
      els.body.innerHTML =
        '<div class="state-block"><p>Não foi possível carregar o histórico.</p></div>';
      return;
    }
    render(data || []);
  }

  function close() {
    els.modal.hidden = true;
    document.body.style.overflow = '';
  }

  function actionLabel(action) {
    if (action === 'created')     return 'Venda criada';
    if (action === 'updated')     return 'Venda alterada';
    if (action === 'deleted')     return 'Venda excluída';
    if (action === 'corrected')   return 'Venda corrigida';
    if (action === 'approved')    return 'Venda aprovada';
    if (action === 'rejected')    return 'Venda rejeitada';
    if (action === 'created_from_correction') return 'Criada por correção';
    return action;
  }

  function formatChanges(changes) {
    if (!changes || typeof changes !== 'object') return '';
    const lines = [];
    Object.keys(changes).forEach(k => {
      const c = changes[k];
      if (c && typeof c === 'object' && ('from' in c || 'to' in c)) {
        const from = c.from === null || c.from === undefined ? '—' : String(c.from);
        const to   = c.to   === null || c.to   === undefined ? '—' : String(c.to);
        if (from !== to) lines.push(k + ': ' + from + ' → ' + to);
      }
    });
    return lines.length === 0 ? '(sem alterações de cabeçalho)' : lines.join('\n');
  }

  function render(rows) {
    els.body.innerHTML = '';
    if (rows.length === 0) {
      els.body.innerHTML = '<div class="state-block"><p>Nenhuma alteração registrada.</p></div>';
      return;
    }

    const list = document.createElement('div');
    list.className = 'audit-list';

    rows.forEach(a => {
      const wrap = document.createElement('div');
      wrap.className = 'audit-item';

      const head = document.createElement('div');
      head.className = 'audit-item__head';

      const act = document.createElement('span');
      act.className = 'audit-item__action';
      act.textContent = actionLabel(a.action);

      const when = document.createElement('span');
      when.className = 'audit-item__when';
      when.textContent = utils.formatDateTime(a.created_at);

      head.appendChild(act);
      head.appendChild(when);

      const who = document.createElement('p');
      who.className = 'audit-item__who';
      who.textContent = 'Por ' + (a.actor_name || a.actor_email || '—');

      wrap.appendChild(head);
      wrap.appendChild(who);

      if (a.changes && typeof a.changes === 'object') {
        const diff = document.createElement('div');
        diff.className = 'audit-item__diff';
        diff.textContent = formatChanges(a.changes);
        wrap.appendChild(diff);
      }
      list.appendChild(wrap);
    });

    els.body.appendChild(list);
  }

  DH.modalAudit = { setup, open, close };
})();