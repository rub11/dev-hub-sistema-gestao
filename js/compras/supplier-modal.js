/* =========================================================
   DEV HUB · Compras · supplier-modal
   ---------------------------------------------------------
   Modal de cadastro de fornecedor inline.
   Usado por nova.js (botão "+ Novo" ao lado do select) e
   fornecedores.js (botão "Novo fornecedor").
   ========================================================= */

(function () {
  'use strict';

  const { toast, API } = window.Cmp;

  /* =========================================================
     Helpers de UI
     ========================================================= */
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

  /* =========================================================
     Modal (singleton)
     ========================================================= */
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

      $sup.cnpj  && $sup.cnpj.addEventListener('input', (e) => { e.target.value = API.maskCNPJ(e.target.value); });
      $sup.cnpj  && $sup.cnpj.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
      });
      $sup.phone && $sup.phone.addEventListener('input', (e) => { e.target.value = API.maskPhone(e.target.value); });
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
        const info = await API.lookupCNPJ(raw);
        if (info.name    && $sup.name)    $sup.name.value    = info.name;
        if (info.fantasy && $sup.fantasy) $sup.fantasy.value = info.fantasy;
        if (info.email   && $sup.email)   $sup.email.value   = info.email;
        if (info.phone   && $sup.phone)   $sup.phone.value   = API.maskPhone(info.phone);
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

  /* =========================================================
     Wire do botão "+ Novo" ao lado do select de fornecedor
     ========================================================= */
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
     Publica
     ========================================================= */
  window.Cmp.SupplierModal    = SupplierModal;
  window.Cmp.initSupplierInline = initSupplierInline;
  window.Cmp.setLoading        = setLoading;
  window.Cmp.flashFilled       = flashFilled;

})();