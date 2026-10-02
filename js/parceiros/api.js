/* =========================================================
   DEV HUB · Parceiros · api
   ---------------------------------------------------------
   Camada Supabase: RPCs + lookup CNPJ + validações.
   ========================================================= */

(function () {
  'use strict';

  const db = () => {
    if (window.db && window.db.from) return window.db;
    throw new Error('Supabase client não encontrado.');
  };

  /* =========================================================
     LISTAR — todos os parceiros (sem filtro de papel)
     ========================================================= */
  async function loadPartners() {
    const { data, error } = await db().from('customers').select(`
      id, organization_id, type, name, company_name, trade_name, cpf_cnpj,
      phone, email, address, status, category, segment, created_at,
      state_registration, tax_regime,
      is_customer, is_supplier, is_carrier, is_other,
      customer_phones(phone, is_primary),
      customer_emails(email, is_primary),
      customer_addresses(street, number, city, state, is_primary)
    `).order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /* =========================================================
     CARREGAR COMPLETO (RPC)
     ========================================================= */
  async function getPartnerFull(id) {
    const { data, error } = await db().rpc('get_customer_full', { p_customer_id: id });
    if (error) throw error;
    return {
      customer:  (data && data.customer)                    ? data.customer  : {},
      phones:    (data && Array.isArray(data.phones))       ? data.phones    : [],
      emails:    (data && Array.isArray(data.emails))       ? data.emails    : [],
      addresses: (data && Array.isArray(data.addresses))    ? data.addresses : [],
      contacts:  (data && Array.isArray(data.contacts))     ? data.contacts  : []
    };
  }

  /* =========================================================
     SALVAR (RPC)
     ========================================================= */
  async function upsertPartnerFull(payload) {
    const { error } = await db().rpc('upsert_customer_full', {
      p_customer_id:     payload.customerId || null,
      p_organization_id: null,
      p_customer:        payload.customer,
      p_phones:          payload.phones,
      p_emails:          payload.emails,
      p_addresses:       payload.addresses,
      p_contacts:        payload.contacts
    });
    if (error) throw error;
  }

  /* =========================================================
     EXCLUIR
     ========================================================= */
  async function deletePartner(id) {
    const { error } = await db().from('customers').delete().eq('id', id);
    if (error) throw error;
  }

  /* =========================================================
     VALIDAÇÕES
     ========================================================= */
  function validateCNPJ(cnpj) {
    const n = String(cnpj || '').replace(/\D/g, '');
    if (n.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(n)) return false;
    const calc = (base) => {
      let sum = 0, pos = base.length - 7;
      for (let i = 0; i < base.length; i++) {
        sum += parseInt(base[i]) * pos--;
        if (pos < 2) pos = 9;
      }
      const r = sum % 11;
      return r < 2 ? 0 : 11 - r;
    };
    const d1 = calc(n.slice(0, 12));
    const d2 = calc(n.slice(0, 12) + d1);
    return n.endsWith(String(d1) + String(d2));
  }

  function validateCPF(cpf) {
    const n = String(cpf || '').replace(/\D/g, '');
    if (n.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(n)) return false;
    let sum = 0, r;
    for (let i = 1; i <= 9; i++) sum += parseInt(n[i - 1]) * (11 - i);
    r = (sum * 10) % 11;
    if (r === 10 || r === 11) r = 0;
    if (r !== parseInt(n[9])) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(n[i - 1]) * (12 - i);
    r = (sum * 10) % 11;
    if (r === 10 || r === 11) r = 0;
    return r === parseInt(n[10]);
  }

  /* =========================================================
     LOOKUP CNPJ (BrasilAPI + ReceitaWS fallback)
     ========================================================= */
  function buildAddressFromAPI(d) {
    const parts = [];
    if (d.logradouro) parts.push(d.logradouro + (d.numero ? ', ' + d.numero : ''));
    if (d.complemento) parts.push(d.complemento);
    if (d.bairro) parts.push(d.bairro);
    if (d.municipio && d.uf) parts.push(`${d.municipio}/${d.uf}`);
    else if (d.municipio) parts.push(d.municipio);
    if (d.cep) parts.push('CEP ' + String(d.cep).replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2'));
    return parts.filter(Boolean).join(' · ');
  }

  async function lookupCNPJ(cnpj) {
    const providers = [
      {
        name: 'BrasilAPI',
        url: `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
        parse: (d) => ({
          name:    d.razao_social || d.nome_fantasia || '',
          fantasy: d.nome_fantasia || '',
          email:   d.email || '',
          phone:   (d.ddd_telefone_1 || '').replace(/\D/g, ''),
          address: buildAddressFromAPI(d)
        })
      },
      {
        name: 'ReceitaWS',
        url: `https://receitaws.com.br/v1/cnpj/${cnpj}`,
        parse: (d) => {
          if (d.status === 'ERROR') throw new Error(d.message || 'CNPJ não encontrado');
          return {
            name:    d.nome || '',
            fantasy: d.fantasia || '',
            email:   d.email || '',
            phone:   (d.telefone || '').replace(/\D/g, ''),
            address: buildAddressFromAPI({
              logradouro: d.logradouro, numero: d.numero, complemento: d.complemento,
              bairro: d.bairro, municipio: d.municipio, uf: d.uf, cep: d.cep
            })
          };
        }
      }
    ];

    let lastErr = null;
    for (const p of providers) {
      try {
        const res = await fetch(p.url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`${p.name} ${res.status}`);
        const data = await res.json();
        return p.parse(data);
      } catch (e) {
        console.warn(`[CNPJ] ${p.name} falhou:`, e.message);
        lastErr = e;
      }
    }
    throw lastErr || new Error('Falha ao consultar CNPJ.');
  }

  /* =========================================================
     NOTES · banco (extrai linhas "Banco: ..." do texto)
     ========================================================= */
  function parseBankFromNotes(raw) {
    const out = { bank: '', agency: '', account: '', pix: '' };
    String(raw).split('\n').forEach((line) => {
      const m = line.match(/^(Banco|Ag[eê]ncia|Conta|Pix):\s*(.+)$/i);
      if (!m) return;
      const k = m[1].toLowerCase();
      if (k.startsWith('banco')) out.bank = m[2].trim();
      else if (k.startsWith('ag')) out.agency = m[2].trim();
      else if (k.startsWith('conta')) out.account = m[2].trim();
      else if (k.startsWith('pix')) out.pix = m[2].trim();
    });
    return out;
  }

  Object.assign(window.Parn, {
    db,
    loadPartners,
    getPartnerFull,
    upsertPartnerFull,
    deletePartner,
    validateCNPJ,
    validateCPF,
    lookupCNPJ,
    buildAddressFromAPI,
    parseBankFromNotes
  });

})();