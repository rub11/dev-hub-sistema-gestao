/* =========================================================
   DEV HUB · Scanner móvel
   ---------------------------------------------------------
   Modos:
     - ?token=XXX              → VENDAS (carrinho remoto)
     - ?mode=products&token=X  → PRODUTOS (cadastra e adiciona
                                  estoque direto do celular)

   Fluxo modo products:
     1. Bipa código
     2. Busca produto
     3. NÃO existe → abre modal "Novo produto" → salva em
                     products → loga em scan_items
     4. Existe     → abre modal "Adicionar estoque" →
                     UPDATE products.stock → loga
     5. Volta pra câmera (sessão continua ativa)
   ========================================================= */

(function () {
  'use strict';

  const params   = new URLSearchParams(location.search);
  const tokenUrl = params.get('token');
  const mode     = params.get('mode') || 'sale';

  let session      = null;
  let html5Qr      = null;
  let lastCode     = '';
  let lastTime     = 0;
  let ultimoItemId = null;
  let channel      = null;
  let encerrada    = false;
  let pausado      = false;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const Auth = window.Auth;
    if (!Auth || !Auth.isConfigured || !Auth.isConfigured() || !window.db) {
      alert('Supabase não configurado.');
      return;
    }

    const s = await Auth.requireSession().catch(() => null);
    if (!s) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.replace('index.html?next=' + next);
      return;
    }

    // Ajusta título conforme o modo
    const titleEl = document.getElementById('page-title');
    if (titleEl) {
      titleEl.textContent = mode === 'products' ? 'Cadastro rápido' : 'Scanner';
    }

    setupModais();
    setupBotoes();

    if (tokenUrl) {
      const ok = await parearPorToken(tokenUrl);
      if (!ok) {
        setLast('❌ Token inválido ou expirado.', 'err');
        mostrarSessao('Sessão inválida');
        return;
      }
    } else {
      await pegarSessaoAtiva(s.user.id);
    }

    if (session) {
      iniciarCamera();
      assinarEncerramento();
    } else {
      mostrarSessao('Nenhuma sessão ativa');
      setLast('Abra o Modo Scanner no PC primeiro.', 'err');
    }
  }

  /* =========================================================
     Sessão
     ========================================================= */
  async function parearPorToken(token) {
    const { data, error } = await window.db
      .from('scan_sessions')
      .select('id, token, status, expires_at')
      .eq('token', token)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !data) return false;
    if (new Date(data.expires_at) < new Date()) return false;

    session = data;
    mostrarSessao('Sessão: ' + session.token);
    return true;
  }

  async function pegarSessaoAtiva(userId) {
    const { data } = await window.db
      .from('scan_sessions')
      .select('id, token, status, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data[0]) {
      session = data[0];
      mostrarSessao('Sessão: ' + session.token);
    }
  }

  function mostrarSessao(txt) {
    const el = document.getElementById('sessao-info');
    if (el) el.textContent = txt;
  }

  function assinarEncerramento() {
    if (!session) return;

    channel = window.db
      .channel('scanner-mob:' + session.id)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'scan_sessions',
        filter: 'id=eq.' + session.id
      }, (payload) => {
        const novo = payload.new;
        if (novo && (novo.status === 'closed' || novo.status === 'expired')) {
          encerrarTela();
        }
      })
      .subscribe();
  }

  function encerrarTela() {
    if (encerrada) return;
    encerrada = true;

    if (html5Qr) {
      try { html5Qr.stop().catch(() => {}); } catch (e) {}
      html5Qr = null;
    }

    const tela = document.getElementById('tela-encerrada');
    if (tela) tela.classList.remove('hidden');
  }

  /* =========================================================
     Câmera
     ========================================================= */
  function iniciarCamera() {
    if (typeof Html5Qrcode === 'undefined') {
      setLast('Biblioteca de scan não carregou.', 'err');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setLast('Câmera não disponível (precisa HTTPS).', 'err');
      return;
    }

    html5Qr = new Html5Qrcode('reader', { verbose: false });

    const config = {
      fps: 10,
      qrbox: (w, h) => {
        const min = Math.min(w, h);
        return { width: Math.floor(min * 0.85), height: Math.floor(min * 0.42) };
      },
      aspectRatio: 1.0,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.QR_CODE
      ]
    };

    html5Qr.start(
      { facingMode: 'environment' },
      config,
      onScanSuccess,
      () => {}
    ).catch((err) => {
      console.error('[scanner] start:', err);
      const msg = String((err && err.message) || err || '');
      if (msg.toLowerCase().includes('permission')) {
        setLast('Permissão de câmera negada.', 'err');
      } else if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        setLast('A câmera exige HTTPS.', 'err');
      } else {
        setLast('Não foi possível abrir a câmera.', 'err');
      }
    });
  }

  function pausarCamera() {
    if (!html5Qr) return;
    try { html5Qr.pause(true); pausado = true; } catch (e) {}
  }

  function retomarCamera() {
    if (!html5Qr || !pausado) return;
    try { html5Qr.resume(); pausado = false; } catch (e) {}
  }

  async function onScanSuccess(decodedText) {
    if (encerrada) return;

    const now = Date.now();
    if (decodedText === lastCode && (now - lastTime) < 1600) return;
    lastCode = decodedText;
    lastTime = now;

    pausarCamera();

    if (mode === 'products') {
      await processarProduto(decodedText);
    } else {
      await adicionarItemVenda(decodedText);
      setTimeout(() => { if (!encerrada) retomarCamera(); }, 800);
    }
  }

  /* =========================================================
     MODO VENDA (igual antes)
     ========================================================= */
  async function adicionarItemVenda(barcode) {
    const codigo = String(barcode || '').trim();
    if (!codigo) return;
    if (!session) { setLast('Sem sessão pareada.', 'err'); return; }

    setLast('Buscando "' + codigo + '"…');

    const { data: prod, error: prodErr } = await window.db
      .rpc('find_product_by_barcode', { p_barcode: codigo });

    if (prodErr) {
      console.error('[scanner] rpc find:', prodErr);
      setLast('Erro ao buscar produto.', 'err');
      vibrar(180);
      return;
    }

    const product = Array.isArray(prod) ? prod[0] : prod;

    if (!product) {
      setLast('❌ ' + codigo + ' não cadastrado.', 'err');
      vibrar(180);
      return;
    }

    const { data: itemId, error: upErr } = await window.db
      .rpc('scan_upsert_item', {
        p_session_id:      session.id,
        p_product_id:      product.id,
        p_barcode:         codigo,
        p_product_name:    product.name,
        p_unit_price:      Number(product.price) || 0,
        p_stock_available: Number(product.stock) || 0
      });

    if (upErr) {
      console.error('[scanner] upsert:', upErr);
      setLast('Erro ao inserir: ' + (upErr.message || 'erro'), 'err');
      vibrar(180);
      return;
    }

    ultimoItemId = itemId;

    let qtyAtual = 1;
    try {
      const { data: row } = await window.db
        .from('scan_items')
        .select('quantity')
        .eq('id', itemId)
        .single();
      if (row && row.quantity) qtyAtual = Number(row.quantity);
    } catch (e) {}

    setLast(
      '✅ ' + product.name + ' · ' + qtyAtual + '× · R$ ' +
      (Number(product.price) || 0).toFixed(2).replace('.', ','),
      'ok'
    );
    vibrar(60);
  }

  /* =========================================================
     MODO PRODUTOS
     ========================================================= */
  async function processarProduto(barcode) {
    const codigo = String(barcode || '').trim();
    if (!codigo) return;
    if (!session) { setLast('Sem sessão pareada.', 'err'); return; }

    setLast('Lendo "' + codigo + '"…');

    const { data: prod, error } = await window.db
      .rpc('find_product_by_barcode', { p_barcode: codigo });

    if (error) {
      console.error('[scanner] rpc find:', error);
      setLast('Erro ao buscar produto.', 'err');
      vibrar(180);
      retomarCamera();
      return;
    }

    const product = Array.isArray(prod) ? prod[0] : prod;

    if (!product) {
      // Abre modal "Novo produto" com o barcode já preenchido
      abrirNovoProduto(codigo);
    } else {
      // Abre modal "Adicionar estoque"
      abrirAdicionarEstoque(product);
    }
  }

  /* ---- Modal: Novo produto ---- */
  const npEls = {};

  function abrirNovoProduto(barcode) {
    npEls.name.value = '';
    npEls.price.value = '0';
    npEls.stock.value = '0';
    npEls.code.value = '';
    npEls.barcode.value = barcode;
    npEls.description.value = '';
    npEls.feedback.textContent = '';
    npEls.barcodeLabel.textContent = barcode;

    npEls.modal.hidden = false;
    setTimeout(() => npEls.name.focus(), 100);
    vibrar(60);
  }

  async function salvarNovoProduto() {
    const name = npEls.name.value.trim();
    const price = Number(npEls.price.value) || 0;
    const stock = parseInt(npEls.stock.value, 10) || 0;
    const code  = npEls.code.value.trim() || null;
    const barcode = npEls.barcode.value.trim();
    const description = npEls.description.value.trim() || null;

    if (!name) {
      npEls.feedback.textContent = 'Informe o nome do produto.';
      npEls.name.focus();
      return;
    }
    if (price < 0) {
      npEls.feedback.textContent = 'Preço inválido.';
      return;
    }
    if (stock < 0) {
      npEls.feedback.textContent = 'Estoque inválido.';
      return;
    }
    if (!barcode) {
      npEls.feedback.textContent = 'Código de barras ausente.';
      return;
    }

    npEls.save.disabled = true;
    npEls.save.innerHTML = '<span class="sm-busy"></span>Salvando…';

    try {
      // Pega org do usuário
      const s = await window.Auth.requireSession();
      const { data: profile } = await window.db
        .from('profiles')
        .select('organization_id')
        .eq('id', s.user.id)
        .maybeSingle();

      if (!profile || !profile.organization_id) {
        throw new Error('Empresa não identificada.');
      }

      const { data: inserted, error } = await window.db
        .from('products')
        .insert({
          organization_id: profile.organization_id,
          name: name,
          code: code,
          barcode: barcode,
          description: description,
          price: price,
          stock: stock,
          minimum_stock: 0,
          active: true,
          image_urls: []
        })
        .select('id, name')
        .single();

      if (error) throw error;

      // Log em scan_items
      await window.db.from('scan_items').insert({
        session_id: session.id,
        product_id: inserted.id,
        barcode: barcode,
        product_name: name,
        unit_price: price,
        stock_available: stock,
        quantity: 1,
        action_type: 'product_created',
        metadata: {
          name: name,
          price: price,
          stock: stock,
          code: code
        },
        scanned_by: s.user.id
      });

      npEls.modal.hidden = true;
      setLast('✅ Novo produto: ' + name, 'ok');
      vibrar(80);

      setTimeout(() => { if (!encerrada) retomarCamera(); }, 500);
    } catch (err) {
      console.error('[scanner] salvar produto:', err);
      const msg = String(err.message || '');
      if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')) {
        npEls.feedback.textContent = 'Já existe produto com este código.';
      } else {
        npEls.feedback.textContent = msg || 'Erro ao cadastrar produto.';
      }
    } finally {
      npEls.save.disabled = false;
      npEls.save.textContent = 'Cadastrar';
    }
  }

  /* ---- Modal: Adicionar estoque ---- */
  const asEls = {};

  function abrirAdicionarEstoque(product) {
    asEls.target = product;
    asEls.name.textContent    = product.name || '—';
    asEls.barcode.textContent = product.barcode || '—';
    asEls.code.textContent    = product.code || '—';
    asEls.current.textContent = (parseInt(product.stock, 10) || 0) + ' un.';
    asEls.price.textContent   = 'R$ ' + (Number(product.price) || 0).toFixed(2).replace('.', ',');
    asEls.qty.value = '1';
    asEls.feedback.textContent = '';

    asEls.modal.hidden = false;
    setTimeout(() => asEls.qty.focus(), 100);
    vibrar(60);
  }

  async function salvarEstoque() {
    if (!asEls.target) return;

    const qty = Math.max(1, parseInt(asEls.qty.value, 10) || 0);
    if (!qty) {
      asEls.feedback.textContent = 'Informe uma quantidade válida.';
      return;
    }

    asEls.save.disabled = true;
    asEls.save.innerHTML = '<span class="sm-busy"></span>Salvando…';

    try {
      const next = (parseInt(asEls.target.stock, 10) || 0) + qty;

      const { error } = await window.db
        .from('products')
        .update({ stock: next })
        .eq('id', asEls.target.id);

      if (error) throw error;

      const s = await window.Auth.requireSession();

      await window.db.from('scan_items').insert({
        session_id: session.id,
        product_id: asEls.target.id,
        barcode: asEls.target.barcode,
        product_name: asEls.target.name,
        unit_price: Number(asEls.target.price) || 0,
        stock_available: next,
        quantity: qty,
        action_type: 'stock_added',
        metadata: {
          qty_added: qty,
          previous_stock: parseInt(asEls.target.stock, 10) || 0,
          new_stock: next
        },
        scanned_by: s.user.id
      });

      asEls.modal.hidden = true;
      setLast('✅ +' + qty + ' un. de ' + asEls.target.name + ' (' + next + ' total)', 'ok');
      vibrar(80);

      setTimeout(() => { if (!encerrada) retomarCamera(); }, 500);
    } catch (err) {
      console.error('[scanner] add estoque:', err);
      asEls.feedback.textContent = err.message || 'Erro ao adicionar estoque.';
    } finally {
      asEls.save.disabled = false;
      asEls.save.textContent = 'Adicionar';
    }
  }

  /* =========================================================
     Modais: setup
     ========================================================= */
  function setupModais() {
    // ---- Novo produto ----
    npEls.modal      = document.getElementById('sm-new-product');
    npEls.name       = document.getElementById('sm-np-name');
    npEls.price      = document.getElementById('sm-np-price');
    npEls.stock      = document.getElementById('sm-np-stock');
    npEls.code       = document.getElementById('sm-np-code');
    npEls.barcode    = document.getElementById('sm-np-barcode');
    npEls.barcodeLabel = document.getElementById('sm-np-barcode-label');
    npEls.description = document.getElementById('sm-np-description');
    npEls.feedback   = document.getElementById('sm-np-feedback');
    npEls.save       = document.getElementById('sm-np-save');

    if (npEls.modal) {
      npEls.modal.querySelectorAll('[data-sm-close]').forEach(el => {
        el.addEventListener('click', () => {
          npEls.modal.hidden = true;
          retomarCamera();
        });
      });
      npEls.save.addEventListener('click', salvarNovoProduto);
    }

    // ---- Adicionar estoque ----
    asEls.modal    = document.getElementById('sm-add-stock');
    asEls.name     = document.getElementById('sm-as-name');
    asEls.barcode  = document.getElementById('sm-as-barcode');
    asEls.code     = document.getElementById('sm-as-code');
    asEls.current  = document.getElementById('sm-as-current');
    asEls.price    = document.getElementById('sm-as-price');
    asEls.qty      = document.getElementById('sm-as-qty');
    asEls.feedback = document.getElementById('sm-as-feedback');
    asEls.save     = document.getElementById('sm-as-save');

    if (asEls.modal) {
      asEls.modal.querySelectorAll('[data-sm-close]').forEach(el => {
        el.addEventListener('click', () => {
          asEls.modal.hidden = true;
          retomarCamera();
        });
      });
      asEls.modal.querySelectorAll('[data-sm-step]').forEach(btn => {
        btn.addEventListener('click', () => {
          const step = parseInt(btn.getAttribute('data-sm-step'), 10);
          const cur = Math.max(1, parseInt(asEls.qty.value, 10) || 1);
          asEls.qty.value = String(Math.max(1, cur + step));
        });
      });
      asEls.save.addEventListener('click', salvarEstoque);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (npEls.modal && !npEls.modal.hidden) {
        npEls.modal.hidden = true;
        retomarCamera();
      }
      if (asEls.modal && !asEls.modal.hidden) {
        asEls.modal.hidden = true;
        retomarCamera();
      }
    });
  }

  /* =========================================================
     Botões / UI
     ========================================================= */
  function setupBotoes() {
    const manualInput = document.getElementById('manual-input');
    const manualAdd   = document.getElementById('manual-add');
    const rmLast      = document.getElementById('btn-remove-last');
    const encerrar    = document.getElementById('btn-encerrar');
    const sair        = document.getElementById('btn-sair');

    manualAdd.addEventListener('click', () => {
      const v = manualInput.value.trim();
      if (!v) return;
      manualInput.value = '';
      manualInput.focus();
      if (mode === 'products') {
        processarProduto(v);
      } else {
        adicionarItemVenda(v);
      }
    });

    manualInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); manualAdd.click(); }
    });

    rmLast.addEventListener('click', async () => {
      if (mode === 'products') {
        setLast('No modo cadastro não há itens pra remover.', 'err');
        return;
      }
      if (!ultimoItemId) { setLast('Nada pra remover.', 'err'); return; }
      const { error } = await window.db
        .rpc('scan_decrement_item', { p_item_id: ultimoItemId });
      if (error) { setLast('Erro ao remover.', 'err'); return; }
      setLast('Último item removido.', 'ok');
    });

    encerrar.addEventListener('click', async () => {
      if (!session) return;
      const ok = window.UI && window.UI.confirm
        ? await window.UI.confirm('Encerrar a sessão de scanner?', {
            title: 'Encerrar', danger: true, confirmLabel: 'Encerrar'
          })
        : window.confirm('Encerrar a sessão de scanner?');
      if (!ok) return;

      try {
        await window.db.from('scan_sessions')
          .update({ status: 'closed' }).eq('id', session.id);
      } catch (e) {}
      encerrarTela();
    });

    sair.addEventListener('click', async () => {
      try { await window.Auth.signOut(); } catch (e) {}
    });
  }

  function setLast(msg, kind) {
    const el = document.getElementById('last-scan');
    if (!el) return;
    el.textContent = msg;
    el.className = 'last' + (kind ? ' ' + kind : '');
  }

  function vibrar(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }
})();