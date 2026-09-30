/* =========================================================
   DEV HUB · Módulo Compras · UI + integração Supabase
   ---------------------------------------------------------
   Índice:
     1. Helpers (DOM, formatação, toast, val/setVal)
     2. Constantes (labels)
     3. API (wrappers Supabase)
     4. CNPJ + SupplierModal (cadastro inline)
     5. Páginas (uma função por data-page)
     6. Bootstrap
   ---------------------------------------------------------
   Roteia por body[data-page]:
     • compras           → lista + ações completas
     • compras-nova      → lançar / editar (via ?id=xxx)
     • compras-receber   → estoquista
     • fornecedores      → CRUD com busca CNPJ
   ========================================================= */

(function () {
  'use strict';

  /* =========================================================
     1) HELPERS
     ========================================================= */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const todayISO = () => new Date().toISOString().slice(0, 10);

  const val = (sel, fallback = '') => {
    const el = $(sel);
    if (!el) {
      console.warn('[compras] elemento não encontrado:', sel);
      return fallback;
    }
    return el.value == null ? fallback : el.value;
  };

  const setVal = (sel, v) => {
    const el = $(sel);
    if (el) el.value = v == null ? '' : v;
  };

  const db = () => {
    if (window.db && window.db.from) return window.db;
    if (window.supabaseClient && window.supabaseClient.from) return window.supabaseClient;
    throw new Error('Cliente Supabase não encontrado. Verifique js/supabase.js.');
  };

  const fmtBRL = (cents) => {
    const n = (Number(cents) || 0) / 100;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
  };

  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleString('pt-BR');
  };

  const parseBRLToCents = (str) => {
    if (str == null || str === '') return 0;
    const clean = String(str)
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : Math.round(n * 100);
  };

  const escapeHTML = (s) =>
    String(s || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));

  const toast = (msg, kind) => {
    if (window.Toast && typeof window.Toast.show === 'function') {
      return window.Toast.show(msg, kind);
    }
    const el = document.createElement('div');
    el.className = kind === 'error' ? 'cmp-error' : 'cmp-info';
    el.style.cssText =
      'position:fixed;top:80px;right:20px;z-index:200;max-width:360px;box-shadow:var(--cmp-shadow-md)';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  };

  /* =========================================================
     2) CONSTANTES
     ========================================================= */
  const STATUS_LABEL = {
    rascunho:              'Rascunho',
    aguardando_aprovacao:  'Aguardando aprovação',
    pendente_recebimento:  'Pendente de recebimento',
    recebida_parcial:      'Recebida parcial',
    recebida:              'Recebida',
    paga:                  'Paga',
    cancelada:             'Cancelada'
  };

  const PAYMENT_LABEL = {
    pix:              'PIX',
    boleto:           'Boleto',
    cartao_credito:   'Cartão de crédito',
    cartao_debito:    'Cartão de débito',
    transferencia:    'Transferência',
    dinheiro:         'Dinheiro',
    cheque:           'Cheque'
  };

  const EVENT_LABEL = {
    created:   'Compra criada',
    updated:   'Compra alterada',
    submitted: 'Enviada para aprovação',
    approved:  'Aprovada',
    received:  'Recebida',
    paid:      'Paga',
    cancelled: 'Cancelada'
  };

  /* =========================================================
     3) API
     ========================================================= */
  const API = {
    async hasCapability(cap) {
      try {
        const { data, error } = await db().rpc('user_has_capability', { p_capability: cap });
        if (error) { console.error('[compras] hasCapability', error); return false; }
        return data === true;
      } catch (e) { console.error(e); return false; }
    },

    /* ---------- Compras ---------- */
    async listPurchases(filters = {}) {
      let q = db().from('purchases').select(`
        id, code, status, supplier_name, supplier_id,
        total_cents, payment_method, purchase_date, expected_date,
        received_at, paid_at, created_at, created_by_name
      `).order('created_at', { ascending: false }).limit(200);

      if (filters.status)   q = q.eq('status', filters.status);
      if (filters.supplier) q = q.eq('supplier_id', filters.supplier);
      if (filters.from)     q = q.gte('purchase_date', filters.from);
      if (filters.to)       q = q.lte('purchase_date', filters.to);

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    async getPurchase(id) {
      const [p, i, e] = await Promise.all([
        db().from('purchases').select('*').eq('id', id).single(),
        db().from('purchase_items').select('*').eq('purchase_id', id).order('created_at'),
        db().from('purchase_events').select('*').eq('purchase_id', id)
          .order('created_at', { ascending: false }).limit(50)
      ]);
      if (p.error) throw p.error;
      if (i.error) throw i.error;
      if (e.error) throw e.error;
      return { purchase: p.data, items: i.data || [], events: e.data || [] };
    },

    async nextPurchaseCode() {
      const year = new Date().getFullYear();
      const prefix = `COMP-${year}-`;
      const { data, error } = await db()
        .from('purchases').select('code')
        .like('code', `${prefix}%`)
        .order('code', { ascending: false })
        .limit(1);
      if (error) throw error;
      const last = data && data[0] ? data[0].code : '';
      const n = last ? parseInt(last.split('-').pop(), 10) + 1 : 1;
      return prefix + String(n).padStart(4, '0');
    },

    async createPurchase(payload) {
      const { data: u } = await db().auth.getUser();
      const actor = u && u.user ? u.user : null;

      let createdByName = '';
      if (actor) {
        const { data: prof } = await db().from('profiles')
          .select('name').eq('id', actor.id).maybeSingle();
        createdByName = (prof && prof.name) || actor.email || '';
      }

      /* Fallbacks de data */
      const purchaseDate = (payload.purchase_date && String(payload.purchase_date).trim()) || todayISO();
      const expectedDate = (payload.expected_date && String(payload.expected_date).trim()) || null;
      const firstDue     = (payload.first_due_date && String(payload.first_due_date).trim()) || null;

      const { data: purchase, error } = await db()
        .from('purchases')
        .insert({
          code:             payload.code,
          status:           payload.status || 'rascunho',
          supplier_id:      payload.supplier_id || null,
          supplier_name:    payload.supplier_name || null,
          supplier_doc:     payload.supplier_doc || null,
          supplier_contact: payload.supplier_contact || null,
          subtotal_cents:   payload.subtotal_cents || 0,
          discount_cents:   payload.discount_cents || 0,
          shipping_cents:   payload.shipping_cents || 0,
          other_cents:      payload.other_cents || 0,
          total_cents:      payload.total_cents || 0,
          payment_method:   payload.payment_method || null,
          payment_terms:    payload.payment_terms || null,
          installments:     payload.installments || 1,
          first_due_date:   firstDue,
          purchase_date:    purchaseDate,
          expected_date:    expectedDate,
          notes:            payload.notes || null,
          invoice_number:   payload.invoice_number || null,
          created_by:       actor ? actor.id : null,
          created_by_name:  createdByName
        })
        .select().single();
      if (error) throw error;

      if (payload.items && payload.items.length) {
        const rows = payload.items.map((it) => ({
          purchase_id:      purchase.id,
          product_id:       it.product_id || null,
          description:      it.description || '',
          unit:             it.unit || 'un',
          quantity:         Number(it.quantity) || 0,
          unit_price_cents: Number(it.unit_price_cents) || 0,
          discount_cents:   Number(it.discount_cents) || 0,
          total_cents:      Number(it.total_cents) || 0
        }));
        const { error: e2 } = await db().from('purchase_items').insert(rows);
        if (e2) throw e2;
      }

      await db().from('purchase_events').insert({
        purchase_id: purchase.id,
        event:       'created',
        to_status:   purchase.status,
        actor_id:    actor ? actor.id : null,
        actor_name:  createdByName,
        payload:     { total_cents: purchase.total_cents }
      }).then(() => {}).catch(() => {});

      return purchase;
    },

    async updatePurchase(id, patch) {
      const { data: u } = await db().auth.getUser();
      const actor = u && u.user ? u.user : null;
      let actorName = '';
      if (actor) {
        const { data: prof } = await db().from('profiles')
          .select('name').eq('id', actor.id).maybeSingle();
        actorName = (prof && prof.name) || actor.email || '';
      }

      /* Fallback de datas */
      const safePatch = { ...patch };
      if ('purchase_date' in safePatch) {
        const d = (safePatch.purchase_date && String(safePatch.purchase_date).trim()) || todayISO();
        safePatch.purchase_date = d;
      }
      if ('expected_date' in safePatch) {
        safePatch.expected_date = (safePatch.expected_date && String(safePatch.expected_date).trim()) || null;
      }
      if ('first_due_date' in safePatch) {
        safePatch.first_due_date = (safePatch.first_due_date && String(safePatch.first_due_date).trim()) || null;
      }

      const { error } = await db().from('purchases').update({
        ...safePatch,
        updated_by:      actor ? actor.id : null,
        updated_by_name: actorName
      }).eq('id', id);
      if (error) throw error;

      await db().from('purchase_events').insert({
        purchase_id: id,
        event:       'updated',
        actor_id:    actor ? actor.id : null,
        actor_name:  actorName,
        payload:     safePatch
      }).then(() => {}).catch(() => {});
    },

    async updatePurchaseItems(purchaseId, items) {
      await db().from('purchase_items').delete().eq('purchase_id', purchaseId);
      if (!items || !items.length) return;
      const rows = items.map((it) => ({
        purchase_id:      purchaseId,
        product_id:       it.product_id || null,
        description:      it.description || '',
        unit:             it.unit || 'un',
        quantity:         Number(it.quantity) || 0,
        unit_price_cents: Number(it.unit_price_cents) || 0,
        discount_cents:   Number(it.discount_cents) || 0,
        total_cents:      Number(it.total_cents) || 0
      }));
      const { error } = await db().from('purchase_items').insert(rows);
      if (error) throw error;
    },

    async deletePurchase(id) {
      const { error } = await db().from('purchases').delete().eq('id', id);
      if (error) throw error;
    },

    async cancelPurchase(id, reason) {
      const { data, error } = await db().rpc('cancel_purchase', {
        p_purchase_id: id,
        p_reason:      reason
      });
      if (error) throw error;
      return data;
    },

    async receivePurchase(id, items) {
      const { data, error } = await db().rpc('receive_purchase', {
        p_purchase_id: id,
        p_items: items
      });
      if (error) throw error;
      return data;
    },

    async payPurchase(id, amountCents, method, notes) {
      const { data, error } = await db().rpc('pay_purchase', {
        p_purchase_id: id,
        p_amount:      amountCents,
        p_method:      method,
        p_notes:       notes || null
      });
      if (error) throw error;
      return data;
    },

    /* ---------- Fornecedores ---------- */
    async listSuppliers(search) {
      let q = db().from('suppliers')
        .select('id, name, doc, email, phone, active, created_at')
        .order('name');
      if (search) q = q.ilike('name', `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    async createSupplier(payload) {
      const { data: u } = await db().auth.getUser();
      const actor = u && u.user ? u.user : null;
      let actorName = '';
      if (actor) {
        const { data: prof } = await db().from('profiles')
          .select('name').eq('id', actor.id).maybeSingle();
        actorName = (prof && prof.name) || actor.email || '';
      }
      const { data, error } = await db().from('suppliers').insert({
        name:            payload.name,
        doc:             payload.doc || null,
        email:           payload.email || null,
        phone:           payload.phone || null,
        address:         payload.address || null,
        notes:           payload.notes || null,
        active:          payload.active !== false,
        created_by:      actor ? actor.id : null,
        created_by_name: actorName
      }).select().single();
      if (error) throw error;
      return data;
    },

    async updateSupplier(id, patch) {
      const { error } = await db().from('suppliers').update(patch).eq('id', id);
      if (error) throw error;
    },

    async deleteSupplier(id) {
      const { error } = await db().from('suppliers').delete().eq('id', id);
      if (error) throw error;
    },

    /* ---------- Produtos ---------- */
    async listProducts(search) {
      let q = db().from('products')
        .select('id, name, code, price, stock')
        .eq('active', true)
        .order('name')
        .limit(500);
      if (search) q = q.ilike('name', `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    }
  };

  /* =========================================================
     4) CNPJ
     ========================================================= */
  function validateCNPJ(cnpj) {
    const n = String(cnpj || '').replace(/\D/g, '');
    if (n.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(n)) return false;
    const calc = (base) => {
      let sum = 0, pos = base.length - 7;
      for (let i = 0; i < base.length; i++) {
        sum += Number(base[i]) * pos--;
        if (pos < 2) pos = 9;
      }
      const r = sum % 11;
      return r < 2 ? 0 : 11 - r;
    };
    const d1 = calc(n.slice(0, 12));
    const d2 = calc(n.slice(0, 12) + d1);
    return n.endsWith(String(d1) + String(d2));
  }

  function maskCNPJ(v) {
    const n = String(v || '').replace(/\D/g, '').slice(0, 14);
    return n
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  function maskPhone(v) {
    const n = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (n.length <= 10) return n.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
    return n.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
  }

  function buildAddress(d) {
    const parts = [];
    if (d.logradouro) parts.push(d.logradouro + (d.numero ? ', ' + d.numero : ''));
    if (d.complemento) parts.push(d.complemento);
    if (d.bairro) parts.push(d.bairro);
    if (d.municipio && d.uf) parts.push(`${d.municipio}/${d.uf}`);
    else if (d.municipio) parts.push(d.municipio);
    if (d.cep) {
      parts.push('CEP ' + String(d.cep).replace(/\D/g, '')
        .replace(/^(\d{5})(\d{3})$/, '$1-$2'));
    }
    return parts.filter(Boolean).join(' · ');
  }

  async function lookupCNPJ(cnpjRaw) {
    const cnpj = String(cnpjRaw || '').replace(/\D/g, '');
    if (cnpj.length !== 14) throw new Error('CNPJ deve ter 14 dígitos.');
    if (!validateCNPJ(cnpj)) throw new Error('CNPJ inválido (dígitos verificadores).');

    const providers = [
      {
        name: 'BrasilAPI',
        url: `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
        parse: (d) => ({
          cnpj,
          name:    d.razao_social || d.nome_fantasia || '',
          fantasy: d.nome_fantasia || '',
          email:   d.email || '',
          phone:   (d.ddd_telefone_1 || '').replace(/\D/g, '') || '',
          address: buildAddress(d),
          raw: d
        })
      },
      {
        name: 'ReceitaWS',
        url: `https://receitaws.com.br/v1/cnpj/${cnpj}`,
        parse: (d) => {
          if (d.status === 'ERROR') throw new Error(d.message || 'CNPJ não encontrado');
          return {
            cnpj,
            name:    d.nome || '',
            fantasy: d.fantasia || '',
            email:   d.email || '',
            phone:   (d.telefone || '').replace(/\D/g, '') || '',
            address: buildAddress({
              logradouro: d.logradouro,
              numero: d.numero,
              complemento: d.complemento,
              bairro: d.bairro,
              municipio: d.municipio,
              uf: d.uf,
              cep: d.cep
            }),
            raw: d
          };
        }
      }
    ];

    let lastErr = null;
    for (const p of providers) {
      try {
        const res = await fetch(p.url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`${p.name} respondeu ${res.status}`);
        const data = await res.json();
        return p.parse(data);
      } catch (e) {
        console.warn(`[CNPJ] ${p.name} falhou:`, e.message);
        lastErr = e;
      }
    }
    throw new Error('Não foi possível consultar o CNPJ agora. Preencha manualmente.');
  }

  function setLoading(btn, on) {
    if (!btn) return;
    btn.classList.toggle('is-loading', !!on);
    btn.disabled = !!on;
  }
  function flashFilled(input) {
    if (!input) return;
    input.classList.remove('is-autofilled');
    void input.offsetWidth;
    input.classList.add('is-autofilled');
    setTimeout(() => input.classList.remove('is-autofilled'), 1200);
  }

  /* ---------- SupplierModal (compras-nova.html) ---------- */
  const SupplierModal = (() => {
    let modal = null, $sup = null, onSaved = null, bound = false;

    function init() {
      if (bound) return true;
      modal = document.getElementById('supplier-modal');
      if (!modal) { console.warn('[compras] modal de fornecedor não encontrado.'); return false; }

      $sup = {
        cnpj:    document.getElementById('sup-cnpj'),
        search:  document.getElementById('sup-cnpj-search'),
        hint:    document.getElementById('sup-cnpj-hint'),
        name:    document.getElementById('sup-name'),
        fantasy: document.getElementById('sup-fantasy'),
        email:   document.getElementById('sup-email'),
        phone:   document.getElementById('sup-phone'),
        contact: document.getElementById('sup-contact'),
        address: document.getElementById('sup-address'),
        error:   document.getElementById('sup-error'),
        save:    document.getElementById('sup-save')
      };

      modal.querySelectorAll('[data-close]').forEach((el) =>
        el.addEventListener('click', close)
      );
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) close();
      });
      $sup.cnpj  && $sup.cnpj.addEventListener('input', (e) => { e.target.value = maskCNPJ(e.target.value); });
      $sup.cnpj  && $sup.cnpj.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
      });
      $sup.phone && $sup.phone.addEventListener('input', (e) => { e.target.value = maskPhone(e.target.value); });
      $sup.search && $sup.search.addEventListener('click', doSearch);
      $sup.save   && $sup.save.addEventListener('click', doSave);
      bound = true;
      return true;
    }

    async function doSearch() {
      if (!$sup || !$sup.cnpj) return;
      const raw = $sup.cnpj.value;
      hideError();
      if ($sup.hint) $sup.hint.innerHTML = 'Consultando Receita Federal...';
      if (!raw.replace(/\D/g, '').length) {
        showError('Digite um CNPJ para buscar.');
        if ($sup.hint) $sup.hint.innerHTML = 'Digite o CNPJ e clique em <strong>Buscar dados</strong>.';
        return;
      }
      setLoading($sup.search, true);
      try {
        const info = await lookupCNPJ(raw);
        if (info.name    && $sup.name)    $sup.name.value    = info.name;
        if (info.fantasy && $sup.fantasy) $sup.fantasy.value = info.fantasy;
        if (info.email   && $sup.email)   $sup.email.value   = info.email;
        if (info.phone   && $sup.phone)   $sup.phone.value   = maskPhone(info.phone);
        if (info.address && $sup.address) $sup.address.value = info.address;
        [$sup.name, $sup.fantasy, $sup.email, $sup.phone, $sup.address].forEach(flashFilled);
        if ($sup.hint) $sup.hint.innerHTML =
          `Dados preenchidos via <strong>${info.fantasy || info.name}</strong>.`;
      } catch (e) {
        console.warn(e);
        showError(e.message);
        if ($sup.hint) $sup.hint.innerHTML = 'Se a busca falhar, preencha manualmente.';
      } finally {
        setLoading($sup.search, false);
      }
    }

    async function doSave() {
      if (!$sup) return;
      hideError();
      const name = ($sup.name && $sup.name.value || '').trim();
      if (!name) { showError('Informe a razão social ou nome.'); $sup.name && $sup.name.focus(); return; }
      setLoading($sup.save, true);
      try {
        const created = await API.createSupplier({
          name,
          doc:     ($sup.cnpj    && $sup.cnpj.value    || '').replace(/\D/g, '') || null,
          email:   ($sup.email   && $sup.email.value   || '').trim() || null,
          phone:   ($sup.phone   && $sup.phone.value   || '').trim() || null,
          address: ($sup.address && $sup.address.value || '').trim() || null,
          notes:   ($sup.contact && $sup.contact.value || '').trim() || null,
          active:  true
        });
        if (typeof onSaved === 'function') onSaved(created);
        close(); reset();
        toast('Fornecedor cadastrado com sucesso.');
      } catch (e) {
        console.error(e);
        showError('Erro ao salvar fornecedor: ' + e.message);
      } finally {
        setLoading($sup.save, false);
      }
    }

    function open(callback) {
      if (!init()) return false;
      onSaved = callback || null;
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      setTimeout(() => $sup.cnpj && $sup.cnpj.focus(), 60);
      return true;
    }
    function close() {
      if (!modal) return;
      modal.hidden = true;
      document.body.style.overflow = '';
    }
    function reset() {
      if (!$sup) return;
      ['cnpj','name','fantasy','email','phone','contact','address'].forEach((k) => {
        const el = $sup[k];
        if (el && 'value' in el) el.value = '';
      });
      hideError();
      if ($sup.hint) $sup.hint.innerHTML =
        'Digite o CNPJ e clique em <strong>Buscar dados</strong>.';
    }
    function showError(msg) {
      if (!$sup || !$sup.error) return;
      $sup.error.textContent = msg;
      $sup.error.hidden = false;
    }
    function hideError() {
      if (!$sup || !$sup.error) return;
      $sup.error.hidden = true;
      $sup.error.textContent = '';
    }
    return { init, open, close, reset };
  })();

  function initSupplierInline(selectEl) {
    if (!selectEl) return;
    const newBtn = document.getElementById('cmp-new-supplier');
    if (!newBtn) return;
    newBtn.addEventListener('click', () => {
      const ok = SupplierModal.open((created) => {
        const opt = document.createElement('option');
        opt.value = created.id;
        opt.dataset.doc = created.doc || '';
        opt.textContent = created.name;
        selectEl.appendChild(opt);
        selectEl.value = created.id;
        selectEl.dispatchEvent(new Event('change'));
      });
      if (!ok) toast('Não foi possível abrir o cadastro. Recarregue a página.', 'error');
    });
  }

  /* =========================================================
     5) PÁGINAS
     ========================================================= */

  /* ---------- Lista de compras ---------- */
  async function pageComprasList() {
    const tbody = $('#cmp-tbody');
    const searchInput = $('#cmp-search');
    const statusFilter = $('#cmp-status-filter');
    let allData = [];

    async function load() {
      tbody.innerHTML = `<tr><td colspan="7"><div class="cmp-loading">Carregando...</div></td></tr>`;
      try {
        allData = await API.listPurchases();
        render();
      } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="7"><div class="cmp-error">Erro ao carregar: ${escapeHTML(e.message)}</div></td></tr>`;
      }
    }

    function render() {
      const q = (searchInput.value || '').trim().toLowerCase();
      const st = statusFilter.value || '';

      let rows = allData;
      if (q) {
        rows = rows.filter((r) =>
          (r.code || '').toLowerCase().includes(q) ||
          (r.supplier_name || '').toLowerCase().includes(q) ||
          (r.created_by_name || '').toLowerCase().includes(q)
        );
      }
      if (st) rows = rows.filter((r) => r.status === st);

      if (!rows.length) {
        const hasFilter = q || st;
        tbody.innerHTML = `
          <tr><td colspan="7" style="padding:0;border:0">
            <div class="cmp-empty">
              <div class="cmp-empty__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h9.2a2 2 0 0 0 2-1.6L22 7H6"/>
                  <circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>
                </svg>
              </div>
              <h3 class="cmp-empty__title">
                ${hasFilter ? 'Nenhum resultado encontrado' : 'Nenhuma compra ainda'}
              </h3>
              <p class="cmp-empty__text">
                ${hasFilter
                  ? 'Tente ajustar a busca ou os filtros.'
                  : 'Comece lançando uma nova compra ou cadastrando fornecedores.'}
              </p>
              ${hasFilter ? '' : `
                <div class="cmp-empty__actions">
                  <a href="fornecedores.html" class="cmp-btn cmp-btn--ghost">Gerenciar fornecedores</a>
                  <a href="compras-nova.html" class="cmp-btn cmp-btn--primary">+ Nova compra</a>
                </div>
              `}
            </div>
          </td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map((r) => {
        const canEdit   = r.status === 'rascunho' || r.status === 'pendente_recebimento' || r.status === 'aguardando_aprovacao';
        const canCancel = r.status !== 'paga' && r.status !== 'cancelada';
        const canPay    = r.status === 'recebida' || r.status === 'recebida_parcial';

        return `
        <tr data-id="${r.id}">
          <td><span class="cmp-code">${escapeHTML(r.code || '—')}</span></td>
          <td>
            <div class="cmp-supplier">
              <span class="cmp-supplier__name">${escapeHTML(r.supplier_name || 'Sem fornecedor')}</span>
              ${r.created_by_name ? `<span class="cmp-supplier__meta">por ${escapeHTML(r.created_by_name)}</span>` : ''}
            </div>
          </td>
          <td>${fmtDate(r.purchase_date)}</td>
          <td class="cell--num"><span class="cmp-money">${fmtBRL(r.total_cents)}</span></td>
          <td>
            ${r.payment_method
              ? escapeHTML(PAYMENT_LABEL[r.payment_method] || r.payment_method)
              : '<span style="color:var(--text-muted)">—</span>'}
          </td>
          <td>
            <span class="cmp-status cmp-status--${escapeHTML(r.status)}">
              ${escapeHTML(STATUS_LABEL[r.status] || r.status)}
            </span>
          </td>
          <td class="cell--right">
            <div class="cmp-row-actions">
              <button class="cmp-action" data-action="view" data-id="${r.id}" title="Ver detalhes" aria-label="Ver">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>

              ${canEdit ? `
                <button class="cmp-action" data-action="edit" data-id="${r.id}" title="Editar" aria-label="Editar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                  </svg>
                </button>
              ` : ''}

              ${canPay ? `
                <button class="cmp-action" data-action="pay" data-id="${r.id}" title="Dar baixa no pagamento" aria-label="Pagar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2.5" y="6" width="19" height="12" rx="2"/>
                    <path d="M2.5 10h19"/>
                    <circle cx="17" cy="14" r="1"/>
                  </svg>
                </button>
              ` : ''}

              ${canCancel ? `
                <button class="cmp-action cmp-action--danger" data-action="cancel" data-id="${r.id}" title="Cancelar compra" aria-label="Cancelar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="m9 9 6 6M15 9l-6 6"/>
                  </svg>
                </button>
              ` : ''}

              ${r.status === 'rascunho' ? `
                <button class="cmp-action cmp-action--danger" data-action="delete" data-id="${r.id}" title="Excluir rascunho" aria-label="Excluir">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
      }).join('');

      tbody.querySelectorAll('[data-action]').forEach((btn) => {
        const id = btn.dataset.id;
        const row = allData.find((x) => x.id === id);
        if (!row) return;

        if (btn.dataset.action === 'view')   btn.addEventListener('click', () => viewPurchaseModal(row));
        if (btn.dataset.action === 'edit')   btn.addEventListener('click', () => {
          window.location.href = 'compras-nova.html?id=' + encodeURIComponent(id);
        });
        if (btn.dataset.action === 'cancel') btn.addEventListener('click', () => cancelPurchaseModal(row, load));
        if (btn.dataset.action === 'pay')    btn.addEventListener('click', () => payPurchaseModal(row, load));
        if (btn.dataset.action === 'delete') btn.addEventListener('click', async () => {
          if (!confirm('Excluir este rascunho? Esta ação não pode ser desfeita.')) return;
          try {
            await API.deletePurchase(id);
            allData = allData.filter((x) => x.id !== id);
            render();
            toast('Rascunho excluído.');
          } catch (e) {
            toast('Erro ao excluir: ' + e.message, 'error');
          }
        });
      });
    }

    /* ---------- Ver detalhes ---------- */
    async function viewPurchaseModal(row) {
      try {
        const { purchase, items, events } = await API.getPurchase(row.id);
        const modal = document.createElement('div');
        modal.className = 'cmp-modal';
        modal.innerHTML = `
          <div class="cmp-modal__backdrop" data-close></div>
          <div class="cmp-modal__dialog cmp-modal__dialog--lg">
            <header class="cmp-modal__head">
              <div>
                <h3 class="cmp-modal__title">${escapeHTML(purchase.code)}</h3>
                <p style="margin:4px 0 0;font-size:13px;color:var(--text-soft)">
                  ${escapeHTML(purchase.supplier_name || 'Sem fornecedor')} · ${fmtDate(purchase.purchase_date)}
                </p>
              </div>
              <button class="cmp-modal__close" data-close aria-label="Fechar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </header>
            <div class="cmp-modal__body">
              <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">
                <span class="cmp-status cmp-status--${escapeHTML(purchase.status)}">
                  ${escapeHTML(STATUS_LABEL[purchase.status] || purchase.status)}
                </span>
                ${purchase.payment_method ? `<span style="font-size:13px;color:var(--text-soft);align-self:center">
                  ${escapeHTML(PAYMENT_LABEL[purchase.payment_method] || purchase.payment_method)}
                </span>` : ''}
              </div>

              ${purchase.notes ? `
                <p style="margin:0;padding:10px 14px;background:var(--surface-2);border-radius:8px;font-size:13px;color:var(--text-soft);line-height:1.5">
                  ${escapeHTML(purchase.notes)}
                </p>
              ` : ''}

              <h4 style="margin:12px 0 8px;font-size:13.5px;font-weight:600">Itens</h4>
              <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;font-size:13.5px;min-width:520px">
                  <thead>
                    <tr style="border-bottom:1px solid var(--border);text-align:left;color:var(--text-muted);font-size:11.5px;letter-spacing:.06em;text-transform:uppercase">
                      <th style="padding:8px 0">Descrição</th>
                      <th style="padding:8px 0;text-align:right">Qtd</th>
                      <th style="padding:8px 0;text-align:right">Recebido</th>
                      <th style="padding:8px 0;text-align:right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map((it) => `
                      <tr style="border-bottom:1px solid var(--border)">
                        <td style="padding:10px 0">${escapeHTML(it.description)}</td>
                        <td style="padding:10px 0;text-align:right">${Number(it.quantity)} ${escapeHTML(it.unit || 'un')}</td>
                        <td style="padding:10px 0;text-align:right">${Number(it.quantity_received) || 0}</td>
                        <td style="padding:10px 0;text-align:right;font-variant-numeric:tabular-nums">${fmtBRL(it.total_cents)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                  <tfoot>
                    <tr><td colspan="3" style="padding:8px 0;text-align:right;color:var(--text-muted)">Subtotal</td>
                        <td style="padding:8px 0;text-align:right;font-weight:600">${fmtBRL(purchase.subtotal_cents)}</td></tr>
                    ${purchase.discount_cents ? `
                    <tr><td colspan="3" style="padding:4px 0;text-align:right;color:var(--text-muted)">Desconto</td>
                        <td style="padding:4px 0;text-align:right">- ${fmtBRL(purchase.discount_cents)}</td></tr>` : ''}
                    ${purchase.shipping_cents ? `
                    <tr><td colspan="3" style="padding:4px 0;text-align:right;color:var(--text-muted)">Frete</td>
                        <td style="padding:4px 0;text-align:right">${fmtBRL(purchase.shipping_cents)}</td></tr>` : ''}
                    <tr><td colspan="3" style="padding:12px 0 0;text-align:right;font-weight:700;border-top:1px solid var(--border)">Total</td>
                        <td style="padding:12px 0 0;text-align:right;font-weight:700;font-size:16px;border-top:1px solid var(--border)">${fmtBRL(purchase.total_cents)}</td></tr>
                  </tfoot>
                </table>
              </div>

              ${events && events.length ? `
                <h4 style="margin:20px 0 8px;font-size:13.5px;font-weight:600">Histórico</h4>
                <ul style="list-style:none;padding:0;margin:0;font-size:13px;color:var(--text-soft)">
                  ${events.map((ev) => `
                    <li style="padding:10px 0;border-bottom:1px dashed var(--border)">
                      <strong style="color:var(--text)">${escapeHTML(EVENT_LABEL[ev.event] || ev.event)}</strong>
                      ${ev.from_status || ev.to_status ? ` — ${escapeHTML(STATUS_LABEL[ev.from_status] || ev.from_status || '—')} → ${escapeHTML(STATUS_LABEL[ev.to_status] || ev.to_status || '—')}` : ''}
                      <span style="display:block;font-size:12px;color:var(--text-muted);margin-top:3px">
                        ${escapeHTML(ev.actor_name || 'Sistema')} · ${fmtDateTime(ev.created_at)}
                      </span>
                    </li>
                  `).join('')}
                </ul>
              ` : ''}
            </div>
            <footer class="cmp-modal__foot">
              <button type="button" class="cmp-btn cmp-btn--ghost" data-close>Fechar</button>
            </footer>
          </div>`;
        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
      } catch (e) {
        console.error(e);
        toast('Erro ao abrir: ' + e.message, 'error');
      }
    }

    /* ---------- Cancelar ---------- */
    function cancelPurchaseModal(row, onDone) {
      const modal = document.createElement('div');
      modal.className = 'cmp-modal';
      modal.innerHTML = `
        <div class="cmp-modal__backdrop" data-close></div>
        <div class="cmp-modal__dialog">
          <header class="cmp-modal__head">
            <h3 class="cmp-modal__title">Cancelar ${escapeHTML(row.code)}</h3>
            <button class="cmp-modal__close" data-close aria-label="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </header>
          <div class="cmp-modal__body">
            <p style="margin:0;font-size:13.5px;color:var(--text-soft);line-height:1.5">
              Esta ação é <strong>permanente</strong> e o gestor será notificado.
            </p>
            <div class="field">
              <label for="c-reason">Motivo do cancelamento *</label>
              <textarea id="c-reason" rows="3" placeholder="Ex.: fornecedor não tinha o produto, preço mudou, etc."></textarea>
            </div>
            <div class="cmp-error" id="c-error" hidden></div>
          </div>
          <footer class="cmp-modal__foot">
            <button type="button" class="cmp-btn cmp-btn--ghost" data-close>Voltar</button>
            <button type="button" class="cmp-btn cmp-btn--primary" id="c-confirm" style="background:var(--danger);border-color:var(--danger)">
              Cancelar compra
            </button>
          </footer>
        </div>`;
      document.body.appendChild(modal);
      const close = () => modal.remove();
      modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

      const reasonEl = $('#c-reason', modal);
      reasonEl.focus();

      $('#c-confirm', modal).addEventListener('click', async () => {
        const reason = (reasonEl.value || '').trim();
        const err = $('#c-error', modal);
        err.hidden = true;
        if (reason.length < 5) {
          err.textContent = 'Informe um motivo (mínimo 5 caracteres).';
          err.hidden = false;
          return;
        }
        const btn = $('#c-confirm', modal);
        btn.disabled = true;
        btn.textContent = 'Cancelando...';

        try {
          await API.cancelPurchase(row.id, reason);
          close();
          await onDone();
          toast('Compra cancelada.');
        } catch (e) {
          console.error(e);
          err.textContent = e.message;
          err.hidden = false;
          btn.disabled = false;
          btn.textContent = 'Cancelar compra';
        }
      });
    }

    /* ---------- Pagar ---------- */
    function payPurchaseModal(row, onDone) {
      const modal = document.createElement('div');
      modal.className = 'cmp-modal';
      modal.innerHTML = `
        <div class="cmp-modal__backdrop" data-close></div>
        <div class="cmp-modal__dialog">
          <header class="cmp-modal__head">
            <h3 class="cmp-modal__title">Pagar ${escapeHTML(row.code)}</h3>
            <button class="cmp-modal__close" data-close aria-label="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </header>
          <div class="cmp-modal__body">
            <div class="field">
              <label for="p-amount">Valor pago (R$)</label>
              <input id="p-amount" type="text" value="${((row.total_cents || 0) / 100).toFixed(2).replace('.', ',')}" />
            </div>
            <div class="field">
              <label for="p-method">Forma de pagamento</label>
              <select id="p-method" class="control-select">
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="transferencia">Transferência</option>
                <option value="cartao_credito">Cartão de crédito</option>
                <option value="cartao_debito">Cartão de débito</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div class="field">
              <label for="p-notes">Observações</label>
              <input id="p-notes" type="text" placeholder="Opcional" />
            </div>
            <div class="cmp-error" id="p-error" hidden></div>
          </div>
          <footer class="cmp-modal__foot">
            <button type="button" class="cmp-btn cmp-btn--ghost" data-close>Cancelar</button>
            <button type="button" class="cmp-btn cmp-btn--primary" id="p-confirm">Confirmar pagamento</button>
          </footer>
        </div>`;
      document.body.appendChild(modal);
      const close = () => modal.remove();
      modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

      $('#p-confirm', modal).addEventListener('click', async () => {
        const err = $('#p-error', modal);
        err.hidden = true;
        const amount = parseBRLToCents($('#p-amount', modal).value);
        if (amount <= 0) {
          err.textContent = 'Informe um valor válido.';
          err.hidden = false;
          return;
        }
        const btn = $('#p-confirm', modal);
        btn.disabled = true;
        btn.textContent = 'Salvando...';
        try {
          await API.payPurchase(
            row.id,
            amount,
            $('#p-method', modal).value,
            $('#p-notes', modal).value.trim()
          );
          close();
          await onDone();
          toast('Pagamento registrado! Gestor notificado.');
        } catch (e) {
          console.error(e);
          err.textContent = e.message;
          err.hidden = false;
          btn.disabled = false;
          btn.textContent = 'Confirmar pagamento';
        }
      });
    }

    searchInput.addEventListener('input', render);
    statusFilter.addEventListener('change', render);

    await load();
  }

  /* ---------- Nova compra / Edição ---------- */
  async function pageComprasNova() {
    const form = $('#cmp-form');
    if (!form) return;

    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('id');
    const isEdit = !!editId;

    let currentStatus = 'rascunho';   /* status atual (modo edição) */

    /* ---------- Código sequencial (só em criação) ---------- */
    if (!isEdit) {
      try {
        const code = await API.nextPurchaseCode();
        setVal('#cmp-code', code);
      } catch (e) { /* ignora */ }
    }

    /* ---------- Data de hoje como default ---------- */
    const dateInput = document.getElementById('cmp-date');
    if (dateInput && !dateInput.value && !isEdit) {
      dateInput.value = todayISO();
    }

    /* ---------- Fornecedores ---------- */
    const supplierSel = $('#cmp-supplier');
    if (supplierSel) {
      try {
        const list = await API.listSuppliers();
        supplierSel.innerHTML = '<option value="">— Selecione —</option>' +
          list.map((s) =>
            `<option value="${s.id}" data-doc="${escapeHTML(s.doc || '')}">${escapeHTML(s.name)}</option>`
          ).join('');
      } catch (e) {
        console.error(e);
        supplierSel.innerHTML = '<option value="">Erro ao carregar fornecedores</option>';
      }
      initSupplierInline(supplierSel);
    }

    /* ---------- Itens ---------- */
    const itemsWrap = $('#cmp-items-body');
    const products = await API.listProducts().catch(() => []);
    let items = [{ description: '', unit: 'un', quantity: 1, unit_price_cents: 0, discount_cents: 0 }];

    function recalcTotals() {
      let subtotal = 0;
      items.forEach((it, i) => {
        const line = (Number(it.quantity) || 0) * (Number(it.unit_price_cents) || 0)
                   - (Number(it.discount_cents) || 0);
        it.total_cents = Math.max(0, Math.round(line));
        subtotal += it.total_cents;
        const el = document.querySelector(`[data-line-total="${i}"]`);
        if (el) el.textContent = fmtBRL(it.total_cents);
      });
      const disc  = parseBRLToCents(val('#cmp-discount'));
      const ship  = parseBRLToCents(val('#cmp-shipping'));
      const other = parseBRLToCents(val('#cmp-other'));
      const total = Math.max(0, subtotal - disc + ship + other);

      const subEl   = $('#cmp-subtotal');
      const totalEl = $('#cmp-total');
      if (subEl)   subEl.textContent   = fmtBRL(subtotal);
      if (totalEl) totalEl.textContent = fmtBRL(total);

      return { subtotal, disc, ship, other, total };
    }

    function renderItems() {
      if (!itemsWrap) return;
      itemsWrap.innerHTML = items.map((it, i) => `
        <div class="cmp-items__row" data-row="${i}">
          <select data-field="product_id" data-idx="${i}">
            <option value="">Item avulso (digite abaixo)</option>
            ${products.map((p) => `
              <option value="${p.id}" ${it.product_id === p.id ? 'selected' : ''}>${escapeHTML(p.name)}</option>
            `).join('')}
          </select>
          <input type="number" min="0" step="0.001" data-field="quantity" data-idx="${i}" value="${it.quantity}" placeholder="Qtd" />
          <input type="text" data-field="unit" data-idx="${i}" value="${escapeHTML(it.unit || 'un')}" placeholder="un" />
          <input type="text" data-field="unit_price" data-idx="${i}" value="${(it.unit_price_cents / 100).toFixed(2).replace('.', ',')}" placeholder="0,00" />
          <input type="text" data-field="discount" data-idx="${i}" value="${(it.discount_cents / 100).toFixed(2).replace('.', ',')}" placeholder="0,00" />
          <div class="cmp-items__total" data-line-total="${i}">R$ 0,00</div>
          <button type="button" class="cmp-items__remove" data-action="remove" data-idx="${i}" title="Remover linha" aria-label="Remover linha">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      `).join('');

      itemsWrap.querySelectorAll('[data-field]').forEach((el) => {
        el.addEventListener('input', (e) => {
          const idx   = Number(e.target.dataset.idx);
          const field = e.target.dataset.field;
          if (field === 'quantity')        items[idx].quantity = Number(e.target.value) || 0;
          else if (field === 'unit')       items[idx].unit = e.target.value;
          else if (field === 'unit_price') items[idx].unit_price_cents = parseBRLToCents(e.target.value);
          else if (field === 'discount')   items[idx].discount_cents = parseBRLToCents(e.target.value);
          else if (field === 'product_id') {
            items[idx].product_id = e.target.value || null;
            const p = products.find((x) => x.id === e.target.value);
            if (p) {
              items[idx].description = p.name;
              if (!items[idx].unit_price_cents) {
                items[idx].unit_price_cents = Math.round((p.price || 0) * 100);
                const inp = itemsWrap.querySelector(`[data-field="unit_price"][data-idx="${idx}"]`);
                if (inp) inp.value = (p.price || 0).toFixed(2).replace('.', ',');
              }
            }
          }
          recalcTotals();
        });
      });

      itemsWrap.querySelectorAll('[data-action="remove"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.idx);
          if (items.length === 1) { toast('Precisa ter pelo menos 1 item.', 'error'); return; }
          items.splice(idx, 1);
          renderItems();
          recalcTotals();
        });
      });
    }

    const addBtn = $('#cmp-add-item');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        items.push({ description: '', unit: 'un', quantity: 1, unit_price_cents: 0, discount_cents: 0 });
        renderItems();
        recalcTotals();
      });
    }

    ['cmp-discount', 'cmp-shipping', 'cmp-other'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', recalcTotals);
    });

    renderItems();
    recalcTotals();

    if (supplierSel) {
      supplierSel.addEventListener('change', () => {
        const opt = supplierSel.selectedOptions[0];
        setVal('#cmp-supplier-doc', opt ? (opt.dataset.doc || '') : '');
      });
    }

    /* ---------- Sync dos radios de modo de salvamento ---------- */
    const modeRadios = document.querySelectorAll('input[name="save-mode"]');
    const modeHidden = document.getElementById('cmp-save-mode');
    if (modeRadios.length && modeHidden) {
      const initial = document.querySelector('input[name="save-mode"]:checked');
      if (initial) modeHidden.value = initial.value;

      modeRadios.forEach((r) => {
        r.addEventListener('change', () => {
          if (r.checked) modeHidden.value = r.value;
        });
      });
    }

    /* ---------- MODO EDIÇÃO ---------- */
    if (isEdit) {
      try {
        const { purchase, items: existingItems } = await API.getPurchase(editId);

        currentStatus = purchase.status || 'rascunho';

        setVal('#cmp-code', purchase.code || '');
        setVal('#cmp-date', purchase.purchase_date || todayISO());
        setVal('#cmp-expected', purchase.expected_date || '');
        setVal('#cmp-supplier-name-manual', purchase.supplier_name || '');
        setVal('#cmp-supplier-doc', purchase.supplier_doc || '');
        setVal('#cmp-supplier-contact', purchase.supplier_contact || '');
        setVal('#cmp-discount', ((purchase.discount_cents || 0) / 100).toFixed(2).replace('.', ','));
        setVal('#cmp-shipping', ((purchase.shipping_cents || 0) / 100).toFixed(2).replace('.', ','));
        setVal('#cmp-other',    ((purchase.other_cents    || 0) / 100).toFixed(2).replace('.', ','));
        setVal('#cmp-payment-method', purchase.payment_method || '');
        setVal('#cmp-payment-terms',  purchase.payment_terms  || '');
        setVal('#cmp-installments',   purchase.installments   || 1);
        setVal('#cmp-first-due',      purchase.first_due_date || '');
        setVal('#cmp-notes',          purchase.notes          || '');
        setVal('#cmp-invoice',        purchase.invoice_number || '');

        if (purchase.supplier_id && supplierSel) supplierSel.value = purchase.supplier_id;

        items = existingItems.map((it) => ({
          product_id:       it.product_id || null,
          description:      it.description,
          unit:             it.unit || 'un',
          quantity:         Number(it.quantity),
          unit_price_cents: Number(it.unit_price_cents),
          discount_cents:   Number(it.discount_cents),
          total_cents:      Number(it.total_cents)
        }));
        if (!items.length) items = [{ description: '', unit: 'un', quantity: 1, unit_price_cents: 0, discount_cents: 0 }];
        renderItems();
        recalcTotals();

        const titleEl = document.querySelector('.cmp-page-head__title');
        if (titleEl) titleEl.textContent = 'Editar compra';
        const submitBtn = $('#cmp-submit');
        if (submitBtn) {
          const label = submitBtn.querySelector('span');
          if (label) label.textContent = 'Salvar alterações';
          else submitBtn.textContent = 'Salvar alterações';
        }

        /* Marca o radio conforme status atual */
        if (purchase.status === 'pendente_recebimento') {
          const r = document.querySelector('input[name="save-mode"][value="pendente_recebimento"]');
          if (r) { r.checked = true; if (modeHidden) modeHidden.value = 'pendente_recebimento'; }
        } else {
          const r = document.querySelector('input[name="save-mode"][value="rascunho"]');
          if (r) { r.checked = true; if (modeHidden) modeHidden.value = 'rascunho'; }
        }

        /* Bloqueia edição se status não permitir */
        const editableStatus = ['rascunho', 'pendente_recebimento', 'aguardando_aprovacao'];
        if (!editableStatus.includes(purchase.status)) {
          toast('Esta compra não pode mais ser editada (status: ' + (STATUS_LABEL[purchase.status] || purchase.status) + ').', 'error');
          if (submitBtn) {
            submitBtn.disabled = true;
            const label = submitBtn.querySelector('span');
            if (label) label.textContent = 'Edição bloqueada';
          }
        }
      } catch (e) {
        console.error('Erro ao carregar compra para edição:', e);
        toast('Não foi possível carregar a compra.', 'error');
      }
    }

    /* ---------------------------------------------------------
       Resolve status alvo respeitando transições:
         rascunho → rascunho / pendente_recebimento (avança)
         pendente_recebimento → mantém (não volta pra rascunho)
         outros → mantém
       --------------------------------------------------------- */
    function resolveTargetStatus() {
      const chosen = val('#cmp-save-mode') || 'rascunho';

      if (!isEdit) return chosen;   /* criação: usa escolhido */

      if (currentStatus === 'rascunho') {
        if (chosen === 'pendente_recebimento') return 'pendente_recebimento';
        return 'rascunho';
      }
      return currentStatus;
    }

    /* ---------- Submit (criar ou atualizar) ---------- */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#cmp-submit');
      if (btn) {
        btn.disabled = true;
        const label = btn.querySelector('span');
        if (label) label.textContent = 'Salvando...';
      }

      try {
        const supplierId = supplierSel ? (supplierSel.value || null) : null;
        const supplierName = supplierSel && supplierSel.selectedOptions[0] && supplierSel.value
          ? supplierSel.selectedOptions[0].textContent
          : (val('#cmp-supplier-name-manual') || '');

        if (!supplierId && !supplierName) throw new Error('Selecione um fornecedor.');

        const validItems = items.filter((it) => it.quantity > 0 && (it.description || it.product_id));
        if (!validItems.length) throw new Error('Adicione pelo menos 1 item com quantidade e descrição.');

        const totals = recalcTotals();
        const targetStatus = resolveTargetStatus();

        /* Datas com fallback */
        const purchaseDate = (val('#cmp-date') || '').trim() || todayISO();
        const expectedDate = (val('#cmp-expected') || '').trim() || null;
        const firstDue     = (val('#cmp-first-due') || '').trim() || null;

        const basePayload = {
          status:           targetStatus,          /* ← ESSENCIAL: envia o status */
          supplier_id:      supplierId,
          supplier_name:    supplierName,
          supplier_doc:     (val('#cmp-supplier-doc') || '').trim() || null,
          supplier_contact: (val('#cmp-supplier-contact') || '').trim() || null,
          subtotal_cents:   totals.subtotal,
          discount_cents:   totals.disc,
          shipping_cents:   totals.ship,
          other_cents:      totals.other,
          total_cents:      totals.total,
          payment_method:   val('#cmp-payment-method') || null,
          payment_terms:    val('#cmp-payment-terms') || null,
          installments:     Number(val('#cmp-installments')) || 1,
          first_due_date:   firstDue,
          purchase_date:    purchaseDate,
          expected_date:    expectedDate,
          notes:            (val('#cmp-notes') || '').trim() || null,
          invoice_number:   (val('#cmp-invoice') || '').trim() || null
        };

        const itemsPayload = validItems.map((it) => ({
          product_id:       it.product_id,
          description:      it.description || (products.find((p) => p.id === it.product_id) || {}).name || 'Item',
          unit:             it.unit || 'un',
          quantity:         it.quantity,
          unit_price_cents: it.unit_price_cents,
          discount_cents:   it.discount_cents,
          total_cents:      it.total_cents
        }));

        if (isEdit) {
          await API.updatePurchase(editId, basePayload);
          await API.updatePurchaseItems(editId, itemsPayload);
          if (currentStatus !== targetStatus) {
            toast(`Compra atualizada para "${STATUS_LABEL[targetStatus] || targetStatus}". Gestor notificado.`);
          } else {
            toast('Compra atualizada. Gestor notificado.');
          }
        } else {
          await API.createPurchase({
            ...basePayload,
            code: (val('#cmp-code') || '').trim() || ('COMP-' + Date.now()),
            items: itemsPayload
          });
          toast('Compra salva com sucesso.');
        }

        setTimeout(() => { window.location.href = 'compras.html'; }, 800);
      } catch (err) {
        console.error(err);
        toast('Erro ao salvar: ' + err.message, 'error');
        if (btn) {
          btn.disabled = false;
          const label = btn.querySelector('span');
          if (label) label.textContent = isEdit ? 'Salvar alterações' : 'Salvar compra';
        }
      }
    });
  }

  /* ---------- Receber compras ---------- */
  async function pageComprasReceber() {
    const wrap = $('#cmp-receive-list');
    if (!wrap) return;

    async function load() {
      wrap.innerHTML = `<div class="cmp-loading">Carregando compras pendentes...</div>`;
      try {
        const all = await API.listPurchases();
        const pending = all.filter((p) =>
          p.status === 'pendente_recebimento' || p.status === 'recebida_parcial'
        );
        if (!pending.length) {
          wrap.innerHTML = `
            <div class="cmp-panel">
              <div class="cmp-empty">
                <div class="cmp-empty__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m5 12 5 5L20 7"/>
                  </svg>
                </div>
                <h3 class="cmp-empty__title">Nada para receber</h3>
                <p class="cmp-empty__text">Não há compras pendentes de recebimento.</p>
              </div>
            </div>`;
          return;
        }
        wrap.innerHTML = pending.map((p) => `
          <div class="cmp-panel" style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start;padding:20px 24px">
              <div style="min-width:0">
                <div style="font-size:11.5px;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;font-weight:600">
                  ${escapeHTML(p.code)}
                </div>
                <div style="font-size:16px;font-weight:700;color:var(--text);margin-top:4px">
                  ${escapeHTML(p.supplier_name || 'Sem fornecedor')}
                </div>
                <div style="font-size:13px;color:var(--text-soft);margin-top:6px">
                  Data: ${fmtDate(p.purchase_date)} · Previsão: ${fmtDate(p.expected_date)}
                </div>
              </div>
              <button class="cmp-btn cmp-btn--primary" data-action="open" data-id="${p.id}">Receber</button>
            </div>
          </div>
        `).join('');
        wrap.querySelectorAll('[data-action="open"]').forEach((btn) => {
          btn.addEventListener('click', () => openReceiveModal(btn.dataset.id));
        });
      } catch (e) {
        console.error(e);
        wrap.innerHTML = `<div class="cmp-error">Erro: ${escapeHTML(e.message)}</div>`;
      }
    }

    async function openReceiveModal(purchaseId) {
      try {
        const { purchase, items } = await API.getPurchase(purchaseId);
        const modal = document.createElement('div');
        modal.className = 'cmp-modal';
        modal.innerHTML = `
          <div class="cmp-modal__backdrop" data-close></div>
          <div class="cmp-modal__dialog cmp-modal__dialog--lg">
            <header class="cmp-modal__head">
              <h3 class="cmp-modal__title">Receber ${escapeHTML(purchase.code)}</h3>
              <button class="cmp-modal__close" data-close aria-label="Fechar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </header>
            <div class="cmp-modal__body">
              <p style="font-size:13.5px;color:var(--text-soft);margin:0">
                Informe a quantidade recebida de cada item.
              </p>
              <div id="cmp-receive-items">
                ${items.map((it) => {
                  const pend = (Number(it.quantity) || 0) - (Number(it.quantity_received) || 0);
                  return `
                    <div class="cmp-receive-item" data-item-id="${it.id}">
                      <div class="cmp-receive-item__info">
                        <span class="cmp-receive-item__name">${escapeHTML(it.description)}</span>
                        <span class="cmp-receive-item__meta">
                          Pedido: ${Number(it.quantity)} ${escapeHTML(it.unit || 'un')} · Recebido: ${Number(it.quantity_received) || 0} · Pendente: ${pend}
                        </span>
                      </div>
                      <div class="cmp-receive-item__qty">
                        <div class="cmp-receive-item__label">Receber agora</div>
                        <input type="number" min="0" max="${pend}" step="0.001" value="${pend}" data-qty />
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
            <footer class="cmp-modal__foot">
              <button type="button" class="cmp-btn cmp-btn--ghost" data-close>Cancelar</button>
              <button type="button" class="cmp-btn cmp-btn--primary" id="cmp-receive-confirm">Confirmar recebimento</button>
            </footer>
          </div>
        `;
        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

        $('#cmp-receive-confirm').addEventListener('click', async () => {
          const btn = $('#cmp-receive-confirm');
          btn.disabled = true;
          btn.textContent = 'Salvando...';
          try {
            const receivedItems = [];
            modal.querySelectorAll('.cmp-receive-item').forEach((row) => {
              const itemId = row.dataset.itemId;
              const qty = Number(row.querySelector('[data-qty]').value) || 0;
              if (qty > 0) receivedItems.push({ item_id: itemId, qty });
            });
            if (!receivedItems.length) throw new Error('Nenhuma quantidade para receber.');
            const res = await API.receivePurchase(purchase.id, receivedItems);
            toast(`Recebido! Status: ${STATUS_LABEL[res.status] || res.status}`);
            close();
            await load();
          } catch (e) {
            console.error(e);
            toast('Erro ao receber: ' + e.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Confirmar recebimento';
          }
        });
      } catch (e) {
        console.error(e);
        toast('Erro: ' + e.message, 'error');
      }
    }

    await load();
  }

  /* ---------- Fornecedores ---------- */
  async function pageFornecedores() {
    const tbody = $('#forn-tbody');
    const searchInput = $('#forn-search');
    if (!tbody) return;

    let data = [];

    async function load() {
      tbody.innerHTML = `<tr><td colspan="5"><div class="cmp-loading">Carregando...</div></td></tr>`;
      try {
        data = await API.listSuppliers();
        render();
      } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="cmp-error">Erro: ${escapeHTML(e.message)}</div></td></tr>`;
      }
    }

    function render() {
      const q = (searchInput.value || '').trim().toLowerCase();
      let rows = data;
      if (q) rows = rows.filter((r) =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.doc || '').toLowerCase().includes(q)
      );

      if (!rows.length) {
        tbody.innerHTML = `
          <tr><td colspan="5" style="padding:0;border:0">
            <div class="cmp-empty">
              <div class="cmp-empty__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/>
                  <path d="M15 21V9h4a2 2 0 0 1 2 2v10"/><path d="M9 7h2M9 11h2M9 15h2"/>
                </svg>
              </div>
              <h3 class="cmp-empty__title">
                ${q ? 'Nenhum resultado encontrado' : 'Nenhum fornecedor cadastrado'}
              </h3>
              <p class="cmp-empty__text">
                ${q ? 'Tente outro termo de busca.' : 'Cadastre fornecedores para usá-los nas compras.'}
              </p>
            </div>
          </td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map((r) => `
        <tr>
          <td><div class="cmp-supplier"><span class="cmp-supplier__name">${escapeHTML(r.name)}</span></div></td>
          <td>${escapeHTML(r.doc || '—')}</td>
          <td>${escapeHTML(r.phone || '—')}</td>
          <td>${escapeHTML(r.email || '—')}</td>
          <td class="cell--right">
            <div class="cmp-row-actions">
              <button class="cmp-action" data-action="edit" data-id="${r.id}" title="Editar" aria-label="Editar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                </svg>
              </button>
              <button class="cmp-action cmp-action--danger" data-action="delete" data-id="${r.id}" title="Excluir" aria-label="Excluir">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
        btn.addEventListener('click', () => openSupplierModal(data.find((x) => x.id === btn.dataset.id)));
      });
      tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Excluir este fornecedor?')) return;
          try {
            await API.deleteSupplier(btn.dataset.id);
            data = data.filter((x) => x.id !== btn.dataset.id);
            render();
            toast('Fornecedor excluído.');
          } catch (e) { toast('Erro: ' + e.message, 'error'); }
        });
      });
    }

    function openSupplierModal(supplier) {
      const isEdit = !!supplier;
      const modal = document.createElement('div');
      modal.className = 'cmp-modal';
      modal.innerHTML = `
        <div class="cmp-modal__backdrop" data-close></div>
        <div class="cmp-modal__dialog cmp-modal__dialog--lg">
          <header class="cmp-modal__head">
            <h3 class="cmp-modal__title">${isEdit ? 'Editar' : 'Novo'} fornecedor</h3>
            <button class="cmp-modal__close" data-close aria-label="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </header>
          <div class="cmp-modal__body">
            <div class="cmp-cnpj">
              <div class="field cmp-cnpj__field">
                <label for="f-doc">CNPJ</label>
                <input id="f-doc" type="text" inputmode="numeric" placeholder="00.000.000/0000-00" maxlength="18" autocomplete="off" value="${escapeHTML(supplier && supplier.doc ? supplier.doc : '')}" />
              </div>
              <button type="button" class="cmp-btn cmp-btn--primary cmp-cnpj__btn" id="f-cnpj-search" title="Buscar dados do CNPJ automaticamente">
                <span class="cmp-cnpj__spinner" aria-hidden="true"></span>
                <svg class="cmp-cnpj__icon-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                </svg>
                <span>Buscar dados</span>
              </button>
            </div>
            <p class="cmp-cnpj__hint" id="f-cnpj-hint">
              Digite o CNPJ e clique em <strong>Buscar dados</strong> para preencher automaticamente.
            </p>
            <div class="cmp-grid cmp-grid--2">
              <div class="field" style="grid-column: 1 / -1">
                <label for="f-name">Razão social / Nome *</label>
                <input id="f-name" type="text" value="${escapeHTML(supplier ? supplier.name : '')}" />
              </div>
              <div class="field">
                <label for="f-fantasy">Nome fantasia</label>
                <input id="f-fantasy" type="text" />
              </div>
              <div class="field">
                <label for="f-phone">Telefone</label>
                <input id="f-phone" type="text" value="${escapeHTML(supplier ? supplier.phone : '')}" />
              </div>
              <div class="field">
                <label for="f-email">E-mail</label>
                <input id="f-email" type="email" value="${escapeHTML(supplier ? supplier.email : '')}" />
              </div>
              <div class="field">
                <label for="f-contact">Contato responsável</label>
                <input id="f-contact" type="text" placeholder="Nome de quem atende" />
              </div>
              <div class="field" style="grid-column: 1 / -1">
                <label for="f-address">Endereço</label>
                <input id="f-address" type="text" placeholder="Rua, número, bairro, cidade/UF, CEP" />
              </div>
            </div>
            <div class="cmp-error" id="f-error" hidden></div>
          </div>
          <footer class="cmp-modal__foot">
            <button type="button" class="cmp-btn cmp-btn--ghost" data-close>Cancelar</button>
            <button type="button" class="cmp-btn cmp-btn--primary" id="f-save">
              <span class="cmp-cnpj__spinner" aria-hidden="true"></span>
              <span>Salvar</span>
            </button>
          </footer>
        </div>`;
      document.body.appendChild(modal);

      const $f = {
        cnpj:    $('#f-doc', modal),
        search:  $('#f-cnpj-search', modal),
        hint:    $('#f-cnpj-hint', modal),
        name:    $('#f-name', modal),
        fantasy: $('#f-fantasy', modal),
        phone:   $('#f-phone', modal),
        email:   $('#f-email', modal),
        contact: $('#f-contact', modal),
        address: $('#f-address', modal),
        error:   $('#f-error', modal),
        save:    $('#f-save', modal)
      };

      const close = () => {
        modal.remove();
        document.removeEventListener('keydown', onEsc);
      };
      const onEsc = (e) => { if (e.key === 'Escape') close(); };
      modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
      document.addEventListener('keydown', onEsc);

      $f.cnpj.addEventListener('input', (e) => { e.target.value = maskCNPJ(e.target.value); });
      $f.cnpj.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
      });
      $f.phone.addEventListener('input', (e) => { e.target.value = maskPhone(e.target.value); });
      $f.search.addEventListener('click', doSearch);
      $f.save.addEventListener('click', doSave);

      async function doSearch() {
        $f.error.hidden = true;
        const raw = $f.cnpj.value;
        $f.hint.innerHTML = 'Consultando Receita Federal...';
        if (!raw.replace(/\D/g, '').length) {
          showError('Digite um CNPJ para buscar.');
          $f.hint.innerHTML = 'Digite o CNPJ e clique em <strong>Buscar dados</strong>.';
          return;
        }
        setLoading($f.search, true);
        try {
          const info = await lookupCNPJ(raw);
          if (info.name)    $f.name.value    = info.name;
          if (info.fantasy && $f.fantasy)  $f.fantasy.value = info.fantasy;
          if (info.email)   $f.email.value   = info.email;
          if (info.phone)   $f.phone.value   = maskPhone(info.phone);
          if (info.address && $f.address)  $f.address.value = info.address;
          [$f.name, $f.fantasy, $f.email, $f.phone, $f.address].forEach(flashFilled);
          $f.hint.innerHTML = `Dados preenchidos via <strong>${info.fantasy || info.name}</strong>.`;
        } catch (e) {
          console.warn(e);
          showError(e.message);
          $f.hint.innerHTML = 'Se a busca falhar, preencha manualmente.';
        } finally {
          setLoading($f.search, false);
        }
      }

      async function doSave() {
        $f.error.hidden = true;
        const name = ($f.name.value || '').trim();
        if (!name) { showError('Informe a razão social ou nome.'); $f.name.focus(); return; }
        setLoading($f.save, true);
        try {
          const payload = {
            name,
            doc:     ($f.cnpj.value || '').replace(/\D/g, '') || null,
            email:   ($f.email.value || '').trim()   || null,
            phone:   ($f.phone.value || '').trim()   || null,
            address: ($f.address.value || '').trim() || null,
            notes:   ($f.contact.value || '').trim() || null
          };
          if (isEdit) await API.updateSupplier(supplier.id, payload);
          else        await API.createSupplier(payload);
          close();
          await load();
          toast('Fornecedor salvo.');
        } catch (e) {
          console.error(e);
          showError('Erro ao salvar: ' + e.message);
        } finally {
          setLoading($f.save, false);
        }
      }

      function showError(msg) {
        $f.error.textContent = msg;
        $f.error.hidden = false;
      }
    }

    searchInput.addEventListener('input', render);
    $('#forn-new').addEventListener('click', () => openSupplierModal(null));
    await load();
  }

  /* =========================================================
     6) BOOTSTRAP
     ========================================================= */
  const ROUTES = {
    'compras':         pageComprasList,
    'compras-nova':    pageComprasNova,
    'compras-receber': pageComprasReceber,
    'fornecedores':    pageFornecedores
  };

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    const fn = ROUTES[page];
    if (fn) fn().catch((e) => console.error('[compras] erro em "' + page + '":', e));
  });

  window.ComprasAPI = API;
  window.ComprasFmt = { fmtBRL, fmtDate, parseBRLToCents };

})();