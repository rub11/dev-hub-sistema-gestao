/* =========================================================
   DEV HUB · Navegação · busca global (Ctrl+K)
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV;
  const state = NAV.state;

  function setupSearch() {
    const s = state.search;
    s.input   = document.getElementById('tnav-search-input');
    s.results = document.getElementById('tnav-search-results');
    s.clear   = document.getElementById('tnav-search-clear');
    s.wrap    = document.getElementById('tnav-search');

    if (!s.input || !s.results) return;

    s.index = NAV.roles.visibleItems().map(function (it) {
      return { id: it.id, label: it.label, href: it.href, icon: it.icon, module: it.group };
    });

    s.input.addEventListener('input', onInput);
    s.input.addEventListener('focus', onInput);
    s.input.addEventListener('keydown', onKeydown);

    if (s.clear) {
      s.clear.addEventListener('click', function () {
        clear();
        s.input.focus();
      });
    }
  }

  function onInput() {
    const s = state.search;
    const q = String(s.input.value || '').trim().toLowerCase();

    if (s.wrap) s.wrap.classList.toggle('has-value', q.length > 0);

    if (!q) { closeResults(); return; }

    const words = q.split(/\s+/).filter(Boolean);
    s.filtered = s.index.filter(function (item) {
      const haystack = (item.label + ' ' + (item.module || '')).toLowerCase();
      return words.every(function (w) { return haystack.indexOf(w) !== -1; });
    });

    s.selectedIdx = s.filtered.length > 0 ? 0 : -1;
    renderResults();
  }

  function renderResults() {
    const s = state.search;
    const wrap = s.results;
    if (!wrap) return;

    if (s.filtered.length === 0) {
      wrap.innerHTML = '<div class="tnav-search__empty">Nenhum resultado encontrado.</div>';
      wrap.hidden = false;
      s.input.setAttribute('aria-expanded', 'true');
      return;
    }

    wrap.innerHTML = s.filtered.map(function (item, idx) {
      const sel = idx === s.selectedIdx ? ' is-selected' : '';
      return (
        '<a class="tnav-search__item' + sel + '" href="' + item.href + '" ' +
           'data-idx="' + idx + '" data-entry-id="' + item.id + '" role="option" ' +
           (sel ? 'aria-selected="true"' : '') + '>' +
          NAV.ICONS[item.icon] +
          '<span>' + item.label + '</span>' +
          (item.module ? '<span class="tnav-search__module">' + item.module + '</span>' : '') +
        '</a>'
      );
    }).join('');

    wrap.hidden = false;
    s.input.setAttribute('aria-expanded', 'true');

    wrap.querySelectorAll('.tnav-search__item').forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        s.selectedIdx = Number(el.dataset.idx);
        updateHighlight();
      });

      el.addEventListener('click', function (ev) {
        ev.preventDefault();
        const entryId = el.getAttribute('data-entry-id');
        const item = NAV.findItemById(entryId);
        if (!item) return;
        clear();
        NAV.tabs.open(item);
      });
    });
  }

  function updateHighlight() {
    const s = state.search;
    const wrap = s.results;
    if (!wrap) return;
    wrap.querySelectorAll('.tnav-search__item').forEach(function (el, idx) {
      el.classList.toggle('is-selected', idx === s.selectedIdx);
      if (idx === s.selectedIdx) el.setAttribute('aria-selected', 'true');
      else el.removeAttribute('aria-selected');
    });

    const current = wrap.querySelector('.tnav-search__item.is-selected');
    if (current && current.scrollIntoView) current.scrollIntoView({ block: 'nearest' });
  }

  function onKeydown(e) {
    const s = state.search;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeResults();
      s.input.blur();
      return;
    }

    if (!s.results || s.results.hidden) return;

    const len = s.filtered.length;
    if (len === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      s.selectedIdx = (s.selectedIdx + 1) % len;
      updateHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      s.selectedIdx = (s.selectedIdx - 1 + len) % len;
      updateHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = s.filtered[s.selectedIdx];
      if (item) {
        const found = NAV.findItemById(item.id);
        if (found) { clear(); NAV.tabs.open(found); }
      }
    }
  }

  function closeResults() {
    const s = state.search;
    if (s.results) s.results.hidden = true;
    if (s.input) s.input.setAttribute('aria-expanded', 'false');
  }

  function clear() {
    const s = state.search;
    if (s.input) s.input.value = '';
    if (s.wrap) s.wrap.classList.remove('has-value');
    closeResults();
  }

  NAV.search = { setup: setupSearch, closeResults, clear };
})();