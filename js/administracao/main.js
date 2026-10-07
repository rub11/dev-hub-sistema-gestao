/* =========================================================
   DEV HUB · Central de Administração · main
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV;
  const DH = window.DH = window.DH || {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    if (document.body.dataset.page !== 'administracao') return;

    /* Ícones */
    const ICONS = {
      lock:          NAV.ICONS.lock,
      gestao:        NAV.ICONS.gestao,
      check:         NAV.ICONS.check,
      payment:       NAV.ICONS.payment,
      configuracoes: NAV.ICONS.configuracoes,
      empresas:      NAV.ICONS.empresas,
      usuarios:      NAV.ICONS.usuarios
    };

    /* Catálogo de cards */
    const CARDS = [
      {
        id: 'gestao',
        title: 'Gestão de usuários',
        desc: 'Criar, editar e desativar usuários da empresa.',
        href: 'gestao.html',
        icon: ICONS.gestao,
        cap: 'management.view'
      },
      {
        id: 'permissoes',
        title: 'Permissões',
        desc: 'Editor de permissões por perfil e por tela.',
        href: 'permissoes.html',
        icon: ICONS.lock,
        cap: 'management.roles'
      },
      {
        id: 'config-pagamentos',
        title: 'Formas de pagamento',
        desc: 'Aceite dinheiro, Pix, cartão, cheque, VA/VR e configure descontos por forma.',
        href: 'configuracoes-pagamentos.html',
        icon: ICONS.payment,
        cap: 'management.view'
      },
      {
        id: 'config-parcelamento',
        title: 'Parcelamento',
        desc: 'Defina faixas de valor e em quantas vezes o cliente pode parcelar no cartão.',
        href: 'configuracoes-parcelamento.html',
        icon: ICONS.payment,
        cap: 'management.view'
      },
      {
        id: 'aprovacoes',
        title: 'Aprovações',
        desc: 'Compras e vendas pendentes de aprovação.',
        href: 'aprovacoes.html',
        icon: ICONS.check,
        cap: 'purchases.approve'
      },
      {
        id: 'config-empresa',                                  /* ⬅️ ALTERADO */
        title: 'Configurações da empresa',
        desc: 'Dados cadastrais, endereço, dados fiscais e informações da empresa.',
        href: 'configuracoes-empresa.html',                    /* ⬅️ ALTERADO */
        icon: ICONS.configuracoes,
        cap: 'management.view'
      }
    ];

    /* Checagem de capability */
    const ctx = NAV.roles ? NAV.roles.readContext() : { caps: {} };
    const can = (cap) => {
      if (!cap) return true;
      if (ctx.isPlatform) return true;
      const c = String(ctx.role || '').toLowerCase();
      const baseCaps = (NAV.BASE_CAPS && (NAV.BASE_CAPS[c] || NAV.BASE_CAPS.usuario)) || [];
      if (baseCaps.indexOf(cap) !== -1) return true;
      if (window.Perms && typeof window.Perms.has === 'function') {
        try { return window.Perms.has(cap); } catch (e) {}
      }
      return false;
    };

    const grid = document.getElementById('adm-grid');
    if (!grid) return;

    grid.innerHTML = CARDS
      .filter(c => can(c.cap))
      .map(c => `
        <a class="adm-card" href="${c.href}" data-id="${c.id}">
          <span class="adm-card__icon">${c.icon}</span>
          <span class="adm-card__body">
            <span class="adm-card__title">${c.title}</span>
            <span class="adm-card__desc">${c.desc}</span>
          </span>
          <span class="adm-card__arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </span>
        </a>
      `).join('');

    if (grid.children.length === 0) {
      grid.innerHTML = `
        <div class="state-block">
          <h3>Sem permissões de administração</h3>
          <p>Você não tem acesso a nenhuma área administrativa.</p>
        </div>
      `;
    }
  }

  DH.administracao = { init };
})();