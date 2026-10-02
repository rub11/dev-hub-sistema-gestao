(function () {
  'use strict';
  const DH = window.DH;

  function setup() {
    document.querySelectorAll('.qty-stepper').forEach(stepper => {
      const input = stepper.querySelector('input[type="number"]');
      if (!input) return;

      stepper.querySelectorAll('[data-step]').forEach(btn => {
        btn.addEventListener('click', () => {
          const step = Number(btn.dataset.step) || 0;
          const min = Number(input.min) || 1;
          const max = Number(input.max) || Infinity;
          const cur = Number(input.value) || min;
          let next = cur + step;
          if (next < min) next = min;
          if (next > max) next = max;
          input.value = next;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });

      input.addEventListener('keydown', e => {
        if (e.key === '.' || e.key === ',' || e.key === '-' || e.key === 'e') {
          e.preventDefault();
        }
      });
    });
  }

  DH.stepper = { setup };
})();