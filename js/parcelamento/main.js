/* =========================================================
   DEV HUB · Parcelamento · main.js
   CRUD das regras de parcelamento (por organização).
   ========================================================= */
(function () {
  'use strict';
  const DH = window.DH || (window.DH = {});

  const state = {
    rules: [],
    editingId: null,
    user: null,
    isAdmin: false
  };

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    if (document.body.dataset.page !== 'config-parcelamento') return;

    const Auth = window.Auth;
    if (!Auth || !Auth.isConfigured() || !window.db) {
      alert('Supabase não configurado.');
      return;
    }

    els.tbody   = document.getElementById('rules-body');
    els.wrap    = document.getElementById('rules-table-wrap');
    els.empty   = document.getElementById('rules-empty');
    els.loading = document.getElementById('rules-loading');
    els.count   = document.getElementById('rules-count');

    els.modal     = document.getElementById('rule-modal');
    els.form      = document.getElementById('rule-form');
    els.title     = document.getElementById('rule-modal-title');
    els.maxValue  = document.getElementById('rule-max-value');
    els.insts     = document.getElementById('rule-installments');
    els.minInst   = document.getElementById('rule-min-installment');
    els.active    = document.getElementById('rule-active');
    els.activeFld = document.getElementById('rule-active-field');
    els.feedback  = document.getElementById('rule-feedback');
    els.saveBtn   = document.getElementById('rule-save-btn');

    document.getElementById('new-rule-btn').addEventListener('click', () => openModal(null));

    els.modal.querySelectorAll('[data-close-rule]').forEach(el =>
      el.addEventListener('click', closeModal)
    );
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !els.modal.hidden) closeModal();
    });

    els.form.addEventListener('submit', onSave);
    els.tbody.addEventListener('click', onTableClick);

    /* Sessão + permissão */
    const session = await Auth.requireSession();
    if (!session) return;
    const profile = await Auth.getProfile(session.user.id);
    state.user = profile || {};
    state.isAdmin = !!(profile && profile.is_platform_admin) ||
      ['admin','administrador','gestor'].includes(
        String((profile && profile.role) || '').toLowerCase()
      );

    if (!state.isAdmin) {
      document.getElementById('new-rule-btn').hidden = true;
      DH.toast && DH.toast('Você não tem permissão para editar parcelamento.', 'error');
    }

    await load();
  }

  /* =========================================================
     CARREGAR REGRAS
     ========================================================= */
  async function load() {
    els.loading.hidden = false;
    els.wrap.hidden = true;
    els.empty.hidden = true;

    try {
      const { data, error } = await window.db
        .from('installment_rules')
        .select('*')
        .eq('active', true)
        .order('max_value', { ascending: true });

      if (error) throw error;

      state.rules = data || [];
      render();
    } catch (e) {
      console.error('[parcelamento] load:', e);
      els.loading.hidden = true;
      els.empty.hidden = false;
      els.empty.querySelector('h3').textContent = 'Erro ao carregar';
      els.empty.querySelector('p').textContent = e.message || 'Tente novamente.';
    }
  }

  function render() {
    els.loading.hidden = true;

    if (state.rules.length === 0) {
      els.wrap.hidden = true;
      els.empty.hidden = false;
      els.count.textContent = 'Nenhuma faixa cadastrada';
      return;
    }

    els.empty.hidden = true;
    els.wrap.hidden = false;
    els.count.textContent = state.rules.length +
      (state.rules.length === 1 ? ' faixa cadastrada' : ' faixas cadastradas');

    const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    els.tbody.innerHTML = state.rules.map(r => `
      <tr data-id="${r.id}">
        <td><strong>${fmt.format(Number(r.max_value) || 0)}</strong></td>
        <td class="cell--num">até <strong>${r.max_installments}x</strong></td>
        <td class="cell--num">${r.min_installment_value ? fmt.format(Number(r.min_installment_value)) : '—'}</td>
        <td><span class="badge badge--success">Ativa</span></td>
        <td class="cell--num">
          <div class="row-actions">
            <button class="row-action" data-action="edit" data-id="${r.id}" title="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
              </svg>
            </button>
            <button class="row-action row-action--danger" data-action="delete" data-id="${r.id}" title="Excluir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  /* =========================================================
     MODAL
     ========================================================= */
  function openModal(rule) {
    state.editingId = rule ? rule.id : null;
    els.form.reset();
    els.feedback.hidden = true;
    els.activeFld.hidden = !rule;

    if (rule) {
      els.title.textContent = 'Editar faixa';
      els.maxValue.value = rule.max_value;
      els.insts.value = rule.max_installments;
      els.minInst.value = rule.min_installment_value || '';
      els.active.checked = !!rule.active;
    } else {
      els.title.textContent = 'Nova faixa';
      els.active.checked = true;
    }

    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => els.maxValue.focus(), 50);
  }

  function closeModal() {
    els.modal.hidden = true;
    document.body.style.overflow = '';
  }

  /* =========================================================
     SALVAR
     ========================================================= */
  async function onSave(e) {
    e.preventDefault();
    els.feedback.hidden = true;

    const maxValue = Number(els.maxValue.value);
    const insts    = Number(els.insts.value);
    const minInst  = els.minInst.value ? Number(els.minInst.value) : null;

    if (!Number.isFinite(maxValue) || maxValue <= 0) {
      return showFb('Informe um valor máximo maior que zero.');
    }
    if (!Number.isInteger(insts) || insts < 1 || insts > 24) {
      return showFb('Parcelas devem ser um número entre 1 e 24.');
    }

    const btn = els.saveBtn;
    btn.disabled = true;
    btn.classList.add('is-loading');

    try {
      if (state.editingId) {
        const { error } = await window.db.rpc('update_installment_rule', {
          p_id: state.editingId,
          p_max_value: maxValue,
          p_max_installments: insts,
          p_min_installment_value: minInst,
          p_active: els.active.checked
        });
        if (error) throw error;
        DH.toast && DH.toast('Faixa atualizada.', 'success');
      } else {
        const { error } = await window.db.rpc('create_installment_rule', {
          p_max_value: maxValue,
          p_max_installments: insts,
          p_min_installment_value: minInst,
          p_sort_order: 0
        });
        if (error) throw error;
        DH.toast && DH.toast('Faixa criada.', 'success');
      }

      closeModal();
      await load();
    } catch (err) {
      console.error('[parcelamento] save:', err);
      showFb(err.message || 'Erro ao salvar.');
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  }

  function showFb(msg) {
    els.feedback.textContent = msg;
    els.feedback.hidden = false;
  }

  /* =========================================================
     AÇÕES DA TABELA
     ========================================================= */
  async function onTableClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const rule = state.rules.find(r => r.id === id);
    if (!rule) return;

    if (btn.dataset.action === 'edit') {
      openModal(rule);
    } else if (btn.dataset.action === 'delete') {
      if (!confirm('Excluir esta faixa de parcelamento?')) return;
      try {
        const { error } = await window.db.rpc('delete_installment_rule', { p_id: id });
        if (error) throw error;
        DH.toast && DH.toast('Faixa excluída.', 'success');
        await load();
      } catch (err) {
        console.error('[parcelamento] delete:', err);
        DH.toast && DH.toast('Erro ao excluir.', 'error');
      }
    }
  }
})();