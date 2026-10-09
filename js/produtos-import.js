/* =========================================================
   DEV HUB · Produtos · Importação de planilhas
   ---------------------------------------------------------
   - Aceita .xlsx, .xls, .csv
   - Validação ESTRITA das colunas (nome normalizado:
     lowercase, sem acento, espaços → _)
   - Se faltar coluna obrigatória OU sobrar coluna
     desconhecida → rejeita a planilha
   - Preview das primeiras 5 linhas
   - Insert em lote (batches de 50)
   - Botão "Baixar modelo" gera XLSX com o padrão
   ---------------------------------------------------------
   UI PREMIUM · Futurista
   - Cards com gradiente e glow
   - Números em fonte monoespaçada grande
   - Animações sutis de entrada
   - Glassmorphism no backdrop
   - Erros com hover e scroll customizado
   ---------------------------------------------------------
   CORREÇÕES:
   - anti-flash: click no botão faz stopPropagation + guard 250ms
   - z-index máximo (2147483647) vence o FloTo Widget (2147483647)
   - esconde FloTo Widget enquanto o modal está aberto
   ========================================================= */

(function () {
  'use strict';

  /* ---------------------------------------------------------
     Schema — mapeia header normalizado → campo interno
     --------------------------------------------------------- */
  const SCHEMA = [
    { header: 'nome',            key: 'name',          required: true,  type: 'string' },
    { header: 'preco',           key: 'price',         required: true,  type: 'number' },
    { header: 'codigo',          key: 'code',          required: false, type: 'string' },
    { header: 'codigo_barras',   key: 'barcode',       required: false, type: 'string' },
    { header: 'descricao',       key: 'description',   required: false, type: 'string' },
    { header: 'estoque',         key: 'stock',         required: false, type: 'integer' },
    { header: 'estoque_minimo',  key: 'minimum_stock', required: false, type: 'integer' },
    { header: 'ativo',           key: 'active',        required: false, type: 'boolean' }
  ];

  const REQUIRED = SCHEMA.filter(c => c.required).map(c => c.header);
  const KNOWN    = SCHEMA.map(c => c.header);
  const BATCH    = 50;

  /* ---------------------------------------------------------
     Estado
     --------------------------------------------------------- */
  const state = {
    orgId: null,
    userId: null,
    file: null,
    rawRows: [],
    headerMap: {},
    validRows: [],
    rowErrors: [],
    stage: 'idle',
    importing: false,
    modal: null,
    results: { success: 0, fail: 0 },
    openedAt: 0
  };

  document.addEventListener('DOMContentLoaded', boot);

  async function boot() {
    const Auth = window.Auth;
    if (!Auth || !window.db || !Auth.isConfigured || !Auth.isConfigured()) return;

    const session = await Auth.requireSession().catch(() => null);
    if (!session) return;

    state.userId = session.user.id;

    let profile = null;
    try { profile = await Auth.getProfile(session.user.id); } catch (e) {}
    state.orgId = (profile && profile.organization_id) || null;

    ensureStyles();
    observarBotao();
  }

  /* =========================================================
     Botão
     ========================================================= */
  function observarBotao() {
    let tentativas = 0;
    const tick = () => {
      const btn = encontrarOuInjetarBotao();
      if (btn && !btn.dataset.importWired) {
        btn.dataset.importWired = '1';
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
          abrir();
        });
      }
      tentativas += 1;
      if (tentativas < 25 && (!btn || !btn.dataset.importWired)) {
        setTimeout(tick, 400);
      }
    };
    tick();
  }

  function encontrarOuInjetarBotao() {
    let btn = document.getElementById('import-products-btn');
    if (btn) return btn;

    const anchor = document.getElementById('scanner-mode-btn') ||
                   document.getElementById('new-product-btn');
    if (!anchor) return null;

    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'import-products-btn';
    btn.className = 'btn btn--ghost';
    btn.title = 'Importar planilha';
    btn.style.cssText = 'white-space:nowrap; display:inline-flex; align-items:center; gap:6px;';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 3v12"/>' +
      '<path d="m7 10 5 5 5-5"/>' +
      '<path d="M5 21h14"/></svg>' +
      '<span>Importar</span>';
    anchor.insertAdjacentElement('afterend', btn);
    return btn;
  }

  /* =========================================================
     Modal
     ========================================================= */
  function abrir() {
    if (!state.modal) state.modal = buildModal();
    if (!state.modal.parentNode) document.body.appendChild(state.modal);
    resetState();
    renderStage();
    state.modal.hidden = false;
    document.body.classList.add('dh-scan-open');
    state.openedAt = Date.now();
  }

  function fechar() {
    if (state.importing) return;
    if (state.openedAt && (Date.now() - state.openedAt) < 250) return;

    if (state.modal) state.modal.hidden = true;
    document.body.classList.remove('dh-scan-open');
  }

  function resetState() {
    state.file = null;
    state.rawRows = [];
    state.headerMap = {};
    state.validRows = [];
    state.rowErrors = [];
    state.stage = 'idle';
    state.importing = false;
    state.results = { success: 0, fail: 0 };
  }

  function buildModal() {
    const modal = document.createElement('div');
    modal.id = 'dh-imp-modal';
    modal.className = 'dh-scan-backdrop';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="dh-scan-card" role="dialog" aria-modal="true">
        <header class="dh-scan-header">
          <div class="dh-scan-header__brand">
            <span class="dh-scan-header__icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                   stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
                   stroke-linejoin="round" aria-hidden="true">
                <path d="M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/>
                <path d="M14 2.5v5h5"/>
                <path d="M9 13h6M9 17h4"/>
              </svg>
            </span>
            <div>
              <h2>Importar produtos</h2>
              <p>Importe em massa via planilha</p>
            </div>
          </div>
          <button type="button" class="dh-scan-close" data-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round"
                 aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>

        <div class="dh-scan-body" id="dh-imp-body"></div>

        <footer class="dh-scan-footer">
          <button type="button" class="dh-scan-btn dh-scan-btn--ghost" data-close>Cancelar</button>
          <button type="button" class="dh-scan-btn dh-scan-btn--primary" id="dh-imp-confirm"
                  style="display:none;">
            Importar
          </button>
        </footer>
      </div>
    `;

    modal.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', fechar);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) fechar();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.modal && !state.modal.hidden) fechar();
    });

    return modal;
  }

  /* =========================================================
     Render por estágio
     ========================================================= */
  function renderStage() {
    const body = state.modal.querySelector('#dh-imp-body');
    const confirmBtn = state.modal.querySelector('#dh-imp-confirm');
    if (!body || !confirmBtn) return;

    if (state.stage === 'idle') {
      body.innerHTML = renderIdle();
      confirmBtn.style.display = 'none';
      wireIdle();
    } else if (state.stage === 'validated') {
      body.innerHTML = renderValidated();
      confirmBtn.style.display = '';
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Importar ' + state.validRows.length + ' produto' +
        (state.validRows.length === 1 ? '' : 's');
      if (!confirmBtn.dataset.wired) {
        confirmBtn.dataset.wired = '1';
        confirmBtn.addEventListener('click', doImport);
      }
    } else if (state.stage === 'importing') {
      body.innerHTML = renderImporting();
      confirmBtn.style.display = 'none';
    } else if (state.stage === 'done') {
      body.innerHTML = renderDone();
      confirmBtn.style.display = '';
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Fechar';
      confirmBtn.onclick = function () {
        fechar();
        if (window.Produtos && typeof window.Produtos.reload === 'function') {
          window.Produtos.reload();
        }
      };
    }
  }

  /* =========================================================
     IDLE · Drop zone futurista
     ========================================================= */
  function renderIdle() {
    return `
      <div class="dh-imp-drop" id="dh-imp-drop">
        <div class="dh-imp-drop__glow" aria-hidden="true"></div>
        <div class="dh-imp-drop__icon">
          <svg viewBox="0 0 24 24" width="44" height="44" fill="none"
               stroke="currentColor" stroke-width="1.3" stroke-linecap="round"
               stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3v14"/>
            <path d="m6 11 6 6 6-6"/>
            <path d="M3 21h18"/>
          </svg>
        </div>
        <p class="dh-imp-drop__title"><strong>Arraste um arquivo .xlsx ou .csv</strong></p>
        <p class="dh-imp-hint">ou clique para selecionar</p>
        <input type="file" id="dh-imp-input" accept=".xlsx,.xls,.csv" hidden>
      </div>

      <div class="dh-imp-actions">
        <button type="button" class="dh-scan-btn dh-scan-btn--ghost" id="dh-imp-download">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
               stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
               stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>
          </svg>
          <span>Baixar modelo</span>
        </button>
      </div>

      <div class="dh-imp-cols">
        <p class="dh-imp-cols__title">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round"
               stroke-linejoin="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h10"/>
          </svg>
          Colunas esperadas
        </p>
        <ul>
          ${SCHEMA.map(c =>
            `<li><code>${c.header}</code>${c.required ? ' <b>*</b>' : ''}` +
            `<span>${c.type === 'number' ? 'número' : c.type === 'integer' ? 'inteiro' : c.type === 'boolean' ? 'sim/não' : 'texto'}</span></li>`
          ).join('')}
        </ul>
        <p class="dh-imp-hint"><b>*</b> obrigatório</p>
      </div>
    `;
  }

  function wireIdle() {
    const drop = state.modal.querySelector('#dh-imp-drop');
    const input = state.modal.querySelector('#dh-imp-input');
    const dl = state.modal.querySelector('#dh-imp-download');

    if (input) {
      input.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) onFile(f);
      });
    }

    if (drop) {
      drop.addEventListener('click', () => input && input.click());

      ['dragenter', 'dragover'].forEach(evt => {
        drop.addEventListener(evt, (e) => {
          e.preventDefault();
          drop.classList.add('is-hover');
        });
      });
      ['dragleave', 'drop'].forEach(evt => {
        drop.addEventListener(evt, (e) => {
          e.preventDefault();
          drop.classList.remove('is-hover');
        });
      });
      drop.addEventListener('drop', (e) => {
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) onFile(f);
      });
    }

    if (dl) {
      dl.addEventListener('click', baixarModelo);
    }
  }

  /* =========================================================
     VALIDATED · Preview premium
     ========================================================= */
  function renderValidated() {
    const ok = state.validRows.length;
    const err = state.rowErrors.length;
    const preview = state.validRows.slice(0, 5);

    return `
      <div class="dh-imp-stat">
        <div class="dh-imp-stat__item dh-imp-stat__item--ok">
          <div class="dh-imp-stat__label">Linhas válidas</div>
          <div class="dh-imp-stat__value">${ok}</div>
        </div>
        ${err > 0 ? `
          <div class="dh-imp-stat__divider"></div>
          <div class="dh-imp-stat__item dh-imp-stat__item--warn">
            <div class="dh-imp-stat__label">Com erro</div>
            <div class="dh-imp-stat__value">${err}</div>
          </div>
        ` : ''}
      </div>

      <div class="dh-imp-file">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
             stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
             stroke-linejoin="round" aria-hidden="true">
          <path d="M14 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/>
          <path d="M14 2.5v5h5"/>
        </svg>
        <span>${escapeHtml(state.file.name)}</span>
      </div>

      ${err > 0 ? `
        <details class="dh-imp-warn" open>
          <summary>
            <span class="dh-imp-warn__icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                   stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
                   stroke-linejoin="round" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <path d="M12 9v4"/><path d="M12 17h.01"/>
              </svg>
            </span>
            <span class="dh-imp-warn__title">${err} linha${err === 1 ? '' : 's'} com erro</span>
            <span class="dh-imp-warn__meta">serão ignoradas</span>
          </summary>
          <ul class="dh-imp-errors">
            ${state.rowErrors.slice(0, 10).map(e =>
              `<li><span class="dh-imp-errors__dot"></span>Linha ${e.line}: ${escapeHtml(e.message)}</li>`
            ).join('')}
            ${err > 10 ? `<li class="dh-imp-errors__more">…e mais ${err - 10} erro(s)</li>` : ''}
          </ul>
        </details>
      ` : ''}

      <div class="dh-imp-preview">
        <p class="dh-imp-cols__title">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round"
               stroke-linejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          Prévia (${Math.min(5, ok)} de ${ok})
        </p>
        <div class="dh-imp-preview__wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th><th>Cód.</th><th>Barras</th>
                <th class="num">Preço</th><th class="num">Estoque</th>
              </tr>
            </thead>
            <tbody>
              ${preview.map(r => `
                <tr>
                  <td class="dh-imp-preview__name">${escapeHtml(r.name)}</td>
                  <td>${escapeHtml(r.code || '—')}</td>
                  <td class="dh-imp-preview__mono">${escapeHtml(r.barcode || '—')}</td>
                  <td class="num dh-imp-preview__price">R$ ${fmtBRL(r.price)}</td>
                  <td class="num">${r.stock}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /* =========================================================
     IMPORTING · Progresso futurista
     ========================================================= */
  function renderImporting() {
    const pct = state.progress ? Math.round(state.progress.pct) : 0;
    const done = state.progress ? state.progress.done : 0;
    const total = state.progress ? state.progress.total : state.validRows.length;

    return `
      <div class="dh-imp-loading">
        <div class="dh-imp-loading__orbit" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <p class="dh-imp-loading__title">Importando produtos</p>
        <p class="dh-imp-loading__counter">
          <span>${done}</span> <small>/ ${total}</small>
        </p>
        <div class="dh-imp-bar"><span style="width:${pct}%"></span></div>
        <p class="dh-imp-loading__pct">${pct}%</p>
      </div>
    `;
  }

  /* =========================================================
     DONE · Resultado premium
     ========================================================= */
  function renderDone() {
    const { success, fail } = state.results;
    const allOk = fail === 0;

    return `
      <div class="dh-imp-result ${allOk ? 'dh-imp-result--ok' : 'dh-imp-result--warn'}">
        <div class="dh-imp-result__glow" aria-hidden="true"></div>

        <div class="dh-imp-result__header">
          <span class="dh-imp-result__check">
            ${allOk ? `
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
                   stroke="currentColor" stroke-width="3" stroke-linecap="round"
                   stroke-linejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            ` : `
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
                   stroke="currentColor" stroke-width="2.4" stroke-linecap="round"
                   stroke-linejoin="round" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <path d="M12 9v4"/><path d="M12 17h.01"/>
              </svg>
            `}
          </span>
          <div class="dh-imp-result__title-wrap">
            <h3>${allOk ? 'Importação concluída' : 'Importação parcial'}</h3>
            <p>${allOk ? 'Todos os produtos foram importados com sucesso.' : 'Alguns produtos não puderam ser importados.'}</p>
          </div>
        </div>

        <div class="dh-imp-result__stats">
          <div class="dh-imp-result__stat dh-imp-result__stat--ok">
            <div class="dh-imp-result__stat-label">Importados</div>
            <div class="dh-imp-result__stat-value">${success}</div>
          </div>
          ${fail > 0 ? `
            <div class="dh-imp-result__stat-sep" aria-hidden="true"></div>
            <div class="dh-imp-result__stat dh-imp-result__stat--warn">
              <div class="dh-imp-result__stat-label">Com erro</div>
              <div class="dh-imp-result__stat-value">${fail}</div>
            </div>
          ` : ''}
        </div>
      </div>

      ${fail > 0 ? `
        <details class="dh-imp-warn dh-imp-warn--mt">
          <summary>
            <span class="dh-imp-warn__icon">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                   stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
                   stroke-linejoin="round" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <path d="M12 9v4"/><path d="M12 17h.01"/>
              </svg>
            </span>
            <span class="dh-imp-warn__title">Ver detalhes dos erros</span>
            <span class="dh-imp-warn__meta">${fail} linha${fail === 1 ? '' : 's'}</span>
          </summary>
          <ul class="dh-imp-errors">
            ${state.rowErrors.slice(0, 20).map(e =>
              `<li><span class="dh-imp-errors__dot"></span>Linha ${e.line}: ${escapeHtml(e.message)}</li>`
            ).join('')}
            ${fail > 20 ? `<li class="dh-imp-errors__more">…e mais ${fail - 20} erro(s)</li>` : ''}
          </ul>
        </details>
      ` : ''}
    `;
  }

  /* =========================================================
     Baixar modelo
     ========================================================= */
  function baixarModelo() {
    if (typeof XLSX === 'undefined') {
      toast('Biblioteca de planilha não carregou.', 'error');
      return;
    }

    const headers = SCHEMA.map(c => c.header);
    const example = [
      'Caneta Esferográfica Azul',
      '2,50',
      'CAN-001',
      '7891234567890',
      'Caneta azul ponta fina',
      '100',
      '10',
      'sim'
    ];

    const row = SCHEMA.map(c => {
      const idx = headers.indexOf(c.header);
      return example[idx];
    });

    const wsData = [headers, row];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(14, h.length + 2) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    XLSX.writeFile(wb, 'modelo-produtos.xlsx');

    toast('Modelo baixado.', 'success');
  }

  /* =========================================================
     Ler arquivo
     ========================================================= */
  async function onFile(file) {
    if (typeof XLSX === 'undefined') {
      toast('Biblioteca de planilha não carregou.', 'error');
      return;
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (['xlsx', 'xls', 'csv'].indexOf(ext) === -1) {
      toast('Formato não aceito. Use .xlsx, .xls ou .csv', 'error');
      return;
    }

    state.file = file;
    state.rowErrors = [];

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];

      const aoa = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        raw: false,
        blankrows: false
      });

      if (!aoa || aoa.length < 2) {
        toast('A planilha está vazia ou não tem linhas.', 'error');
        return;
      }

      const rawHeaders = aoa[0].map(h => String(h == null ? '' : h));
      const body = aoa.slice(1);

      const validation = validateHeaders(rawHeaders);
      if (!validation.ok) {
        showHeaderError(validation);
        return;
      }

      state.headerMap = validation.headerMap;

      state.validRows = [];
      body.forEach((linha, idx) => {
        const lineNum = idx + 2;
        const row = convertRow(linha, validation.headerMap, lineNum);
        if (row.ok) {
          state.validRows.push(row.data);
        } else {
          state.rowErrors.push({ line: lineNum, message: row.error });
        }
      });

      if (state.validRows.length === 0) {
        toast('Nenhuma linha válida encontrada.', 'error');
        return;
      }

      state.stage = 'validated';
      renderStage();
    } catch (err) {
      console.error('[import] erro lendo planilha:', err);
      toast('Não foi possível ler a planilha.', 'error');
    }
  }

  /* =========================================================
     Validação de headers
     ========================================================= */
  function validateHeaders(rawHeaders) {
    const headerMap = {};
    const foundNormalized = [];
    const extras = [];

    rawHeaders.forEach((h, i) => {
      const norm = normalizeHeader(h);
      if (!norm) return;
      foundNormalized.push(norm);

      if (KNOWN.indexOf(norm) === -1) {
        extras.push(h);
        return;
      }
      if (headerMap[norm] === undefined) {
        headerMap[norm] = i;
      }
    });

    const missing = REQUIRED.filter(h => headerMap[h] === undefined);

    if (missing.length > 0 || extras.length > 0) {
      return {
        ok: false,
        missing: missing,
        extras: extras,
        detected: foundNormalized
      };
    }

    return { ok: true, headerMap: headerMap };
  }

  function normalizeHeader(h) {
    return String(h == null ? '' : h)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  function showHeaderError(v) {
    const missing = v.missing || [];
    const extras = v.extras || [];

    let msg = '';
    if (missing.length > 0 && extras.length > 0) {
      msg = 'Faltam colunas obrigatórias e existem colunas desconhecidas.';
    } else if (missing.length > 0) {
      msg = 'Faltam colunas obrigatórias.';
    } else {
      msg = 'Existem colunas desconhecidas na planilha.';
    }

    const body = state.modal.querySelector('#dh-imp-body');
    if (body) {
      body.innerHTML = `
        <div class="dh-imp-result dh-imp-result--err">
          <div class="dh-imp-result__glow" aria-hidden="true"></div>
          <div class="dh-imp-result__header">
            <span class="dh-imp-result__check">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
                   stroke="currentColor" stroke-width="2.4" stroke-linecap="round"
                   stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/>
              </svg>
            </span>
            <div class="dh-imp-result__title-wrap">
              <h3>Planilha não reconhecida</h3>
              <p>${escapeHtml(msg)}</p>
            </div>
          </div>
        </div>

        ${missing.length > 0 ? `
          <div class="dh-imp-cols">
            <p class="dh-imp-cols__title">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
                   stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
                   stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/>
              </svg>
              Faltando
            </p>
            <ul>${missing.map(h => `<li class="is-no"><code>${h}</code><span>ausente</span></li>`).join('')}</ul>
          </div>
        ` : ''}

        ${extras.length > 0 ? `
          <div class="dh-imp-cols">
            <p class="dh-imp-cols__title">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
                   stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
                   stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/>
              </svg>
              Desconhecidas
            </p>
            <ul>${extras.map(h => `<li class="is-no"><code>${escapeHtml(h)}</code><span>remover</span></li>`).join('')}</ul>
            <p class="dh-imp-hint">
              Renomeie pra bater com o padrão ou use o "Baixar modelo".
            </p>
          </div>
        ` : ''}

        <div class="dh-imp-cols">
          <p class="dh-imp-cols__title">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round"
                 stroke-linejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            Colunas aceitas
          </p>
          <ul>
            ${SCHEMA.map(c => `<li><code>${c.header}</code>${c.required ? ' <b>*</b>' : ''}<span>${c.type === 'number' ? 'número' : c.type === 'integer' ? 'inteiro' : c.type === 'boolean' ? 'sim/não' : 'texto'}</span></li>`).join('')}
          </ul>
        </div>

        <div class="dh-imp-actions" style="margin-top:14px;">
          <button type="button" class="dh-scan-btn dh-scan-btn--ghost" id="dh-imp-retry">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round"
                 stroke-linejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>
            </svg>
            <span>Tentar outro arquivo</span>
          </button>
          <button type="button" class="dh-scan-btn dh-scan-btn--ghost" id="dh-imp-download2">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                 stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
                 stroke-linejoin="round" aria-hidden="true">
              <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>
            </svg>
            <span>Baixar modelo</span>
          </button>
        </div>
      `;

      body.querySelector('#dh-imp-retry').addEventListener('click', () => {
        resetState();
        renderStage();
      });
      body.querySelector('#dh-imp-download2').addEventListener('click', baixarModelo);
    }

    state.stage = 'idle';
  }

  /* =========================================================
     Conversão de linha
     ========================================================= */
  function convertRow(rawRow, headerMap, lineNum) {
    const get = (h) => headerMap[h] !== undefined ? rawRow[headerMap[h]] : undefined;

    const name = String(get('nome') || '').trim();
    if (!name) return { ok: false, error: 'Nome vazio' };

    const priceRaw = get('preco');
    const price = parseNumber(priceRaw);
    if (price === null || price < 0) {
      return { ok: false, error: 'Preço inválido ("' + priceRaw + '")' };
    }

    const code = String(get('codigo') || '').trim() || null;
    const barcode = String(get('codigo_barras') || '').trim() || null;
    const description = String(get('descricao') || '').trim() || null;

    const stockRaw = get('estoque');
    const stock = parseIntSafe(stockRaw, 0);
    if (stock < 0) return { ok: false, error: 'Estoque negativo' };

    const minRaw = get('estoque_minimo');
    const minimum_stock = parseIntSafe(minRaw, 0);
    if (minimum_stock < 0) return { ok: false, error: 'Estoque mínimo negativo' };

    const activeRaw = get('ativo');
    const active = parseBoolean(activeRaw);

    return {
      ok: true,
      data: {
        name: name,
        code: code,
        barcode: barcode,
        description: description,
        price: price,
        stock: stock,
        minimum_stock: minimum_stock,
        active: active
      }
    };
  }

  function parseNumber(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    let s = String(v).trim().replace(/[R$\s]/g, '');

    if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.indexOf(',') !== -1) {
      s = s.replace(',', '.');
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function parseIntSafe(v, def) {
    if (v === null || v === undefined || v === '') return def;
    const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
    return Number.isFinite(n) ? n : def;
  }

  function parseBoolean(v) {
    if (v === null || v === undefined || v === '') return true;
    if (typeof v === 'boolean') return v;
    const s = String(v).trim().toLowerCase();
    if (['nao', 'não', 'n', 'false', '0', 'inativo', 'no'].indexOf(s) !== -1) return false;
    return true;
  }

  /* =========================================================
     Importação
     ========================================================= */
  async function doImport() {
    if (state.importing) return;
    if (state.validRows.length === 0) return;

    state.importing = true;
    state.stage = 'importing';
    state.progress = { done: 0, total: state.validRows.length, pct: 0 };
    state.results = { success: 0, fail: 0 };
    renderStage();

    const chunks = [];
    for (let i = 0; i < state.validRows.length; i += BATCH) {
      chunks.push(state.validRows.slice(i, i + BATCH));
    }

    for (let c = 0; c < chunks.length; c++) {
      const batch = chunks[c].map(r => ({
        name: r.name,
        code: r.code,
        barcode: r.barcode,
        description: r.description,
        price: r.price,
        stock: r.stock,
        minimum_stock: r.minimum_stock,
        active: r.active,
        image_urls: [],
        status: 'approved',
        created_by: state.userId
      }));

      try {
        const { error } = await window.db.from('products').insert(batch);

        if (error) {
          for (const row of batch) {
            const { error: rowErr } = await window.db.from('products').insert(row);
            if (rowErr) {
              state.results.fail += 1;
              state.rowErrors.push({
                line: '(lote)',
                message: rowErr.message || 'Erro ao inserir'
              });
            } else {
              state.results.success += 1;
            }
          }
        } else {
          state.results.success += batch.length;
        }
      } catch (err) {
        state.results.fail += batch.length;
        state.rowErrors.push({ line: '(lote)', message: err.message || 'Erro' });
      }

      state.progress.done = Math.min(state.validRows.length, (c + 1) * BATCH);
      state.progress.pct = (state.progress.done / state.validRows.length) * 100;
      renderStage();
    }

    state.importing = false;
    state.stage = 'done';
    renderStage();
  }

  /* =========================================================
     CSS · Design premium
     ========================================================= */
  function ensureStyles() {
    if (document.getElementById('dh-imp-styles')) return;
    const style = document.createElement('style');
    style.id = 'dh-imp-styles';
    style.textContent = `
      /* =====================================================
         BACKDROP · Glassmorphism
         z-index MAX (vence o FloTo Widget)
         ===================================================== */
      .dh-scan-backdrop{
        position:fixed;inset:0;
        z-index:2147483647;
        background:rgba(3,6,12,.72);
        backdrop-filter:blur(8px) saturate(140%);
        -webkit-backdrop-filter:blur(8px) saturate(140%);
        display:flex;align-items:center;justify-content:center;padding:20px;
        animation:dhImpFade 180ms ease-out;
      }
      .dh-scan-backdrop[hidden]{display:none;}
      @keyframes dhImpFade{ from{opacity:0;} to{opacity:1;} }

      /* Esconde o FloTo Widget enquanto o modal está aberto */
      body.dh-scan-open .floto-widget-root,
      body.dh-scan-open [id^="floto-"],
      body.dh-scan-open [class*="floto-"] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      /* =====================================================
         CARD
         ===================================================== */
      .dh-scan-card{
        width:100%;max-width:640px;
        background:linear-gradient(180deg,#0e1420 0%,#0a0f18 100%);
        color:#e6eaf2;
        border:1px solid rgba(255,255,255,.08);
        border-radius:18px;
        display:flex;flex-direction:column;max-height:92vh;overflow:hidden;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
        box-shadow:
          0 0 0 1px rgba(255,255,255,.02) inset,
          0 30px 80px -20px rgba(0,0,0,.8),
          0 0 120px -40px rgba(59,130,246,.35);
        animation:dhImpCardIn 260ms cubic-bezier(.2,.9,.3,1);
      }
      @keyframes dhImpCardIn{
        from{opacity:0;transform:translateY(8px) scale(.98);}
        to{opacity:1;transform:translateY(0) scale(1);}
      }

      /* =====================================================
         HEADER
         ===================================================== */
      .dh-scan-header{
        display:flex;align-items:center;justify-content:space-between;
        padding:18px 22px;border-bottom:1px solid rgba(255,255,255,.06);
        flex-shrink:0;background:rgba(255,255,255,.015);
      }
      .dh-scan-header__brand{display:flex;align-items:center;gap:12px;}
      .dh-scan-header__icon{
        display:grid;place-items:center;
        width:36px;height:36px;border-radius:10px;
        background:linear-gradient(135deg,rgba(59,130,246,.2),rgba(99,102,241,.15));
        border:1px solid rgba(59,130,246,.3);
        color:#93b6ff;
        box-shadow:0 0 20px -6px rgba(59,130,246,.5);
      }
      .dh-scan-header h2{
        margin:0;font-size:15px;font-weight:600;letter-spacing:-.01em;
        color:#f0f4fa;
      }
      .dh-scan-header p{
        margin:2px 0 0;font-size:12px;color:#7a8698;
      }
      .dh-scan-close{
        appearance:none;border:0;background:transparent;color:#8b95a7;
        cursor:pointer;width:32px;height:32px;border-radius:8px;
        display:grid;place-items:center;
        transition:background .15s,color .15s;
      }
      .dh-scan-close:hover{background:rgba(255,255,255,.06);color:#e6eaf2;}

      /* =====================================================
         BODY
         ===================================================== */
      .dh-scan-body{padding:22px;overflow-y:auto;overflow-x:hidden;}
      .dh-scan-body::-webkit-scrollbar{width:8px;}
      .dh-scan-body::-webkit-scrollbar-track{background:transparent;}
      .dh-scan-body::-webkit-scrollbar-thumb{
        background:rgba(255,255,255,.08);border-radius:4px;
      }
      .dh-scan-body::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.14);}

      /* =====================================================
         FOOTER
         ===================================================== */
      .dh-scan-footer{
        display:flex;justify-content:flex-end;gap:10px;
        padding:16px 22px;border-top:1px solid rgba(255,255,255,.06);
        background:rgba(0,0,0,.2);flex-shrink:0;
      }

      /* =====================================================
         BOTÕES
         ===================================================== */
      .dh-scan-btn{
        appearance:none;border:1px solid transparent;border-radius:10px;
        padding:10px 18px;font-size:13px;font-weight:600;font-family:inherit;
        cursor:pointer;
        display:inline-flex;align-items:center;gap:8px;
        transition:all .15s ease;
        letter-spacing:-.005em;
      }
      .dh-scan-btn--ghost{
        background:rgba(255,255,255,.03);color:#c7d0dd;
        border-color:rgba(255,255,255,.1);
      }
      .dh-scan-btn--ghost:hover{
        background:rgba(255,255,255,.06);
        border-color:rgba(255,255,255,.16);
        color:#e6eaf2;
      }
      .dh-scan-btn--primary{
        background:linear-gradient(135deg,#3b82f6 0%,#6366f1 100%);
        color:#fff;
        box-shadow:
          0 0 0 1px rgba(255,255,255,.1) inset,
          0 8px 24px -8px rgba(59,130,246,.6);
      }
      .dh-scan-btn--primary:hover{
        filter:brightness(1.08);
        box-shadow:
          0 0 0 1px rgba(255,255,255,.15) inset,
          0 10px 28px -8px rgba(59,130,246,.8);
      }
      .dh-scan-btn--primary:disabled{opacity:.6;cursor:not-allowed;}
      body.dh-scan-open{overflow:hidden;}

      /* =====================================================
         DROP ZONE
         ===================================================== */
      .dh-imp-drop{
        position:relative;
        border:1.5px dashed rgba(255,255,255,.14);
        border-radius:16px;
        padding:44px 24px;
        text-align:center;
        color:#8b95a7;
        cursor:pointer;
        overflow:hidden;
        transition:all .2s ease;
      }
      .dh-imp-drop__glow{
        position:absolute;inset:0;
        background:radial-gradient(circle at 50% 0%,rgba(59,130,246,.12),transparent 60%);
        opacity:0;transition:opacity .3s ease;pointer-events:none;
      }
      .dh-imp-drop:hover,.dh-imp-drop.is-hover{
        border-color:rgba(59,130,246,.5);
        color:#93b6ff;
        background:rgba(59,130,246,.03);
      }
      .dh-imp-drop:hover .dh-imp-drop__glow,
      .dh-imp-drop.is-hover .dh-imp-drop__glow{opacity:1;}
      .dh-imp-drop__icon{
        display:inline-grid;place-items:center;
        width:72px;height:72px;border-radius:18px;
        background:linear-gradient(135deg,rgba(59,130,246,.1),rgba(99,102,241,.05));
        border:1px solid rgba(59,130,246,.2);
        color:#93b6ff;margin-bottom:14px;
        transition:transform .25s ease;
      }
      .dh-imp-drop:hover .dh-imp-drop__icon{
        transform:translateY(-3px);
      }
      .dh-imp-drop__title{
        margin:0 0 4px;font-size:14px;color:#b7c0cf;
      }
      .dh-imp-drop__title strong{color:#f0f4fa;font-weight:600;}
      .dh-imp-hint{font-size:12px;color:#7a8698;margin:0;}
      .dh-imp-hint b{color:#f87171;font-weight:700;}

      /* =====================================================
         AÇÕES
         ===================================================== */
      .dh-imp-actions{
        display:flex;justify-content:flex-end;gap:10px;margin-top:16px;
      }

      /* =====================================================
         LISTAS DE COLUNAS
         ===================================================== */
      .dh-imp-cols{margin-top:20px;}
      .dh-imp-cols__title{
        font-size:11px;font-weight:600;color:#c7d0dd;
        margin:0 0 10px;letter-spacing:.06em;text-transform:uppercase;
        display:flex;align-items:center;gap:6px;
      }
      .dh-imp-cols__title svg{opacity:.7;}
      .dh-imp-cols ul{
        list-style:none;padding:0;margin:0;
        display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));
        gap:6px;
      }
      .dh-imp-cols li{
        display:flex;align-items:center;justify-content:space-between;
        gap:8px;
        padding:8px 12px;
        border-radius:9px;
        background:rgba(255,255,255,.02);
        border:1px solid rgba(255,255,255,.05);
        font-size:12px;
        transition:background .15s;
      }
      .dh-imp-cols li:hover{background:rgba(255,255,255,.04);}
      .dh-imp-cols li code{
        font-family:ui-monospace,"SF Mono",Menlo,monospace;
        font-size:11.5px;color:#c7d0dd;letter-spacing:-.01em;
      }
      .dh-imp-cols li span{color:#6b7688;font-size:10.5px;font-weight:500;}
      .dh-imp-cols li b{color:#f87171;font-weight:700;margin-left:2px;}
      .dh-imp-cols li.is-ok{border-color:rgba(34,197,94,.25);background:rgba(34,197,94,.04);}
      .dh-imp-cols li.is-ok span{color:#4ade80;}
      .dh-imp-cols li.is-no{border-color:rgba(239,68,68,.25);background:rgba(239,68,68,.04);}
      .dh-imp-cols li.is-no span{color:#f87171;}

      /* =====================================================
         RESULT CARD PREMIUM · Importação concluída
         ===================================================== */
      .dh-imp-result{
        position:relative;
        border-radius:16px;
        padding:22px;
        overflow:hidden;
        border:1px solid rgba(255,255,255,.08);
      }
      .dh-imp-result__glow{
        position:absolute;inset:0;pointer-events:none;
        opacity:.55;
      }
      .dh-imp-result--ok{
        background:linear-gradient(135deg,rgba(34,197,94,.08) 0%,rgba(16,185,129,.04) 100%);
        border-color:rgba(34,197,94,.3);
        box-shadow:0 0 40px -12px rgba(34,197,94,.4);
      }
      .dh-imp-result--ok .dh-imp-result__glow{
        background:radial-gradient(circle at 0% 0%,rgba(34,197,94,.2),transparent 60%);
      }
      .dh-imp-result--warn{
        background:linear-gradient(135deg,rgba(245,158,11,.08) 0%,rgba(239,68,68,.04) 100%);
        border-color:rgba(245,158,11,.3);
        box-shadow:0 0 40px -12px rgba(245,158,11,.35);
      }
      .dh-imp-result--warn .dh-imp-result__glow{
        background:radial-gradient(circle at 0% 0%,rgba(245,158,11,.18),transparent 60%);
      }
      .dh-imp-result--err{
        background:linear-gradient(135deg,rgba(239,68,68,.08) 0%,rgba(220,38,38,.04) 100%);
        border-color:rgba(239,68,68,.3);
        box-shadow:0 0 40px -12px rgba(239,68,68,.35);
      }
      .dh-imp-result--err .dh-imp-result__glow{
        background:radial-gradient(circle at 0% 0%,rgba(239,68,68,.18),transparent 60%);
      }

      .dh-imp-result__header{
        display:flex;align-items:center;gap:14px;
        position:relative;z-index:1;
      }
      .dh-imp-result__check{
        display:grid;place-items:center;
        width:44px;height:44px;border-radius:12px;
        flex:none;
      }
      .dh-imp-result--ok .dh-imp-result__check{
        background:linear-gradient(135deg,rgba(34,197,94,.25),rgba(16,185,129,.1));
        border:1px solid rgba(34,197,94,.45);
        color:#4ade80;
        box-shadow:0 0 24px -4px rgba(34,197,94,.5);
      }
      .dh-imp-result--warn .dh-imp-result__check{
        background:linear-gradient(135deg,rgba(245,158,11,.25),rgba(239,68,68,.1));
        border:1px solid rgba(245,158,11,.45);
        color:#fbbf24;
        box-shadow:0 0 24px -4px rgba(245,158,11,.5);
      }
      .dh-imp-result--err .dh-imp-result__check{
        background:linear-gradient(135deg,rgba(239,68,68,.25),rgba(220,38,38,.1));
        border:1px solid rgba(239,68,68,.45);
        color:#f87171;
        box-shadow:0 0 24px -4px rgba(239,68,68,.5);
      }

      .dh-imp-result__title-wrap{flex:1;min-width:0;}
      .dh-imp-result__title-wrap h3{
        margin:0;font-size:15px;font-weight:600;color:#f0f4fa;
        letter-spacing:-.01em;
      }
      .dh-imp-result__title-wrap p{
        margin:3px 0 0;font-size:12.5px;color:#8b95a7;
      }

      /* -------- STATS GRANDES -------- */
      .dh-imp-result__stats{
        display:flex;align-items:stretch;gap:0;
        margin-top:20px;position:relative;z-index:1;
        padding-top:18px;
        border-top:1px solid rgba(255,255,255,.06);
      }
      .dh-imp-result__stat{
        flex:1;display:flex;flex-direction:column;gap:4px;
        padding:0 4px;
      }
      .dh-imp-result__stat-label{
        font-size:10.5px;font-weight:600;letter-spacing:.1em;
        text-transform:uppercase;color:#7a8698;
      }
      .dh-imp-result__stat-value{
        font-family:ui-monospace,"SF Mono",Menlo,monospace;
        font-size:38px;font-weight:700;line-height:1;
        letter-spacing:-.04em;
      }
      .dh-imp-result__stat--ok .dh-imp-result__stat-value{
        color:#4ade80;
        text-shadow:0 0 28px rgba(34,197,94,.5);
      }
      .dh-imp-result__stat--warn .dh-imp-result__stat-value{
        color:#fbbf24;
        text-shadow:0 0 28px rgba(245,158,11,.5);
      }
      .dh-imp-result__stat-sep{
        width:1px;background:linear-gradient(180deg,transparent,rgba(255,255,255,.1),transparent);
        margin:0 20px;
      }

      /* =====================================================
         FILE TAG
         ===================================================== */
      .dh-imp-file{
        display:inline-flex;align-items:center;gap:8px;
        padding:8px 12px;margin-top:14px;
        border-radius:9px;
        background:rgba(255,255,255,.03);
        border:1px solid rgba(255,255,255,.06);
        font-size:12.5px;color:#c7d0dd;
      }
      .dh-imp-file svg{color:#7a8698;flex:none;}
      .dh-imp-file span{
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        max-width:420px;
      }

      /* =====================================================
         STATS PEQUENOS (validated)
         ===================================================== */
      .dh-imp-stat{
        display:flex;align-items:center;gap:0;
        padding:16px 18px;
        border-radius:14px;
        background:linear-gradient(135deg,rgba(34,197,94,.06),rgba(59,130,246,.03));
        border:1px solid rgba(34,197,94,.2);
      }
      .dh-imp-stat__item{flex:1;display:flex;flex-direction:column;gap:2px;}
      .dh-imp-stat__item--ok .dh-imp-stat__label{color:#86efac;}
      .dh-imp-stat__item--ok .dh-imp-stat__value{color:#4ade80;text-shadow:0 0 20px rgba(34,197,94,.4);}
      .dh-imp-stat__item--warn .dh-imp-stat__label{color:#fcd34d;}
      .dh-imp-stat__item--warn .dh-imp-stat__value{color:#fbbf24;text-shadow:0 0 20px rgba(245,158,11,.4);}
      .dh-imp-stat__label{
        font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
      }
      .dh-imp-stat__value{
        font-family:ui-monospace,"SF Mono",Menlo,monospace;
        font-size:28px;font-weight:700;line-height:1;letter-spacing:-.03em;
      }
      .dh-imp-stat__divider{
        width:1px;height:38px;
        background:linear-gradient(180deg,transparent,rgba(255,255,255,.12),transparent);
        margin:0 22px;
      }

      /* =====================================================
         WARN BOX · Erros
         ===================================================== */
      .dh-imp-warn{
        margin-top:14px;padding:0;
        border-radius:12px;
        background:rgba(245,158,11,.05);
        border:1px solid rgba(245,158,11,.22);
        overflow:hidden;
      }
      .dh-imp-warn--mt{margin-top:16px;}
      .dh-imp-warn summary{
        display:flex;align-items:center;gap:10px;
        padding:12px 16px;cursor:pointer;
        list-style:none;
        transition:background .15s;
      }
      .dh-imp-warn summary::-webkit-details-marker{display:none;}
      .dh-imp-warn summary:hover{background:rgba(245,158,11,.06);}
      .dh-imp-warn__icon{
        display:grid;place-items:center;
        width:22px;height:22px;border-radius:6px;
        background:rgba(245,158,11,.15);
        color:#fbbf24;flex:none;
      }
      .dh-imp-warn__title{
        font-size:13px;font-weight:600;color:#fcd34d;
        flex:1;
      }
      .dh-imp-warn__meta{
        font-size:11.5px;color:#a68b46;
        font-family:ui-monospace,"SF Mono",Menlo,monospace;
      }
      .dh-imp-warn[open] summary{
        border-bottom:1px solid rgba(245,158,11,.15);
      }

      .dh-imp-errors{
        list-style:none;padding:8px 16px 12px;margin:0;
        max-height:220px;overflow-y:auto;
      }
      .dh-imp-errors::-webkit-scrollbar{width:6px;}
      .dh-imp-errors::-webkit-scrollbar-thumb{
        background:rgba(245,158,11,.2);border-radius:3px;
      }
      .dh-imp-errors li{
        display:flex;align-items:center;gap:8px;
        padding:7px 8px;border-radius:6px;
        font-size:12.5px;color:#d4c47e;
        font-family:ui-monospace,"SF Mono",Menlo,monospace;
        transition:background .12s;
      }
      .dh-imp-errors li:hover{background:rgba(245,158,11,.06);}
      .dh-imp-errors__dot{
        width:5px;height:5px;border-radius:50%;
        background:#fbbf24;flex:none;
        box-shadow:0 0 8px rgba(245,158,11,.6);
      }
      .dh-imp-errors__more{
        color:#8b7c3a !important;
        font-style:italic;
        padding-left:13px !important;
      }

      /* =====================================================
         PREVIEW TABLE
         ===================================================== */
      .dh-imp-preview{margin-top:20px;}
      .dh-imp-preview__wrap{
        border:1px solid rgba(255,255,255,.06);
        border-radius:12px;
        overflow:hidden;
        max-height:240px;
        overflow-y:auto;
        background:rgba(0,0,0,.15);
      }
      .dh-imp-preview__wrap table{
        width:100%;border-collapse:collapse;font-size:12.5px;
      }
      .dh-imp-preview__wrap thead{
        position:sticky;top:0;z-index:1;
      }
      .dh-imp-preview__wrap th{
        text-align:left;padding:10px 14px;
        background:#0a0f18;
        color:#8b95a7;font-weight:600;font-size:11px;
        letter-spacing:.05em;text-transform:uppercase;
        border-bottom:1px solid rgba(255,255,255,.06);
      }
      .dh-imp-preview__wrap td{
        padding:10px 14px;
        border-top:1px solid rgba(255,255,255,.04);
        color:#c7d0dd;
      }
      .dh-imp-preview__wrap tr:hover td{
        background:rgba(255,255,255,.02);
      }
      .dh-imp-preview__wrap .num{text-align:right;}
      .dh-imp-preview__name{color:#e6eaf2;font-weight:500;}
      .dh-imp-preview__mono{
        font-family:ui-monospace,"SF Mono",Menlo,monospace;
        font-size:11.5px;color:#8b95a7;
      }
      .dh-imp-preview__price{
        color:#86efac !important;
        font-family:ui-monospace,"SF Mono",Menlo,monospace;
        font-weight:600;
      }

      /* =====================================================
         LOADING · Importando
         ===================================================== */
      .dh-imp-loading{
        padding:32px 20px;text-align:center;
      }
      .dh-imp-loading__orbit{
        position:relative;
        width:64px;height:64px;
        margin:0 auto 18px;
      }
      .dh-imp-loading__orbit span{
        position:absolute;inset:0;
        border:2px solid transparent;
        border-radius:50%;
      }
      .dh-imp-loading__orbit span:nth-child(1){
        border-top-color:#3b82f6;
        animation:dhImpSpin 1s linear infinite;
      }
      .dh-imp-loading__orbit span:nth-child(2){
        inset:8px;
        border-right-color:#6366f1;
        animation:dhImpSpin 1.4s linear infinite reverse;
      }
      .dh-imp-loading__orbit span:nth-child(3){
        inset:16px;
        border-bottom-color:#8b5cf6;
        animation:dhImpSpin 1.8s linear infinite;
      }
      .dh-imp-loading__title{
        margin:0 0 8px;font-size:14px;font-weight:600;color:#e6eaf2;
      }
      .dh-imp-loading__counter{
        margin:0 0 20px;
        font-family:ui-monospace,"SF Mono",Menlo,monospace;
        font-size:32px;font-weight:700;
        letter-spacing:-.03em;
      }
      .dh-imp-loading__counter span{
        color:#93b6ff;
        text-shadow:0 0 24px rgba(59,130,246,.5);
      }
      .dh-imp-loading__counter small{color:#5a6577;font-size:18px;}
      .dh-imp-loading__pct{
        margin:10px 0 0;font-size:12px;color:#8b95a7;
        font-family:ui-monospace,monospace;
      }

      .dh-imp-bar{
        margin:0 auto;max-width:340px;
        height:5px;border-radius:999px;
        background:rgba(255,255,255,.06);
        overflow:hidden;
        position:relative;
      }
      .dh-imp-bar span{
        display:block;height:100%;
        background:linear-gradient(90deg,#3b82f6,#6366f1,#8b5cf6);
        transition:width 250ms ease;
        border-radius:999px;
        box-shadow:0 0 16px rgba(99,102,241,.7);
      }

      /* =====================================================
         STATUS BLOCK (usado em validated)
         ===================================================== */
      .dh-imp-status{
        display:flex;align-items:center;gap:10px;
        padding:12px 16px;border-radius:11px;
        background:rgba(59,130,246,.06);
        border:1px solid rgba(59,130,246,.2);
        color:#93b6ff;font-size:13px;
      }
      .dh-imp-status--ok{
        background:rgba(34,197,94,.08);
        border-color:rgba(34,197,94,.25);
        color:#86efac;
      }
      .dh-imp-status--err{
        background:rgba(239,68,68,.08);
        border-color:rgba(239,68,68,.25);
        color:#fca5a5;
      }
      .dh-imp-status--warn{
        background:rgba(245,158,11,.08);
        border-color:rgba(245,158,11,.25);
        color:#fcd34d;
      }

      .dh-imp-spinner{
        display:inline-block;width:14px;height:14px;
        border:2px solid rgba(255,255,255,.3);
        border-top-color:currentColor;
        border-radius:50%;
        animation:dhImpSpin .7s linear infinite;
      }
      @keyframes dhImpSpin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }

  /* =========================================================
     Helpers
     ========================================================= */
  function fmtBRL(v) {
    const n = Number(v) || 0;
    return n.toFixed(2).replace('.', ',');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(msg, type) {
    const region = document.getElementById('toast-region');
    if (!region) { console.log('[import]', msg); return; }
    const el = document.createElement('div');
    el.className = 'toast toast--' + (type || 'info');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const t = document.createElement('span');
    t.className = 'toast__message';
    t.textContent = msg;
    el.appendChild(t);
    region.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 400);
    }, 3200);
  }

  window.ProdutosImport = { abrir };
})();