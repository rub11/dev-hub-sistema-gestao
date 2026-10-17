/* =========================================================
   DEV HUB · Gestão · helpers
   ========================================================= */
(function () {
  'use strict';
  const Gestao = window.Gestao;
  if (!Gestao) {
    console.error('[gestao] window.Gestao não encontrado. Verifique a ordem dos scripts.');
    return;
  }

  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  function confirmDialog(message, options) {
    if (window.UI && typeof window.UI.confirm === 'function') {
      return window.UI.confirm(message, options || {});
    }
    try { return Promise.resolve(window.confirm(message)); }
    catch (e) { return Promise.resolve(false); }
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  }

  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return dateFormatter.format(d);
  }

  function createCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }

  function roleLabel(roleKey) {
    if (window.DHRoles) return window.DHRoles.label(roleKey) || 'Funcionário';
    if (roleKey === 'admin') return 'Administrador';
    if (roleKey === 'gestor') return 'Gestor';
    if (roleKey === 'leader') return 'Líder';
    return 'Funcionário';
  }

  /* ---------------------------------------------------------
     Toast — delega para o módulo global (js/core/toast.js).
     Mantidas as funções para compatibilidade de API.
     --------------------------------------------------------- */
  function showToast(message, type) {
    if (window.Toast && typeof window.Toast.show === 'function') {
      return window.Toast.show(message, type);
    }
    console.warn('[gestao] Toast global indisponível:', message);
  }

  function dismissToast(toast) {
    if (window.Toast && typeof window.Toast.dismiss === 'function') {
      return window.Toast.dismiss(toast);
    }
    if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
  }

  Gestao.utils = {
    dateFormatter, confirmDialog, setText, setInputValue,
    formatDate, createCell, roleLabel, showToast, dismissToast
  };
})();
