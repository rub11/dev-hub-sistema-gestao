/* =========================================================
   DEV HUB · Orçamentos · main
   Lista de orçamentos com filtros, busca e estatísticas.
   ========================================================= */
(function () {
  'use strict';

  const state = {
    all: [],
    filtered: [],
    search: '',
    status: 'todos',
    periodo: 'todos'
  };

  const $ = (id) => document.getElementById(id);

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  function boot() {
    if (!window.db || !window.Auth) {
      console.warn('[orcamentos] db ou Auth não carregados');
      return;
    }

    // Lê filtros da URL (?status=pendentes por exemplo)
    const params = new URLSearchParams(window.location.search);
    const statusUrl = params.get('status');
    if (statusUrl) {
      state.status = statusUrl;
      const sel = $('orc-filter-status');
      if (sel) sel.value = statusUrl;
    }

    // Botão Novo orçamento
    const newBtn = $('new-quote-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        window.location.href = 'vendas.html?novo=orcamento';
      });
    }

    $('orc-search').addEventListener('input', (e) => {
      state.search = e.target.value.trim().toLowerCase();
      aplicar();
    });

    $('orc-filter-status').addEventListener('change', (e) => {
      state.status = e.target.value;
      aplicar();
    });

    $('orc-filter-periodo').addEventListener('change', (e) => {
      state.periodo = e.target.value;
      aplicar();
    });

    carregar();
  }

  /* ---------------------------------------------------------
     Resolver organization_id (tenta várias fontes)
     --------------------------------------------------------- */
  async function resolverOrgId(userId) {
    try {
      const profile = await window.Auth.getProfile(userId);
      console.log('[orcamentos] profile via Auth:', profile);

      if (profile) {
        const orgId = profile.organization_id
                   || profile.org_id
                   || profile.tenant_id
                   || profile.empresa_id;
        if (orgId) return orgId;
      }
    } catch (e) {
      console.warn('[orcamentos] getProfile falhou:', e);
    }

    try {
      const { data, error } = await window.db
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      console.log('[orcamentos] profile via query direta:', data, 'erro:', error);

      if (data) {
        const orgId = data.organization_id
                   || data.org_id
                   || data.tenant_id
                   || data.empresa_id;
        if (orgId) return orgId;
      }
    } catch (e) {
      console.warn('[orcamentos] query direta falhou:', e);
    }

    try {
      if (window.DH && window.DH.state) {
        const s = window.DH.state;
        const orgId = s.orgId || s.organization_id || s.activeOrg;
        if (orgId) {
          console.log('[orcamentos] org via DH.state:', orgId);
          return orgId;
        }
      }
    } catch (e) {}

    try {
      if (window.NAV && window.NAV.state) {
        const s = window.NAV.state;
        const orgId = s.orgId || s.organization_id || s.activeOrg;
        if (orgId) {
          console.log('[orcamentos] org via NAV.state:', orgId);
          return orgId;
        }
      }
    } catch (e) {}

    return null;
  }

  /* ---------------------------------------------------------
     Carregar do Supabase
     --------------------------------------------------------- */
  async function carregar() {
    const session = await window.Auth.requireSession().catch(() => null);
    if (!session) {
      console.warn('[orcamentos] sem sessão');
      return;
    }

    const orgId = await resolverOrgId(session.user.id);

    if (!orgId) {
      console.warn('[orcamentos] não conseguiu resolver orgId');
      mostrarVazio(
        'Empresa não identificada',
        'Não foi possível identificar sua organização. Verifique o console.'
      );
      return;
    }

    console.log('[orcamentos] orgId final:', orgId);

    try {
      const { data, error } = await window.db
        .from('sales')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('[orcamentos] vendas carregadas:', data ? data.length : 0);

      state.all = (data || []).filter(isOrcamento);

      console.log('[orcamentos] orçamentos filtrados:', state.all.length);

      aplicar();
      atualizarStats();
    } catch (err) {
      console.error('[orcamentos] erro:', err);
      mostrarVazio('Erro ao carregar', 'Não foi possível carregar os orçamentos.');
    }
  }

  /* ---------------------------------------------------------
     Detectar se é orçamento
     --------------------------------------------------------- */
  function isOrcamento(s) {
    const st = String(s.status || '').toLowerCase();
    return (
      s.is_quote === true ||
      st === 'quote' ||
      st === 'orcamento' ||
      st === 'orçamento' ||
      (s.kind && String(s.kind).toLowerCase() === 'quote') ||
      (s.type && String(s.type).toLowerCase() === 'quote')
    );
  }

  /* ---------------------------------------------------------
     Aplicar filtros
     --------------------------------------------------------- */
  function aplicar() {
    const agora = new Date();
    const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const seteDias = new Date(inicioDia.getTime() - 7 * 24 * 60 * 60 * 1000);
    const trintaDias = new Date(inicioDia.getTime() - 30 * 24 * 60 * 60 * 1000);
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    state.filtered = state.all.filter(s => {
      if (state.search) {
        const nome = String(s.customer_name || s.cliente || '').toLowerCase();
        const num = String(s.sale_number || s.numero_venda || '').toLowerCase();
        if (!nome.includes(state.search) && !num.includes(state.search)) return false;
      }

      const st = String(s.status || '').toLowerCase();
      const cancelado = ['canceled', 'cancelled', 'rejected', 'devolvida'].includes(st);
      const pendente = ['pending', 'pending_approval', 'pendente', 'aguardando'].includes(st);
      const aprovado = ['completed', 'approved', 'aprovado', 'active'].includes(st);

      if (state.status === 'pendentes' && !pendente) return false;
      if (state.status === 'aprovados' && !aprovado) return false;
      if (state.status === 'cancelados' && !cancelado) return false;

      const dt = new Date(s.created_at);
      if (state.periodo === 'hoje' && dt < inicioDia) return false;
      if (state.periodo === '7dias' && dt < seteDias) return false;
      if (state.periodo === '30dias' && dt < trintaDias) return false;
      if (state.periodo === 'mes' && dt < inicioMes) return false;

      return true;
    });

    render();
  }

  /* ---------------------------------------------------------
     Render
     --------------------------------------------------------- */
  function render() {
    const body = $('orc-body');
    const wrap = $('orc-table-wrap');
    const empty = $('orc-empty');
    const loading = $('orc-loading');

    loading.hidden = true;

    if (state.filtered.length === 0) {
      wrap.hidden = true;
      empty.hidden = false;
      $('orc-count').textContent = 'Nenhum orçamento';
      return;
    }

    empty.hidden = true;
    wrap.hidden = false;

    $('orc-count').textContent =
      state.filtered.length === 1
        ? '1 orçamento'
        : state.filtered.length + ' orçamentos';

    body.innerHTML = state.filtered.map(renderRow).join('');
  }

  function renderRow(s) {
    const st = String(s.status || '').toLowerCase();
    const badge = statusBadge(st);
    const num = s.sale_number || s.numero_venda || '—';
    const cliente = s.customer_name || s.cliente || '—';
    const data = formatDate(s.created_at);
    const validade = formatDate(s.valid_until || s.validade);
    const total = formatMoney(s.total);
    const criador = s.created_by_name || s.user_name || '—';

    return `
      <tr data-id="${s.id}">
        <td>#${escapeHtml(num)}</td>
        <td>${escapeHtml(cliente)}</td>
        <td>${data}</td>
        <td>${validade}</td>
        <td class="cell--num">${total}</td>
        <td><span class="badge ${badge.class}">${badge.label}</span></td>
        <td>${escapeHtml(criador)}</td>
        <td class="cell--num">
          <button class="row-action" title="Ver detalhes" aria-label="Ver detalhes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }

  /* ---------------------------------------------------------
     Stats
     --------------------------------------------------------- */
  function atualizarStats() {
    const total = state.all.length;
    let pendentes = 0, aprovados = 0, valor = 0;

    state.all.forEach(s => {
      const st = String(s.status || '').toLowerCase();
      const cancelado = ['canceled', 'cancelled', 'rejected', 'devolvida'].includes(st);
      if (cancelado) return;

      if (['pending', 'pending_approval', 'pendente', 'aguardando'].includes(st)) pendentes++;
      if (['completed', 'approved', 'aprovado', 'active'].includes(st)) aprovados++;
      valor += Number(s.total) || 0;
    });

    $('stat-total').textContent = total;
    $('stat-pendentes').textContent = pendentes;
    $('stat-aprovados').textContent = aprovados;
    $('stat-valor').textContent = 'R$ ' + formatMoneyNumber(valor);
  }

  /* ---------------------------------------------------------
     Badge
     --------------------------------------------------------- */
  function statusBadge(st) {
    if (['pending', 'pending_approval', 'pendente', 'aguardando'].includes(st))
      return { class: 'badge--warning', label: 'Pendente' };
    if (['completed', 'approved', 'aprovado', 'active'].includes(st))
      return { class: 'badge--success', label: 'Aprovado' };
    if (['canceled', 'cancelled', 'rejected', 'devolvida'].includes(st))
      return { class: 'badge--danger', label: 'Cancelado' };
    if (['corrected', 'replaced'].includes(st))
      return { class: 'badge--muted', label: 'Corrigido' };
    return { class: 'badge--muted', label: st || '—' };
  }

  /* ---------------------------------------------------------
     Helpers
     --------------------------------------------------------- */
  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('pt-BR');
  }

  function formatMoney(v) {
    const n = Number(v) || 0;
    return 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function formatMoneyNumber(v) {
    const n = Number(v) || 0;
    return n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function mostrarVazio(title, text) {
    const loading = $('orc-loading');
    const wrap = $('orc-table-wrap');
    const empty = $('orc-empty');
    if (loading) loading.hidden = true;
    if (wrap) wrap.hidden = true;
    if (empty) empty.hidden = false;
    const titleEl = $('orc-empty-title');
    const textEl = $('orc-empty-text');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
  }

  /* ---------------------------------------------------------
     Start
     --------------------------------------------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();