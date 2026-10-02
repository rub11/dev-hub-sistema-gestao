/* =========================================================
   DEV HUB · Navegação · styles
   Injeta o CSS da barra de abas e dropdowns.
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV;

  function injectStyles() {
    if (document.getElementById('devhub-topnav-styles')) return;

    const css = `
      html.layout-topnav .sidebar,
      html.layout-topnav .sidebar-overlay,
      html.layout-topnav .menu-toggle,
      html.layout-topnav .topbar,
      body.layout-topnav .sidebar,
      body.layout-topnav .sidebar-overlay,
      body.layout-topnav .menu-toggle,
      body.layout-topnav .topbar { display: none !important; }
      html.layout-topnav .app__body,
      body.layout-topnav .app__body { margin-left: 0 !important; }

      .app-tabs {
        display: flex; align-items: stretch;
        height: 56px; min-height: 56px;
        padding: 0 16px;
        background: var(--surface-2);
        border-bottom: 1px solid var(--border);
        position: sticky; top: 0; z-index: 40;
        overflow: hidden;
      }

      .app-tabs__brand {
        display: flex; align-items: center; gap: 10px;
        flex: none; padding-right: 18px; margin-right: 6px;
        border-right: 1px solid var(--border);
        height: 32px; align-self: center;
        user-select: none; text-decoration: none; color: inherit;
        cursor: pointer; transition: opacity var(--transition);
      }
      .app-tabs__brand:hover { opacity: 0.85; }
      .app-tabs__brand:focus-visible {
        outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 8px;
      }
      .app-tabs__brand-mark {
        display: grid; place-items: center;
        width: 32px; height: 32px; border-radius: 9px;
        background: transparent; overflow: hidden; flex: none;
      }
      .app-tabs__brand-mark img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .app-tabs__brand-text {
        font-size: 13px; font-weight: 800; letter-spacing: 0.1em;
        color: var(--text); white-space: nowrap;
      }

      .app-tabs__scroll {
        display: flex; align-items: center; gap: 2px;
        flex: 1 1 auto; min-width: 0;
        overflow-x: auto; overflow-y: hidden;
        scrollbar-width: none; padding: 8px 0;
      }
      .app-tabs__scroll::-webkit-scrollbar { display: none; }

      .app-tabs__empty {
        padding: 0 10px; font-size: 12.5px;
        color: var(--text-muted); font-style: italic;
      }

      .app-tab {
        flex: 0 0 auto;
        display: inline-flex; align-items: center; gap: 8px;
        height: 36px; padding: 0 6px 0 12px;
        border: 1px solid transparent; border-radius: 8px;
        background: transparent; color: var(--text-soft);
        font-size: 12.5px; font-weight: 500;
        cursor: pointer; max-width: 220px; min-width: 0;
        transition: background-color var(--transition), color var(--transition),
                    border-color var(--transition);
        position: relative;
      }
      .app-tab:hover { background: var(--surface); color: var(--text); border-color: var(--border); }
      .app-tab.is-active {
        background: var(--surface); color: var(--text); border-color: var(--border);
        box-shadow: 0 -2px 0 0 var(--accent) inset;
      }
      .app-tab__icon { display: inline-flex; flex: none; width: 14px; height: 14px; color: var(--text-muted); }
      .app-tab__icon svg { width: 14px; height: 14px; }
      .app-tab.is-active .app-tab__icon { color: var(--accent); }
      .app-tab__label {
        flex: 1 1 auto; min-width: 0;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .app-tab__close {
        flex: none; display: grid; place-items: center;
        width: 20px; height: 20px;
        border: 0; border-radius: 5px;
        background: transparent; color: var(--text-muted);
        cursor: pointer; opacity: 0.55;
        transition: opacity var(--transition), background-color var(--transition), color var(--transition);
      }
      .app-tab__close svg { width: 11px; height: 11px; }
      .app-tab__close:hover { opacity: 1; background: var(--danger-soft); color: var(--danger); }
      .app-tab.is-active .app-tab__close { opacity: 0.75; }

      .app-tabs__new {
        flex: none; display: grid; place-items: center; align-self: center;
        width: 34px; height: 34px; margin: 0 6px 0 6px;
        border: 1px solid transparent; border-radius: 8px;
        background: transparent; color: var(--text-muted);
        cursor: pointer;
        transition: background-color var(--transition), color var(--transition), border-color var(--transition);
      }
      .app-tabs__new svg { width: 15px; height: 15px; }
      .app-tabs__new:hover,
      .app-tabs__new[aria-expanded="true"] {
        background: var(--surface); border-color: var(--border); color: var(--text);
      }
      .app-tabs__new:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

      .app-tabs__spacer { flex: 0 0 12px; }

      .app-tabs__bell {
        position: relative; flex: none; align-self: center;
        display: grid; place-items: center;
        width: 36px; height: 36px; margin: 0 4px;
        border: 1px solid transparent; border-radius: 9px;
        background: transparent; color: var(--text-muted);
        cursor: pointer;
        transition: background-color var(--transition), color var(--transition), border-color var(--transition);
      }
      .app-tabs__bell:hover,
      .app-tabs__bell[aria-expanded="true"] {
        background: var(--surface); border-color: var(--border); color: var(--text);
      }
      .app-tabs__bell:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      .app-tabs__bell svg { width: 17px; height: 17px; }

      .app-tabs__bell-badge {
        position: absolute; top: -2px; right: -2px;
        min-width: 16px; height: 16px; padding: 0 4px;
        border-radius: 999px; background: var(--danger); color: #fff;
        font-size: 10px; font-weight: 700; line-height: 16px; text-align: center;
        box-shadow: 0 0 0 2px var(--surface-2);
      }

      .tnav-notif {
        position: fixed; top: 0; left: 0;
        max-height: 520px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 20px 40px -12px rgba(16, 24, 40, 0.24);
        z-index: 9999;
        overflow: hidden;
        display: flex; flex-direction: column;
        animation: tnav-pop 140ms ease-out;
      }
      .tnav-notif[hidden] { display: none !important; }

      .tnav-notif__head {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; padding: 12px 14px;
        border-bottom: 1px solid var(--border);
        font-size: 13px; font-weight: 700; color: var(--text);
      }
      .tnav-notif__mark {
        border: 0; background: transparent;
        color: var(--accent); font-family: inherit;
        font-size: 11.5px; font-weight: 600;
        cursor: pointer; padding: 4px 6px; border-radius: 6px;
      }
      .tnav-notif__mark:hover { background: var(--accent-soft); }
      .tnav-notif__mark:disabled { opacity: .6; cursor: progress; }

      .tnav-notif__list { flex: 1 1 auto; overflow-y: auto; max-height: 380px; }

      .tnav-notif__item {
        display: flex; gap: 10px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--border);
        text-decoration: none; color: inherit;
        transition: background-color 140ms ease;
      }
      .tnav-notif__item:hover { background: var(--surface-2); }
      .tnav-notif__item.is-unread { background: var(--accent-soft); }
      .tnav-notif__item:last-child { border-bottom: 0; }

      .tnav-notif__dot {
        flex: none; width: 8px; height: 8px; margin-top: 5px;
        border-radius: 50%; background: var(--text-muted);
      }
      .tnav-notif__dot[data-kind="success"] { background: #10b981; }
      .tnav-notif__dot[data-kind="warn"]    { background: #f59e0b; }
      .tnav-notif__dot[data-kind="danger"]  { background: #dc2626; }
      .tnav-notif__dot[data-kind="info"]    { background: var(--accent); }

      .tnav-notif__body {
        display: flex; flex-direction: column; gap: 3px;
        min-width: 0; flex: 1 1 auto;
      }
      .tnav-notif__title {
        font-size: 13px; font-weight: 600;
        color: var(--text); line-height: 1.35;
      }
      .tnav-notif__msg {
        font-size: 12.5px; color: var(--text-soft); line-height: 1.4;
        overflow: hidden; display: -webkit-box;
        -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      }
      .tnav-notif__time {
        font-size: 11px; color: var(--text-muted); margin-top: 2px;
      }

      .tnav-notif__empty {
        display: flex; flex-direction: column; align-items: center;
        gap: 8px; padding: 40px 20px;
        color: var(--text-muted); font-size: 13px;
      }
      .tnav-notif__empty svg { width: 28px; height: 28px; color: var(--border-strong); }

      .tnav-notif__loading {
        padding: 24px 14px; text-align: center;
        font-size: 13px; color: var(--text-muted);
      }

      .tnav-notif__foot {
        padding: 10px 14px;
        border-top: 1px solid var(--border);
        background: var(--surface-2);
        text-align: center;
      }
      .tnav-notif__see-all {
        font-size: 12.5px; font-weight: 600;
        color: var(--accent); text-decoration: none;
      }
      .tnav-notif__see-all:hover { text-decoration: underline; }

      .app-tabs__search {
        position: relative; flex: 0 0 260px;
        display: flex; align-items: center; align-self: center;
        height: 36px; margin: 0 8px;
        background: var(--surface); border: 1px solid var(--border);
        border-radius: 8px;
        transition: border-color var(--transition), box-shadow var(--transition);
      }
      .app-tabs__search:focus-within {
        border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring);
      }
      .app-tabs__search .tnav-search__icon {
        position: absolute; left: 10px;
        display: grid; place-items: center; width: 14px; height: 14px;
        color: var(--text-muted); pointer-events: none;
      }
      .app-tabs__search .tnav-search__icon svg { width: 14px; height: 14px; }
      .app-tabs__search .tnav-search__input {
        width: 100%; height: 100%;
        padding: 0 28px 0 32px;
        border: 0; background: transparent;
        font-size: 12.5px; color: var(--text); outline: none;
        border-radius: 8px;
      }
      .app-tabs__search .tnav-search__input::placeholder { color: var(--text-muted); }
      .app-tabs__search .tnav-search__clear {
        position: absolute; right: 4px;
        display: none; place-items: center;
        width: 22px; height: 22px;
        border: 0; border-radius: 5px;
        background: transparent; color: var(--text-muted);
        cursor: pointer;
      }
      .app-tabs__search .tnav-search__clear:hover {
        background: var(--surface-2); color: var(--text);
      }
      .app-tabs__search .tnav-search__clear svg { width: 12px; height: 12px; }
      .app-tabs__search.has-value .tnav-search__clear { display: grid; }

      .tnav-search__results {
        position: absolute; top: calc(100% + 6px); right: 0;
        min-width: 320px; max-height: 400px; overflow-y: auto;
        padding: 6px;
        border: 1px solid var(--border); border-radius: 10px;
        background: var(--surface);
        box-shadow: 0 10px 30px -8px rgba(16, 24, 40, 0.18);
        z-index: 1000;
      }
      .tnav-search__results[hidden] { display: none !important; }
      .tnav-search__empty {
        padding: 18px 12px; text-align: center;
        font-size: 13px; color: var(--text-muted);
      }
      .tnav-search__item {
        display: flex; align-items: center; gap: 10px;
        padding: 9px 12px; border-radius: 7px;
        color: var(--text); font-size: 13.5px; font-weight: 500;
        text-decoration: none; cursor: pointer;
        transition: background-color var(--transition), color var(--transition);
      }
      .tnav-search__item svg {
        width: 16px; height: 16px; flex: none; color: var(--text-muted);
      }
      .tnav-search__item:hover,
      .tnav-search__item.is-selected {
        background: var(--accent-soft); color: var(--accent-hover);
      }
      .tnav-search__item:hover svg,
      .tnav-search__item.is-selected svg { color: var(--accent); }
      .tnav-search__module {
        margin-left: auto; padding: 2px 8px;
        border-radius: 999px; background: var(--surface-2);
        color: var(--text-muted); font-size: 11px; font-weight: 600;
        letter-spacing: 0.02em; white-space: nowrap;
      }

      .app-tabs__user { position: relative; flex: none; align-self: center; margin-left: 8px; }
      .app-tabs__user-btn {
        display: inline-flex; align-items: center; gap: 10px;
        height: 42px; padding: 0 12px 0 4px;
        border: 1px solid transparent; border-radius: 10px;
        background: transparent; color: var(--text);
        cursor: pointer; font-family: inherit;
        transition: background-color var(--transition), border-color var(--transition);
      }
      .app-tabs__user-btn:hover,
      .app-tabs__user-btn[aria-expanded="true"] {
        background: var(--surface); border-color: var(--border);
      }
      .app-tabs__user-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

      .app-tabs__user-avatar {
        display: grid; place-items: center;
        width: 32px; height: 32px; flex: none;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
        color: #ffffff; font-size: 12px; font-weight: 700;
        text-transform: uppercase; overflow: hidden;
      }
      .app-tabs__user-avatar img {
        width: 100%; height: 100%; object-fit: cover; display: block;
      }
      .app-tabs__user-info {
        display: flex; flex-direction: column; align-items: flex-start;
        line-height: 1.15; max-width: 140px; min-width: 0;
      }
      .app-tabs__user-name {
        font-size: 12.5px; font-weight: 700; color: var(--text);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
      }
      .app-tabs__user-role {
        font-size: 10.5px; color: var(--text-muted);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
      }
      .app-tabs__user-chevron {
        display: inline-flex; flex: none; width: 14px; height: 14px;
        color: var(--text-muted);
        transition: transform var(--transition);
      }
      .app-tabs__user-chevron svg { width: 14px; height: 14px; }
      .app-tabs__user-btn[aria-expanded="true"] .app-tabs__user-chevron {
        transform: rotate(180deg);
      }

      .app-tabs__user-menu {
        position: fixed; top: 0; left: 0; z-index: 9999;
        min-width: 210px; padding: 6px;
        border: 1px solid var(--border); border-radius: 12px;
        background: var(--surface);
        box-shadow: 0 12px 32px -8px rgba(16, 24, 40, 0.24);
        animation: tnav-pop 140ms ease-out;
      }
      .app-tabs__user-menu[hidden] { display: none !important; }
      .app-tabs__user-item {
        display: flex; align-items: center; gap: 10px;
        width: 100%; padding: 9px 12px;
        border: 0; border-radius: 8px;
        background: transparent; color: var(--text);
        font-size: 13px; font-weight: 500;
        text-align: left; text-decoration: none; cursor: pointer;
        font-family: inherit;
        transition: background-color var(--transition), color var(--transition);
      }
      .app-tabs__user-item svg {
        width: 16px; height: 16px; flex: none; color: var(--text-muted);
      }
      .app-tabs__user-item:hover { background: var(--surface-2); }
      .app-tabs__user-item--danger { color: var(--danger); }
      .app-tabs__user-item--danger svg { color: var(--danger); }
      .app-tabs__user-item--danger:hover { background: var(--danger-soft); }
      .app-tabs__user-sep { height: 1px; margin: 4px 6px; background: var(--border); }

      .tnav-menu {
        position: fixed; top: 0; left: 0;
        min-width: 280px; max-height: 80vh; overflow-y: auto;
        overscroll-behavior: contain;
        padding: 6px;
        border: 1px solid var(--border); border-radius: 12px;
        background: var(--surface);
        box-shadow: 0 12px 32px -8px rgba(16, 24, 40, 0.24);
        z-index: 9999;
        animation: tnav-pop 140ms ease-out;
      }
      .tnav-menu[hidden] { display: none !important; }
      @keyframes tnav-pop {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .tnav-menu__group {
        padding: 10px 12px 4px;
        font-size: 10.5px; font-weight: 700;
        letter-spacing: 0.08em; text-transform: uppercase;
        color: var(--text-muted);
      }
      .tnav-menu__item {
        display: flex; align-items: center; gap: 10px;
        width: 100%; padding: 9px 12px;
        border: 0; border-radius: 8px;
        background: transparent; color: var(--text);
        font-size: 13.5px; font-weight: 500;
        text-align: left; cursor: pointer; white-space: nowrap;
        transition: background-color var(--transition), color var(--transition);
      }
      .tnav-menu__item--indent { padding-left: 14px; }
      .tnav-menu__item:hover { background: var(--surface-2); }
      .tnav-menu__item.is-active {
        background: var(--accent-soft); color: var(--accent-hover);
      }
      .tnav-menu__item > svg {
        width: 16px; height: 16px; flex: none; color: var(--text-muted);
      }
      .tnav-menu__icon {
        display: inline-flex; flex: none; width: 16px; height: 16px;
        color: var(--text-muted);
      }
      .tnav-menu__icon svg { width: 16px; height: 16px; }
      .tnav-menu__item.is-active .tnav-menu__icon { color: var(--accent); }
      .tnav-menu__label { flex: 1 1 auto; min-width: 0; }
      .tnav-menu__dot {
        flex: none; width: 6px; height: 6px; border-radius: 50%;
        background: var(--accent); opacity: 0.7;
      }
      .tnav-menu__sep { height: 1px; margin: 6px 8px; background: var(--border); }
      .tnav-menu__item--danger { color: var(--danger); }
      .tnav-menu__item--danger:hover { background: var(--danger-soft); }
      .tnav-menu__item--danger .tnav-menu__icon svg,
      .tnav-menu__item--danger svg { color: var(--danger); }

      .perm-denied__icon {
        display: grid; place-items: center;
        width: 48px; height: 48px; margin: 0 auto 6px;
        border-radius: 12px;
        background: var(--danger-soft); color: var(--danger);
      }
      .perm-denied__icon svg { width: 22px; height: 22px; }
      .perm-denied__text {
        margin: 0; text-align: center;
        font-size: 14.5px; color: var(--text); line-height: 1.55;
      }
      .perm-denied__text strong { color: var(--text); font-weight: 700; }
      .perm-denied__hint {
        margin: 6px 0 0; text-align: center;
        font-size: 13px; color: var(--text-soft); line-height: 1.5;
      }

      [data-theme="dark"] .app-tabs { background: rgba(0, 0, 0, 0.20); }
      [data-theme="dark"] .app-tabs__search { background: rgba(255, 255, 255, 0.03); }

      @media (max-width: 1024px) {
        .app-tabs__brand-text { display: none; }
        .app-tabs__brand { padding-right: 12px; margin-right: 4px; border-right: 0; }
      }
      @media (max-width: 900px) {
        .app-tabs__search { flex: 1 1 auto; min-width: 140px; }
        .app-tabs__user-info { display: none; }
        .app-tabs__user-chevron { display: none; }
        .app-tabs__user-btn { padding: 0 4px 0 2px; height: 38px; }
      }
      @media (max-width: 720px) {
        .app-tabs { height: 52px; min-height: 52px; padding: 0 8px; gap: 4px; }
        .app-tabs__brand { display: none; }
        .app-tab { max-width: 140px; font-size: 12px; height: 32px; }
        .app-tab__label { font-size: 11.5px; }
        .app-tabs__search { flex: 0 0 130px; }
        .app-tabs__new { width: 32px; height: 32px; margin: 0 2px; }
        .app-tabs__bell { width: 32px; height: 32px; margin: 0 2px; }
      }
    `;

    const style = document.createElement('style');
    style.id = 'devhub-topnav-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  NAV.styles = { inject: injectStyles };
})();