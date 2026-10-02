/* =========================================================
   DEV HUB · Compras · fornecedores
   ---------------------------------------------------------
   Página fornecedores.html — CRUD de fornecedores.
   ========================================================= */

(function () {
  'use strict';

  const {
    $, escapeHTML, toast,
    API, SupplierModal
  } = window.Cmp;

  async function pageFornecedores() {
    const tbody = $('#forn-tbody');
    const searchInput = $('#forn-search');
    if (!tbody || !searchInput) return;

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

      $f.cnpj.addEventListener('input', (e) => { e.target.value = API.maskCNPJ(e.target.value); });
      $f.cnpj.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
      });
      $f.phone.addEventListener('input', (e) => { e.target.value = API.maskPhone(e.target.value); });
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
        window.Cmp.setLoading($f.search, true);
        try {
          const info = await API.lookupCNPJ(raw);
          if (info.name)    $f.name.value    = info.name;
          if (info.fantasy) $f.fantasy.value = info.fantasy;
          if (info.email)   $f.email.value   = info.email;
          if (info.phone)   $f.phone.value   = API.maskPhone(info.phone);
          if (info.address) $f.address.value = info.address;
          [$f.name, $f.fantasy, $f.email, $f.phone, $f.address].forEach(window.Cmp.flashFilled);
          $f.hint.innerHTML = `Dados preenchidos via <strong>${info.fantasy || info.name}</strong>.`;
        } catch (e) {
          console.warn(e);
          showError(e.message);
          $f.hint.innerHTML = 'Se a busca falhar, preencha manualmente.';
        } finally {
          window.Cmp.setLoading($f.search, false);
        }
      }

      async function doSave() {
        $f.error.hidden = true;
        const name = ($f.name.value || '').trim();
        if (!name) { showError('Informe a razão social ou nome.'); $f.name.focus(); return; }

        window.Cmp.setLoading($f.save, true);
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
          window.Cmp.setLoading($f.save, false);
        }
      }

      function showError(msg) {
        $f.error.textContent = msg;
        $f.error.hidden = false;
      }
    }

    let t = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(render, 220);
    });

    const newBtn = $('#forn-new');
    if (newBtn) newBtn.addEventListener('click', () => openSupplierModal(null));

    await load();
  }

  window.Cmp.pageFornecedores = pageFornecedores;

})();