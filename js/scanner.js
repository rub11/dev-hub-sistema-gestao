/* =========================================================
   DEV HUB · Scanner Mobile
   ---------------------------------------------------------
   Fluxo:
     1. Abre scanner.html?token=XXXXXX (vindo do QR do PC)
     2. Valida a sessão no Supabase
     3. Abre a câmera, lê código de barras (EAN/UPC/Code128)
     4. Consulta produto pelo barcode via find_product_by_barcode
     5. Envia pra scan_items via scan_upsert_item
     6. PC recebe via realtime

   Modo "products":
     - ?mode=products → aceita enviar mesmo sem produto cadastrado
       (o PC abre o modal de cadastro novo)
   ========================================================= */

(function () {
  'use strict';

  const params = new URLSearchParams(location.search);

  const state = {
    session: null,
    token: null,
    stream: null,
    scanning: false,
    detector: null,
    ultimoItemId: null,
    ultimoCodigo: null,
    ultimoTimestamp: 0,
    cooldownMs: 1200,
    modoProdutos: false
  };

  // Elementos
  let videoEl, canvasEl, statusEl, lastEl, btnTorch, btnSwitch, btnStop;

  document.addEventListener('DOMContentLoaded', init);

  /* =========================================================
     Init
     ========================================================= */
  async function init() {
    videoEl   = document.getElementById('scanner-video');
    canvasEl  = document.getElementById('scanner-canvas');
    statusEl  = document.getElementById('scanner-status');
    lastEl    = document.getElementById('scanner-last');
    btnTorch  = document.getElementById('scanner-torch');
    btnSwitch = document.getElementById('scanner-switch');
    btnStop   = document.getElementById('scanner-stop');

    state.modoProdutos = params.get('mode') === 'products';
    state.token = (params.get('token') || '').trim().toUpperCase();

    if (!state.token) {
      setStatus('Token ausente. Volte e escaneie o QR novamente.', 'err');
      return;
    }

    if (state.modoProdutos) {
      document.body.classList.add('mode-products');
      setStatus('Modo: cadastro/estoque de produtos', 'info');
    }

    wireBotoes();

    // Valida sessão
    const ok = await validarSessao();
    if (!ok) return;

    // Inicia câmera
    await iniciarCamera();
  }

  /* =========================================================
     UI
     ========================================================= */
  function setStatus(txt, kind) {
    if (!statusEl) { console.log('[scanner]', txt); return; }
    statusEl.textContent = txt;
    statusEl.dataset.kind = kind || 'info';
  }

  function setLast(txt, kind) {
    if (!lastEl) { console.log('[scanner]', txt); return; }
    lastEl.textContent = txt;
    lastEl.dataset.kind = kind || 'info';
  }

  function vibrar(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }

  function wireBotoes() {
    if (btnTorch) {
      btnTorch.addEventListener('click', toggleTorch);
      btnTorch.hidden = true; // mostra só se suportado
    }
    if (btnSwitch) {
      btnSwitch.addEventListener('click', trocarCamera);
    }
    if (btnStop) {
      btnStop.addEventListener('click', () => {
        pararCamera();
        setStatus('Scanner pausado.', 'info');
      });
    }
  }

  /* =========================================================
     Sessão
     ========================================================= */
  async function validarSessao() {
    setStatus('Validando sessão…', 'info');

    const { data, error } = await window.db
      .from('scan_sessions')
      .select('id, token, status, organization_id, user_id, expires_at')
      .eq('token', state.token)
      .maybeSingle();

    if (error) {
      console.error('[scanner] erro validar:', error);
      setStatus('Erro ao validar. Tente novamente.', 'err');
      return false;
    }

    if (!data) {
      setStatus('Sessão não encontrada. Gere um novo QR no PC.', 'err');
      return false;
    }

    if (data.status !== 'active') {
      setStatus('Sessão encerrada. Gere um novo QR no PC.', 'err');
      return false;
    }

    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      setStatus('Sessão expirada. Gere um novo QR no PC.', 'err');
      return false;
    }

    state.session = data;
    setStatus('Pronto! Aponte a câmera pro código de barras.', 'ok');
    return true;
  }

  /* =========================================================
     Câmera
     ========================================================= */
  async function iniciarCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('Navegador não suporta câmera.', 'err');
      return;
    }

    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      videoEl.srcObject = state.stream;
      videoEl.setAttribute('playsinline', '');
      await videoEl.play();

      iniciarDeteccao();
      configurarTorch();
    } catch (err) {
      console.error('[scanner] câmera:', err);
      setStatus('Não foi possível acessar a câmera. Verifique permissões.', 'err');
    }
  }

  function pararCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach(t => t.stop());
      state.stream = null;
    }
  }

  async function trocarCamera() {
    pararCamera();
    await iniciarCamera();
  }

  async function configurarTorch() {
    if (!btnTorch || !state.stream) return;
    const track = state.stream.getVideoTracks()[0];
    if (!track) return;
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (caps && caps.torch) {
      btnTorch.hidden = false;
    }
  }

  async function toggleTorch() {
    if (!state.stream) return;
    const track = state.stream.getVideoTracks()[0];
    if (!track) return;
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (!caps || !caps.torch) return;
    const atual = track.getSettings().torch || false;
    try {
      await track.applyConstraints({ advanced: [{ torch: !atual }] });
    } catch (e) {}
  }

  /* =========================================================
     Detecção
     ========================================================= */
  async function iniciarDeteccao() {
    // Preferência: BarcodeDetector nativo (Chrome Android, Safari iOS 17+)
    if ('BarcodeDetector' in window) {
      try {
        state.detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code']
        });
      } catch (e) {
        state.detector = null;
      }
    }

    if (state.detector) {
      loopBarcodeDetector();
    } else {
      // Fallback: lib externa (ZXing) — se você já carregou
      if (window.ZXing && window.ZXing.BrowserMultiFormatReader) {
        const reader = new window.ZXing.BrowserMultiFormatReader();
        reader.decodeFromVideoDevice(null, videoEl, (result, err) => {
          if (result) onCodigoLido(result.getText());
        });
      } else {
        setStatus('Este navegador não suporta leitura de código. Use Chrome Android.', 'err');
      }
    }
  }

  async function loopBarcodeDetector() {
    if (!state.detector || !videoEl || !state.stream) return;

    // Só detecta a cada ~250ms pra economizar bateria
    const INTERVALO = 250;

    const tick = async () => {
      if (!state.stream) return;
      if (videoEl.readyState >= 2) {
        try {
          const codes = await state.detector.detect(videoEl);
          if (codes && codes.length) {
            const raw = codes[0].rawValue || '';
            if (raw) onCodigoLido(raw);
          }
        } catch (e) {}
      }
      setTimeout(tick, INTERVALO);
    };

    tick();
  }

  /* =========================================================
     Bipou!
     ========================================================= */
  async function onCodigoLido(codigo) {
    if (!codigo) return;
    codigo = String(codigo).trim();
    if (!codigo) return;

    // Cooldown anti-duplicata
    const agora = Date.now();
    if (codigo === state.ultimoCodigo && (agora - state.ultimoTimestamp) < state.cooldownMs) {
      return;
    }
    state.ultimoCodigo = codigo;
    state.ultimoTimestamp = agora;

    if (state.scanning) return;
    state.scanning = true;

    setStatus('Lido: ' + codigo, 'ok');
    vibrar(40);

    try {
      await adicionarItem(codigo);
    } catch (err) {
      console.error('[scanner] adicionarItem:', err);
      setLast('❌ Erro ao enviar: ' + (err.message || err), 'err');
      vibrar(180);
    } finally {
      setTimeout(() => { state.scanning = false; }, 400);
    }
  }

  /* =========================================================
     Envia pro PC
     ========================================================= */
  async function adicionarItem(codigo) {
    if (!state.session) {
      setLast('❌ Sessão não iniciada.', 'err');
      return;
    }

    // 1. Busca produto pelo barcode
    let prod = null;
    try {
      const { data, error } = await window.db
        .rpc('find_product_by_barcode', {
          p_org_id: state.session.organization_id,
          p_barcode: codigo
        });
      if (error) throw error;
      prod = Array.isArray(data) ? data[0] : data;
    } catch (e) {
      console.error('[scanner] find_product_by_barcode:', e);
    }

    const product = prod || null;

    /* Modo "produtos": aceita registrar mesmo se não existir,
       pra que o PC abra o modal de cadastro. */
    if (!product && !state.modoProdutos) {
      setLast('❌ ' + codigo + ' não cadastrado.', 'err');
      vibrar(180);
      return;
    }

    // 2. UPSERT: soma se já existe, insere se não
    const { data: itemId, error: upErr } = await window.db
      .rpc('scan_upsert_item', {
        p_session_id:      state.session.id,
        p_product_id:      product ? product.id : null,
        p_barcode:         codigo,
        p_product_name:    product ? product.name : '(novo)',
        p_unit_price:      product ? (Number(product.price) || 0) : 0,
        p_stock_available: product ? (Number(product.stock) || 0) : 0
      });

    if (upErr) {
      console.error('[scanner] scan_upsert_item:', upErr);
      setLast('❌ Erro ao enviar: ' + upErr.message, 'err');
      vibrar(180);
      return;
    }

    state.ultimoItemId = itemId;

    if (!product) {
      setLast('📥 ' + codigo + ' enviado (não cadastrado)', 'ok');
    } else {
      let qtyAtual = 1;
      try {
        const { data: row } = await window.db
          .from('scan_items')
          .select('quantity')
          .eq('id', itemId)
          .maybeSingle();
        if (row && row.quantity) qtyAtual = Number(row.quantity);
      } catch (e) {}

      setLast(
        '✅ ' + product.name + ' · ' + qtyAtual + '× · R$ ' +
        (Number(product.price) || 0).toFixed(2).replace('.', ','),
        'ok'
      );
    }

    vibrar(60);
    setStatus('Pronto! Aponte pro próximo código.', 'ok');
  }
})();