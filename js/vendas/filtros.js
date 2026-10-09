/* =========================================================
   DEV HUB · Vendas · filtros.js
   Filtros client-side de status, período e pagamento.
   + Stats do topo (total, faturamento, a receber, ticket médio).
   ========================================================= */
(function () {
  'use strict';

  const state = {
    search: '',
    status: 'todos',
    periodo: 'todos',
    pagamento: 'todos'
  };

  const $ = (id) => document.getElementById(id);

  /* ---------------------------------------------------------
     Extrai contexto de cada linha da tabela
     --------------------------------------------------------- */
  function extrairContexto(row) {
    const cells = row.children;
    if (cells.length < 7) return null;

    const statusText = (cells[6].textContent || '').trim().toLowerCase();
    const totalText = cells[3] ? (cells[3].textContent || '').trim() : '';
    const formaText = cells[5] ? (cells[5].textContent || '').trim().toLowerCase() : '';
    const dataText = cells[2] ? (cells[2].textContent || '').trim() : '';
    const clienteText = cells[1] ? (cells[1].textContent || '').trim().toLowerCase() : '';
    const numText = cells[0] ? (cells[0].textContent || '').trim().toLowerCase() : '';

    const total = parseMoney(totalText);
    const dataVenda = parseDate(dataText);

    return {
      status: statusText,
      total: total,
      forma: formaText,
      dataVenda: dataVenda,
      cliente: clienteText,
      numero: numText,
      row: row
    };
  }

  function parseMoney(txt) {
    if (!txt) return 0;
    const cleaned = String(txt).replace(/[^\d,.-]/g, '')
      .replace(/\./g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function parseDate(txt) {
    if (!txt) return null;
    const m = txt.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  }

  /* ---------------------------------------------------------
     Regras
     --------------------------------------------------------- */
  function matchesStatus(ctx) {
    if (state.status === 'todos') return true;
    const st = ctx.status;

    if (state.status === 'canceladas')
      return st.includes('cancel') || st.includes('rejeit') || st.includes('devolv');

    if (state.status === 'pendentes')
      return st.includes('pendent') || st.includes('aguard');

    if (state.status === 'ativas')
      return !st.includes('cancel') && !st.includes('rejeit') &&
             !st.includes('devolv') && !st.includes('pendent') &&
             !st.includes('aguard');

    return true;
  }

  function matchesPeriodo(ctx) {
    if (state.periodo === 'todos') return true;
    if (!ctx.dataVenda) return true;

    const hoje = new Date();
    const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const dt = ctx.dataVenda;

    if (state.periodo === 'hoje') return dt >= inicioDia;

    if (state.periodo === '7dias') {
      const limite = new Date(inicioDia.getTime() - 7 * 86400000);
      return dt >= limite;
    }

    if (state.periodo === '30dias') {
      const limite = new Date(inicioDia.getTime() - 30 * 86400000);
      return dt >= limite;
    }

    if (state.periodo === 'mes') {
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      return dt >= inicioMes;
    }

    return true;
  }

  function matchesPagamento(ctx) {
    if (state.pagamento === 'todos') return true;

    const f = ctx.forma;

    if (state.pagamento === 'pix')      return f.includes('pix');
    if (state.pagamento === 'cash')     return f.includes('dinheiro');
    if (state.pagamento === 'debit_card')  return f.includes('débito') || f.includes('debito');
    if (state.pagamento === 'credit_card') return f.includes('crédito') || f.includes('credito');
    if (state.pagamento === 'boleto')   return f.includes('boleto');
    if (state.pagamento === 'other')    return f.includes('outro');

    return true;
  }

  function matchesSearch(ctx) {
    if (!state.search) return true;
    return ctx.cliente.includes(state.search) || ctx.numero.includes(state.search);
  }

  /* ---------------------------------------------------------
     Aplicar
     --------------------------------------------------------- */
  function aplicar() {
    const tbody = $('sales-body');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length === 0) return;

    let visible = 0;
    let faturamento = 0;
    let aReceber = 0;

    rows.forEach(row => {
      const ctx = extrairContexto(row);
      if (!ctx) { row.style.display = ''; visible++; return; }

      const show =
        matchesSearch(ctx) &&
        matchesStatus(ctx) &&
        matchesPeriodo(ctx) &&
        matchesPagamento(ctx);

      row.style.display = show ? '' : 'none';

      if (show) {
        visible++;
        faturamento += ctx.total;
        // Se a coluna de "Pagamento" tiver "Não pago", soma a receber
        const pgtoText = row.children[4] ? row.children[4].textContent.toLowerCase() : '';
        if (pgtoText.includes('não pago') || pgtoText.includes('nao pago')) {
          aReceber += ctx.total;
        }
      }
    });

    // Contador
    const countEl = $('sales-count');
    if (countEl) {
      if (visible === 0) countEl.textContent = 'Nenhuma venda';
      else if (visible === 1) countEl.textContent = '1 venda';
      else countEl.textContent = visible + ' vendas';
    }

    // Stats
    const totalEl = $('stat-count');
    if (totalEl) totalEl.textContent = visible;

    const fatEl = $('stat-faturamento');
    if (fatEl) fatEl.textContent = 'R$ ' + fmtMoney(faturamento);

    const recEl = $('stat-receber');
    if (recEl) recEl.textContent = 'R$ ' + fmtMoney(aReceber);

    const ticketEl = $('stat-ticket');
    if (ticketEl) {
      const ticket = visible > 0 ? faturamento / visible : 0;
      ticketEl.textContent = 'R$ ' + fmtMoney(ticket);
    }

    // Estado vazio
    const emptyEl = $('sales-empty');
    const tableWrap = $('sales-table-wrap');
    const loadingEl = $('sales-loading');
    const carregou = loadingEl && loadingEl.hidden;

    if (visible === 0 && rows.length > 0 && carregou) {
      if (emptyEl) {
        const titleEl = $('sales-empty-title');
        const textEl = $('sales-empty-text');
        if (titleEl) titleEl.textContent = 'Nenhuma venda encontrada';
        if (textEl) textEl.textContent = 'Ajuste os filtros para ver mais resultados.';
        emptyEl.hidden = false;
      }
      if (tableWrap) tableWrap.hidden = true;
    } else if (visible > 0) {
      if (emptyEl) emptyEl.hidden = true;
      if (tableWrap) tableWrap.hidden = false;
    }
  }

  function fmtMoney(v) {
    const n = Number(v) || 0;
    return n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /* ---------------------------------------------------------
     Observa mudanças
     --------------------------------------------------------- */
  function observar() {
    const tbody = $('sales-body');
    if (!tbody) return;

    const mo = new MutationObserver(() => {
      clearTimeout(observar._t);
      observar._t = setTimeout(aplicar, 30);
    });
    mo.observe(tbody, { childList: true });
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  function boot() {
    const searchEl = $('search-input');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        state.search = searchEl.value.trim().toLowerCase();
        aplicar();
      });
    }

    const statusEl = $('filter-status');
    if (statusEl) {
      statusEl.addEventListener('change', () => {
        state.status = statusEl.value;
        aplicar();
      });
    }

    const periodoEl = $('filter-periodo');
    if (periodoEl) {
      periodoEl.addEventListener('change', () => {
        state.periodo = periodoEl.value;
        aplicar();
      });
    }

    const pagtoEl = $('filter-pagamento');
    if (pagtoEl) {
      pagtoEl.addEventListener('change', () => {
        state.pagamento = pagtoEl.value;
        aplicar();
      });
    }

    let tentativas = 0;
    const tick = () => {
      const tbody = $('sales-body');
      if (tbody) {
        observar();
        aplicar();
        return;
      }
      tentativas++;
      if (tentativas < 30) setTimeout(tick, 200);
    };
    tick();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();