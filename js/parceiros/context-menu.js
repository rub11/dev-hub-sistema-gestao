/* =========================================================
   DEV HUB · Parceiros · context-menu
   ---------------------------------------------------------
   Menu de contexto (right-click) na grade de parceiros.
   ========================================================= */

(function () {
  'use strict';

  const { escapeHtml, showToast, state } = window.Parn;

  let ctxMenuEl = null;
  let ctxTargetPartner = null;

  function setupCtxMenu() {
    document.addEventListener('click', (e) => {
      if (!ctxMenuEl || ctxMenuEl.hidden) return;
      if (ctxMenuEl.contains(e.target)) return;
      closeCtxMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && ctxMenuEl && !ctxMenuEl.hidden) closeCtxMenu();
    });
    window.addEventListener('resize', closeCtxMenu);
    window.addEventListener('scroll', closeCtxMenu, true);
  }

  function buildCtxMenu() {
    const menu = document.createElement('div');
    menu.className = 'parn-ctx';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    const items = [
      { group: 'Validação / Situação' },
      { id: 'validate', label: 'Validar CNPJ/CPF',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' },
      { id: 'update-receitaws', label: 'Atualizar situação cadastral (ReceitaWS)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>' },
      { id: 'update-sefaz', label: 'Atualizar situação cadastral SEFAZ/SUFRAMA',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
        badge: 'Requer certificado' },
      { id: 'suspend-sefaz', label: 'Suspender validação SEFAZ',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
        badge: 'Requer certificado' },

      { sep: true },
      { group: 'Importação' },
      { id: 'import-receitaws', label: 'Importar dados cadastrais (ReceitaWS)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>' },
      { id: 'import-sefaz', label: 'Importar dados cadastrais (SEFAZ)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
        badge: 'Requer certificado' },

      { sep: true },
      { group: 'Endereço' },
      { id: 'copy-addr', label: 'Copiar Endereço Principal p/ End. de Entrega…',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>' },

      { sep: true },
      { group: 'Grade (ação em massa)' },
      { id: 'bulk-selection', label: 'Alterar o campo "Seleção" de TODOS os parceiros na grade…',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M21 12a9 9 0 1 1-9-9"/></svg>' },

      { sep: true },
      { group: 'Cadastro' },
      { id: 'copy-doc', label: 'Copiar CNPJ/CPF para a área de transferência',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>' },
      { id: 'toggle-active', label: 'Ativar/Inativar parceiro',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/><path d="M12 2v10"/></svg>' },
      { id: 'labels', label: 'Impressão de Etiquetas',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>' },

      { sep: true },
      { group: 'Consulta externa' },
      { id: 'open-sefaz', label: 'Consultar no SEFAZ (abre navegador)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>' },
      { id: 'open-receitaws', label: 'Consultar no ReceitaWS (abre navegador)',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>' },
      { id: 'risk-analysis', label: 'Consultar análise de risco',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>' },

      { sep: true },
      { id: 'delete', label: 'Excluir parceiro…', danger: true,
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>' }
    ];

    menu.innerHTML = items.map((it) => {
      if (it.sep) return '<div class="parn-ctx__sep" role="separator"></div>';
      if (it.group) return `<div class="parn-ctx__group">${it.group}</div>`;
      const badge = it.badge ? `<span class="parn-ctx__badge">${it.badge}</span>` : '';
      return `
        <button type="button" class="parn-ctx__item ${it.danger ? 'parn-ctx__item--danger' : ''} ${it.badge ? 'parn-ctx__item--with-badge' : ''}"
                role="menuitem" data-action="${it.id}">
          ${it.icon}<span class="parn-ctx__label">${it.label}</span>${badge}
        </button>`;
    }).join('');

    document.body.appendChild(menu);

    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      handleCtxAction(btn.dataset.action, ctxTargetPartner);
      closeCtxMenu();
    });

    return menu;
  }

  function ensureCtxMenu() {
    if (!ctxMenuEl) ctxMenuEl = buildCtxMenu();
    return ctxMenuEl;
  }

  function openCtxMenu(x, y, partner, rowEl) {
    const menu = ensureCtxMenu();
    ctxTargetPartner = partner;

    document.querySelectorAll('.parn-ctx-target').forEach((tr) => tr.classList.remove('parn-ctx-target'));
    if (rowEl) rowEl.classList.add('parn-ctx-target');

    const hasDoc = !!(partner && partner.cpf_cnpj);
    const isPJ = String(partner && partner.type || '').toUpperCase() === 'PJ';
    const canExternal = hasDoc && isPJ;

    menu.querySelectorAll('[data-action]').forEach((btn) => {
      const a = btn.dataset.action;
      if (a === 'validate' || a === 'copy-doc') btn.disabled = !hasDoc;
      if (a === 'import-receitaws' || a === 'open-receitaws' ||
          a === 'update-receitaws' || a === 'open-sefaz' ||
          a === 'import-sefaz' || a === 'update-sefaz' || a === 'risk-analysis') {
        btn.disabled = !canExternal;
      }
      if (a === 'delete') btn.disabled = !state.perms.remove;
      if (a === 'bulk-selection') btn.disabled = !state.perms.edit;
    });

    menu.hidden = false;

    const rect = menu.getBoundingClientRect();
    const margin = 8;
    let left = x, top = y;

    if (left + rect.width > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - rect.width - margin);
    if (top + rect.height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - rect.height - margin);

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }

  function closeCtxMenu() {
    if (ctxMenuEl) ctxMenuEl.hidden = true;
    document.querySelectorAll('.parn-ctx-target').forEach((tr) => tr.classList.remove('parn-ctx-target'));
    ctxTargetPartner = null;
  }

  async function handleCtxAction(action, partner) {
    if (!partner) return;
    switch (action) {
      case 'validate':          return ctxValidateDoc(partner);
      case 'update-receitaws':  return ctxUpdateFromReceitaWS(partner);
      case 'update-sefaz':      return ctxUpdateFromSefaz();
      case 'suspend-sefaz':     return ctxSuspendSefaz();
      case 'import-receitaws':  return ctxImportFromReceitaWS(partner);
      case 'import-sefaz':      return ctxImportFromSefaz();
      case 'copy-addr':         return ctxCopyAddressToDelivery(partner);
      case 'bulk-selection':    return ctxBulkSelection();
      case 'copy-doc':          return ctxCopyDoc(partner);
      case 'toggle-active':     return ctxToggleActive(partner);
      case 'labels':            return ctxPrintLabels(partner);
      case 'open-sefaz':        return ctxOpenSefaz();
      case 'open-receitaws':    return ctxOpenReceitaWS(partner);
      case 'risk-analysis':     return ctxRiskAnalysis(partner);
      case 'delete':            return window.Parn.openConfirmModal(partner);
    }
  }

  function ctxValidateDoc(partner) {
    const doc = String(partner.cpf_cnpj || '').replace(/\D/g, '');
    if (!doc) { showToast('Parceiro sem CNPJ/CPF cadastrado.', 'error'); return; }

    const isCNPJ = doc.length === 14;
    const isCPF  = doc.length === 11;
    if (!isCNPJ && !isCPF) { showToast('Documento com tamanho inválido.', 'error'); return; }

    const valid = isCNPJ ? window.Parn.validateCNPJ(doc) : window.Parn.validateCPF(doc);
    if (valid) showToast((isCNPJ ? 'CNPJ' : 'CPF') + ' válido: ' + partner.cpf_cnpj, 'success');
    else       showToast((isCNPJ ? 'CNPJ' : 'CPF') + ' INVÁLIDO: ' + partner.cpf_cnpj, 'error');
  }

  async function ctxUpdateFromReceitaWS(partner) {
    const cnpj = String(partner.cpf_cnpj || '').replace(/\D/g, '');
    if (cnpj.length !== 14) { showToast('Só funciona para CNPJ.', 'error'); return; }
    showToast('Consultando situação cadastral…', 'info');
    try {
      const data = await window.Parn.lookupCNPJ(cnpj);
      if (!data) throw new Error('CNPJ não encontrado.');

      const patch = {};
      if (data.name)    patch.company_name = data.name;
      if (data.fantasy) patch.trade_name   = data.fantasy;
      if (data.email)   patch.email        = data.email;
      if (data.phone)   patch.phone        = data.phone;
      if (data.address) patch.address      = data.address;

      if (Object.keys(patch).length === 0) { showToast('Nada novo para atualizar.', 'info'); return; }

      const { error } = await window.Parn.db().from('customers').update(patch).eq('id', partner.id);
      if (error) throw error;
      showToast('Situação atualizada com sucesso.', 'success');
      await window.Parn.reload?.();
    } catch (e) {
      console.error('[ctxUpdateFromReceitaWS]', e);
      showToast('Não foi possível atualizar. ' + (e.message || ''), 'error');
    }
  }

  function ctxUpdateFromSefaz() {
    showToast('A consulta SEFAZ/SUFRAMA exige certificado digital A1/A3 configurado no servidor.', 'info');
  }

  function ctxSuspendSefaz() {
    const key = 'devhub_suspend_sefaz';
    const current = localStorage.getItem(key) === '1';
    if (!confirm(current
      ? 'Reativar a validação SEFAZ automática para todos os parceiros?'
      : 'Suspender a validação SEFAZ automática para todos os parceiros?')) return;
    localStorage.setItem(key, current ? '0' : '1');
    showToast(current ? 'Validação SEFAZ reativada.' : 'Validação SEFAZ suspensa.', 'success');
  }

  async function ctxImportFromReceitaWS(partner) {
    const cnpj = String(partner.cpf_cnpj || '').replace(/\D/g, '');
    if (cnpj.length !== 14) { showToast('A importação só funciona para CNPJ.', 'error'); return; }
    showToast('Consultando Receita Federal…', 'info');
    try {
      const data = await window.Parn.lookupCNPJ(cnpj);
      if (!data) throw new Error('CNPJ não encontrado.');
      const merged = Object.assign({}, partner, {
        company_name: data.name    || partner.company_name,
        trade_name:   data.fantasy || partner.trade_name,
        email:        data.email   || partner.email,
        phone:        data.phone   || partner.phone,
        address:      data.address || partner.address
      });
      showToast('Dados obtidos. Revise e salve.', 'success');
      window.Parn.openEditModal(merged);
    } catch (e) {
      console.error('[ctxImportFromReceitaWS]', e);
      showToast('Não foi possível consultar agora. ' + (e.message || ''), 'error');
    }
  }

  function ctxImportFromSefaz() {
    showToast('A importação SEFAZ exige certificado digital A1/A3 configurado no servidor.', 'info');
  }

  async function ctxCopyAddressToDelivery(partner) {
    if (!confirm('Copiar o endereço principal do parceiro para um novo endereço do tipo "Entrega"?')) return;
    try {
      const data = await window.Parn.getPartnerFull(partner.id);
      const addresses = data.addresses || [];
      const primary = addresses.find((a) => a.is_primary) || addresses[0];
      if (!primary) { showToast('Este parceiro não possui endereço cadastrado.', 'error'); return; }

      const cloned = Object.assign({}, primary, { type: 'Entrega', is_primary: false });
      delete cloned.id;

      const merged = addresses.concat([cloned]).map((a) => ({
        type: a.type, zip_code: a.zip_code || '', state: a.state || '',
        city: a.city || '', neighborhood: a.neighborhood || '',
        street: a.street || '', number: a.number || '',
        complement: a.complement || '', reference: a.reference || '',
        is_primary: !!a.is_primary
      }));

      await window.Parn.upsertPartnerFull({
        customerId: partner.id,
        customer: data.customer || {},
        phones: data.phones || [],
        emails: data.emails || [],
        addresses: merged,
        contacts: data.contacts || []
      });
      showToast('Endereço de entrega criado.', 'success');
      await window.Parn.reload?.();
    } catch (e) {
      console.error('[ctxCopyAddressToDelivery]', e);
      showToast('Não foi possível copiar o endereço.', 'error');
    }
  }

  async function ctxBulkSelection() {
    if (!state.perms.edit) { showToast('Sem permissão para alterar parceiros.', 'error'); return; }
    const total = state.filtered.length;
    if (total === 0) { showToast('Nenhum parceiro na grade.', 'error'); return; }

    const choice = prompt(
      `Aplicar em TODOS os ${total} parceiros visíveis na grade.\n\n` +
      `Escolha uma opção:\n` +
      `  1 - Marcar como CLIENTE\n` +
      `  2 - Marcar como FORNECEDOR\n` +
      `  3 - Marcar como TRANSPORTADORA\n` +
      `  4 - Desmarcar todos os papéis\n\n` +
      `Digite 1, 2, 3 ou 4:`, '1');
    if (!choice) return;

    const patch = {};
    if (choice === '1') { patch.is_customer = true; }
    else if (choice === '2') { patch.is_supplier = true; }
    else if (choice === '3') { patch.is_carrier = true; }
    else if (choice === '4') {
      patch.is_customer = false;
      patch.is_supplier = false;
      patch.is_carrier  = false;
      patch.is_other    = false;
    } else { showToast('Opção inválida.', 'error'); return; }

    const ids = state.filtered.map((p) => p.id);
    const label = choice === '1' ? 'Cliente'
                : choice === '2' ? 'Fornecedor'
                : choice === '3' ? 'Transportadora'
                : 'desmarcar papéis';

    if (!confirm(`Confirma aplicar "${label}" em ${total} parceiros?`)) return;

    showToast('Aplicando em ' + ids.length + ' parceiros…', 'info');
    const { error } = await window.Parn.db().from('customers').update(patch).in('id', ids);
    if (error) { showToast('Erro ao aplicar em massa. ' + error.message, 'error'); return; }
    showToast(`Aplicado "${label}" em ${ids.length} parceiros.`, 'success');
    await window.Parn.reload?.();
  }

  async function ctxCopyDoc(partner) {
    const doc = partner.cpf_cnpj || '';
    if (!doc) { showToast('Sem documento para copiar.', 'error'); return; }
    try {
      await navigator.clipboard.writeText(doc);
      showToast('Documento copiado: ' + doc, 'success');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = doc; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Documento copiado.', 'success');
    }
  }

  async function ctxToggleActive(partner) {
    const isActive = String(partner.status || 'active') === 'active';
    const next = isActive ? 'inactive' : 'active';
    if (!confirm((isActive ? 'Inativar' : 'Ativar') + ' "' + (partner.name || '') + '"?')) return;
    try {
      const { error } = await window.Parn.db().from('customers')
        .update({ status: next }).eq('id', partner.id);
      if (error) throw error;
      showToast(isActive ? 'Parceiro inativado.' : 'Parceiro ativado.', 'success');
      await window.Parn.reload?.();
    } catch (e) {
      console.error('[ctxToggleActive]', e);
      showToast('Não foi possível alterar o status.', 'error');
    }
  }

  function ctxPrintLabels(partner) {
    const name = partner.name || partner.company_name || '';
    const doc  = partner.cpf_cnpj || '';
    const addrList = partner.customer_addresses || [];
    const a = addrList.find((x) => x.is_primary) || addrList[0] || {};
    const addr = [a.street, a.number, a.neighborhood,
                  a.city && a.state ? a.city + '/' + a.state : a.city]
      .filter(Boolean).join(', ');

    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) { showToast('Bloqueado pelo navegador. Habilite pop-ups.', 'error'); return; }

    w.document.write(`
      <html><head><title>Etiqueta · ${escapeHtml(name)}</title>
      <style>
        @page { margin: 8mm; }
        body { font-family: Inter, Arial, sans-serif; padding: 16px; }
        .label { border: 2px dashed #333; border-radius: 10px; padding: 22px; max-width: 420px; margin: 0 auto; }
        .name { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
        .doc  { font-size: 13px; color: #555; margin-bottom: 14px; }
        .addr { font-size: 15px; line-height: 1.4; }
        .foot { margin-top: 18px; font-size: 11px; color: #999; text-align: right; }
      </style></head>
      <body onload="window.print()">
        <div class="label">
          <div class="name">${escapeHtml(name)}</div>
          <div class="doc">${escapeHtml(doc)}</div>
          <div class="addr">${escapeHtml(addr || 'Sem endereço')}</div>
          <div class="foot">DEV HUB · ${new Date().toLocaleDateString('pt-BR')}</div>
        </div>
      </body></html>
    `);
    w.document.close();
  }

  function ctxOpenSefaz() {
    window.open('https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo=7PhJ+gAVw2g=', '_blank');
  }

  function ctxOpenReceitaWS(partner) {
    const cnpj = String(partner.cpf_cnpj || '').replace(/\D/g, '');
    if (!cnpj) { showToast('Sem CNPJ.', 'error'); return; }
    window.open('https://www.receitaws.com.br/v1/cnpj/' + cnpj, '_blank');
  }

  function ctxRiskAnalysis(partner) {
    const cnpj = String(partner.cpf_cnpj || '').replace(/\D/g, '');
    if (!cnpj) { showToast('Sem CNPJ para consultar.', 'error'); return; }
    window.open('https://cnpj.ws/' + cnpj, '_blank');
  }

  Object.assign(window.Parn, {
    setupCtxMenu,
    openCtxMenu,
    closeCtxMenu
  });

})();