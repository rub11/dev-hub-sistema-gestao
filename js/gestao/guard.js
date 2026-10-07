/* =========================================================
   DEV HUB · Gestão · guard de acesso
   ========================================================= */
(function () {
  'use strict';
  const Gestao = window.Gestao;

  function bloquearAcesso(motivo) {
    if (window.__gestaoGuardTimeout) {
      clearTimeout(window.__gestaoGuardTimeout);
    }
    document.documentElement.classList.remove('guard-locked');

    if (window.AccessGuard && typeof window.AccessGuard.deny === 'function') {
      let titulo = 'Acesso restrito';
      let mensagem =
        'Esta área é exclusiva para gestores e administradores da empresa. ' +
        'Se você precisa gerenciar usuários, peça acesso a um administrador.';
      let backHref = 'dashboard.html';
      let backLabel = 'Voltar ao dashboard';

      if (motivo === 'config') {
        titulo = 'Erro de conexão';
        mensagem =
          'Não foi possível conectar ao servidor. Verifique sua conexão e ' +
          'tente novamente em alguns instantes.';
      } else if (motivo === 'session') {
        titulo = 'Sessão expirada';
        mensagem = 'Sua sessão expirou. Faça login novamente para continuar.';
        backHref = 'index.html';
        backLabel = 'Fazer login';
      }

      window.AccessGuard.deny({
        title: titulo, message: mensagem,
        backHref: backHref, backLabel: backLabel
      });
      return;
    }

    document.body.innerHTML =
      '<div style="padding:80px 24px;text-align:center;color:#e6eaf2;' +
      'font-family:system-ui,sans-serif;">' +
        '<h1 style="font-size:22px;margin:0 0 8px;">Acesso restrito</h1>' +
        '<p style="color:#8b95a7;margin:0 0 20px;">' +
          'Você não tem permissão para acessar esta área.' +
        '</p>' +
        '<a href="dashboard.html" style="color:#7aa2ff;">Voltar ao dashboard</a>' +
      '</div>';
  }

  Gestao.guard = { bloquearAcesso };
})();