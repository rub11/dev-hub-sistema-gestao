(function () {
  'use strict';
  const DH = window.DH;

  DH.mapSaleError = function (error) {
    if (!error) return 'Não foi possível concluir a operação. Tente novamente.';
    const message = String(error.message || '');
    const code = String(error.code || '');
    const lower = message.toLowerCase();

    if (message.includes('Senha incorreta')) return 'Senha incorreta. Tente novamente.';
    if (message.includes('Estoque insuficiente')) return message;
    if (message.includes('Produto não encontrado')) return message;
    if (message.includes('Produto indisponível')) return message;
    if (message.includes('pelo menos um produto')) return message;
    if (message.includes('Desconto não pode')) return message;
    if (message.includes('Total da venda não pode')) return message;
    if (message.includes('Quantidade inválida')) return message;
    if (message.includes('Sessão inválida')) return message;
    if (message.includes('Venda não encontrada')) return message;
    if (message.includes('Venda não pertence')) return message;
    if (message.includes('Sem permissão')) return message;

    if (lower.includes('failed to fetch') || lower.includes('network')) {
      return 'Não foi possível conectar ao servidor.';
    }
    if (lower.includes('row-level security') || lower.includes('permission denied') || code === '42501') {
      return 'Você não tem permissão para executar esta ação.';
    }
    if ((lower.includes('could not find') && lower.includes('function')) ||
        (lower.includes('function') && lower.includes('does not exist')) ||
        code === 'PGRST202') {
      return 'A função não está instalada no banco. Contate o suporte.';
    }
    if (code === '23502' || lower.includes('violates not-null')) {
      return 'Algum campo obrigatório não foi preenchido.';
    }
    return 'Não foi possível concluir a operação. (' + (message || code || '?') + ')';
  };
})();