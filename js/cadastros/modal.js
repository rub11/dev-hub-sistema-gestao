/* =========================================================
   DEV HUB · Cadastros · modal (genérico)
   Renderiza formulário a partir de um schema de campos.
   ========================================================= */
(function () {
  'use strict';
  const CAD = window.CAD;

  const els = {};
  let current = null;

  function setup() {
    els.modal    = document.getElementById('cad-modal');
    els.title    = document.getElementById('cad-modal-title');
    els.form     = document.getElementById('cad-form');
    els.fields   = document.getElementById('cad-form-fields');
    els.feedback = document.getElementById('cad-form-feedback');
    els.submit   = document.getElementById('cad-form-submit');

    if (!els.modal) return;

    els.modal.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', close);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !els.modal.hidden) close();
    });

    els.form.addEventListener('submit', onSubmit);

    // ✅ FIX: setup do modal de confirmação
    setupConfirm();
  }

  function open(opts) {
    current = {
      fields: opts.fields || [],
      onSubmit: opts.onSubmit,
      recordId: opts.recordId || null
    };

    els.title.textContent = opts.title || 'Formulário';
    els.submit.querySelector('.btn__label').textContent = opts.submitLabel || 'Salvar';
    els.feedback.hidden = true;
    els.feedback.textContent = '';
    els.submit.classList.remove('is-loading');
    els.submit.disabled = false;

    renderFields(current.fields);
    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      const first = els.fields.querySelector('input, select, textarea');
      if (first) first.focus();
    }, 60);
  }

  function renderFields(fields) {
    els.fields.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'cad-form__group';

    fields.forEach(f => {
      const wrap = document.createElement('div');
      wrap.className = 'cad-form__field field' + (f.full ? ' cad-form__field--full' : '');

      if (f.type === 'section') {
        const title = document.createElement('p');
        title.className = 'cad-form__section-title';
        title.textContent = f.label;
        grid.appendChild(title);
        return;
      }

      if (f.type === 'checkbox') {
        const label = document.createElement('label');
        label.className = 'cad-form__checkbox cad-form__field--full';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = f.name;
        input.checked = !!f.value;
        const span = document.createElement('span');
        span.textContent = f.label;
        label.appendChild(input);
        label.appendChild(span);
        wrap.appendChild(label);
        grid.appendChild(wrap);
        return;
      }

      const labelEl = document.createElement('label');
      labelEl.setAttribute('for', 'cad-f-' + f.name);
      labelEl.textContent = f.label + (f.required ? ' *' : '');
      wrap.appendChild(labelEl);

      let input;
      if (f.type === 'select') {
        input = document.createElement('select');
        (f.options || []).forEach(opt => {
          const o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          if (String(opt.value) === String(f.value ?? '')) o.selected = true;
          input.appendChild(o);
        });
      } else if (f.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = f.rows || 3;
        if (f.maxlength) input.maxLength = f.maxlength;
        input.value = f.value ?? '';
      } else {
        input = document.createElement('input');
        input.type = f.type || 'text';
        input.value = f.value ?? '';
        if (f.placeholder) input.placeholder = f.placeholder;
        if (f.min !== undefined) input.min = f.min;
        if (f.max !== undefined) input.max = f.max;
        if (f.maxlength) input.maxLength = f.maxlength;
        if (f.step !== undefined) input.step = f.step;
      }

      input.id = 'cad-f-' + f.name;
      input.name = f.name;
      if (f.required) input.required = true;
      if (f.readonly) input.readOnly = true;
      if (f.autocomplete) input.autocomplete = f.autocomplete;

      wrap.appendChild(input);

      if (f.hint) {
        const hint = document.createElement('p');
        hint.className = 'cad-form__hint';
        hint.textContent = f.hint;
        wrap.appendChild(hint);
      }

      grid.appendChild(wrap);
    });

    els.fields.appendChild(grid);
  }

  function readValues() {
    const values = {};
    current.fields.forEach(f => {
      if (f.type === 'section') return;
      const input = els.fields.querySelector('[name="' + f.name + '"]');
      if (!input) return;

      if (f.type === 'checkbox') {
        values[f.name] = input.checked;
      } else if (f.type === 'number') {
        const v = input.value.trim();
        values[f.name] = v === '' ? null : Number(v);
      } else {
        const v = input.value.trim();
        values[f.name] = v === '' ? null : v;
      }
    });
    return values;
  }

  function showFeedback(msg) {
    els.feedback.textContent = msg;
    els.feedback.hidden = false;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!current) return;

    els.feedback.hidden = true;

    const values = readValues();

    for (const f of current.fields) {
      if (f.type === 'section') continue;
      if (f.required && (values[f.name] === null || values[f.name] === '')) {
        showFeedback('Preencha o campo: ' + f.label);
        const input = els.fields.querySelector('[name="' + f.name + '"]');
        if (input) input.focus();
        return;
      }
    }

    setBusy(true);
    try {
      await current.onSubmit(values, current.recordId);
      close();
    } catch (err) {
      console.error('[CAD] Erro no submit:', err);
      showFeedback(CAD.friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  function setBusy(busy) {
    if (!els.submit) return;
    els.submit.disabled = busy;
    els.submit.classList.toggle('is-loading', busy);
    const label = els.submit.querySelector('.btn__label');
    if (label) {
      if (!els.submit.dataset.originalLabel) {
        els.submit.dataset.originalLabel = label.textContent;
      }
      label.textContent = busy ? 'Salvando…' : els.submit.dataset.originalLabel;
    }
  }

  function close() {
    if (!els.modal) return;
    els.modal.hidden = true;
    document.body.style.overflow = '';
    current = null;
  }

  /* =========================================================
     Confirm modal
     ========================================================= */
  const confirmEls = {};
  let confirmCb = null;

  function setupConfirm() {
    confirmEls.modal = document.getElementById('confirm-modal');
    confirmEls.text  = document.getElementById('confirm-text');
    confirmEls.ok    = document.getElementById('confirm-ok');

    if (!confirmEls.modal) {
      console.warn('[CAD] confirm-modal não encontrado no HTML');
      return;
    }

    confirmEls.modal.querySelectorAll('[data-close-confirm]').forEach(el => {
      el.addEventListener('click', closeConfirm);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !confirmEls.modal.hidden) closeConfirm();
    });

    if (confirmEls.ok) {
      confirmEls.ok.addEventListener('click', async () => {
        if (!confirmCb) return;
        confirmEls.ok.disabled = true;
        try {
          await confirmCb();
          closeConfirm();
        } catch (err) {
          CAD.toast(CAD.friendlyError(err), 'error');
        } finally {
          confirmEls.ok.disabled = false;
        }
      });
    }
  }

  function openConfirm(message, onOk, okLabel) {
    // Se por algum motivo setupConfirm não rodou, tenta de novo
    if (!confirmEls.modal) setupConfirm();

    if (!confirmEls.modal || !confirmEls.text || !confirmEls.ok) {
      console.warn('[CAD] confirm-modal indisponível, usando window.confirm');
      // Fallback: usa window.confirm nativo
      if (window.confirm(message)) {
        Promise.resolve(onOk()).catch(err => CAD.toast(CAD.friendlyError(err), 'error'));
      }
      return;
    }

    confirmEls.text.textContent = message;
    confirmEls.ok.textContent = okLabel || 'Excluir';
    confirmEls.ok.disabled = false;
    confirmCb = onOk;
    confirmEls.modal.hidden = false;
    document.body.style.overflow = 'hidden';

    setTimeout(() => confirmEls.ok.focus(), 60);
  }

  function closeConfirm() {
    if (!confirmEls.modal) return;
    confirmEls.modal.hidden = true;
    document.body.style.overflow = '';
    confirmCb = null;
  }

  CAD.modal = { setup, open, close, openConfirm, closeConfirm };
})();