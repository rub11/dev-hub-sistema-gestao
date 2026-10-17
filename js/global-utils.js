// js/global-utils.js

/**
 * DEV HUB - Utilitários Globais
 * Garante que todo o sistema permita copiar e colar (Ctrl+C / Ctrl+V)
 */

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Garante que o navegador não bloqueie a seleção de texto
  // (Alguns resets de CSS ou frameworks podem colocar user-select: none)
  const style = document.createElement('style');
  style.innerHTML = `
    body, p, h1, h2, h3, h4, h5, h6, span, div, td, th, li, a, input, textarea, select {
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
      user-select: text !important;
    }
    button, .btn, .icon, svg, .no-select {
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
    }
  `;
  document.head.appendChild(style);

  // 2. Melhora a cópia de tabelas (formata como TSV para Excel)
  document.addEventListener('copy', (event) => {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

    // Verifica se o que está sendo copiado está dentro de uma tabela
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const table = container.nodeType === 1 ? container.closest('table') : container.parentElement.closest('table');

    if (table) {
      const rows = Array.from(table.querySelectorAll('tr'));
      const selectedRows = rows.filter(row => selection.containsNode(row, true));
      
      if (selectedRows.length > 0) {
        const tsvData = selectedRows.map(row => {
          return Array.from(row.querySelectorAll('th, td'))
            .map(cell => cell.innerText.trim())
            .join('\t'); // Separa colunas por tabulação
        }).join('\n'); // Separa linhas por quebra de linha
        
        // Sobrescreve a área de transferência com o texto formatado
        event.clipboardData.setData('text/plain', tsvData);
        event.preventDefault();
      }
    }
  });

  // 3. Garante que o evento de colar não seja bloqueado
  document.addEventListener('paste', (event) => {
    // Apenas permite o comportamento padrão, mas serve como hook para futuras sanitizações
  });
});