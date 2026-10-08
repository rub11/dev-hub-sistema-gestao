/* =========================================================
   DEV HUB · Vendas · import-sales.js
   Importação de vendas históricas via planilha.
   ---------------------------------------------------------
   Módulo standalone — não depende de nenhum namespace.
   Auto-injeta o botão na toolbar de vendas.
   Só aparece se o user tiver permissão (sales.create).
   ========================================================= */
(function () {
  'use strict';

  const SCHEMA = [
    { header: 'data',            required: true,  type: 'date' },
    { header: 'numero_venda',    required: false, type: 'string' },
    { header: 'cliente',         required: false, type: 'string' },
    { header: 'produto',         required: true,  type: 'string' },
    { header: 'quantidade',      required: true,  type: 'integer' },
    { header: 'preco_unitario',  required: true,  type: 'number' },
    { header: 'desconto',        required: false, type: 'number' },
    { header: 'forma_pagamento', required: false, type: 'string' },
    { header: 'status',          required: false, type: 'string' }
  ];
  const REQUIRED = SCHEMA.filter(c => c.required).map(c => c.header);
  const KNOWN = SCHEMA.map(c => c.header);

  const imp = {
    modal: null,
    stage: 'idle',
    parsed: [],
    errors: [],
    inserting: false,
    progress: null,
    result: { success: 0, fail: 0 }
  };

  /* =========================================================
     Setup — injeta o botão na toolbar
     ========================================================= */
  function setup() {
    let tentativas = 0;
    const tick = () => {
      if (injetarBotao()) return;
      tentativas += 1;
      if (tentativas < 25) setTimeout(tick, 300);
    };
    tick();
  }

  function injetarBotao() {
    let btn = document.getElementById('import-sales-btn');
    if (btn) return true;

    if (!podeImportar()) return true;

    const anchor = document.getElementById('new-sale-btn') ||
                   document.getElementById('new-quote-btn');
    if (!anchor) return false;

    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'import-sales-btn';
    btn.className = 'btn btn--ghost';
    btn.title = 'Importar vendas históricas';
    btn.style.cssText = 'white-space:nowrap; display:inline-flex; align-items:center; gap:6px;';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
      'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>' +
      '<span>Importar histórico</span>';

    btn.addEventListener('click', abrir);
    anchor.parentNode.insertBefore(btn, anchor);

    return true;
  }

  /* =========================================================
     Permissão
     ========================================================= */
  function podeImportar() {
    if (window.Perms && typeof window.Perms.has === 'function') {
      return window.Perms.has('sales.create') === true;
    }
    return true;
  }

  /* =========================================================
     Abrir / fechar modal
     ========================================================= */
  function abrir() {
    if (!podeImportar()) {
      alert('Você não tem permissão para importar vendas.');
      return;
    }

    if (!imp.modal) imp.modal = build();
    if (!imp.modal.parentNode) document.body.appendChild(imp.modal);
    reset();
    render();
    imp.modal.hidden = false;
    imp.modal.style.display = 'flex';
  }

  function close() {
    if (imp.inserting) return;
    if (imp.modal) {
      imp.modal.hidden = true;
      imp.modal.style.display = 'none';
    }
  }

  function reset() {
    imp.stage = 'idle';
    imp.parsed = [];
    imp.errors = [];
    imp.inserting = false;
    imp.progress = null;
    imp.result = { success: 0, fail: 0 };
  }

  /* =========================================================
     Build — estilos críticos inline pra funcionar sem CSS externo
     ========================================================= */
  function build() {
    const el = document.createElement('div');
    el.id = 'dh-imp-sales';
    el.className = 'dh-imp-hub';
    el.hidden = true;
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:9999',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'background:rgba(0,0,0,.65)',
      'padding:20px',
      'overflow:auto'
    ].join(';') + ';';

    el.innerHTML = `
      <div class="dh-imp-hub__card" role="dialog" aria-modal="true"
           style="width:100%;max-width:660px;background:#0d131c;border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.6);color:#e6eaf2;font-family:inherit;">
        <header class="dh-imp-hub__head"
                style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08);">
          <div>
            <h2 style="margin:0;font-size:16px;color:#e6eaf2;">Importar vendas históricas</h2>
            <p style="margin:4px 0 0;font-size:12.5px;color:#8b95a7;">Suba uma planilha com as vendas antigas</p>
          </div>
          <button type="button" class="dh-imp-hub__close" data-close aria-label="Fechar"
                  style="appearance:none;border:0;background:transparent;color:#8b95a7;font-size:22px;line-height:1;cursor:pointer;padding:0 6px;">×</button>
        </header>
        <div class="dh-imp-hub__body" id="dh-imp-sales-body" style="padding:18px 20px;max-height:60vh;overflow:auto;"></div>
        <footer style="display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid rgba(255,255,255,.08);background:#0a0f16;">
          <button type="button" data-close
                  style="appearance:none;border:1px solid rgba(255,255,255,.14);background:transparent;color:#c7d0dd;border-radius:9px;padding:10px 18px;font-size:13.5px;font-weight:600;cursor:pointer;">Cancelar</button>
          <button type="button" id="dh-imp-sales-confirm"
                  style="display:none;appearance:none;border:0;background:#3b82f6;color:#fff;border-radius:9px;padding:10px 18px;font-size:13.5px;font-weight:600;cursor:pointer;">
            Importar
          </button>
        </footer>
      </div>
    `;

    el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && el && !el.hidden) close();
    });

    return el;
  }

  /* =========================================================
     Render por estágio
     ========================================================= */
  function render() {
    const body = imp.modal.querySelector('#dh-imp-sales-body');
    const confirm = imp.modal.querySelector('#dh-imp-sales-confirm');
    if (!body || !confirm) return;

    if (imp.stage === 'idle') {
      body.innerHTML = renderIdle();
      confirm.style.display = 'none';
      wireIdle();
    } else if (imp.stage === 'validated') {
      body.innerHTML = renderValidated();
      confirm.style.display = '';
      confirm.textContent = 'Importar ' + imp.parsed.length + ' venda' + (imp.parsed.length === 1 ? '' : 's');
      confirm.onclick = doImport;
    } else if (imp.stage === 'importing') {
      body.innerHTML = renderImporting();
      confirm.style.display = 'none';
    } else if (imp.stage === 'done') {
      body.innerHTML = renderDone();
      confirm.style.display = '';
      confirm.textContent = 'Fechar';
      confirm.onclick = () => {
        close();
        if (window.DH && window.DH.list && typeof window.DH.list.refresh === 'function') {
          window.DH.list.refresh();
        } else {
          location.reload();
        }
      };
    }
  }

  function renderIdle() {
    return `
      <div class="dh-imp-drop" id="dh-imp-sales-drop" style="border:2px dashed rgba(255,255,255,.18);border-radius:14px;padding:32px 20px;text-align:center;color:#8b95a7;cursor:pointer;">
        <div style="font-size:32px;margin-bottom:8px;">🛒</div>
        <p style="color:#e6eaf2;font-size:14px;margin:4px 0;"><strong>Arraste um arquivo .xlsx ou .csv</strong></p>
        <p style="font-size:12px;margin:4px 0;">ou clique pra selecionar</p>
        <input type="file" id="dh-imp-sales-input" accept=".xlsx,.xls,.csv" hidden>
      </div>
      <div style="margin-top:14px;display:flex;justify-content:flex-end;">
        <button type="button" id="dh-imp-sales-model"
                style="appearance:none;border:1px solid rgba(255,255,255,.14);background:transparent;color:#c7d0dd;border-radius:9px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer;">
          Baixar modelo (.xlsx)
        </button>
      </div>
      <div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06);">
        <p style="font-size:11.5px;font-weight:600;color:#c7d0dd;margin:0 0 8px;">Colunas esperadas</p>
        <ul style="list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px;font-size:12px;">
          ${SCHEMA.map(c => `
            <li style="padding:5px 10px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);display:flex;justify-content:space-between;gap:8px;">
              <code style="font-family:monospace;color:#c7d0dd;">${c.header}</code>
              ${c.required ? '<b style="color:#f87171;">*</b>' : ''}
            </li>
          `).join('')}
        </ul>
        <p style="font-size:11.5px;color:#8b95a7;margin:10px 0 0;">
          <b>*</b> obrigatório · <code>numero_venda</code> agrupa itens da mesma venda. Datas aceitas: 2024-01-15 ou 15/01/2024.
        </p>
      </div>
    `;
  }

  function wireIdle() {
    const input = imp.modal.querySelector('#dh-imp-sales-input');
    const drop = imp.modal.querySelector('#dh-imp-sales-drop');
    const model = imp.modal.querySelector('#dh-imp-sales-model');

    if (drop && input) {
      drop.addEventListener('click', () => input.click());
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.style.borderColor = '#3b82f6'; });
      drop.addEventListener('dragleave', () => { drop.style.borderColor = ''; });
      drop.addEventListener('drop', (e) => {
        e.preventDefault();
        drop.style.borderColor = '';
        const f = e.dataTransfer.files[0];
        if (f) parseFile(f);
      });
    }
    if (input) input.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) parseFile(f);
    });
    if (model) model.addEventListener('click', downloadModel);
  }

  function downloadModel() {
    if (typeof XLSX === 'undefined') { alert('Biblioteca de planilha não carregou.'); return; }
    const headers = SCHEMA.map(c => c.header);
    const example = ['2024-01-15','V001','João Silva','Caneta Azul','3','2,50','0','pix','ativo'];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(14, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
    XLSX.writeFile(wb, 'modelo-vendas.xlsx');
  }

  /* =========================================================
     Parsing
     ========================================================= */
  function normalizeHeader(h) {
    return String(h == null ? '' : h).toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
  }

  function parseFile(file) {
    if (typeof XLSX === 'undefined') { alert('Biblioteca de planilha não carregou.'); return; }
    imp.errors = [];

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });
        if (!aoa || aoa.length < 2) { alert('Planilha vazia.'); return; }

        const rawHeaders = aoa[0].map(h => String(h == null ? '' : h));
        const headerMap = {};
        rawHeaders.forEach((h, i) => {
          const norm = normalizeHeader(h);
          if (KNOWN.indexOf(norm) !== -1 && headerMap[norm] === undefined) headerMap[norm] = i;
        });

        const missing = REQUIRED.filter(r => headerMap[r] === undefined);
        if (missing.length > 0) {
          imp.stage = 'idle';
          alert('Faltam colunas: ' + missing.join(', '));
          return;
        }

        const rows = [];
        const body = aoa.slice(1);
        body.forEach((linha, idx) => {
          const line = idx + 2;
          const get = (k) => headerMap[k] !== undefined ? String(linha[headerMap[k]] || '').trim() : '';
          const getNum = (k) => {
            const v = get(k).replace(/[R$\s]/g, '');
            if (!v) return null;
            const n = v.indexOf(',') !== -1 && v.indexOf('.') !== -1
              ? Number(v.replace(/\./g, '').replace(',', '.'))
              : Number(v.replace(',', '.'));
            return Number.isFinite(n) ? n : null;
          };

          const dataRaw = get('data');
          const data = parseDate(dataRaw);
          if (!data) { imp.errors.push({ line, msg: 'Data inválida: ' + dataRaw }); return; }

          const produto = get('produto');
          if (!produto) { imp.errors.push({ line, msg: 'Produto vazio' }); return; }

          const qtd = getNum('quantidade');
          if (!qtd || qtd <= 0) { imp.errors.push({ line, msg: 'Quantidade inválida' }); return; }

          const preco = getNum('preco_unitario');
          if (preco === null || preco < 0) { imp.errors.push({ line, msg: 'Preço inválido' }); return; }

          rows.push({
            line,
            data,
            numero_venda: get('numero_venda') || null,
            cliente: get('cliente') || null,
            produto,
            quantidade: qtd,
            preco_unitario: preco,
            desconto: getNum('desconto') || 0,
            forma_pagamento: mapPayment(get('forma_pagamento')),
            status: mapStatus(get('status'))
          });
        });

        imp.parsed = rows;
        imp.stage = 'validated';
        render();
      } catch (err) {
        console.error('[import-sales] parse:', err);
        alert('Erro ao ler planilha.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function parseDate(s) {
    if (!s) return null;
    const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (br) {
      const d = br[1].padStart(2, '0');
      const m = br[2].padStart(2, '0');
      let y = br[3]; if (y.length === 2) y = '20' + y;
      return y + '-' + m + '-' + d;
    }
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
    return null;
  }

  function mapPayment(s) {
    const v = String(s || '').toLowerCase().trim();
    if (!v) return 'pix';
    if (v.includes('dinh')) return 'cash';
    if (v.includes('pix')) return 'pix';
    if (v.includes('deb')) return 'debit_card';
    if (v.includes('cred')) return 'credit_card';
    if (v.includes('bol')) return 'boleto';
    return 'other';
  }

  function mapStatus(s) {
    const v = String(s || '').toLowerCase().trim();
    if (!v || v === 'ativo' || v === 'active' || v === 'pago') return 'active';
    if (v.includes('cancel')) return 'canceled';
    if (v.includes('pend')) return 'pending';
    return 'active';
  }

  function renderValidated() {
    const preview = imp.parsed.slice(0, 5);
    return `
      <div style="padding:12px 14px;border-radius:10px;background:rgba(34,197,94,.10);border:1px solid rgba(34,197,94,.28);color:#86efac;font-size:13px;">
        <b>${imp.parsed.length}</b> linha${imp.parsed.length === 1 ? '' : 's'} válida${imp.parsed.length === 1 ? '' : 's'}
        ${imp.errors.length > 0 ? ' · ' + imp.errors.length + ' com erro' : ''}
      </div>
      ${imp.errors.length > 0 ? `
        <details style="margin-top:12px;padding:10px 14px;border-radius:10px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.24);color:#fcd34d;font-size:12.5px;">
          <summary style="cursor:pointer;">Ver erros (${imp.errors.length})</summary>
          <ul style="padding-left:18px;margin:8px 0 0;">
            ${imp.errors.slice(0, 10).map(e => `<li>Linha ${e.line}: ${e.msg}</li>`).join('')}
          </ul>
        </details>
      ` : ''}
      <div style="margin-top:16px;">
        <p style="font-size:12px;font-weight:600;color:#c7d0dd;margin:0 0 8px;">Prévia (${preview.length} de ${imp.parsed.length})</p>
        <div style="border:1px solid rgba(255,255,255,.08);border-radius:10px;overflow:auto;max-height:240px;">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
            <thead>
              <tr>
                <th style="text-align:left;padding:8px 10px;background:rgba(255,255,255,.04);color:#c7d0dd;">Data</th>
                <th style="text-align:left;padding:8px 10px;background:rgba(255,255,255,.04);color:#c7d0dd;">Cliente</th>
                <th style="text-align:left;padding:8px 10px;background:rgba(255,255,255,.04);color:#c7d0dd;">Produto</th>
                <th style="text-align:right;padding:8px 10px;background:rgba(255,255,255,.04);color:#c7d0dd;">Qtd</th>
                <th style="text-align:right;padding:8px 10px;background:rgba(255,255,255,.04);color:#c7d0dd;">Preço</th>
              </tr>
            </thead>
            <tbody>
              ${preview.map(r => `
                <tr>
                  <td style="padding:8px 10px;border-top:1px solid rgba(255,255,255,.05);">${r.data}</td>
                  <td style="padding:8px 10px;border-top:1px solid rgba(255,255,255,.05);">${r.cliente || '—'}</td>
                  <td style="padding:8px 10px;border-top:1px solid rgba(255,255,255,.05);">${r.produto}</td>
                  <td style="padding:8px 10px;border-top:1px solid rgba(255,255,255,.05);text-align:right;">${r.quantidade}</td>
                  <td style="padding:8px 10px;border-top:1px solid rgba(255,255,255,.05);text-align:right;">R$ ${r.preco_unitario.toFixed(2).replace('.', ',')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderImporting() {
    const pct = imp.progress ? Math.round(imp.progress.pct) : 0;
    const done = imp.progress ? imp.progress.done : 0;
    const total = imp.progress ? imp.progress.total : 0;
    return `
      <div style="padding:12px 14px;border-radius:10px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.22);color:#93b6ff;font-size:13px;">
        Importando… <b>${done} / ${total}</b>
      </div>
      <div style="margin-top:12px;height:6px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;">
        <span style="display:block;height:100%;background:linear-gradient(90deg,#3b82f6,#6366f1);width:${pct}%;transition:width 200ms;"></span>
      </div>
    `;
  }

  function renderDone() {
    const r = imp.result;
    const ok = r.fail === 0;
    return `
      <div style="padding:12px 14px;border-radius:10px;background:${ok ? 'rgba(34,197,94,.10)' : 'rgba(245,158,11,.10)'};border:1px solid ${ok ? 'rgba(34,197,94,.28)' : 'rgba(245,158,11,.28)'};color:${ok ? '#86efac' : '#fcd34d'};font-size:13px;">
        <b>${r.success}</b> venda${r.success === 1 ? '' : 's'} importada${r.success === 1 ? '' : 's'}${r.fail > 0 ? ' · ' + r.fail + ' com erro' : ''}
      </div>
      ${r.fail > 0 ? `
        <details style="margin-top:12px;padding:10px 14px;border-radius:10px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.24);color:#fcd34d;font-size:12.5px;">
          <summary style="cursor:pointer;">Ver erros</summary>
          <ul style="padding-left:18px;margin:8px 0 0;">
            ${imp.errors.slice(0, 20).map(e => `<li>Linha ${e.line}: ${e.msg}</li>`).join('')}
          </ul>
        </details>
      ` : ''}
    `;
  }

  /* =========================================================
     Import
     ========================================================= */
  async function doImport() {
    if (imp.inserting || imp.parsed.length === 0) return;

    imp.inserting = true;
    imp.stage = 'importing';
    imp.progress = { done: 0, total: imp.parsed.length, pct: 0 };
    imp.result = { success: 0, fail: 0 };
    render();

    const s = await window.Auth.requireSession().catch(() => null);
    const uid = s && s.user ? s.user.id : null;

    let orgId = null;
    try {
      const { data } = await window.db.from('profiles').select('organization_id').eq('id', uid).maybeSingle();
      orgId = data && data.organization_id;
    } catch (e) {}

    if (!orgId) {
      alert('Empresa não identificada.');
      imp.inserting = false;
      imp.stage = 'validated';
      render();
      return;
    }

    const [prodRes, custRes] = await Promise.all([
      window.db.from('products').select('id, name, code, price').eq('organization_id', orgId),
      window.db.from('customers').select('id, name').eq('organization_id', orgId)
    ]);

    const prodByName = new Map();
    const prodByCode = new Map();
    (prodRes.data || []).forEach(p => {
      if (p.name) prodByName.set(String(p.name).toLowerCase().trim(), p);
      if (p.code) prodByCode.set(String(p.code).toLowerCase().trim(), p);
    });

    const custByName = new Map();
    (custRes.data || []).forEach(c => {
      if (c.name) custByName.set(String(c.name).toLowerCase().trim(), c);
    });

    const grupos = new Map();
    imp.parsed.forEach((r, i) => {
      const key = r.numero_venda || ('auto_' + i);
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key).push(r);
    });

    let idx = 0;
    for (const [numVenda, linhas] of grupos.entries()) {
      idx += 1;
      try {
        const primeiraLinha = linhas[0];
        const subtotal = linhas.reduce((sum, l) => sum + l.quantidade * l.preco_unitario, 0);
        const desconto = primeiraLinha.desconto || 0;
        const total = Math.max(0, subtotal - desconto);

        const customer = primeiraLinha.cliente
          ? custByName.get(String(primeiraLinha.cliente).toLowerCase().trim())
          : null;

        /* Gera sale_number único — usa o da planilha se existir, senão gera um */
        const saleNumber = (numVenda && !String(numVenda).startsWith('auto_'))
          ? String(numVenda)
          : 'IMP-' + Date.now() + '-' + idx;

        const { data: sale, error: saleErr } = await window.db
          .from('sales')
          .insert({
            organization_id: orgId,
            sale_number: saleNumber,
            customer_id: customer ? customer.id : null,
            subtotal: subtotal,
            discount: desconto,
            total: total,
            payment_method: primeiraLinha.forma_pagamento,
            status: primeiraLinha.status,
            created_at: primeiraLinha.data + 'T12:00:00Z',
            notes: 'Importada via planilha · Venda ' + numVenda
          })
          .select('id')
          .single();

        if (saleErr) throw saleErr;

        const items = linhas.map(l => {
          const prod = prodByName.get(String(l.produto).toLowerCase().trim())
                    || prodByCode.get(String(l.produto).toLowerCase().trim());
          return {
            sale_id: sale.id,
            product_id: prod ? prod.id : null,
            product_name: l.produto,
            quantity: l.quantidade,
            unit_price: l.preco_unitario,
            subtotal: Math.round((l.quantidade * l.preco_unitario) * 100) / 100
          };
        });

        const { error: itemsErr } = await window.db.from('sale_items').insert(items);
        if (itemsErr) throw itemsErr;

        imp.result.success += 1;
      } catch (err) {
        imp.result.fail += 1;
        imp.errors.push({ line: 'Venda ' + numVenda, msg: err.message || 'Erro' });
      }

      imp.progress.done = idx;
      imp.progress.pct = (idx / grupos.size) * 100;
      if (idx % 3 === 0 || idx === grupos.size) render();
    }

    imp.inserting = false;
    imp.stage = 'done';
    render();
  }

  /* =========================================================
     Exporta
     ========================================================= */
  window.ImportSales = { setup, abrir, close };
})();