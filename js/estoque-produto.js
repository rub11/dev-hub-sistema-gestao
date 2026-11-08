(function () {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  if (!productId) {
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
      const { data: product, error: pErr } = await window.db
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (pErr || !product) throw new Error('Produto não encontrado.');

      renderProductInfo(product);

      const { data: movements, error: mErr } = await window.db
        .from('stock_movements')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (mErr) throw mErr;

      renderHistory(movements || []);

      document.getElementById('loading-msg').hidden = true;
      document.getElementById('prod-content').hidden = false;

    } catch (err) {
      console.error(err);
      document.getElementById('loading-msg').textContent = 'Erro ao carregar produto: ' + err.message;
      document.getElementById('loading-msg').style.color = 'var(--danger)';
    }
  }

  function renderProductInfo(product) {
    document.getElementById('prod-name').textContent = product.name || 'Produto sem nome';
    document.getElementById('prod-code').textContent = product.code ? 'SKU: ' + product.code : 'Sem código';
    document.getElementById('prod-stock').textContent = product.stock || 0;
    document.getElementById('prod-min-stock').textContent = product.minimum_stock || 0;

    const statusEl = document.getElementById('prod-status');
    if (product.stock === 0) {
      statusEl.innerHTML = '<span class="badge badge--danger">Sem estoque</span>';
    } else if (product.stock <= product.minimum_stock) {
      statusEl.innerHTML = '<span class="badge badge--warning">Estoque baixo</span>';
    } else {
      statusEl.innerHTML = '<span class="badge badge--success">Estoque normal</span>';
    }
  }

  function renderHistory(movements) {
    const tbody = document.getElementById('prod-history-body');
    if (!movements.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--text-muted);">Nenhuma movimentação registrada para este produto.</td></tr>';
      return;
    }

    const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    tbody.innerHTML = movements.map(m => {
      const isEntrada = m.type === 'entrada';
      const isSaida = m.type === 'saida';
      const badgeClass = isEntrada ? 'badge--success' : (isSaida ? 'badge--danger' : 'badge--warning');
      const qtySign = isEntrada ? '+' : (isSaida ? '-' : '');

      return `
        <tr style="border-bottom: 1px solid var(--border); cursor:pointer;" onclick="window.location.href='estoque-movimentacao.html?id=${m.id}'">
          <td style="padding: 16px;">${dateFormatter.format(new Date(m.created_at))}</td>
          <td style="padding: 16px;"><span class="badge ${badgeClass}">${m.type.toUpperCase()}</span></td>
          <td style="padding: 16px; font-weight: 600; color: ${isEntrada ? 'var(--success)' : (isSaida ? 'var(--danger)' : 'var(--text)')}">${qtySign}${m.quantity}</td>
          <td style="padding: 16px;">${m.previous_stock}</td>
          <td style="padding: 16px; font-weight: 600;">${m.new_stock}</td>
          <td style="padding: 16px;">${m.document || '—'}</td>
          <td style="padding: 16px;">${m.created_by_name || 'Sistema'}</td>
        </tr>
      `;
    }).join('');
  }
})();