(function () {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  const movementId = urlParams.get('id');

  if (!movementId) {
    window.location.href = 'estoque.html';
    return;
  }

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const Auth = window.Auth;
    if (!Auth || !Auth.isConfigured() || !window.db) return;
    const session = await Auth.requireSession();
    if (!session) return;

    try {
      const { data: movement, error: mErr } = await window.db
        .from('stock_movements')
        .select('*')
        .eq('id', movementId)
        .single();

      if (mErr || !movement) throw new Error('Movimentação não encontrada.');

      let productName = '(Produto removido)';
      if (movement.product_id) {
        const { data: prod } = await window.db.from('products').select('name').eq('id', movement.product_id).maybeSingle();
        if (prod) productName = prod.name;
      }

      renderMovementInfo(movement, productName);

      if (movement.document && movement.document.startsWith('COMP-')) {
        await loadPurchaseOrigin(movement.document);
      } else if (movement.category === 'ajuste_manual') {
        document.getElementById('origem-content').innerHTML = `
          <div class="mov-prop-item" style="border-bottom:none; padding-top: 10px;">
            <dt class="mov-prop-label">Ajuste Manual</dt>
            <dd class="mov-prop-value mov-reason-box" style="text-align:center;">
              Esta movimentação foi gerada por um ajuste manual no estoque.
            </dd>
          </div>
        `;
      }

      document.getElementById('loading-msg').hidden = true;
      document.getElementById('mov-content').hidden = false;

    } catch (err) {
      console.error(err);
      document.getElementById('loading-msg').textContent = 'Erro ao carregar movimentação: ' + err.message;
      document.getElementById('loading-msg').style.color = 'var(--danger)';
    }
  }

  function renderMovementInfo(m, productName) {
    const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
    
    document.getElementById('mov-prod-name').textContent = productName;
    document.getElementById('mov-type').innerHTML = `<span class="badge ${m.type === 'entrada' ? 'badge--success' : 'badge--danger'}">${m.type.toUpperCase()}</span>`;
    document.getElementById('mov-qty').textContent = (m.type === 'entrada' ? '+' : '-') + m.quantity;
    document.getElementById('mov-prev').textContent = m.previous_stock;
    document.getElementById('mov-new').textContent = m.new_stock;
    document.getElementById('mov-date').textContent = dateFormatter.format(new Date(m.created_at));
    document.getElementById('mov-user').textContent = m.created_by_name || m.user_name || 'Sistema';
    document.getElementById('mov-category').textContent = m.category || '—';
    document.getElementById('mov-reason').textContent = m.reason || 'Sem motivo informado.';
  }

  async function loadPurchaseOrigin(purchaseCode) {
    const box = document.getElementById('origem-content');
    box.innerHTML = '<div class="cmp-loading">Buscando dados da compra...</div>';

    try {
      const { data: purchase, error } = await window.db
        .from('purchases')
        .select('*')
        .eq('code', purchaseCode)
        .single();

      if (error || !purchase) throw new Error('Compra não encontrada.');

      const { data: items } = await window.db
        .from('purchase_items')
        .select('description, quantity, unit, unit_price_cents, total_cents')
        .eq('purchase_id', purchase.id);

      const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

      box.innerHTML = `
        <dl class="mov-props">
          <div class="mov-prop-item">
            <dt class="mov-prop-label">Documento Vinculado</dt>
            <dd class="mov-prop-value highlight" style="display:flex; align-items:center; gap: 8px;">
              ${purchase.code}
              <span class="badge badge--success" style="font-size:10px;">Confirmado</span>
            </dd>
          </div>
          <div class="mov-prop-item">
            <dt class="mov-prop-label">Fornecedor</dt>
            <dd class="mov-prop-value">${purchase.supplier_name || '—'}</dd>
          </div>
          <div class="mov-prop-item">
            <dt class="mov-prop-label">Data da Compra</dt>
            <dd class="mov-prop-value">${dateFormatter.format(new Date(purchase.purchase_date))}</dd>
          </div>
          <div class="mov-prop-item">
            <dt class="mov-prop-label">Recebido em</dt>
            <dd class="mov-prop-value">${purchase.received_at ? dateFormatter.format(new Date(purchase.received_at)) : '—'}</dd>
          </div>
          <div class="mov-prop-item">
            <dt class="mov-prop-label">Valor Total</dt>
            <dd class="mov-prop-value" style="color: var(--accent); font-weight: 700;">R$ ${(purchase.total_cents / 100).toFixed(2).replace('.', ',')}</dd>
          </div>
        </dl>

        <div class="origem-table-wrap">
          <div class="origem-table-title">Itens desta Compra</div>
          <table class="origem-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="text-center">Qtd</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(items || []).map(it => `
                <tr>
                  <td>${it.description}</td>
                  <td class="text-center">${it.quantity} ${it.unit}</td>
                  <td class="text-right">R$ ${(it.total_cents / 100).toFixed(2).replace('.', ',')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      console.error(err);
      box.innerHTML = `
        <p style="color: var(--danger); font-size: 13px; text-align:center; padding: 20px 0;">
          Documento de origem (${purchaseCode}) não encontrado.
        </p>
      `;
    }
  }
})();