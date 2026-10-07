/* =========================================================
   DEV HUB · Vendas · quotes-print.js
   Abre janela com o orçamento formatado pra impressão / PDF.
   ========================================================= */
(function () {
  'use strict';
  const DH = window.DH;
  const { utils } = DH;

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function padNum(n) {
    const s = String(n == null ? '' : n);
    return s.length >= 6 ? s : '0'.repeat(6 - s.length) + s;
  }

  async function print(quote, preloadedItems) {
    let items = preloadedItems;
    if (!items) {
      try {
        const { data, error } = await window.db
          .from('quote_items').select('*').eq('quote_id', quote.id).order('created_at');
        if (error) throw error;
        items = data || [];
      } catch (e) { items = []; }
    }

    let orgName = 'DEV HUB';
    try {
      if (window.Auth && typeof window.Auth.requireSession === 'function') {
        const session = await window.Auth.requireSession();
        if (session && window.Auth.getProfile) {
          const prof = await window.Auth.getProfile(session.user.id);
          if (prof && prof.organization_name) orgName = prof.organization_name;
        }
      }
    } catch (e) {}

    const numero  = 'ORC-' + padNum(quote.quote_number);
    const emitido = new Date(quote.created_at).toLocaleDateString('pt-BR');
    const valido  = quote.valid_until
      ? new Date(quote.valid_until + 'T00:00:00').toLocaleDateString('pt-BR')
      : '—';

    const deposit = utils.toNumber(quote.deposit_amount, 0);
    const total   = utils.toNumber(quote.total, 0);
    const saldo   = Math.max(0, total - deposit);

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>${numero} · Orçamento</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, "Segoe UI", Inter, Roboto, sans-serif;
    color: #101828; padding: 40px 48px; font-size: 13.5px; line-height: 1.5;
    background: #fff;
  }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 20px; border-bottom: 2px solid #101828; }
  .head h1 { font-size: 22px; margin: 0 0 4px; }
  .head__meta { text-align: right; }
  .head__num { font-family: ui-monospace, monospace; font-weight: 700; font-size: 16px; color: #4338ca; }
  .section { margin-top: 24px; }
  .section h2 { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #667085; margin-bottom: 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 32px; }
  .item { padding: 8px 0; border-bottom: 1px solid #e4e7ec; display: flex; justify-content: space-between; }
  .item strong { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e4e7ec; }
  th { font-size: 11px; text-transform: uppercase; color: #667085; letter-spacing: .04em; background: #f9fafb; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 16px; margin-left: auto; width: 300px; }
  .totals div { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13.5px; }
  .totals .grand { border-top: 2px solid #101828; font-size: 17px; font-weight: 700; padding-top: 10px; margin-top: 4px; }
  .totals .saldo { border-top: 1px dashed #d0d5dd; padding-top: 10px; margin-top: 4px; color: #4338ca; font-weight: 600; }
  .notes { margin-top: 24px; padding: 14px 16px; background: #f9fafb; border-left: 3px solid #6366f1; border-radius: 4px; font-size: 13px; white-space: pre-wrap; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e4e7ec; font-size: 11.5px; color: #667085; text-align: center; }
  @media print { body { padding: 20px; } .no-print { display: none !important; } }
  .no-print { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; }
  .no-print button { padding: 8px 14px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; cursor: pointer; font: inherit; font-weight: 600; }
  .no-print button.primary { background: #6366f1; color: #fff; border-color: #6366f1; }
</style>
</head>
<body>

<div class="no-print">
  <button onclick="window.close()">Fechar</button>
  <button class="primary" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
</div>

<div class="head">
  <div>
    <h1>${escapeHTML(orgName)}</h1>
    <div style="color:#667085">Orçamento comercial</div>
  </div>
  <div class="head__meta">
    <div class="head__num">${numero}</div>
    <div style="margin-top:4px;color:#667085">Emitido em ${emitido}</div>
    <div style="color:#667085">Válido até ${valido}</div>
  </div>
</div>

<div class="section">
  <h2>Cliente</h2>
  <div class="grid">
    <div class="item"><strong>Nome</strong><span>${escapeHTML(quote.customer_name || 'Não informado')}</span></div>
    <div class="item"><strong>Criado por</strong><span>${escapeHTML(quote.created_by_name || '—')}</span></div>
  </div>
</div>

<div class="section">
  <h2>Itens do orçamento</h2>
  <table>
    <thead>
      <tr>
        <th>Produto</th>
        <th class="num">Qtd</th>
        <th class="num">Preço unit.</th>
        <th class="num">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${(items || []).map(it => `
        <tr>
          <td>${escapeHTML(it.product_name)}</td>
          <td class="num">${Number(it.quantity)}</td>
          <td class="num">${utils.formatMoney(it.unit_price)}</td>
          <td class="num">${utils.formatMoney(it.subtotal)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>${utils.formatMoney(quote.subtotal)}</span></div>
    <div><span>Desconto</span><span>- ${utils.formatMoney(quote.discount)}</span></div>
    <div class="grand"><span>Total</span><span>${utils.formatMoney(total)}</span></div>
    ${deposit > 0 ? `
      <div><span>Sinal</span><span>${utils.formatMoney(deposit)}</span></div>
      <div class="saldo"><span>Saldo a receber</span><span>${utils.formatMoney(saldo)}</span></div>
    ` : ''}
  </div>
</div>

${quote.payment_method ? `
<div class="section">
  <h2>Forma de pagamento</h2>
  <div>${escapeHTML(DH.PAYMENT_LABELS[quote.payment_method] || quote.payment_method)}</div>
</div>` : ''}

${quote.notes ? `
<div class="section">
  <h2>Observações</h2>
  <div class="notes">${escapeHTML(quote.notes)}</div>
</div>` : ''}

<div class="footer">
  Este orçamento tem validade até ${valido}. Após esta data, os valores podem sofrer alteração.
</div>

</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=1000');
    if (!win) {
      DH.toast('Bloqueador de pop-up impediu a impressão.', 'error');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  window.QuotePrint = { print };
})();