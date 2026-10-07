/* =========================================================
   DEV HUB · Scanner móvel
   ========================================================= */

(function () {
  'use strict';

  const params   = new URLSearchParams(location.search);
  const tokenUrl = params.get('token');

  let session      = null;
  let html5Qr      = null;
  let lastCode     = '';
  let lastTime     = 0;
  let ultimoItemId = null;
  let channel      = null;
  let encerrada    = false;

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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scan_sessions',
          filter: 'id=eq.' + session.id
        },
        (payload) => {
          const novo = payload.new;
          if (novo && (novo.status === 'closed' || novo.status === 'expired')) {
            encerrarTela();
          }
        }
      )
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
      qrbox: function (w, h) {
        const min = Math.min(w, h);
        return {
          width:  Math.floor(min * 0.85),
          height: Math.floor(min * 0.42)
        };
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
      const msg = String(err && err.message || err || '');
      if (msg.toLowerCase().includes('permission')) {
        setLast('Permissão de câmera negada.', 'err');
      } else if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        setLast('A câmera exige HTTPS.', 'err');
      } else {
        setLast('Não foi possível abrir a câmera.', 'err');
      }
    });
  }

  async function onScanSuccess(decodedText) {
    if (encerrada) return;

    const now = Date.now();
    if (decodedText === lastCode && (now - lastTime) < 1600) return;
    lastCode = decodedText;
    lastTime = now;

    if (html5Qr) { try { html5Qr.pause(true); } catch (e) {} }

    await adicionarItem(decodedText);

    setTimeout(() => {
      if (html5Qr && !encerrada) {
        try { html5Qr.resume(); } catch (e) {}
      }
    }, 800);
  }

  async function adicionarItem(barcode) {
    const codigo = String(barcode || '').trim();
    if (!codigo) return;

    if (!session) { setLast('Sem sessão pareada.', 'err'); return; }

    setLast('Buscando "' + codigo + '"…');

    const { data: prod, error: prodErr } = await window.db
      .rpc('find_product_by_barcode', { p_barcode: codigo });

    if (prodErr) {
      console.error('[scanner] rpc:', prodErr);
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

    const s = await window.Auth.requireSession().catch(() => null);
    const userId = s && s.user && s.user.id;

    const { data: inserted, error: insErr } = await window.db
      .from('scan_items')
      .insert({
        session_id:   session.id,
        product_id:   product.id,
        barcode:      codigo,
        product_name: product.name,
        unit_price:   Number(product.price) || 0,
        quantity:     1,
        scanned_by:   userId
      })
      .select('id')
      .single();

    if (insErr) {
      console.error('[scanner] insert:', insErr);
      setLast('Erro ao inserir item.', 'err');
      vibrar(180);
      return;
    }

    ultimoItemId = inserted.id;

    setLast('✅ ' + product.name + ' · R$ ' +
      (Number(product.price) || 0).toFixed(2).replace('.', ','), 'ok');
    vibrar(60);
  }

  function setupBotoes() {
    const manualInput = document.getElementById('manual-input');
    const manualAdd   = document.getElementById('manual-add');
    const rmLast      = document.getElementById('btn-remove-last');
    const encerrar    = document.getElementById('btn-encerrar');
    const sair        = document.getElementById('btn-sair');

    manualAdd.addEventListener('click', () => {
      const v = manualInput.value.trim();
      if (!v) return;
      adicionarItem(v);
      manualInput.value = '';
      manualInput.focus();
    });

    manualInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); manualAdd.click(); }
    });

    rmLast.addEventListener('click', async () => {
      if (!ultimoItemId) { setLast('Nada pra remover.', 'err'); return; }
      const { error } = await window.db
        .from('scan_items').delete().eq('id', ultimoItemId);
      if (error) { setLast('Erro ao remover.', 'err'); return; }
      ultimoItemId = null;
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