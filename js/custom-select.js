/* =========================================================
   DEV HUB · Custom Select
   Transforma <select> nativos em um componente customizado
   com visual padronizado (evita o azul do Windows).
   ========================================================= */

(function () {
  'use strict';

  const CustomSelect = {
    init: function (selector = 'select:not(.dh-no-custom)') {
      document.querySelectorAll(selector).forEach(select => {
        // Evita inicializar duas vezes no mesmo select
        if (select.dataset.customSelectInitialized === '1') return;
        select.dataset.customSelectInitialized = '1';
        this.create(select);
      });
    },

    create: function (select) {
      // Cria o wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'dh-custom-select';
      select.parentNode.insertBefore(wrapper, select);
      wrapper.appendChild(select);

      // Cria o botão (trigger)
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'dh-custom-select__trigger';
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      
      const valueSpan = document.createElement('span');
      valueSpan.className = 'dh-custom-select__value';
      
      const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      chevron.setAttribute('class', 'dh-custom-select__chevron');
      chevron.setAttribute('viewBox', '0 0 24 24');
      chevron.setAttribute('fill', 'none');
      chevron.setAttribute('stroke', 'currentColor');
      chevron.setAttribute('stroke-width', '2');
      chevron.setAttribute('stroke-linecap', 'round');
      chevron.setAttribute('stroke-linejoin', 'round');
      chevron.innerHTML = '<path d="m6 9 6 6 6-6"/>';

      trigger.appendChild(valueSpan);
      trigger.appendChild(chevron);
      wrapper.appendChild(trigger);

      // Cria a lista de opções
      const dropdown = document.createElement('ul');
      dropdown.className = 'dh-custom-select__dropdown';
      dropdown.setAttribute('role', 'listbox');
      wrapper.appendChild(dropdown);

      // Função que sincroniza o visual com o <select> real
      const updateUI = () => {
        const currentOption = select.options[select.selectedIndex];
        valueSpan.textContent = currentOption ? currentOption.text : '';
        
        dropdown.innerHTML = '';
        
        Array.from(select.options).forEach((opt) => {
          const li = document.createElement('li');
          li.className = 'dh-custom-select__option';
          li.textContent = opt.text;
          li.dataset.value = opt.value;
          li.setAttribute('role', 'option');
          
          if (opt.value === select.value) {
            li.classList.add('is-selected');
            li.setAttribute('aria-selected', 'true');
          }

          li.addEventListener('click', () => {
            select.value = opt.value;
            // Dispara o evento 'change' para que os scripts da página saibam da mudança
            select.dispatchEvent(new Event('change', { bubbles: true }));
            updateUI();
            wrapper.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
          });

          dropdown.appendChild(li);
        });
      };

      // Renderiza inicialmente
      updateUI();

      // Escuta mudanças no select original (ex: preenchimento via JS)
      select.addEventListener('change', updateUI);
      
      // Observa se as opções do select mudam (ex: carregamento via AJAX)
      new MutationObserver(updateUI).observe(select, { childList: true, subtree: true, attributes: true });

      // Abre/Fecha ao clicar
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = wrapper.classList.contains('is-open');
        
        // Fecha todos os outros abertos
        document.querySelectorAll('.dh-custom-select.is-open').forEach(el => {
          el.classList.remove('is-open');
          el.querySelector('.dh-custom-select__trigger').setAttribute('aria-expanded', 'false');
        });
        
        if (!isOpen) {
          wrapper.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });

      // Fecha ao clicar fora
      document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
          wrapper.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
        }
      });

      // Fecha ao apertar ESC
      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          wrapper.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
    }
  };

  window.CustomSelect = CustomSelect;
  
  // Auto-inicializa quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CustomSelect.init());
  } else {
    CustomSelect.init();
  }
})();