(function () {
  'use strict';
  const DH = window.DH;
  const state = DH.state;

  DH.perms = {
    has(cap, fallback) {
      if (window.Perms && typeof window.Perms.has === 'function') return window.Perms.has(cap);
      return fallback !== false;
    },
    applyToUI() {
      if (!state.perms.create) {
        const newBtn = document.getElementById('new-sale-btn');
        const emptyBtn = document.getElementById('empty-new-btn');
        if (newBtn) newBtn.hidden = true;
        if (emptyBtn) emptyBtn.hidden = true;
      }
    }
  };

  DH.session = {
    watchAuthChanges() {
      window.db.auth.onAuthStateChange(event => {
        if (event === 'SIGNED_OUT' && !window.Auth.isSigningOut()) {
          window.location.replace('index.html?expired=1');
        }
      });
    },
    renderUser(user, profile) {
      const meta = user.user_metadata || {};
      const fullName = (profile && profile.name) || meta.name || meta.full_name ||
        (user.email ? user.email.split('@')[0] : '') || 'Usuário';
      const roleText = window.Auth.roleLabel((profile && profile.role) || meta.role || '');
      const firstName = String(fullName).trim().split(/\s+/)[0] || 'Usuário';
      const initial = firstName.charAt(0).toUpperCase() || '?';

      DH.utils.setText('user-avatar', initial);
      DH.utils.setText('user-name', fullName);
      DH.utils.setText('user-role', roleText || user.email || '');
      DH.utils.setText('greeting-name', 'Olá, ' + firstName);

      const roleBadge = document.getElementById('greeting-role');
      if (roleBadge) {
        if (roleText) { roleBadge.textContent = roleText; roleBadge.hidden = false; }
        else roleBadge.hidden = true;
      }
    },
    setupUserMenu() {
      const trigger = document.getElementById('user-menu-trigger');
      const panel = document.getElementById('user-menu-panel');
      if (!trigger || !panel) return;

      const open = () => {
        panel.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        const first = panel.querySelector('.menu-item:not([aria-disabled="true"])');
        if (first) first.focus();
      };
      const close = () => {
        panel.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      };

      trigger.addEventListener('click', e => {
        e.stopPropagation();
        panel.hidden ? open() : close();
      });
      document.addEventListener('click', e => {
        if (panel.hidden) return;
        if (panel.contains(e.target) || trigger.contains(e.target)) return;
        close();
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !panel.hidden) { close(); trigger.focus(); }
      });
    },
    setupLogout() {
      document.querySelectorAll('[data-action="logout"]').forEach(button => {
        button.addEventListener('click', async () => {
          if (button.disabled) return;
          button.disabled = true;
          button.setAttribute('aria-busy', 'true');
          await window.Auth.signOut();
        });
      });
    }
  };
})();