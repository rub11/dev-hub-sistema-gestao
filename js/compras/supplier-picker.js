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
    
    // Elementos de controle de tela
    const viewSearch = document.getElementById('supplier-view-search');
    const viewDetails = document.getElementById('supplier-view-details');
    const footerSearch = document.getElementById('footer-search');
    const footerDetails = document.getElementById('footer-details');
    const titleEl = document.getElementById('supplier-picker-title');

    // Elementos da tela de detalhes (Dentro do Modal)
    const sdAvatar = document.getElementById('sd-avatar');
    const sdName = document.getElementById('sd-name');
    const sdDoc = document.getElementById('sd-doc');
    const sdPhone = document.getElementById('sd-phone');
    const sdEmail = document.getElementById('sd-email');
    const sdAddress = document.getElementById('sd-address');

    // Elementos do Card de Resumo (Na página principal)
    const summaryBox = document.getElementById('supplier-summary');
    const ssDoc = document.getElementById('ss-doc');
    const ssPhone = document.getElementById('ss-phone');
    const ssEmail = document.getElementById('ss-email');
    const ssAddress = document.getElementById('ss-address');

    // Variáveis de estado interno
    let currentSelectedItem = null;
    const oldNewBtn = document.getElementById('cmp-new-supplier');
    const newBtn = document.getElementById('supplier-picker-new-btn');
    const backBtn = document.getElementById('supplier-picker-back-btn');
    const confirmBtn = document.getElementById('supplier-picker-confirm-btn');

    if (!triggerBtn || !modal || !originalSelect) return;

    function showSearchView() {
      viewSearch.hidden = false;
      viewDetails.hidden = true;
      footerSearch.style.display = 'contents';
      footerDetails.style.display = 'none';
      titleEl.textContent = 'Buscar Fornecedor';
      setTimeout(() => searchInput.focus(), 100);
    }

    function showDetailsView(item) {
      currentSelectedItem = item;
      
      sdAvatar.textContent = item.name.charAt(0).toUpperCase() || '?';
      sdName.textContent = item.name;
      sdDoc.textContent = item.doc || 'Não informado';
      sdPhone.textContent = item.phone || 'Não informado';
      sdEmail.textContent = item.email || 'Não informado';
      sdAddress.textContent = item.address || 'Não informado';

      viewSearch.hidden = true;
      viewDetails.hidden = false;
      footerSearch.style.display = 'none';
      footerDetails.style.display = 'flex';
      titleEl.textContent = 'Detalhes do Fornecedor';
    }

    function openModal() {
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      searchInput.value = '';
      listContainer.innerHTML = '<div class="supplier-list__empty">Digite para pesquisar um fornecedor...</div>';
      showSearchView();
    }

    function closeModal() {
      modal.hidden = true;
      document.body.style.overflow = '';
      currentSelectedItem = null;
    }

    function parseOptionText(text) {
      let name = text;
      let doc = '';
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

    function renderList(query) {
      const q = query.toLowerCase().trim();
      if (!q) {
        listContainer.innerHTML = '<div class="supplier-list__empty">Digite para pesquisar um fornecedor...</div>';
        return;
      }

      let data = [];

      if (window.DH && window.DH.state && window.DH.state.suppliers) {
        data = window.DH.state.suppliers.map(s => ({
          id: s.id,
          name: s.name || s.razao_social || '',
          doc: s.document || s.cnpj || s.cpf_cnpj || 'Sem documento',
          phone: s.phone || s.telefone || '',
          email: s.email || '',
          address: s.address || s.endereco || ''
        }));
      } else {
        const options = Array.from(originalSelect.options).filter(opt => opt.value !== '');
        data = options.map(opt => {
          const parsed = parseOptionText(opt.text);
          return { id: opt.value, name: parsed.name, doc: parsed.doc };
        });
      }

      const uniqueData = data.filter((item, index, self) => 
        index === self.findIndex((t) => (t.id === item.id))
      );

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
          showDetailsView(item);
        });
        
        listContainer.appendChild(el);
      });
    }

    // Ação ao CONFIRMAR o fornecedor
    confirmBtn.addEventListener('click', () => {
      if (!currentSelectedItem) return;
      
      // Salva no select original
      originalSelect.value = currentSelectedItem.id;
      originalSelect.dispatchEvent(new Event('change'));
      
      // Atualiza o botão de trigger principal
      label.textContent = currentSelectedItem.name;
      
      // Preenche o Card de Resumo
      ssDoc.textContent = currentSelectedItem.doc || 'Não informado';
      ssPhone.textContent = currentSelectedItem.phone || 'Não informado';
      ssEmail.textContent = currentSelectedItem.email || 'Não informado';
      ssAddress.textContent = currentSelectedItem.address || 'Não informado';
      
      // Mostra o Card
      summaryBox.hidden = false;
      
      // Fecha o modal
      closeModal();
    });

    backBtn.addEventListener('click', () => {
      showSearchView();
    });

    triggerBtn.addEventListener('click', openModal);
    searchInput.addEventListener('input', (e) => renderList(e.target.value));
    
    modal.querySelectorAll('[data-close-picker]').forEach(el => {
      el.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    newBtn.addEventListener('click', () => {
      closeModal();
      if (oldNewBtn) oldNewBtn.click();
    });
  }
})();