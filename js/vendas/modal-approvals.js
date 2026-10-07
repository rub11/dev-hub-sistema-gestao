/* =========================================================
   DEV HUB · Vendas · modal-approvals.js
   Só cuida do badge de contagem + redireciona pra /aprovacoes.html
   ========================================================= */
(function () {
  'use strict';
  const DH = window.DH;
  const { state } = DH;
  const els = {};

  function setup() {
    els.btn   = document.getElementById('approvals-btn');
    els.count = document.getElementById('approvals-count');
    if (!els.btn) return;

    els.btn.addEventListener('click', () => {
      window.location.href = 'aprovacoes.html';
    });
  }

  function applyPermsToUI() {
    if (!els.btn) return;
    els.btn.hidden = !state.perms.approve;
  }

  async function refreshCount() {
    if (!state.perms.approve) return 0;
    try {
      const { count, error } = await window.db
        .from('sales')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_approval');
      if (error) throw error;
      const n = count || 0;
      if (els.count) {
        if (n > 0) { els.count.textContent = String(n); els.count.hidden = false; }
        else { els.count.hidden = true; }
      }
      return n;
    } catch (e) {
      console.warn('[DEV HUB] refreshCount:', e);
      return 0;
    }
  }

  DH.modalApprovals = { setup, applyPermsToUI, refreshCount };
})();