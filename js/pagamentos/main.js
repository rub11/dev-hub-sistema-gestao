/* =========================================================
   DEV HUB · Pagamentos · main.js
   CRUD das formas de pagamento configuradas pelo gestor.
   ========================================================= */
(function () {
  'use strict';
  const DH = window.DH = window.DH || {};

  const state = { list: [], editingId: null, isAdmin: false };
  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    if (document.body.dataset.page !== 'config-pagamentos') return;

    const Auth = window.Auth;
    if (!Auth || !Auth.isConfigured() || !window.db) return;

    els.tbody      = document.getElementById('methods-body');
    els.wrap       = document.getElementById('methods-table-wrap');
    els.empty      = document.getElementById('methods-empty');
    els.loading    = document.getElementById('methods-loading');
    els.count      = document.getElementById('methods-count');
    els.seedBtn    = document.getElementById('seed-btn');
    els.newBtn     = document.getElementById('new-method-btn');

    els.modal       = document.getElementById('method-modal');
    els.form        = document.getElementById('method-form');
    els.title       = document.getElementById('method-modal-title');
    els.code        = document.getElementById('m-code');
    els.category    = document.getElementById('m-category');
    els.label       = document.getElementById('m-label');
    els.discType    = document.getElementById('m-discount-type');
    els.discAmount  = document.getElementById('m-discount-amount');
    els.notes       = document.getElementById('m-notes');
    els.active      = document.getElementById('m-active');
    els.requiresApr = document.getElementById('m-requires-approval');
    els.feedback    = document.getElementById('method-feedback');
    els.saveBtn     = document.getElementById('method-save-btn');

    els.newBtn.addEventListener('click', () => openModal(null));
    els.seedBtn.addEventListener('click', seed);
    els.modal.querySelectorAll('[data-close-method]').forEach(el =>
      el.addEventListener('click', closeModal));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !els.modal.hidden) closeModal();
    });
    els.form.addEventListener('submit', onSave);
    els.tbody.addEventListener('click', onTableClick);

    const session = await Auth.requireSession();
    if (!session) return;
    const profile = await Auth.getProfile(session.user.id);

    state.isAdmin = !!(profile && profile.is_platform_admin) ||
      ['admin','administrador','gestor'].includes(
        String((profile && profile.role) || '').toLowerCase()
      );

    if (!state.isAdmin) {
      els.newBtn.hidden = true;
      els.seedBtn.hidden = true;
    }

    await load();
  }

  async function load() {
    els.loading.hidden = false;
    els.wrap.hidden    = true;
    els.empty.hidden   = true;

    try {
      const { data, error } = await window.db
        .from('payment_methods')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true });

      if (error) throw error;
      state.list = data || [];
      render();
    } catch (e) {
      console.error('[pagamentos] load:', e);
      els.loading.hidden = true;
      els.empty.hidden = false;
      els.empty.querySelector('h3').textContent = 'Erro ao carregar';
      els.empty.querySelector('p').textContent = e.message || '';
    }
  }

  async function seed() {
    if (!confirm('Restaurar as formas padrão?')) return;
    try {
      const { error } = await window.db.rpc('seed_payment_methods');
      if (error) throw error;
      DH.toast && DH.toast('Formas padrão restauradas.', 'success');
      await load();
    } catch (e) {
      DH.toast && DH.toast('Erro: ' + e.message, 'error');
    }
  }

  function render() {
    els.loading.hidden = true;

    if (state.list.length === 0) {
      els.wrap.hidden  = true;
      els.empty.hidden = false;
      els.count.textContent = 'Nenhuma forma';
      return;
    }

    els.empty.hidden = true;
    els.wrap.hidden  = false;
    els.count.textContent = state.list.length +
      (state.list.length === 1 ? ' forma' : ' formas');

    const catLabels = {
      cash:'Dinheiro', pix:'Pix', debit:'Débito', credit:'Crédito',
      check:'Cheque', voucher:'Vale', transfer:'Transferência', other:'Outro'
    };

    els.tbody.innerHTML = state.list.map(m => {
      const disc = m.discount_type === 'value'
        ? 'R$ ' + Number(m.discount_amount).toFixed(2).replace('.', ',')
        : m.discount_type === 'percent'
          ? Number(m.discount_amount) + '%'
          : '—';
      const needsApr = m.requires_approval
        ? '<span class="badge badge--warning">Sim</span>'
        : '<span class="badge badge--muted">Não</span>';
      const status = m.active
        ? '<span class="badge badge--success">Ativa</span>'
        : '<span class="badge badge--muted">Inativa</span>';

      return `
        <tr data-id="${m.id}">
          <td>
            <strong>${esc(m.label)}</strong>
            <div style="font-size:11px;color:var(--text-muted)">${esc(m.code)}</div>
          </td>
          <td>${catLabels[m.category] || m.category}</td>
          <td>${disc}</td>
          <td>${needsApr}</td>
          <td>${status}</td>
          <td class="cell--num">
            <div class="row-actions">
              <button class="row-action" data-action="edit" data-id="${m.id}" title="Editar">✎</button>
              <button class="row-action row-action--danger" data-action="delete" data-id="${m.id}" title="Excluir">🗑</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function openModal(method) {
    state.editingId = method ? method.id : null;
    els.form.reset();
    els.feedback.hidden = true;

    if (method) {
      els.title.textContent = 'Editar forma';
      els.code.value = method.code;
      els.code.readOnly = true;
      els.code.style.opacity = '0.6';
      els.label.value = method.label;
      els.category.value = method.category || 'other';
      els.discType.value = method.discount_type || 'none';
      els.discAmount.value = method.discount_amount || 0;
      els.notes.value = method.notes || '';
      els.active.checked = !!method.active;
      els.requiresApr.checked = !!method.requires_approval;
    } else {
      els.title.textContent = 'Nova forma';
      els.code.readOnly = false;
      els.code.style.opacity = '';
      els.active.checked = true;
      els.requiresApr.checked = false;
    }

    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => els.label.focus(), 50);
  }

  function closeModal() {
    els.modal.hidden = true;
    document.body.style.overflow = '';
  }

  async function onSave(e) {
    e.preventDefault();
    els.feedback.hidden = true;

    const label = (els.label.value || '').trim();
    const code  = (els.code.value || '').trim().toLowerCase();
    if (!label) return showFb('Informe o nome.');
    if (!state.editingId && !code) return showFb('Informe o código.');
    if (!state.editingId && !/^[a-z0-9_]+$/.test(code))
      return showFb('Código deve ser minúsculas, números e _.');

    const dt = els.discType.value;
    const da = Number(els.discAmount.value) || 0;
    if (dt === 'percent' && (da < 0 || da > 100))
      return showFb('Percentual entre 0 e 100.');

    els.saveBtn.disabled = true;
    els.saveBtn.classList.add('is-loading');

    try {
      const { error } = await window.db.rpc('upsert_payment_method', {
        p_id: state.editingId,
        p_code: code,
        p_label: label,
        p_category: els.category.value,
        p_active: els.active.checked,
        p_discount_type: dt,
        p_discount_amount: da,
        p_requires_approval: els.requiresApr.checked,
        p_allow_partial: true,
        p_notes: els.notes.value.trim(),
        p_sort_order: 0
      });
      if (error) throw error;

      closeModal();
      await load();
      DH.toast && DH.toast('Forma salva.', 'success');
    } catch (err) {
      const msg = String(err.message || '').toLowerCase();
      showFb(msg.includes('duplicate') || msg.includes('unique')
        ? 'Já existe uma forma com esse código.'
        : (err.message || 'Erro ao salvar.'));
    } finally {
      els.saveBtn.disabled = false;
      els.saveBtn.classList.remove('is-loading');
    }
  }

  function showFb(msg) {
    els.feedback.textContent = msg;
    els.feedback.hidden = false;
  }

  async function onTableClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const m = state.list.find(x => x.id === id);
    if (!m) return;

    if (btn.dataset.action === 'edit') {
      openModal(m);
    } else if (btn.dataset.action === 'delete') {
      if (!confirm(`Excluir "${m.label}"?`)) return;
      try {
        const { error } = await window.db.rpc('delete_payment_method', { p_id: id });
        if (error) throw error;
        await load();
        DH.toast && DH.toast('Forma excluída.', 'success');
      } catch (err) {
        DH.toast && DH.toast('Erro: ' + err.message, 'error');
      }
    }
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }
})();