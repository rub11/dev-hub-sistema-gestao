/* =========================================================
   DEV HUB · Compras · api
   ---------------------------------------------------------
   Camada Supabase: purchases, suppliers, products + CNPJ.
   Publica: window.Cmp.API
   ========================================================= */

(function () {
  'use strict';

  const { db, todayISO } = window.Cmp;

  /* =========================================================
     CAPABILITIES
     ========================================================= */
  async function hasCapability(cap) {
    try {
      const { data, error } = await db().rpc('user_has_capability', { p_capability: cap });
      if (error) { console.error('[compras] hasCapability', error); return false; }
      return data === true;
    } catch (e) { console.error(e); return false; }
  }

  /* =========================================================
     COMPRAS
     ========================================================= */
  async function listPurchases(filters = {}) {
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
  }

  async function getPurchase(id) {
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
  }

  async function nextPurchaseCode() {
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
  }

  async function createPurchase(payload) {
    const { data: u } = await db().auth.getUser();
    const actor = u && u.user ? u.user : null;

    let createdByName = '';
    if (actor) {
      const { data: prof } = await db().from('profiles')
        .select('name').eq('id', actor.id).maybeSingle();
      createdByName = (prof && prof.name) || actor.email || '';
    }

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
  }

  async function updatePurchase(id, patch) {
    const { data: u } = await db().auth.getUser();
    const actor = u && u.user ? u.user : null;
    let actorName = '';
    if (actor) {
      const { data: prof } = await db().from('profiles')
        .select('name').eq('id', actor.id).maybeSingle();
      actorName = (prof && prof.name) || actor.email || '';
    }

    const safePatch = { ...patch };
    if ('purchase_date' in safePatch) {
      safePatch.purchase_date = (safePatch.purchase_date && String(safePatch.purchase_date).trim()) || todayISO();
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
  }

  async function updatePurchaseItems(purchaseId, items) {
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
  }

  async function deletePurchase(id) {
    const { error } = await db().from('purchases').delete().eq('id', id);
    if (error) throw error;
  }

  async function cancelPurchase(id, reason) {
    const { data, error } = await db().rpc('cancel_purchase', {
      p_purchase_id: id,
      p_reason:      reason
    });
    if (error) throw error;
    return data;
  }

  async function receivePurchase(id, items) {
    const { data, error } = await db().rpc('receive_purchase', {
      p_purchase_id: id,
      p_items: items
    });
    if (error) throw error;
    return data;
  }

  async function payPurchase(id, amountCents, method, notes) {
    const { data, error } = await db().rpc('pay_purchase', {
      p_purchase_id: id,
      p_amount:      amountCents,
      p_method:      method,
      p_notes:       notes || null
    });
    if (error) throw error;
    return data;
  }

  /* =========================================================
     FORNECEDORES
     ========================================================= */
  async function listSuppliers(search) {
    let q = db().from('suppliers')
      .select('id, name, doc, email, phone, active, created_at')
      .order('name');
    if (search) q = q.ilike('name', `%${search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function createSupplier(payload) {
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
  }

  async function updateSupplier(id, patch) {
    const { error } = await db().from('suppliers').update(patch).eq('id', id);
    if (error) throw error;
  }

  async function deleteSupplier(id) {
    const { error } = await db().from('suppliers').delete().eq('id', id);
    if (error) throw error;
  }

  /* =========================================================
     PRODUTOS
     ========================================================= */
  async function listProducts(search) {
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

  /* =========================================================
     CNPJ
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
              logradouro: d.logradouro, numero: d.numero, complemento: d.complemento,
              bairro: d.bairro, municipio: d.municipio, uf: d.uf, cep: d.cep
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

  /* =========================================================
     Publica
     ========================================================= */
  window.Cmp.API = {
    hasCapability,
    listPurchases, getPurchase, nextPurchaseCode,
    createPurchase, updatePurchase, updatePurchaseItems,
    deletePurchase, cancelPurchase, receivePurchase, payPurchase,
    listSuppliers, createSupplier, updateSupplier, deleteSupplier,
    listProducts,
    validateCNPJ, maskCNPJ, maskPhone, buildAddress, lookupCNPJ
  };

})();