/* =========================================================
   DEV HUB · Modal de Favoritos com Configuração
   ========================================================= */
(function () {
  'use strict';

  function getPreference() { return localStorage.getItem('devhub_fav_pref') || 'individual'; }
  function setPreference(val) { localStorage.setItem('devhub_fav_pref', val); }

  function buildModal() {
    const modal = document.createElement('div');
    modal.className = 'dh-fav-modal';
    modal.style.cssText = 'display: none; position: fixed; inset: 0; z-index: 99999; align-items: center; justify-content: center;';

    modal.innerHTML = `
      <div class="dh-fav-backdrop" style="position: absolute; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);" onclick="window.DHFavoritesModal.close()"></div>
      
      <div class="dh-fav-content" style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; width: 100%; max-width: 480px; padding: 24px; box-shadow: var(--shadow-md); position: relative; z-index: 10000; display: flex; flex-direction: column;">
        
        <h2 style="color: var(--text); font-size: 18px; margin-top: 0; display: flex; align-items: center; gap: 8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" style="width:20px;height:20px;"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          Meus Favoritos
        </h2>

        <div style="margin: 20px 0; padding: 16px; background: var(--surface-2); border-radius: 8px; border: 1px solid var(--border);">
          <p style="font-size: 13px; font-weight: 600; color: var(--text); margin: 0 0 10px 0;">Como deseja abrir os favoritos?</p>
          
          <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; color: var(--text); cursor: pointer;">
            <input type="radio" name="fav-pref" value="individual" ${getPreference() === 'individual' ? 'checked' : ''}>
            Selecionar individualmente
          </label>
          
          <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text); cursor: pointer;">
            <input type="radio" name="fav-pref" value="all" ${getPreference() === 'all' ? 'checked' : ''}>
            Abrir todos de uma vez
          </label>
        </div>

        <div id="dh-fav-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 20px;"></div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border); padding-top: 16px;">
          <button type="button" class="btn btn--ghost" onclick="window.DHFavoritesModal.close()" style="background: var(--surface-2); border: 1px solid var(--border); color: var(--text); padding: 8px 16px; border-radius: 8px; cursor: pointer;">Fechar</button>
          <button type="button" class="btn btn--primary" id="dh-fav-action-btn" style="background: var(--accent); color: #fff; border: 0; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer;">Abrir Favoritos</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  let modalEl = null;

  function renderList() {
    const list = modalEl.querySelector('#dh-fav-list');
    const favs = window.NAV.favorites.getItems(); // Puxa do Supabase via favorites.js
    const pref = getPreference();

    if (favs.length === 0) {
      list.innerHTML = `<p style="text-align:center; color: var(--text-muted); font-size: 13px; padding: 20px;">Nenhum favorito salvo ainda.</p>`;
      modalEl.querySelector('#dh-fav-action-btn').style.display = 'none';
      return;
    }

    modalEl.querySelector('#dh-fav-action-btn').style.display = 'block';

    if (pref === 'all') {
      list.innerHTML = `<p style="font-size: 13px; color: var(--text-soft);">Você tem <strong>${favs.length}</strong> favoritos salvos. Eles serão abertos juntos.</p>`;
    } else {
      list.innerHTML = favs.map((f, i) => `
        <label style="display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 6px; cursor: pointer; background: var(--surface-2);">
          <input type="checkbox" class="fav-check" value="${i}" checked>
          <span style="font-size: 13px; color: var(--text);">${f.label || 'Sem nome'}</span>
        </label>
      `).join('');
    }
  }

  function open() {
    if (!modalEl) modalEl = buildModal();
    modalEl.style.display = 'flex';

    renderList();

    modalEl.querySelectorAll('input[name="fav-pref"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        setPreference(e.target.value);
        renderList();
      });
    });

    modalEl.querySelector('#dh-fav-action-btn').onclick = () => {
      const favs = window.NAV.favorites.getItems();
      const pref = getPreference();

      if (pref === 'all') {
        favs.forEach(f => window.DHTabs ? window.DHTabs.open(f) : window.location.href = f.href);
      } else {
        modalEl.querySelectorAll('.fav-check:checked').forEach(cb => {
          const f = favs[cb.value];
          if (f) window.DHTabs ? window.DHTabs.open(f) : window.location.href = f.href;
        });
      }
      close();
    };
  }

  function close() {
    if (modalEl) modalEl.style.display = 'none';
  }

  window.DHFavoritesModal = { open, close };
})();