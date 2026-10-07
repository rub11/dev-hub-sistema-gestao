/* =========================================================
   DEV HUB · Configurações da empresa · main
   ========================================================= */
(function () {
  'use strict';
  const DH = window.DH = window.DH || {};

  const state = { org: null, original: null, saving: false, isAdmin: false };
  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    if (document.body.dataset.page !== 'config-empresa') return;

    const Auth = window.Auth;
    if (!Auth || !Auth.isConfigured() || !window.db) {
      showError('Não foi possível conectar ao Supabase.');
      return;
    }

    cacheEls();
    if (!els.form) return;

    bindEvents();

    const session = await Auth.requireSession();
    if (!session) return;

    const profile = await Auth.getProfile(session.user.id);
    const role = String((profile && profile.role) || '').toLowerCase();
    state.isAdmin = !!(profile && profile.is_platform_admin) ||
                    ['admin','administrador','gestor','manager'].includes(role);

    await loadOrganization();
  }

  function cacheEls() {
    els.loading = document.getElementById('cmp-loading');
    els.error   = document.getElementById('cmp-error');
    els.errorMsg = document.getElementById('cmp-error-msg');
    els.app     = document.getElementById('cmp-app');

    els.form    = document.getElementById('cmp-form');
    els.feedback = document.getElementById('cmp-feedback');
    els.saveBtn = document.getElementById('cmp-save-btn');
    els.resetBtn = document.getElementById('cmp-reset-btn');
    els.savedMeta = document.getElementById('cmp-saved-meta');

    els.displayName = document.getElementById('cmp-display-name');
    els.displayDoc  = document.getElementById('cmp-display-doc');
    els.displayMeta = document.getElementById('cmp-display-meta');

    els.logoImg = document.getElementById('cmp-logo-img');

    els.name         = document.getElementById('cmp-name');
    els.tradeName    = document.getElementById('cmp-trade-name');
    els.document     = document.getElementById('cmp-document');
    els.logoUrl      = document.getElementById('cmp-logo-url');
    els.email        = document.getElementById('cmp-email');
    els.phone        = document.getElementById('cmp-phone');
    els.website      = document.getElementById('cmp-website');
    els.cep          = document.getElementById('cmp-cep');
    els.address      = document.getElementById('cmp-address');
    els.addressNum   = document.getElementById('cmp-address-number');
    els.addressComp  = document.getElementById('cmp-address-complement');
    els.neighborhood = document.getElementById('cmp-neighborhood');
    els.city         = document.getElementById('cmp-city');
    els.state        = document.getElementById('cmp-state');
    els.taxRegime    = document.getElementById('cmp-tax-regime');
    els.cnae         = document.getElementById('cmp-cnae');
    els.stateReg     = document.getElementById('cmp-state-registration');
    els.municipalReg = document.getElementById('cmp-municipal-registration');
    els.segment      = document.getElementById('cmp-segment');
    els.notes        = document.getElementById('cmp-notes');
  }

  function bindEvents() {
    els.form.addEventListener('submit', onSave);
    els.resetBtn.addEventListener('click', revert);
    els.logoUrl.addEventListener('input', updateLogoPreview);
  }

  async function loadOrganization() {
    try {
      const orgId = await resolveOrgId();
      if (!orgId) {
        showError('Não foi possível identificar sua empresa.');
        return;
      }

      const { data, error } = await window.db
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle();

      if (error) throw error;
      if (!data) { showError('Empresa não encontrada.'); return; }

      state.org = data;
      state.original = Object.assign({}, data);

      fillForm(data);
      updateHeader();
      applyPermissions();

      els.loading.hidden = true;
      els.app.hidden = false;

      if (data.updated_at) {
        els.savedMeta.textContent = 'Última atualização: ' +
          new Date(data.updated_at).toLocaleString('pt-BR');
      }
    } catch (e) {
      console.error('[config-empresa] load:', e);
      showError(e.message || 'Erro ao carregar os dados.');
    }
  }

  async function resolveOrgId() {
    try {
      const raw = sessionStorage.getItem('devhub_user');
      if (raw) {
        const ctx = JSON.parse(raw);
        if (ctx && ctx.organization_id) return ctx.organization_id;
      }
    } catch (e) {}

    try {
      const { data: u } = await window.db.auth.getUser();
      if (u && u.user) {
        const { data: prof } = await window.db
          .from('profiles')
          .select('organization_id')
          .eq('id', u.user.id)
          .maybeSingle();
        if (prof && prof.organization_id) return prof.organization_id;
      }
    } catch (e) {}

    return null;
  }

  function fillForm(o) {
    els.name.value        = o.name || '';
    els.tradeName.value   = o.trade_name || '';
    els.document.value    = o.document || '';
    els.logoUrl.value     = o.logo_url || '';
    els.email.value       = o.email || '';
    els.phone.value       = o.phone || '';
    els.website.value     = o.website || '';
    els.cep.value         = o.cep || '';
    els.address.value     = o.address || '';
    els.addressNum.value  = o.address_number || '';
    els.addressComp.value = o.address_complement || '';
    els.neighborhood.value = o.neighborhood || '';
    els.city.value        = o.city || '';
    els.state.value       = o.state || '';
    els.taxRegime.value   = o.tax_regime || '';
    els.cnae.value        = o.cnae || '';
    els.stateReg.value    = o.state_registration || '';
    els.municipalReg.value = o.municipal_registration || '';
    els.segment.value     = o.segment || '';
    els.notes.value       = o.notes || '';

    updateLogoPreview();
  }

  function revert() {
    if (!state.original) return;
    fillForm(state.original);
    clearFeedback();
    toast('Alterações revertidas.', 'info');
  }

  function updateHeader() {
    if (!state.org) return;
    const name = state.org.trade_name || state.org.name || 'Empresa';
    els.displayName.textContent = name;

    const doc = state.org.document || '';
    els.displayDoc.textContent = doc ? formatDoc(doc) : '—';

    const parts = [];
    if (state.org.city && state.org.state) parts.push(state.org.city + '/' + state.org.state);
    if (state.org.email) parts.push(state.org.email);
    els.displayMeta.textContent = parts.join(' · ') || '';
  }

  function updateLogoPreview() {
    const url = (els.logoUrl.value || '').trim();
    if (url) els.logoImg.src = url;
    else els.logoImg.removeAttribute('src');
  }

  function applyPermissions() {
    if (state.isAdmin) return;
    els.form.querySelectorAll('input, select, textarea, button').forEach(el => {
      if (el.id === 'cmp-reset-btn') return;
      el.disabled = true;
    });
    els.saveBtn.hidden = true;
    showFeedback('Você não tem permissão para editar os dados da empresa.');
  }

  async function onSave(e) {
    e.preventDefault();
    if (state.saving || !state.isAdmin) return;
    clearFeedback();

    const name = (els.name.value || '').trim();
    if (!name) { els.name.focus(); return showFeedback('Razão social é obrigatória.'); }

    const email = (els.email.value || '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      els.email.focus();
      return showFeedback('E-mail inválido.');
    }

    const website = (els.website.value || '').trim();
    if (website && !/^https?:\/\//i.test(website)) {
      els.website.focus();
      return showFeedback('Site deve começar com http:// ou https://');
    }

    setSaving(true);
    try {
      const { error } = await window.db.rpc('update_organization', {
        p_name:                   name,
        p_trade_name:             els.tradeName.value.trim(),
        p_document:               els.document.value.trim(),
        p_email:                  email,
        p_phone:                  els.phone.value.trim(),
        p_website:                website,
        p_cep:                    els.cep.value.trim(),
        p_address:                els.address.value.trim(),
        p_address_number:         els.addressNum.value.trim(),
        p_address_complement:     els.addressComp.value.trim(),
        p_neighborhood:           els.neighborhood.value.trim(),
        p_city:                   els.city.value.trim(),
        p_state:                  els.state.value.trim().toUpperCase(),
        p_logo_url:               els.logoUrl.value.trim(),
        p_segment:                els.segment.value.trim(),
        p_cnae:                   els.cnae.value.trim(),
        p_tax_regime:             els.taxRegime.value.trim(),
        p_state_registration:     els.stateReg.value.trim(),
        p_municipal_registration: els.municipalReg.value.trim(),
        p_notes:                  els.notes.value.trim()
      });
      if (error) throw error;

      state.original = Object.assign({}, state.original, {
        name,
        trade_name: els.tradeName.value.trim(),
        document:   els.document.value.trim(),
        email,
        phone:      els.phone.value.trim(),
        website,
        cep:        els.cep.value.trim(),
        address:    els.address.value.trim(),
        address_number: els.addressNum.value.trim(),
        address_complement: els.addressComp.value.trim(),
        neighborhood: els.neighborhood.value.trim(),
        city:       els.city.value.trim(),
        state:      els.state.value.trim().toUpperCase(),
        logo_url:   els.logoUrl.value.trim(),
        segment:    els.segment.value.trim(),
        cnae:       els.cnae.value.trim(),
        tax_regime: els.taxRegime.value.trim(),
        state_registration: els.stateReg.value.trim(),
        municipal_registration: els.municipalReg.value.trim(),
        notes:      els.notes.value.trim(),
        updated_at: new Date().toISOString()
      });
      state.org = state.original;

      updateHeader();
      els.savedMeta.textContent = 'Última atualização: ' +
        new Date(state.original.updated_at).toLocaleString('pt-BR');

      toast('Dados da empresa atualizados.', 'success');
    } catch (err) {
      console.error('[config-empresa] save:', err);
      showFeedback(err.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  function setSaving(b) {
    state.saving = b;
    if (els.saveBtn) {
      els.saveBtn.disabled = b;
      els.saveBtn.classList.toggle('is-loading', b);
      const label = els.saveBtn.querySelector('.btn__label');
      if (label) label.textContent = b ? 'Salvando…' : 'Salvar alterações';
    }
  }

  function showFeedback(msg) { els.feedback.textContent = msg; els.feedback.hidden = false; }
  function clearFeedback() { els.feedback.textContent = ''; els.feedback.hidden = true; }
  function showError(msg) {
    els.loading.hidden = true;
    els.error.hidden = false;
    if (els.errorMsg) els.errorMsg.textContent = msg;
  }

  function formatDoc(v) {
    const d = String(v || '').replace(/\D+/g, '');
    if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return v;
  }

  function toast(msg, kind) {
    if (DH.toast) return DH.toast(msg, kind);
    const region = document.getElementById('toast-region');
    if (!region) return;
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;top:80px;right:20px;z-index:200;max-width:360px;' +
      'padding:12px 16px;border-radius:10px;background:' +
      (kind === 'error' ? 'var(--danger-soft)' : 'var(--accent-soft)') +
      ';color:' + (kind === 'error' ? 'var(--danger)' : 'var(--accent-hover)') +
      ';box-shadow:0 12px 32px -8px rgba(16,24,40,.24);font-size:13.5px';
    el.textContent = msg;
    region.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
})();