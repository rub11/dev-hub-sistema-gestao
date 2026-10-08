/* =========================================================
   DEV HUB · Parceiros · Importação de planilhas v2.1
   ---------------------------------------------------------
   - Aceita .xlsx, .xls, .csv
   - Validação ESTRITA de colunas
   - Detecção de duplicatas por CPF/CNPJ (banco + arquivo)
   - Modal redesenhado com lista clicável
   - Rodapé adaptativo: [Cancelar] [Importar] → [OK] [Fechar]
   ========================================================= */

(function () {
  'use strict';

  const { showToast, state } = window.Parn;

  /* ---------------------------------------------------------
     Schema
     --------------------------------------------------------- */
  const SCHEMA = [
    { header: 'nome',                key: 'name',                  required: true,  type: 'string' },
    { header: 'tipo',                key: 'type',                  required: false, type: 'enum',   values: ['pf', 'pj'] },
    { header: 'cpf_cnpj',            key: 'cpf_cnpj',              required: false, type: 'string' },
    { header: 'razao_social',        key: 'company_name',          required: false, type: 'string' },
    { header: 'nome_fantasia',       key: 'trade_name',            required: false, type: 'string' },
    { header: 'inscricao_estadual',  key: 'state_registration',    required: false, type: 'string' },
    { header: 'inscricao_municipal', key: 'municipal_registration',required: false, type: 'string' },
    { header: 'email',               key: 'email',                 required: false, type: 'string' },
    { header: 'telefone',            key: 'phone',                 required: false, type: 'string' },
    { header: 'cep',                 key: 'zip_code',              required: false, type: 'string' },
    { header: 'endereco',            key: 'street',                required: false, type: 'string' },
    { header: 'numero',              key: 'number',                required: false, type: 'string' },
    { header: 'bairro',              key: 'neighborhood',          required: false, type: 'string' },
    { header: 'cidade',              key: 'city',                  required: false, type: 'string' },
    { header: 'uf',                  key: 'state',                 required: false, type: 'string' },
    { header: 'papeis',              key: 'roles',                 required: false, type: 'string' },
    { header: 'status',              key: 'status',                required: false, type: 'enum',   values: ['ativo', 'inativo'] },
    { header: 'regime_tributario',   key: 'tax_regime',            required: false, type: 'string' },
    { header: 'observacoes',         key: 'notes',                 required: false, type: 'string' }
  ];

  const REQUIRED = SCHEMA.filter((c) => c.required).map((c) => c.header);
  const KNOWN    = SCHEMA.map((c) => c.header);

  /* ---------------------------------------------------------
     Estado
     --------------------------------------------------------- */
  const imp = {
    file: null,
    headerMap: {},
    validRows: [],
    rowErrors: [],
    stage: 'idle',
    importing: false,
    progress: null,
    results: { success: 0, fail: 0, replaced: 0, skipped: 0 },
    modal: null,
    strategyModal: null,
    strategy: 'replace',
    selected: new Set()
  };

  /* =========================================================
     Setup — botão "Importar"
     ========================================================= */
  function setupImportButton() {
    ensureStyles();

    let tentativas = 0;
    const tick = () => {
      const anchor = document.getElementById('tb-new');
      if (anchor && !document.getElementById('tb-import')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'parn-tb-action';
        btn.id = 'tb-import';
        btn.title = 'Importar planilha';
        btn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
          'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>' +
          '<span>Importar</span>';
        btn.addEventListener('click', abrir);
        anchor.parentNode.insertBefore(btn, anchor.nextSibling);
        return;
      }
      tentativas += 1;
      if (tentativas < 25) setTimeout(tick, 300);
    };
    tick();
  }

  /* =========================================================
     Modal principal
     ========================================================= */
  function abrir() {
    if (!imp.modal) imp.modal = buildModal();
    if (!imp.modal.parentNode) document.body.appendChild(imp.modal);
    resetImpState();
    renderStage();
    imp.modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function fechar() {
    if (imp.importing) return;
    if (imp.modal) imp.modal.hidden = true;
    document.body.style.overflow = '';
  }

  function resetImpState() {
    imp.file = null;
    imp.headerMap = {};
    imp.validRows = [];
    imp.rowErrors = [];
    imp.stage = 'idle';
    imp.importing = false;
    imp.progress = null;
    imp.results = { success: 0, fail: 0, replaced: 0, skipped: 0 };
    imp.strategy = 'replace';
    imp.selected = new Set();
  }

  function buildModal() {
    const modal = document.createElement('div');
    modal.id = 'dh-imp-partner-modal';
    modal.className = 'dh-scan-backdrop';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="dh-scan-card" role="dialog" aria-modal="true" style="max-width:640px;">
        <header class="dh-scan-header">
          <h2>Importar parceiros</h2>
          <button type="button" class="dh-scan-close" data-close aria-label="Fechar">×</button>
        </header>
        <div class="dh-scan-body" id="dh-imp-p-body"></div>
        <footer class="dh-scan-footer">
          <button type="button" class="dh-scan-btn dh-scan-btn--ghost"
                  id="dh-imp-p-secondary" data-close>Cancelar</button>
          <button type="button" class="dh-scan-btn dh-scan-btn--primary"
                  id="dh-imp-p-confirm" style="display:none;">Importar</button>
        </footer>
      </div>
    `;

    modal.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', fechar);
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) fechar(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && imp.modal && !imp.modal.hidden) fechar();
    });

    return modal;
  }

  /* =========================================================
     Render por estágio
     ========================================================= */
  function renderStage() {
    const body       = imp.modal.querySelector('#dh-imp-p-body');
    const secondary  = imp.modal.querySelector('#dh-imp-p-secondary');
    const confirmBtn = imp.modal.querySelector('#dh-imp-p-confirm');
    if (!body || !secondary || !confirmBtn) return;

    /* Reset básico */
    secondary.dataset.close = '1';
    secondary.onclick = null;
    confirmBtn.onclick = null;

    if (imp.stage === 'idle') {
      body.innerHTML = renderIdle();
      secondary.textContent = 'Cancelar';
      secondary.style.display = '';
      confirmBtn.style.display = 'none';
      wireIdle();
    }

    else if (imp.stage === 'validated') {
      body.innerHTML = renderValidated();
      secondary.textContent = 'Cancelar';
      secondary.style.display = '';
      confirmBtn.style.display = '';
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Importar ' + imp.validRows.length +
        ' parceiro' + (imp.validRows.length === 1 ? '' : 's');
      confirmBtn.onclick = doImport;
    }

    else if (imp.stage === 'importing') {
      body.innerHTML = renderImporting();
      secondary.textContent = 'Cancelar';
      secondary.style.display = 'none';
      confirmBtn.style.display = 'none';
    }

    else if (imp.stage === 'done') {
      body.innerHTML = renderDone();

      /* Botão esquerdo: "OK" — fecha + recarrega lista */
      secondary.textContent = 'OK';
      secondary.style.display = '';
      secondary.dataset.close = '';   /* remove o data-close pra controlar manualmente */
      secondary.onclick = () => {
        fechar();
        setTimeout(() => window.Parn.reload?.(), 300);
      };

      /* Botão direito: "Fechar" — só fecha */
      confirmBtn.style.display = '';
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Fechar';
      confirmBtn.onclick = () => {
        fechar();
      };
    }
  }

  function renderIdle() {
    return `
      <div class="dh-imp-drop" id="dh-imp-p-drop">
        <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3v14"/><path d="m6 11 6 6 6-6"/><path d="M3 21h18"/>
        </svg>
        <p><strong>Arraste um arquivo .xlsx ou .csv</strong></p>
        <p class="dh-imp-hint">ou clique pra selecionar</p>
        <input type="file" id="dh-imp-p-input" accept=".xlsx,.xls,.csv" hidden>
      </div>
      <div class="dh-imp-actions">
        <button type="button" class="dh-scan-btn dh-scan-btn--ghost" id="dh-imp-p-download">Baixar modelo (.xlsx)</button>
      </div>
      <div class="dh-imp-cols">
        <p class="dh-imp-cols__title">Colunas esperadas</p>
        <ul>
          ${SCHEMA.map((c) => `<li><code>${c.header}</code>${c.required ? ' <b>*</b>' : ''}<span>${labelTipo(c)}</span></li>`).join('')}
        </ul>
        <p class="dh-imp-hint"><b>*</b> obrigatório · <code>papeis</code> aceita: cliente, fornecedor, transportadora (separados por vírgula)</p>
      </div>
    `;
  }

  function labelTipo(c) {
    if (c.type === 'enum') return c.values.join(' / ');
    return c.type === 'number' ? 'número' : 'texto';
  }

  function wireIdle() {
    const drop  = imp.modal.querySelector('#dh-imp-p-drop');
    const input = imp.modal.querySelector('#dh-imp-p-input');
    const dl    = imp.modal.querySelector('#dh-imp-p-download');

    if (input) input.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) onFile(f);
    });

    if (drop) {
      drop.addEventListener('click', () => input && input.click());
      ['dragenter', 'dragover'].forEach((evt) => drop.addEventListener(evt, (e) => {
        e.preventDefault(); drop.classList.add('is-hover');
      }));
      ['dragleave', 'drop'].forEach((evt) => drop.addEventListener(evt, (e) => {
        e.preventDefault(); drop.classList.remove('is-hover');
      }));
      drop.addEventListener('drop', (e) => {
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) onFile(f);
      });
    }

    if (dl) dl.addEventListener('click', baixarModelo);
  }

  function renderValidated() {
    const ok = imp.validRows.length;
    const err = imp.rowErrors.length;
    const preview = imp.validRows.slice(0, 5);

    return `
      <div class="dh-imp-status dh-imp-status--ok">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        <span><b>${escapeHtml(imp.file.name)}</b> · ${ok + err} linha${(ok + err) === 1 ? '' : 's'} encontrada${(ok + err) === 1 ? '' : 's'}</span>
      </div>

      <div class="dh-imp-cols">
        <p class="dh-imp-cols__title">Colunas detectadas</p>
        <ul>
          ${KNOWN.map((h) => {
            const present = imp.headerMap.hasOwnProperty(h);
            const req = REQUIRED.indexOf(h) !== -1;
            return `<li class="${present ? 'is-ok' : 'is-no'}"><code>${h}</code>${req ? ' <b>*</b>' : ''}<span>${present ? '✓ detectada' : '✗ ausente'}</span></li>`;
          }).join('')}
        </ul>
      </div>

      ${err > 0 ? `
        <div class="dh-imp-warn">
          <b>${err} linha${err === 1 ? '' : 's'} com erro</b> — vão ser ignoradas.
          <details>
            <summary>Ver detalhes</summary>
            <ul>
              ${imp.rowErrors.slice(0, 10).map((e) => `<li>Linha ${e.line}: ${escapeHtml(e.message)}</li>`).join('')}
              ${err > 10 ? `<li>…e mais ${err - 10} erro(s)</li>` : ''}
            </ul>
          </details>
        </div>
      ` : ''}

      <div class="dh-imp-preview">
        <p class="dh-imp-cols__title">Prévia (${Math.min(5, ok)} de ${ok})</p>
        <div class="dh-imp-preview__wrap">
          <table>
            <thead><tr><th>Nome</th><th>Tipo</th><th>Documento</th><th>Papeis</th><th>Cidade/UF</th></tr></thead>
            <tbody>
              ${preview.map((r) => `
                <tr>
                  <td>${escapeHtml(r.name)}</td>
                  <td>${escapeHtml(r.type)}</td>
                  <td>${escapeHtml(r.cpf_cnpj || '—')}</td>
                  <td>${escapeHtml(roleSummary(r))}</td>
                  <td>${escapeHtml((r.city || '') + (r.state ? '/' + r.state : '') || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function roleSummary(r) {
    const roles = [];
    if (r.is_customer) roles.push('Cliente');
    if (r.is_supplier) roles.push('Fornecedor');
    if (r.is_carrier)  roles.push('Transportadora');
    if (r.is_other)    roles.push('Outro');
    return roles.join(', ') || '—';
  }

  function renderImporting() {
    const pct  = imp.progress ? Math.round(imp.progress.pct) : 0;
    const done = imp.progress ? imp.progress.done : 0;
    const total = imp.progress ? imp.progress.total : 0;
    return `
      <div class="dh-imp-status">
        <span class="dh-imp-spinner"></span>
        <span>Importando… <b>${done} / ${total}</b></span>
      </div>
      <div class="dh-imp-bar"><span style="width:${pct}%"></span></div>
    `;
  }

  function renderDone() {
    const { success, fail, replaced, skipped } = imp.results;
    const partes = [];
    if (success > 0) partes.push(`<b>${success}</b> importado${success === 1 ? '' : 's'}`);
    if (replaced > 0) partes.push(`<b>${replaced}</b> substituído${replaced === 1 ? '' : 's'}`);
    if (skipped > 0) partes.push(`<b>${skipped}</b> pulado${skipped === 1 ? '' : 's'}`);
    if (fail > 0) partes.push(`<b>${fail}</b> com erro`);

    return `
      <div class="dh-imp-status ${fail === 0 ? 'dh-imp-status--ok' : 'dh-imp-status--warn'}">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        <span>${partes.join(' · ') || 'Nada importado'}</span>
      </div>
      ${fail > 0 ? `
        <details class="dh-imp-warn">
          <summary>Ver erros</summary>
          <ul>${imp.rowErrors.slice(0, 20).map((e) => `<li>${escapeHtml(e.line)}: ${escapeHtml(e.message)}</li>`).join('')}</ul>
        </details>
      ` : ''}
    `;
  }

  /* =========================================================
     Baixar modelo
     ========================================================= */
  function baixarModelo() {
    if (typeof XLSX === 'undefined') { showToast('Biblioteca de planilha não carregou.', 'error'); return; }

    const headers = SCHEMA.map((c) => c.header);
    const example = [
      'Caneta Esferográfica Azul Ltda', 'PJ', '12.345.678/0001-90',
      'Caneta Azul Comércio LTDA', 'Caneta Azul', '123.456.789.000', '',
      'contato@canetaazul.com.br', '(11) 98765-4321', '01310-100',
      'Av. Paulista', '1000', 'Bela Vista', 'São Paulo', 'SP',
      'cliente, fornecedor', 'ativo', 'Simples Nacional', 'Cliente desde 2024'
    ];

    const row = headers.map((h) => example[headers.indexOf(h)]);
    const ws = XLSX.utils.aoa_to_sheet([headers, row]);
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Parceiros');
    XLSX.writeFile(wb, 'modelo-parceiros.xlsx');
    showToast('Modelo baixado.', 'success');
  }

  /* =========================================================
     Ler arquivo
     ========================================================= */
  async function onFile(file) {
    if (typeof XLSX === 'undefined') { showToast('Biblioteca de planilha não carregou.', 'error'); return; }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (['xlsx', 'xls', 'csv'].indexOf(ext) === -1) {
      showToast('Formato não aceito. Use .xlsx, .xls ou .csv', 'error');
      return;
    }

    imp.file = file;
    imp.rowErrors = [];

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });

      if (!aoa || aoa.length < 2) { showToast('A planilha está vazia ou não tem linhas.', 'error'); return; }

      const rawHeaders = aoa[0].map((h) => String(h == null ? '' : h));
      const body = aoa.slice(1);

      const validation = validateHeaders(rawHeaders);
      if (!validation.ok) { showHeaderError(validation); return; }
      imp.headerMap = validation.headerMap;

      imp.validRows = [];
      body.forEach((linha, idx) => {
        const lineNum = idx + 2;
        const row = convertRow(linha, validation.headerMap, lineNum);
        if (row.ok) imp.validRows.push(row.data);
        else imp.rowErrors.push({ line: lineNum, message: row.error });
      });

      if (imp.validRows.length === 0) { showToast('Nenhuma linha válida encontrada.', 'error'); return; }

      imp.stage = 'validated';
      renderStage();
    } catch (err) {
      console.error('[import-parceiros] erro lendo planilha:', err);
      showToast('Não foi possível ler a planilha.', 'error');
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
      if (KNOWN.indexOf(norm) === -1) { extras.push(h); return; }
      if (headerMap[norm] === undefined) headerMap[norm] = i;
    });

    const missing = REQUIRED.filter((h) => headerMap[h] === undefined);
    if (missing.length > 0 || extras.length > 0) {
      return { ok: false, missing: missing, extras: extras, detected: foundNormalized };
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
    if (missing.length > 0 && extras.length > 0) msg = 'Faltam colunas obrigatórias e existem colunas desconhecidas.';
    else if (missing.length > 0) msg = 'Faltam colunas obrigatórias.';
    else msg = 'Existem colunas desconhecidas na planilha.';

    const body = imp.modal.querySelector('#dh-imp-p-body');
    if (body) {
      body.innerHTML = `
        <div class="dh-imp-status dh-imp-status--err">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/>
          </svg>
          <span><b>Não foi possível reconhecer a planilha.</b> ${msg}</span>
        </div>
        ${missing.length > 0 ? `
          <div class="dh-imp-cols">
            <p class="dh-imp-cols__title">❌ Faltando</p>
            <ul>${missing.map((h) => `<li class="is-no"><code>${h}</code></li>`).join('')}</ul>
          </div>
        ` : ''}
        ${extras.length > 0 ? `
          <div class="dh-imp-cols">
            <p class="dh-imp-cols__title">❌ Desconhecidas</p>
            <ul>${extras.map((h) => `<li class="is-no"><code>${escapeHtml(h)}</code></li>`).join('')}</ul>
            <p class="dh-imp-hint">Renomeie pra bater com o padrão ou use o "Baixar modelo".</p>
          </div>
        ` : ''}
        <div class="dh-imp-cols">
          <p class="dh-imp-cols__title">Colunas aceitas</p>
          <ul>${SCHEMA.map((c) => `<li><code>${c.header}</code>${c.required ? ' <b>*</b>' : ''}</li>`).join('')}</ul>
        </div>
        <div class="dh-imp-actions" style="margin-top:14px;">
          <button type="button" class="dh-scan-btn dh-scan-btn--ghost" id="dh-imp-p-retry">Tentar outro arquivo</button>
          <button type="button" class="dh-scan-btn dh-scan-btn--ghost" id="dh-imp-p-download2">Baixar modelo</button>
        </div>
      `;
      body.querySelector('#dh-imp-p-retry').addEventListener('click', () => { resetImpState(); renderStage(); });
      body.querySelector('#dh-imp-p-download2').addEventListener('click', baixarModelo);
    }
    imp.stage = 'idle';
    renderStage();
  }

  /* =========================================================
     Conversão de linha
     ========================================================= */
  function convertRow(rawRow, headerMap, lineNum) {
    const get = (h) => headerMap[h] !== undefined ? rawRow[headerMap[h]] : '';

    const name = String(get('nome') || '').trim();
    if (!name) return { ok: false, error: 'Nome vazio' };

    const rawType = String(get('tipo') || '').trim().toLowerCase();
    let type = 'PJ';
    if (rawType === 'pf' || rawType === 'física' || rawType === 'fisica') type = 'PF';
    else if (rawType === 'pj' || rawType === 'jurídica' || rawType === 'juridica') type = 'PJ';

    const cpf_cnpj = String(get('cpf_cnpj') || '').trim() || null;
    const company_name = String(get('razao_social') || '').trim() || null;
    const trade_name = String(get('nome_fantasia') || '').trim() || null;
    const state_registration = String(get('inscricao_estadual') || '').trim() || null;
    const municipal_registration = String(get('inscricao_municipal') || '').trim() || null;
    const email = String(get('email') || '').trim() || null;
    const phone = String(get('telefone') || '').trim() || null;
    const zip_code = String(get('cep') || '').trim() || null;
    const street = String(get('endereco') || '').trim() || null;
    const number = String(get('numero') || '').trim() || null;
    const neighborhood = String(get('bairro') || '').trim() || null;
    const city = String(get('cidade') || '').trim() || null;
    const uf = String(get('uf') || '').trim().toUpperCase().slice(0, 2) || null;
    const notes = String(get('observacoes') || '').trim() || null;
    const tax_regime = String(get('regime_tributario') || '').trim() || null;

    const statusRaw = String(get('status') || 'ativo').trim().toLowerCase();
    const status = (statusRaw === 'inativo' || statusRaw === 'inactive') ? 'inactive' : 'active';

    const rolesRaw = String(get('papeis') || '').toLowerCase();
    const roles = rolesRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    let is_customer = roles.indexOf('cliente') !== -1;
    let is_supplier = roles.indexOf('fornecedor') !== -1;
    let is_carrier  = roles.indexOf('transportadora') !== -1 || roles.indexOf('transportes') !== -1;
    let is_other    = roles.indexOf('outro') !== -1;
    if (!is_customer && !is_supplier && !is_carrier && !is_other) is_customer = true;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: 'E-mail inválido: ' + email };
    }

    const docDigits = cpf_cnpj ? cpf_cnpj.replace(/\D/g, '') : '';
    if (docDigits && type === 'PJ' && docDigits.length !== 14) {
      return { ok: false, error: 'CNPJ com ' + docDigits.length + ' dígitos (esperado 14)' };
    }
    if (docDigits && type === 'PF' && docDigits.length !== 11) {
      return { ok: false, error: 'CPF com ' + docDigits.length + ' dígitos (esperado 11)' };
    }

    return {
      ok: true,
      data: {
        name, type, cpf_cnpj, company_name, trade_name,
        state_registration, municipal_registration,
        email, phone, zip_code, street, number, neighborhood, city, state: uf,
        status, tax_regime, notes,
        is_customer, is_supplier, is_carrier, is_other
      }
    };
  }

  /* =========================================================
     Descobre org ativa
     ========================================================= */
  async function getCurrentOrgId() {
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (raw) {
        const ctx = JSON.parse(raw);
        if (ctx && ctx.organization_id) return ctx.organization_id;
      }
    } catch (e) {}

    try {
      const { data: sess } = await window.db.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) return null;
      const { data } = await window.db.from('profiles').select('organization_id').eq('id', uid).maybeSingle();
      return data?.organization_id || null;
    } catch (e) { return null; }
  }

  /* =========================================================
     Modal de estratégia
     ========================================================= */
  function buildStrategyModal() {
    const modal = document.createElement('div');
    modal.id = 'dh-imp-str-modal';
    modal.className = 'dh-scan-backdrop';
    modal.hidden = true;
    modal.style.zIndex = '9999';
    modal.innerHTML = `
      <div class="dh-str-card" role="dialog" aria-modal="true">
        <header class="dh-str-head">
          <div class="dh-str-head__icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 9v4"/><path d="M12 17h.01"/>
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>
            </svg>
          </div>
          <div class="dh-str-head__text">
            <h2>Documentos já cadastrados</h2>
            <p id="dh-str-sub">Revise quais duplicados você quer tratar</p>
          </div>
          <button type="button" class="dh-scan-close" data-str-cancel aria-label="Fechar">×</button>
        </header>

        <div class="dh-str-body">
          <div class="dh-str-summary">
            <div class="dh-str-summary__item">
              <span class="dh-str-summary__label">Novos</span>
              <strong class="dh-str-summary__value dh-str-summary__value--ok" id="dh-str-novos">0</strong>
            </div>
            <div class="dh-str-summary__item">
              <span class="dh-str-summary__label">Duplicados</span>
              <strong class="dh-str-summary__value dh-str-summary__value--warn" id="dh-str-dup">0</strong>
            </div>
            <div class="dh-str-summary__item">
              <span class="dh-str-summary__label">Selecionados</span>
              <strong class="dh-str-summary__value dh-str-summary__value--primary" id="dh-str-sel">0</strong>
            </div>
          </div>

          <div class="dh-str-toolbar">
            <label class="dh-str-check-all">
              <input type="checkbox" id="dh-str-all" checked>
              <span class="dh-str-check-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
                     stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              </span>
              <span>Selecionar todos</span>
            </label>
            <span class="dh-str-count" id="dh-str-count">0 de 0 selecionados</span>
          </div>

          <div class="dh-str-list" id="dh-str-list"></div>

          <div class="dh-str-action">
            <p class="dh-str-action__title">O que fazer com os selecionados?</p>
            <div class="dh-str-segments" role="radiogroup">
              <button type="button" class="dh-str-seg" data-action="replace">
                <span class="dh-str-seg__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>
                  </svg>
                </span>
                <span class="dh-str-seg__body">
                  <b>Substituir</b>
                  <small>Atualiza o cadastro antigo</small>
                </span>
              </button>
              <button type="button" class="dh-str-seg" data-action="keep">
                <span class="dh-str-seg__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                </span>
                <span class="dh-str-seg__body">
                  <b>Manter os dois</b>
                  <small>Cria um cadastro duplicado</small>
                </span>
              </button>
              <button type="button" class="dh-str-seg" data-action="skip">
                <span class="dh-str-seg__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>
                  </svg>
                </span>
                <span class="dh-str-seg__body">
                  <b>Pular</b>
                  <small>Mantém só o antigo</small>
                </span>
              </button>
            </div>
          </div>
        </div>

        <footer class="dh-str-foot">
          <button type="button" class="dh-scan-btn dh-scan-btn--ghost" data-str-cancel>Cancelar</button>
          <button type="button" class="dh-scan-btn dh-scan-btn--primary" id="dh-str-confirm">
            <span class="dh-str-foot__check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                   stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </span>
            OK, aplicar
          </button>
        </footer>
      </div>
    `;

    modal.querySelectorAll('[data-str-cancel]').forEach((el) => {
      el.addEventListener('click', () => {
        modal.hidden = true;
        if (modal._resolve) {
          const r = modal._resolve;
          modal._resolve = null;
          r('cancel');
        }
      });
    });

    modal.querySelector('#dh-str-confirm').addEventListener('click', () => {
      modal.hidden = true;
      if (modal._resolve) {
        const r = modal._resolve;
        modal._resolve = null;
        r(imp.strategy);
      }
    });

    modal.querySelectorAll('.dh-str-seg').forEach((btn) => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.dh-str-seg').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        imp.strategy = btn.dataset.action;
      });
    });

    modal.querySelector('#dh-str-all').addEventListener('change', (e) => {
      const checked = e.target.checked;
      modal.querySelectorAll('.dh-str-item').forEach((el) => {
        const idx = Number(el.dataset.idx);
        const cb = el.querySelector('input[type="checkbox"]');
        cb.checked = checked;
        el.classList.toggle('is-checked', checked);
        if (checked) imp.selected.add(idx);
        else imp.selected.delete(idx);
      });
      atualizarContadores(modal);
    });

    return modal;
  }

  function atualizarContadores(modal) {
    const list = modal.querySelector('#dh-str-list');
    const total = list ? list.querySelectorAll('.dh-str-item').length : 0;
    const sel = modal.querySelectorAll('.dh-str-item.is-checked').length;

    modal.querySelector('#dh-str-sel').textContent = sel;
    modal.querySelector('#dh-str-count').textContent = sel + ' de ' + total + ' selecionados';

    const allCb = modal.querySelector('#dh-str-all');
    if (allCb) {
      allCb.checked = sel === total && total > 0;
      allCb.indeterminate = sel > 0 && sel < total;
    }

    const confirmBtn = modal.querySelector('#dh-str-confirm');
    if (confirmBtn) confirmBtn.disabled = sel === 0;
  }

  function abrirStrategyModal(duplicados, novosCount) {
    if (!imp.strategyModal) imp.strategyModal = buildStrategyModal();
    if (!imp.strategyModal.parentNode) document.body.appendChild(imp.strategyModal);

    const modal = imp.strategyModal;

    modal.querySelector('#dh-str-novos').textContent = novosCount;
    modal.querySelector('#dh-str-dup').textContent = duplicados.length;

    imp.selected = new Set();
    duplicados.forEach((_, i) => imp.selected.add(i));

    imp.strategy = 'replace';
    modal.querySelectorAll('.dh-str-seg').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.action === 'replace');
    });

    const list = modal.querySelector('#dh-str-list');
    list.innerHTML = '';

    duplicados.forEach((d, i) => {
      const item = document.createElement('label');
      item.className = 'dh-str-item is-checked';
      item.dataset.idx = String(i);

      const badge = d.tipo === 'arquivo'
        ? '<span class="dh-str-badge dh-str-badge--file">duplicado na planilha</span>'
        : '<span class="dh-str-badge dh-str-badge--db">já cadastrado</span>';

      item.innerHTML = `
        <input type="checkbox" checked>
        <span class="dh-str-item__check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
               stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </span>
        <div class="dh-str-item__body">
          <div class="dh-str-item__name">${escapeHtml(d.row.name)}</div>
          <div class="dh-str-item__meta">
            <code>${escapeHtml(d.row.cpf_cnpj || '—')}</code>
            ${badge}
          </div>
        </div>
      `;

      const cb = item.querySelector('input[type="checkbox"]');
      cb.addEventListener('change', () => {
        const idx = Number(item.dataset.idx);
        if (cb.checked) imp.selected.add(idx);
        else imp.selected.delete(idx);
        item.classList.toggle('is-checked', cb.checked);
        atualizarContadores(modal);
      });

      list.appendChild(item);
    });

    atualizarContadores(modal);
    modal.hidden = false;

    return new Promise((resolve) => { modal._resolve = resolve; });
  }

  /* =========================================================
     Import
     ========================================================= */
  async function doImport() {
    if (imp.importing || imp.validRows.length === 0) return;

    imp.importing = true;
    imp.stage = 'importing';
    imp.progress = { done: 0, total: imp.validRows.length, pct: 0 };
    imp.results = { success: 0, fail: 0, replaced: 0, skipped: 0 };
    renderStage();

    const orgId = await getCurrentOrgId();
    if (!orgId) {
      showToast('Não foi possível identificar a empresa ativa.', 'error');
      imp.importing = false;
      imp.stage = 'validated';
      renderStage();
      return;
    }

    let existentes = [];
    try {
      const { data } = await window.db
        .from('customers')
        .select('id, cpf_cnpj, name')
        .eq('organization_id', orgId);
      existentes = data || [];
    } catch (err) {
      console.warn('[import] erro buscando existentes:', err);
    }

    const porDocumento = new Map();
    existentes.forEach((c) => {
      const k = String(c.cpf_cnpj || '').replace(/\D/g, '');
      if (k) porDocumento.set(k, c);
    });

    const novos = [];
    const duplicados = [];
    const vistosNoArquivo = new Set();

    imp.validRows.forEach((r) => {
      const k = String(r.cpf_cnpj || '').replace(/\D/g, '');
      if (!k) { novos.push(r); return; }

      if (porDocumento.has(k)) {
        duplicados.push({ row: r, existing: porDocumento.get(k), tipo: 'banco' });
      } else if (vistosNoArquivo.has(k)) {
        duplicados.push({ row: r, existing: null, tipo: 'arquivo' });
      } else {
        vistosNoArquivo.add(k);
        novos.push(r);
      }
    });

    let strategy = 'keep';
    let duplicadosSelecionados = [];
    if (duplicados.length > 0) {
      strategy = await abrirStrategyModal(duplicados, novos.length);
      if (strategy === 'cancel') {
        imp.importing = false;
        imp.stage = 'validated';
        renderStage();
        return;
      }
      duplicadosSelecionados = duplicados.filter((_, i) => imp.selected.has(i));
      imp.results.skipped = duplicados.length - duplicadosSelecionados.length;
    }

    const fila = [];
    novos.forEach((r) => fila.push({ action: 'insert', row: r, customerId: null }));

    if (strategy === 'keep') {
      duplicadosSelecionados.forEach((d) => fila.push({ action: 'insert', row: d.row, customerId: null }));
    } else if (strategy === 'replace') {
      duplicadosSelecionados.forEach((d) => {
        if (d.existing) {
          fila.push({ action: 'update', row: d.row, customerId: d.existing.id });
        } else {
          fila.push({ action: 'insert', row: d.row, customerId: null });
        }
      });
    } else if (strategy === 'skip') {
      imp.results.skipped += duplicadosSelecionados.length;
    }

    imp.progress.total = fila.length || 1;
    imp.progress.done = 0;
    imp.progress.pct = 0;

    for (let i = 0; i < fila.length; i++) {
      const item = fila[i];
      const r = item.row;

      try {
        await window.Parn.upsertPartnerFull({
          customerId: item.customerId,
          customer: {
            type: r.type,
            name: r.name,
            company_name: r.company_name,
            trade_name: r.trade_name,
            cpf_cnpj: r.cpf_cnpj,
            state_registration: r.state_registration,
            municipal_registration: r.municipal_registration,
            tax_regime: r.tax_regime,
            phone: r.phone,
            email: r.email,
            address: [r.street, r.number].filter(Boolean).join(', ') || null,
            status: r.status,
            is_customer: r.is_customer,
            is_supplier: r.is_supplier,
            is_carrier: r.is_carrier,
            is_other: r.is_other,
            notes: r.notes
          },
          phones: r.phone ? [{ type: 'Principal', phone: r.phone, is_primary: true }] : [],
          emails: r.email ? [{ type: 'Principal', email: r.email, is_primary: true }] : [],
          addresses: (r.street || r.city || r.zip_code) ? [{
            type: 'Principal',
            zip_code: r.zip_code || '',
            street: r.street || '',
            number: r.number || '',
            neighborhood: r.neighborhood || '',
            city: r.city || '',
            state: r.state || '',
            is_primary: true
          }] : [],
          contacts: []
        });

        if (item.action === 'update') imp.results.replaced += 1;
        else imp.results.success += 1;
      } catch (err) {
        imp.results.fail += 1;
        imp.rowErrors.push({
          line: r.name,
          message: err.message || 'Erro ao inserir'
        });
      }

      imp.progress.done = i + 1;
      imp.progress.pct = ((i + 1) / imp.progress.total) * 100;
      if (i % 3 === 0 || i === fila.length - 1) renderStage();
    }

    imp.importing = false;
    imp.stage = 'done';
    renderStage();
  }

  /* =========================================================
     Helpers
     ========================================================= */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* =========================================================
     CSS
     ========================================================= */
  function ensureStyles() {
    if (document.getElementById('dh-imp-p-styles')) return;
    const style = document.createElement('style');
    style.id = 'dh-imp-p-styles';
    style.textContent = `
      .dh-scan-backdrop{position:fixed;inset:0;z-index:9998;background:rgba(5,8,14,.78);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;}
      .dh-scan-backdrop[hidden]{display:none;}
      .dh-scan-card{width:100%;max-width:640px;background:#0d131c;color:#e6eaf2;border:1px solid rgba(255,255,255,.10);border-radius:16px;display:flex;flex-direction:column;max-height:92vh;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
      .dh-scan-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0;}
      .dh-scan-header h2{margin:0;font-size:16px;font-weight:600;}
      .dh-scan-close{appearance:none;border:0;background:transparent;color:#8b95a7;font-size:22px;cursor:pointer;width:32px;height:32px;border-radius:8px;}
      .dh-scan-close:hover{background:rgba(255,255,255,.06);color:#e6eaf2;}
      .dh-scan-body{padding:20px;overflow-y:auto;}
      .dh-scan-footer{display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid rgba(255,255,255,.08);background:#0a0f16;flex-shrink:0;}
      .dh-scan-btn{appearance:none;border:1px solid transparent;border-radius:9px;padding:10px 18px;font-size:13.5px;font-weight:600;font-family:inherit;cursor:pointer;}
      .dh-scan-btn--ghost{background:transparent;color:#c7d0dd;border-color:rgba(255,255,255,.14);}
      .dh-scan-btn--ghost:hover{background:rgba(255,255,255,.05);}
      .dh-scan-btn--primary{background:#3b82f6;color:#fff;}
      .dh-scan-btn--primary:hover{background:#2f74e6;}
      .dh-scan-btn--primary:disabled{opacity:.5;cursor:not-allowed;}
      body.dh-scan-open{overflow:hidden;}

      .dh-imp-drop{border:2px dashed rgba(255,255,255,.18);border-radius:14px;padding:36px 20px;text-align:center;color:#8b95a7;cursor:pointer;transition:background 140ms,border-color 140ms,color 140ms;}
      .dh-imp-drop:hover,.dh-imp-drop.is-hover{background:rgba(59,130,246,.06);border-color:rgba(59,130,246,.45);color:#93b6ff;}
      .dh-imp-drop svg{color:currentColor;margin-bottom:10px;}
      .dh-imp-drop p{margin:4px 0;font-size:14px;color:#b7c0cf;}
      .dh-imp-drop p strong{color:#e6eaf2;}
      .dh-imp-hint{font-size:12px;color:#8b95a7;}
      .dh-imp-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:14px;}
      .dh-imp-cols{margin-top:16px;}
      .dh-imp-cols__title{font-size:12px;font-weight:600;color:#c7d0dd;margin:0 0 8px;letter-spacing:.02em;}
      .dh-imp-cols ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px;}
      .dh-imp-cols li{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);font-size:12px;}
      .dh-imp-cols li code{font-family:monospace;font-size:12px;color:#c7d0dd;}
      .dh-imp-cols li span{color:#8b95a7;font-size:11px;}
      .dh-imp-cols li b{color:#f87171;font-weight:700;}
      .dh-imp-cols li.is-ok{border-color:rgba(34,197,94,.3);}
      .dh-imp-cols li.is-ok span{color:#22c55e;}
      .dh-imp-cols li.is-no{border-color:rgba(239,68,68,.3);}
      .dh-imp-cols li.is-no span{color:#ef4444;}
      .dh-imp-status{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.22);color:#93b6ff;font-size:13px;}
      .dh-imp-status--ok{background:rgba(34,197,94,.10);border-color:rgba(34,197,94,.28);color:#86efac;}
      .dh-imp-status--err{background:rgba(239,68,68,.10);border-color:rgba(239,68,68,.28);color:#fca5a5;}
      .dh-imp-status--warn{background:rgba(245,158,11,.10);border-color:rgba(245,158,11,.28);color:#fcd34d;}
      .dh-imp-warn{margin-top:12px;padding:10px 14px;border-radius:10px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.24);color:#fcd34d;font-size:12.5px;line-height:1.5;}
      .dh-imp-warn summary{cursor:pointer;}
      .dh-imp-warn ul{padding-left:18px;margin:8px 0 0;}
      .dh-imp-preview{margin-top:16px;}
      .dh-imp-preview__wrap{border:1px solid rgba(255,255,255,.08);border-radius:10px;overflow:auto;max-height:220px;}
      .dh-imp-preview__wrap table{width:100%;border-collapse:collapse;font-size:12.5px;}
      .dh-imp-preview__wrap th{text-align:left;padding:8px 10px;background:rgba(255,255,255,.04);color:#c7d0dd;font-weight:600;position:sticky;top:0;}
      .dh-imp-preview__wrap td{padding:8px 10px;border-top:1px solid rgba(255,255,255,.05);}
      .dh-imp-bar{margin-top:12px;height:6px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;}
      .dh-imp-bar span{display:block;height:100%;background:linear-gradient(90deg,#3b82f6,#6366f1);transition:width 200ms ease;}
      .dh-imp-spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.35);border-top-color:currentColor;border-radius:50%;animation:dhImpSpin .7s linear infinite;}
      @keyframes dhImpSpin{to{transform:rotate(360deg);}}

      /* Modal de estratégia */
      .dh-str-card{width:100%;max-width:560px;background:linear-gradient(180deg,#0f1620 0%,#0d131c 100%);color:#e6eaf2;border:1px solid rgba(255,255,255,.10);border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.70);display:flex;flex-direction:column;max-height:92vh;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;animation:dhStrPop 220ms cubic-bezier(.2,.9,.3,1.15);}
      @keyframes dhStrPop{from{opacity:0;transform:translateY(8px) scale(.97);}to{opacity:1;transform:translateY(0) scale(1);}}
      .dh-str-head{display:flex;align-items:flex-start;gap:12px;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(245,158,11,.04);}
      .dh-str-head__icon{flex-shrink:0;width:38px;height:38px;border-radius:10px;background:rgba(245,158,11,.14);color:#f59e0b;display:flex;align-items:center;justify-content:center;}
      .dh-str-head__text{flex:1;min-width:0;}
      .dh-str-head__text h2{margin:0 0 2px;font-size:16px;font-weight:700;color:#f5f7fb;}
      .dh-str-head__text p{margin:0;font-size:12.5px;color:#8b95a7;line-height:1.4;}
      .dh-str-body{padding:18px 20px 8px;overflow-y:auto;display:flex;flex-direction:column;gap:14px;}
      .dh-str-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
      .dh-str-summary__item{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);}
      .dh-str-summary__label{font-size:10.5px;font-weight:600;color:#8b95a7;letter-spacing:.04em;text-transform:uppercase;}
      .dh-str-summary__value{font-size:18px;font-weight:700;line-height:1.1;}
      .dh-str-summary__value--ok{color:#22c55e;}
      .dh-str-summary__value--warn{color:#f59e0b;}
      .dh-str-summary__value--primary{color:#60a5fa;}
      .dh-str-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;}
      .dh-str-check-all{display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none;font-size:13px;color:#c7d0dd;}
      .dh-str-check-all input{position:absolute;opacity:0;pointer-events:none;}
      .dh-str-check-all input:checked + .dh-str-check-box,
      .dh-str-check-all input:indeterminate + .dh-str-check-box{background:#3b82f6;border-color:#3b82f6;color:#fff;}
      .dh-str-check-all input:checked + .dh-str-check-box svg,
      .dh-str-check-all input:indeterminate + .dh-str-check-box svg{opacity:1;}
      .dh-str-check-box{width:16px;height:16px;border-radius:5px;border:1.5px solid rgba(255,255,255,.25);background:rgba(255,255,255,.02);display:inline-flex;align-items:center;justify-content:center;transition:background 120ms,border-color 120ms;flex-shrink:0;}
      .dh-str-check-box svg{width:10px;height:10px;opacity:0;transition:opacity 120ms;}
      .dh-str-count{font-size:12px;color:#8b95a7;}
      .dh-str-list{border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.015);max-height:240px;overflow-y:auto;padding:4px;}
      .dh-str-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;cursor:pointer;transition:background 120ms;user-select:none;}
      .dh-str-item + .dh-str-item{margin-top:2px;}
      .dh-str-item:hover{background:rgba(255,255,255,.035);}
      .dh-str-item.is-checked{background:rgba(59,130,246,.06);}
      .dh-str-item.is-checked:hover{background:rgba(59,130,246,.10);}
      .dh-str-item input[type="checkbox"]{position:absolute;opacity:0;pointer-events:none;}
      .dh-str-item__check{flex-shrink:0;width:18px;height:18px;border-radius:6px;border:1.5px solid rgba(255,255,255,.22);background:rgba(255,255,255,.02);display:inline-flex;align-items:center;justify-content:center;transition:background 120ms,border-color 120ms;}
      .dh-str-item__check svg{width:11px;height:11px;opacity:0;transition:opacity 120ms;}
      .dh-str-item input:checked ~ .dh-str-item__check{background:#3b82f6;border-color:#3b82f6;color:#fff;}
      .dh-str-item input:checked ~ .dh-str-item__check svg{opacity:1;}
      .dh-str-item__body{min-width:0;flex:1;}
      .dh-str-item__name{font-size:13.5px;font-weight:600;color:#e6eaf2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .dh-str-item__meta{display:flex;align-items:center;gap:8px;margin-top:3px;font-size:11.5px;}
      .dh-str-item__meta code{color:#8b95a7;font-family:monospace;}
      .dh-str-badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;}
      .dh-str-badge--db{background:rgba(245,158,11,.14);color:#fbbf24;}
      .dh-str-badge--file{background:rgba(168,85,247,.14);color:#c084fc;}
      .dh-str-action__title{font-size:12.5px;font-weight:600;color:#c7d0dd;margin:0 0 8px;}
      .dh-str-segments{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
      .dh-str-seg{appearance:none;display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:12px;border-radius:11px;background:rgba(255,255,255,.025);border:1.5px solid rgba(255,255,255,.08);color:inherit;font:inherit;cursor:pointer;text-align:left;transition:border-color 140ms,background 140ms,transform 100ms;}
      .dh-str-seg:hover{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.16);}
      .dh-str-seg:active{transform:scale(.98);}
      .dh-str-seg.is-active{background:rgba(59,130,246,.10);border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12);}
      .dh-str-seg__icon{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.05);color:#8b95a7;transition:background 140ms,color 140ms;}
      .dh-str-seg.is-active .dh-str-seg__icon{background:rgba(59,130,246,.18);color:#60a5fa;}
      .dh-str-seg__icon svg{width:15px;height:15px;}
      .dh-str-seg__body{display:flex;flex-direction:column;gap:1px;min-width:0;}
      .dh-str-seg__body b{font-size:12.5px;font-weight:600;color:#e6eaf2;}
      .dh-str-seg.is-active .dh-str-seg__body b{color:#93b6ff;}
      .dh-str-seg__body small{font-size:10.5px;color:#8b95a7;line-height:1.3;}
      .dh-str-foot{display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid rgba(255,255,255,.08);background:#0a0f16;}
      .dh-str-foot .dh-scan-btn--primary{display:inline-flex;align-items:center;gap:8px;padding-left:14px;}
      .dh-str-foot__check{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,.18);}
      .dh-str-foot__check svg{width:10px;height:10px;}
    `;
    document.head.appendChild(style);
  }

  /* =========================================================
     Export
     ========================================================= */
  Object.assign(window.Parn, { setupImport: setupImportButton });
})();