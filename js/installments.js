/* =========================================================
   DEV HUB · Vendas · installments.js
   Busca e gerencia as regras de parcelamento do cartão.
   ========================================================= */
(function () {
  'use strict';
  const DH = window.DH = window.DH || {};

  let rules = [];

  DH.installments = {
    async setup() {
      try {
        const { data, error } = await window.db
          .from('installment_rules')
          .select('*')
          .eq('active', true)
          .order('max_value', { ascending: true });

        if (error) throw error;
        
        rules = data || [];
        console.log('[DEV HUB] Regras de parcelamento carregadas com sucesso:', rules);
      } catch (e) {
        console.error('[DEV HUB] Erro ao carregar regras de parcelamento:', e);
      }
    },
    
    getRules() {
      return rules;
    },
    
    reset() {
      // Não precisa fazer nada no reset, as regras permanecem em memória.
    }
  };
})();