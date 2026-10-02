(function () {
  'use strict';
  const DH = window.DH;
  const { state, utils } = DH;
  const els = {};

  function setup() {
    els.modal  = document.getElementById('detail-modal');
    els.title  = document.getElementById('detail-title');
    els.status = document.getElementById('detail-status');
    els.body   = document.getElementById('detail-body');
    els.editBtn  = document.getElementById('detail-edit-btn');
    els.delBtn   = document.getElementById('detail-delete-btn');
    els.auditBtn = document.getElementById('detail-audit-btn');
    if (!els.modal) return;

    els.modal.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', close);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !els.modal.hidden) close();
    });

    els.editBtn.addEventListener('click', () => {
      if (!state.perms.edit) { DH.toast('Você não tem permissão para editar vendas.', 'error'); return; }
      const sale = els.modal.__sale; if (!sale) return;
      close(); DH.form.openEditSale(sale);
    });

    els.delBtn.addEventListener('click', () => {
      if (!state.perms.remove) { DH.toast('Você não tem permissão para excluir vendas.', 'error'); return; }
      const sale = els.modal.__sale; if (!sale) return;
      close();
      DH.modalPassword.request(
        'Excluir a venda ' + utils.formatSaleNumber(sale) +
        '? A ação devolve o estoque e fica registrada no histórico com seu nome e horário.',
        pwd => executeDelete(sale, pwd)
      );
    });

    els.auditBtn.addEventListener('click', () => {
      const sale = els.modal.__sale; if (!sale) return;
      DH.modalAudit.open(sale);
    });
  }

  async function open(sale) {
    if (!els.modal) return;
    els.modal.__sale = sale;
    els.title.textContent = utils.formatSaleNumber(sale);
    els.status.innerHTML = '';
    els.status.appendChild(buildStatusBadge(sale.status));

    if (els.editBtn) els.editBtn.hidden = !state.perms.edit;
    if (els.delBtn) els.delBtn.hidden = !state.perms.remove;

    els.body.innerHTML =
      '<div class="state-block"><span class="spinner" aria-hidden="true"></span>' +
      '<p>Carregando detalhes...</p></div>';
    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';

    const items = await DH.form.fetchSaleItems(sale.id);
    render(sale, items || []);
  }

  function close() {
    if (!els.modal) return;
    els.modal.hidden = true;
    document.body.style.overflow = '';
    els.modal.__sale = null;
  }

  function buildStatusBadge(status) {
    const info = utils.statusInfo(status);
    const badge = document.createElement('span');
    badge.className = 'badge ' + info.modifier;
    badge.textContent = info.label;
    return badge;
  }

  function buildDetailItem(label, value) {
    const wrap = document.createElement('div');
    wrap.className = 'detail-grid__item';
    const l = document.createElement('span');
    l.className = 'detail-grid__label'; l.textContent = label;
    const v = document.createElement('span');
    v.className = 'detail-grid__value'; v.textContent = value;
    wrap.appendChild(l); wrap.appendChild(v);
    return wrap;
  }

  function buildTotalRow(label, value, isGrand) {
    const row = document.createElement('div');
    row.className = 'detail-totals__row' + (isGrand ? ' detail-totals__row--grand' : '');
    const l = document.createElement('span'); l.textContent = label;
    const v = document.createElement('span'); v.textContent = value;
    row.appendChild(l); row.appendChild(v);
    return row;
  }

  function createCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function render(sale, items) {
    if (!els.body) return;
    const frag = document.createDocumentFragment();

    const s1 = document.createElement('section');
    s1.className = 'detail-section';
    s1.innerHTML = '<h3 class="detail-section__title">Informações gerais</h3>';
    const grid = document.createElement('div');
    grid.className = 'detail-grid';
    grid.appendChild(buildDetailItem('Cliente', utils.customerNameOf(sale)));
    grid.appendChild(buildDetailItem('Data', utils.formatDateTime(sale.created_at)));
    grid.appendChild(buildDetailItem('Pagamento', utils.paymentLabel(sale.payment_method)));
    grid.appendChild(buildDetailItem('Status', utils.statusInfo(sale.status).label));
    grid.appendChild(buildDetailItem('Criada por', sale.created_by_name || '—'));
    if (sale.updated_by_name || sale.updated_at) {
      grid.appendChild(buildDetailItem(
        'Última alteração',
        (sale.updated_by_name || '—') + ' · ' + utils.formatDateTime(sale.updated_at)
      ));
    }
    s1.appendChild(grid);
    frag.appendChild(s1);

    const s2 = document.createElement('section');
    s2.className = 'detail-section';
    s2.innerHTML = '<h3 class="detail-section__title">Produtos</h3>';
    if (!items || items.length === 0) {
      const p = document.createElement('p');
      p.className = 'cell--muted'; p.textContent = 'Nenhum item.';
      s2.appendChild(p);
    } else {
      const table = document.createElement('table');
      table.className = 'detail-items-table';
      table.innerHTML =
        '<thead><tr><th>Produto</th><th class="cell--num">Qtd</th>' +
        '<th class="cell--num">Preço unit.</th><th class="cell--num">Subtotal</th></tr></thead>';
      const tb = document.createElement('tbody');
      items.forEach(it => {
        const tr = document.createElement('tr');
        tr.appendChild(createCell(it.product_name || '—'));
        tr.appendChild(createCell(String(utils.toInteger(it.quantity, 0)), 'cell--num'));
        tr.appendChild(createCell(utils.formatMoney(it.unit_price), 'cell--num'));
        tr.appendChild(createCell(utils.formatMoney(it.subtotal), 'cell--num'));
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      s2.appendChild(table);
    }
    frag.appendChild(s2);

    const s3 = document.createElement('section');
    s3.className = 'detail-section';
    s3.innerHTML = '<h3 class="detail-section__title">Totais</h3>';
    const totals = document.createElement('div');
    totals.className = 'detail-totals';
    totals.appendChild(buildTotalRow('Subtotal', utils.formatMoney(sale.subtotal)));
    totals.appendChild(buildTotalRow('Desconto', '- ' + utils.formatMoney(sale.discount)));
    totals.appendChild(buildTotalRow('Total', utils.formatMoney(sale.total), true));
    s3.appendChild(totals);
    frag.appendChild(s3);

    if (sale.notes && String(sale.notes).trim() !== '') {
      const s4 = document.createElement('section');
      s4.className = 'detail-section';
      s4.innerHTML = '<h3 class="detail-section__title">Observações</h3>';
      const p = document.createElement('p');
      p.className = 'detail-grid__value'; p.textContent = sale.notes;
      s4.appendChild(p);
      frag.appendChild(s4);
    }

    els.body.innerHTML = '';
    els.body.appendChild(frag);
  }

  async function executeDelete(sale, password) {
    if (!state.perms.remove) {
      DH.toast('Você não tem permissão para excluir vendas.', 'error'); return;
    }
    try {
      const { error } = await window.db.rpc('delete_sale', {
        p_sale_id: sale.id, p_password: password
      });
      if (error) throw error;
      DH.toast('Venda excluída com sucesso.', 'success');
      state.formDataLoaded = false;
      await DH.list.loadSales();
    } catch (error) {
      console.error('[DEV HUB] Falha ao excluir venda:', error);
      DH.toast(DH.mapSaleError(error), 'error');
    }
  }

  DH.modalDetail = { setup, open, close };
})();