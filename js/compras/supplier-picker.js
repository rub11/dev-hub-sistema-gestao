/* =========================================================
   DEV HUB · Compras · Supplier Picker
   ========================================================= */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    const triggerBtn = document.getElementById('open-supplier-picker');
    const originalSelect = document.getElementById('cmp-supplier');
    const modal = document.getElementById('supplier-picker-modal');
    const searchInput = document.getElementById('supplier-search-input');
    const listContainer = document.getElementById('supplier-list');
    const label = document.getElementById('supplier-picker-label');
    const newBtn = document.getElementById('supplier-picker-new-btn');
    
    // Botão "+ Novo" ao lado do select
    const oldNewBtn = document.getElementById('cmp-new-supplier');

    if (!triggerBtn || !modal || !originalSelect) return;

    // Abre o modal
    function openModal() {
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      searchInput.value = '';
      // Ao abrir, mostra a mensagem padrão
      listContainer.innerHTML = '<div class="supplier-list__empty">Digite para pesquisar um fornecedor...</div>';
      setTimeout(() => searchInput.focus(), 100);
    }

    // Fecha o modal
    function closeModal() {
      modal.hidden = true;
      document.body.style.overflow = '';
    }

    // Extrai nome e documento do texto da option (fallback)
    function parseOptionText(text) {
      let name = text;
      let doc = '';

      // Tenta achar padrão de CNPJ (XX.XXX.XXX/XXXX-XX) ou CPF (XXX.XXX.XXX-XX)
      const docMatch = text.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})|(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
      
      if (docMatch) {
        doc = docMatch[0];
        name = text.replace(doc, '').replace(/[-–—()]/g, '').trim();
      } else {
        const parts = text.split(/[-–—()]/);
        if (parts.length > 1) {
          name = parts[0].trim();
          doc = parts.slice(1).join(' ').trim();
        }
      }

      return { name: name || text, doc: doc || 'Sem documento' };
    }

    // Renderiza a lista de fornecedores no modal
    function renderList(query) {
      const q = query.toLowerCase().trim();
      
      // Se a barra estiver vazia, não lista todos, mostra instrução
      if (!q) {
        listContainer.innerHTML = '<div class="supplier-list__empty">Digite para pesquisar um fornecedor...</div>';
        return;
      }

      let data = [];

      // Tenta pegar os dados reais do estado global
      if (window.DH && window.DH.state && window.DH.state.suppliers) {
        data = window.DH.state.suppliers.map(s => ({
          id: s.id,
          name: s.name || s.razao_social || '',
          doc: s.document || s.cnpj || s.cpf_cnpj || 'Sem documento'
        }));
      } else {
        // Fallback: Extrai do DOM
        const options = Array.from(originalSelect.options).filter(opt => opt.value !== '');
        data = options.map(opt => {
          const parsed = parseOptionText(opt.text);
          return { id: opt.value, name: parsed.name, doc: parsed.doc };
        });
      }

      // DEDUPLICAÇÃO
      const seenIds = new Set();
      const seenNames = new Set();
      
      const uniqueData = data.filter(item => {
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);

        const nameKey = `${item.name.toLowerCase()}_${item.doc}`;
        if (seenNames.has(nameKey)) return false;
        seenNames.add(nameKey);

        return true;
      });

      // FILTRAGEM (Busca no Nome e no Documento)
      const filtered = uniqueData.filter(item => {
        const textToSearch = `${item.name} ${item.doc}`.toLowerCase();
        return textToSearch.includes(q);
      });

      listContainer.innerHTML = '';

      if (filtered.length === 0) {
        listContainer.innerHTML = '<div class="supplier-list__empty">Nenhum fornecedor encontrado.</div>';
        return;
      }

      filtered.forEach(item => {
        const initial = item.name.charAt(0).toUpperCase() || '?';

        const el = document.createElement('div');
        el.className = 'supplier-list__item';
        el.innerHTML = `
          <div class="supplier-list__avatar">${initial}</div>
          <div class="supplier-list__info">
            <strong>${item.name}</strong>
            <span>${item.doc}</span>
          </div>
        `;
        
        el.addEventListener('click', () => {
          originalSelect.value = item.id;
          originalSelect.dispatchEvent(new Event('change'));
          label.textContent = item.name;
          closeModal();
        });
        
        listContainer.appendChild(el);
      });
    }

    // Eventos
    triggerBtn.addEventListener('click', openModal);
    searchInput.addEventListener('input', (e) => renderList(e.target.value));
    
    modal.querySelectorAll('[data-close-picker]').forEach(el => {
      el.addEventListener('click', closeModal);
    });

    // Fecha ao apertar ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    // Ao clicar no botão "Novo Fornecedor" dentro do modal
    newBtn.addEventListener('click', () => {
      closeModal();
      if (oldNewBtn) oldNewBtn.click();
    });

    // Sincroniza o texto do botão principal
    const syncTriggerLabel = () => {
      const selectedOpt = originalSelect.options[originalSelect.selectedIndex];
      if (selectedOpt && selectedOpt.value) {
        const parsed = parseOptionText(selectedOpt.text);
        label.textContent = parsed.name;
      } else {
        label.textContent = '— Selecione o fornecedor —';
      }
    };

    originalSelect.addEventListener('change', syncTriggerLabel);
    
    new MutationObserver(syncTriggerLabel).observe(originalSelect, { childList: true, subtree: true });
  }
})();