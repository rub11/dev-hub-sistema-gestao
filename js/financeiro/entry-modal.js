(function () {
  'use strict';

  const { state, db, toast, fmtBRL, escapeHTML } = window.Fin;

  // ==========================================
  // RENDERIZAÇÃO DO MODAL DE EDIÇÃO
  // ==========================================
  function openEditModal(entry) {
    if (!entry) return;

    // Verifica se o título já foi rateado
    // 1. Checa se existe uma flag 'is_rateado' ou 'rateado' no objeto
    // 2. Checa se o histórico possui a palavra "Rateio:"
    const jaRateado = 
      entry.is_rateado === true || 
      entry.rateado === true || 
      (entry.notes && entry.notes.includes('Rateio:'));

    const modal = document.createElement('div');
    modal.className = 'fin-modal fin-modal--large';
    modal.innerHTML = `
      <div class="fin-modal__backdrop" data-close></div>
      <div class="fin-modal__dialog" style="max-width: 1200px; width: 95%;">
        
        <!-- Header Principal -->
        <header class="fin-modal__head" style="padding-bottom: 0; border-bottom: none;">
          <h3 class="fin-modal__title">Editar título</h3>
          <button class="fin-modal__close" data-close>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <!-- Barra de Ações (Baixar, Estornar, Ratear, Parcelar) -->
        <div class="fin-modal__actions-bar" style="display: flex; gap: 8px; padding: 0 24px; margin-top: 16px;">
          <button class="fin-action-btn" data-action="baixar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
            Baixar
          </button>
          <button class="fin-action-btn" data-action="estornar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Estornar
          </button>
          
          <!-- Botão Ratear com a trava -->
          <button class="fin-action-btn ${jaRateado ? 'is-disabled' : ''}" 
                  data-action="ratear" 
                  ${jaRateado ? 'disabled title="Este título já foi rateado e não pode ser rateado novamente."' : ''}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>
            Ratear
          </button>
          
          <button class="fin-action-btn" data-action="parcelar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            Parcelar
          </button>
        </div>

        <!-- Abas -->
        <div class="fin-tabs" style="padding: 0 24px; border-bottom: 1px solid var(--border); margin-top: 16px;">
          <button class="fin-tab is-active" data-tab="lancamento">Lançamento</button>
          <button class="fin-tab" data-tab="outras">Outras informações</button>
          <button class="fin-tab" data-tab="geral">Geral</button>
          <button class="fin-tab" data-tab="boleto">Boleto</button>
        </div>

        <!-- Corpo do Modal -->
        <div class="fin-modal__body" style="padding: 24px; max-height: 65vh; overflow-y: auto;">
          
          <!-- ABA LANÇAMENTO -->
          <div class="fin-tab-content is-active" data-content="lancamento">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
              
              <div class="fin-field">
                <label>Nro Único</label>
                <input type="text" value="${escapeHTML(entry.unique_number || '')}" readonly class="fin-input" style="background: var(--surface-2);">
              </div>
              <div class="fin-field">
                <label>Observação padrão</label>
                <input type="text" value="" class="fin-input">
              </div>
              <div class="fin-field">
                <label>Baixa Realizada pelo Importador</label>
                <div class="fin-switch">
                  <input type="checkbox" id="sw-importador" ${entry.settled_by_name?.includes('Importador') ? 'checked' : ''}>
                  <label for="sw-importador">Ativar</label>
                </div>
              </div>

              <div class="fin-field">
                <label>Parceiro <span style="color: var(--accent);">*</span></label>
                <input type="text" value="${escapeHTML(entry.partner_name || '')}" class="fin-input" placeholder="Fornecedor Teste">
              </div>
              <div class="fin-field">
                <label>Receita/Despesa <span style="color: var(--accent);">*</span></label>
                <select class="fin-input">
                  <option value="despesa" ${entry.kind === 'despesa' ? 'selected' : ''}>Despesa</option>
                  <option value="receita" ${entry.kind === 'receita' ? 'selected' : ''}>Receita</option>
                </select>
              </div>
              <div class="fin-field">
                <label>Provisão</label>
                <div class="fin-switch">
                  <input type="checkbox" id="sw-provisao" ${entry.status === 'provisao' ? 'checked' : ''}>
                  <label for="sw-provisao">Marcar como provisão</label>
                </div>
              </div>
              <div class="fin-field">
                <label>Empresa <span style="color: var(--accent);">*</span></label>
                <input type="text" value="${escapeHTML(entry.company_name || '')}" class="fin-input">
              </div>

              <div class="fin-field">
                <label>Nro Nota <span style="color: var(--accent);">*</span></label>
                <input type="text" value="${escapeHTML(entry.doc_number || '')}" class="fin-input">
              </div>
              <div class="fin-field">
                <label>Dt. Negociação <span style="color: var(--accent);">*</span></label>
                <input type="date" value="${entry.issue_date || ''}" class="fin-input">
              </div>
              <div class="fin-field">
                <label>Vlr. do Desdobramento <span style="color: var(--accent);">*</span></label>
                <input type="text" value="${fmtBRL(entry.amount_cents || 0)}" class="fin-input">
              </div>
              <div class="fin-field">
                <label>Valor Líquido</label>
                <input type="text" value="${fmtBRL(entry.amount_cents || 0)}" class="fin-input">
              </div>

              <div class="fin-field">
                <label>Dt. Vencimento <span style="color: var(--accent);">*</span></label>
                <input type="date" value="${entry.due_date || ''}" class="fin-input">
              </div>
              <div class="fin-field">
                <label>CNPJ / CPF</label>
                <input type="text" value="${escapeHTML(entry.partner_doc || '')}" class="fin-input">
              </div>
              <div class="fin-field">
                <label>Parcela (${entry.installment_number || 1}/${entry.installments_total || 1})</label>
                <input type="text" value="${entry.installment_number || 1}/${entry.installments_total || 1}" class="fin-input" readonly>
              </div>

              <div class="fin-field" style="grid-column: 1 / -1;">
                <label>Histórico</label>
                <textarea class="fin-input" rows="3">${escapeHTML(entry.notes || '')}</textarea>
              </div>

            </div>
          </div>
          
          <!-- Outras abas ficariam aqui -->
          <div class="fin-tab-content" data-content="outras" style="display:none;"></div>
          <div class="fin-tab-content" data-content="geral" style="display:none;"></div>
          <div class="fin-tab-content" data-content="boleto" style="display:none;"></div>

        </div>

        <!-- Footer -->
        <footer class="fin-modal__foot" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-top: 1px solid var(--border);">
          <div style="display: flex; gap: 16px; font-size: 14px; font-weight: 600;">
            <span style="color: var(--success);">RECEITA: ${entry.kind === 'receita' ? fmtBRL(entry.amount_cents) : '0,00'}</span>
            <span style="color: var(--danger);">DESPESA: ${entry.kind === 'despesa' ? fmtBRL(entry.amount_cents) : '0,00'}</span>
            <span style="color: var(--warning);">TOTAL EM ABERTO: ${fmtBRL(entry.current_balance_cents || 0)}</span>
          </div>
          <div style="display: flex; gap: 12px;">
            <button class="fin-btn fin-btn--ghost" data-close>Cancelar</button>
            <button class="fin-btn fin-btn--primary" id="btn-salvar">Salvar alterações</button>
          </div>
        </footer>
      </div>
    `;

    document.body.appendChild(modal);

    // ==========================================
    // EVENTOS E LÓGICA DO MODAL
    // ==========================================
    
    // Fechar modal
    modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => modal.remove()));

    // Troca de Abas
    const tabs = modal.querySelectorAll('.fin-tab');
    const contents = modal.querySelectorAll('.fin-tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('is-active'));
        contents.forEach(c => c.style.display = 'none');
        
        tab.classList.add('is-active');
        const target = tab.dataset.tab;
        modal.querySelector(`[data-content="${target}"]`).style.display = 'block';
      });
    });

    // Ações da Barra Superior
    const ratearBtn = modal.querySelector('[data-action="ratear"]');
    
    // Se já for rateado, bloqueia o clique via JS por segurança extra (além do disabled e CSS)
    if (jaRateado) {
      ratearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toast('Este título já foi rateado e não pode ser rateado novamente.', 'warning');
      });
    } else {
      ratearBtn.addEventListener('click', () => {
        // Abre o modal de rateio do sistema
        if (window.Fin.openRateioModal) {
          window.Fin.openRateioModal(entry);
          modal.remove();
        } else {
          toast('Módulo de rateio não carregado.', 'error');
        }
      });
    }

    // Outros botões
    modal.querySelector('[data-action="baixar"]').addEventListener('click', () => {
      if (window.Fin.openBaixaModal) window.Fin.openBaixaModal(entry);
    });

    modal.querySelector('[data-action="estornar"]').addEventListener('click', () => {
      if (window.Fin.openEstornoModal) window.Fin.openEstornoModal(entry);
    });

    // Salvar
    modal.querySelector('#btn-salvar').addEventListener('click', async () => {
      try {
        const btn = modal.querySelector('#btn-salvar');
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        // Coleta os dados dos inputs (Exemplo básico)
        const payload = {
          partner_name: modal.querySelector('input[placeholder="Fornecedor Teste"]').value,
          doc_number: modal.querySelector('input[value="' + escapeHTML(entry.doc_number || '') + '"]')?.value || entry.doc_number, 
          notes: modal.querySelector('textarea').value,
          // ... (adicione os outros campos conforme necessidade do seu update)
        };

        const { error } = await db()
          .from('financial_entries')
          .update(payload)
          .eq('id', entry.id);

        if (error) throw error;

        toast('Título atualizado com sucesso!', 'success');
        modal.remove();
        
        // Recarrega a tabela/grid
        if (window.Fin.loadData) window.Fin.loadData();

      } catch (err) {
        console.error(err);
        toast('Erro ao atualizar título: ' + err.message, 'error');
        modal.querySelector('#btn-salvar').disabled = false;
        modal.querySelector('#btn-salvar').textContent = 'Salvar alterações';
      }
    });
  }

  // Exporta para o namespace global
  Object.assign(window.Fin, { openEditModal });

})();