/* =========================================================
   DEV HUB · Financeiro · overview
   ---------------------------------------------------------
   KPIs + period picker.
   Funciona em 2 contextos:
     • Hub (financeiro.html)                → mode: 'all'
     • Tela única (financeiro-titulos?tab=) → mode: 'pagar' | 'receber'
   ========================================================= */

(function () {
  'use strict';

  const { fmtBRL, state } = window.Fin;

  /* =========================================================
     PERÍODO
     ========================================================= */
  function currentMonthISO() {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }
  function monthISOFromParts(year, monthIdx) {
    return year + '-' + String(monthIdx + 1).padStart(2, '0');
  }
  function parseMonthISO(ym) {
    const [y, m] = ym.split('-').map(Number);
    return { year: y, month: m - 1 };
  }
  function startOfMonthFromISO(ym) {
    const { year, month } = parseMonthISO(ym);
    return new Date(year, month, 1);
  }
  function endOfMonthFromISO(ym) {
    const { year, month } = parseMonthISO(ym);
    return new Date(year, month + 1, 0);
  }
  function toISO(d) { return d.toISOString().slice(0, 10); }
  function todayISO() { return toISO(new Date()); }

  const MONTH_LABELS      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const MONTH_LABELS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  /* =========================================================
     PERIOD PICKER
     ========================================================= */
  const picker = {
    root: null, trigger: null, panel: null,
    labelEl: null, yearEl: null, gridEl: null,
    panelYear: new Date().getFullYear(),
    open: false
  };

  function setupPeriodSelect() {
    picker.root     = document.getElementById('fin-period');
    picker.trigger  = document.getElementById('fin-period-trigger');
    picker.panel    = document.getElementById('fin-period-panel');
    picker.labelEl  = document.getElementById('fin-period-label');
    picker.yearEl   = document.getElementById('fin-period-year');
    picker.gridEl   = document.getElementById('fin-period-grid');

    if (!picker.root || !picker.trigger || !picker.panel) return;
    if (!state.selectedMonth) state.selectedMonth = currentMonthISO();

    picker.panelYear = parseMonthISO(state.selectedMonth).year;

    picker.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePicker();
    });

    picker.panel.querySelectorAll('[data-shortcut]').forEach((btn) => {
      btn.addEventListener('click', () => applyShortcut(btn.dataset.shortcut));
    });
    picker.panel.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        picker.panelYear += (btn.dataset.nav === 'next' ? 1 : -1);
        renderGrid();
      });
    });

    document.addEventListener('click', (e) => {
      if (!picker.open) return;
      if (picker.root.contains(e.target)) return;
      closePicker();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && picker.open) { closePicker(); picker.trigger.focus(); }
    });

    renderGrid();
    updatePeriodLabel();
  }

  function togglePicker() { picker.open ? closePicker() : openPicker(); }

  function openPicker() {
    picker.panelYear = parseMonthISO(state.selectedMonth).year;
    picker.panel.hidden = false;
    picker.trigger.setAttribute('aria-expanded', 'true');
    picker.open = true;
    renderGrid();
  }
  function closePicker() {
    picker.panel.hidden = true;
    picker.trigger.setAttribute('aria-expanded', 'false');
    picker.open = false;
  }

  function renderGrid() {
    if (!picker.gridEl) return;
    picker.yearEl.textContent = picker.panelYear;

    const today = new Date();
    const isCurrentYear  = picker.panelYear === today.getFullYear();
    const sel = parseMonthISO(state.selectedMonth);
    const isSelectedYear = picker.panelYear === sel.year;

    picker.gridEl.innerHTML = MONTH_LABELS.map((label, idx) => {
      const classes = ['fin-period__month'];
      if (isCurrentYear && idx === today.getMonth()) classes.push('is-current');
      if (isSelectedYear && idx === sel.month)        classes.push('is-selected');
      return `<button type="button" class="${classes.join(' ')}" data-month="${idx}">${label}</button>`;
    }).join('');

    picker.gridEl.querySelectorAll('[data-month]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const monthIdx = Number(btn.dataset.month);
        state.selectedMonth = monthISOFromParts(picker.panelYear, monthIdx);
        updatePeriodLabel();
        window.Fin.renderOverview?.();
        closePicker();
      });
    });
  }

  function applyShortcut(kind) {
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth();
    if (kind === 'last')  m -= 1;
    if (kind === 'last2') m -= 2;
    if (kind === 'next')  m += 1;
    while (m < 0)  { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    state.selectedMonth = monthISOFromParts(y, m);
    picker.panelYear = y;
    updatePeriodLabel();
    window.Fin.renderOverview?.();
    closePicker();
  }

  function updatePeriodLabel() {
    if (!picker.labelEl) return;
    const { year, month } = parseMonthISO(state.selectedMonth);
    picker.labelEl.textContent = MONTH_LABELS_FULL[month] + ' ' + year;
  }

  /* =========================================================
     CÁLCULOS
     ========================================================= */
  function computeOverview(mode) {
    const ym = state.selectedMonth || currentMonthISO();
    const mStart = toISO(startOfMonthFromISO(ym));
    const mEnd   = toISO(endOfMonthFromISO(ym));
    const hoje   = todayISO();

    const kind = mode === 'receber' ? 'receita' : 'despesa';

    const entries = state.entries.filter((e) => e.kind === kind);

    const noMes = entries.filter((e) =>
      e.status === 'pendente' && e.due_date &&
      e.due_date >= mStart && e.due_date <= mEnd
    );
    const noMesCents = noMes.reduce((s, e) => s + Number(e.amount_cents || 0), 0);

    const vencendoHoje = entries.filter((e) =>
      e.status === 'pendente' && e.due_date === hoje
    );
    const vencendoHojeCents = vencendoHoje.reduce((s, e) => s + Number(e.amount_cents || 0), 0);

    const vencidas = entries.filter((e) =>
      e.status === 'pendente' && e.due_date && e.due_date < hoje
    );
    const vencidasCents = vencidas.reduce((s, e) => s + Number(e.amount_cents || 0), 0);

    const pagoMes = entries.filter((e) =>
      e.settlement_date &&
      e.settlement_date >= mStart && e.settlement_date <= mEnd
    );
    const pagoMesCents = pagoMes.reduce((s, e) => s + Number(e.paid_cents || 0), 0);

    const boletosAberto = entries.filter((e) =>
      e.status === 'pendente' &&
      String(e.payment_method || '').toLowerCase() === 'boleto'
    );
    const boletosAbertoCents = boletosAberto.reduce((s, e) => s + Number(e.amount_cents || 0), 0);

    return {
      noMes:         { cents: noMesCents,         count: noMes.length },
      vencendoHoje:  { cents: vencendoHojeCents,  count: vencendoHoje.length },
      vencidas:      { cents: vencidasCents,      count: vencidas.length },
      pagoMes:       { cents: pagoMesCents,       count: pagoMes.length },
      boletosAberto: { cents: boletosAbertoCents, count: boletosAberto.length }
    };
  }

  /* =========================================================
     SPARKLINES
     ========================================================= */
  const SPARKS = {
    noMes: `
      <svg class="fin-kpi__spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="spark-pagar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ef4444" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="#ef4444" stop-opacity="0"/>
        </linearGradient></defs>
        <path d="M0,22 C10,8 18,16 26,18 C34,20 40,12 50,15 C58,18 66,10 74,13 C82,16 90,8 100,14 L100,30 L0,30 Z" fill="url(#spark-pagar)"/>
        <path d="M0,22 C10,8 18,16 26,18 C34,20 40,12 50,15 C58,18 66,10 74,13 C82,16 90,8 100,14" fill="none" stroke="#ef4444" stroke-width="1.4" stroke-linecap="round"/>
      </svg>`,
    hoje: `
      <svg class="fin-kpi__spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
        <rect x="4"  y="16" width="6" height="14" rx="1.2" fill="#f59e0b" opacity="0.55"/>
        <rect x="16" y="10" width="6" height="20" rx="1.2" fill="#f59e0b" opacity="0.75"/>
        <rect x="28" y="13" width="6" height="17" rx="1.2" fill="#f59e0b" opacity="0.65"/>
        <rect x="40" y="6"  width="6" height="24" rx="1.2" fill="#f59e0b" opacity="0.95"/>
        <rect x="52" y="11" width="6" height="19" rx="1.2" fill="#f59e0b" opacity="0.7"/>
        <rect x="64" y="3"  width="6" height="27" rx="1.2" fill="#f59e0b" opacity="1"/>
        <rect x="76" y="9"  width="6" height="21" rx="1.2" fill="#f59e0b" opacity="0.8"/>
        <rect x="88" y="14" width="6" height="16" rx="1.2" fill="#f59e0b" opacity="0.5"/>
      </svg>`,
    vencidas: `
      <svg class="fin-kpi__spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
        <circle cx="4"   cy="24" r="1.6" fill="#ef4444" opacity="0.45"/>
        <circle cx="12"  cy="22" r="1.6" fill="#ef4444" opacity="0.5"/>
        <circle cx="20"  cy="20" r="1.6" fill="#ef4444" opacity="0.6"/>
        <circle cx="28"  cy="23" r="1.6" fill="#ef4444" opacity="0.55"/>
        <circle cx="36"  cy="19" r="1.6" fill="#ef4444" opacity="0.7"/>
        <circle cx="44"  cy="17" r="1.6" fill="#ef4444" opacity="0.8"/>
        <circle cx="52"  cy="20" r="1.6" fill="#ef4444" opacity="0.75"/>
        <circle cx="60"  cy="15" r="1.6" fill="#ef4444" opacity="0.9"/>
        <circle cx="68"  cy="18" r="1.6" fill="#ef4444" opacity="0.85"/>
        <circle cx="76"  cy="13" r="1.6" fill="#ef4444" opacity="0.95"/>
        <circle cx="84"  cy="16" r="1.6" fill="#ef4444" opacity="0.9"/>
        <circle cx="92"  cy="12" r="1.6" fill="#ef4444" opacity="1"/>
      </svg>`,
    pago: `
      <svg class="fin-kpi__spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="spark-pago" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
        </linearGradient></defs>
        <path d="M0,20 C10,14 18,20 26,18 C34,16 40,20 50,17 C58,15 66,18 74,14 C82,11 90,15 100,10 L100,30 L0,30 Z" fill="url(#spark-pago)"/>
        <path d="M0,20 C10,14 18,20 26,18 C34,16 40,20 50,17 C58,15 66,18 74,14 C82,11 90,15 100,10" fill="none" stroke="#10b981" stroke-width="1.4" stroke-linecap="round"/>
      </svg>`,
    boletos: `
      <svg class="fin-kpi__spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="spark-boletos" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
        </linearGradient></defs>
        <path d="M0,22 C8,20 15,14 24,16 C32,18 40,24 50,22 C58,20 66,12 74,14 C82,16 90,20 100,18 L100,30 L0,30 Z" fill="url(#spark-boletos)"/>
        <path d="M0,22 C8,20 15,14 24,16 C32,18 40,24 50,22 C58,20 66,12 74,14 C82,16 90,20 100,18" fill="none" stroke="#3b82f6" stroke-width="1.4" stroke-linecap="round"/>
      </svg>`
  };

  const ICONS = {
    noMes:    '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    hoje:     '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    vencidas: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    pago:     '<path d="M20 6 9 17l-5-5"/>',
    boletos:  '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M2.5 10h19"/>'
  };

  /* =========================================================
     RENDER
     ========================================================= */
  function renderOverview(mode) {
    const wrap = document.getElementById('fin-overview');
    if (!wrap) return;

    updatePeriodLabel();

    const data = computeOverview(mode || 'pagar');

    const plural = (n, sing, plur) => n === 1 ? `1 ${sing}` : `${n} ${plur}`;
    const isReceber = mode === 'receber';

    const cards = [
      {
        cls: 'pagar',
        label: isReceber ? 'Total a Receber (Mês)' : 'Total a Pagar (Mês)',
        value: fmtBRL(data.noMes.cents),
        hint: plural(data.noMes.count, 'título pendente', 'títulos pendentes')
      },
      {
        cls: 'hoje',
        label: 'Vencendo Hoje',
        value: fmtBRL(data.vencendoHoje.cents),
        hint: plural(data.vencendoHoje.count, 'título vence hoje', 'títulos vencem hoje')
      },
      {
        cls: 'vencidas',
        label: 'Vencidas',
        value: fmtBRL(data.vencidas.cents),
        hint: plural(data.vencidas.count, 'título em atraso', 'títulos em atraso')
      },
      {
        cls: 'pago',
        label: isReceber ? 'Total Recebido (Mês)' : 'Total Pago (Mês)',
        value: fmtBRL(data.pagoMes.cents),
        hint: plural(data.pagoMes.count, isReceber ? 'título recebido' : 'título baixado', isReceber ? 'títulos recebidos' : 'títulos baixados')
      },
      {
        cls: 'boletos',
        label: 'Boletos em Aberto',
        value: fmtBRL(data.boletosAberto.cents),
        hint: plural(data.boletosAberto.count, 'boleto pendente', 'boletos pendentes')
      }
    ];

    wrap.innerHTML = cards.map((c) => `
      <article class="fin-kpi fin-kpi--${c.cls}">
        <div class="fin-kpi__head">
          <span class="fin-kpi__label">${c.label}</span>
          <span class="fin-kpi__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              ${ICONS[c.cls] || ''}
            </svg>
          </span>
        </div>
        <div class="fin-kpi__value">${c.value}</div>
        <div class="fin-kpi__hint">${c.hint}</div>
        ${SPARKS[c.cls] || ''}
      </article>
    `).join('');
  }

  /* =========================================================
     PUBLICA
     ========================================================= */
  Object.assign(window.Fin, {
    computeOverview,
    renderOverview,
    setupPeriodSelect,
    updatePeriodLabel
  });

})();