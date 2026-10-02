/* =========================================================
   DEV HUB · Navegação · sino + realtime
   ========================================================= */
(function () {
  'use strict';
  const NAV = window.NAV;

  function setupNotifications() {
    const btn   = document.getElementById('app-tabs-bell');
    const badge = document.getElementById('app-tabs-bell-badge');
    if (!btn) return;

    let menu = null;
    let unread = 0;
    let readColumn = null;

    function navToast(msg, kind) {
      try {
        if (window.Toast && typeof window.Toast.show === 'function') {
          return window.Toast.show(msg, kind);
        }
      } catch (_) { /* ignora */ }

      const el = document.createElement('div');
      const isErr = kind === 'error';
      el.style.cssText =
        'position:fixed;top:80px;right:20px;z-index:99999;max-width:360px;' +
        'padding:12px 16px;border-radius:10px;font-size:13.5px;font-family:inherit;' +
        'box-shadow:0 12px 32px -8px rgba(16,24,40,.24);' +
        'background:' + (isErr ? 'var(--danger-soft, #fef3f2)' : 'var(--accent-soft, #eef2ff)') + ';' +
        'color:' + (isErr ? 'var(--danger, #b42318)' : 'var(--accent-hover, #4338ca)') + ';' +
        'border:1px solid ' + (isErr ? 'var(--danger-border, #fecdca)' : 'transparent') + ';';
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4200);
    }

    function renderBadge() {
      if (!badge) return;
      if (unread > 0) {
        badge.hidden = false;
        badge.textContent = unread > 99 ? '99+' : String(unread);
      } else {
        badge.hidden = true;
      }
    }

    async function detectReadColumn() {
      if (readColumn) return readColumn;

      const candidates = ['read_at', 'is_read', 'lida', 'read', 'readed'];
      for (const col of candidates) {
        try {
          const { error } = await window.db
            .from('notifications')
            .select('id, ' + col)
            .limit(1);
          if (!error) {
            readColumn = col;
            console.log('[nav] Coluna de status detectada:', col);
            return col;
          }
        } catch (_) { /* tenta próximo */ }
      }

      readColumn = 'read_at';
      console.warn('[nav] Nenhuma coluna de status reconhecida. Usando "read_at" como padrão.');
      return readColumn;
    }

    async function loadCount() {
      if (!window.db) return;

      try {
        const { data, error } = await window.db.rpc('get_unread_notification_count');
        if (!error && typeof data === 'number') {
          unread = data;
          renderBadge();
          return;
        }
      } catch (_) { /* fallback */ }

      try {
        const col = await detectReadColumn();
        const isBool = col === 'is_read' || col === 'lida' || col === 'read' || col === 'readed';

        const query = window.db
          .from('notifications')
          .select('id', { count: 'exact', head: true });

        const { count, error } = isBool
          ? await query.or(`${col}.is.null,${col}.eq.false`)
          : await query.is(col, null);

        if (!error) {
          unread = count || 0;
          renderBadge();
        }
      } catch (e) {
        console.warn('[nav] loadCount fallback falhou:', e);
      }
    }

    async function loadLatest() {
      if (!window.db) return [];
      try {
        const col = await detectReadColumn();
        const { data, error } = await window.db
          .from('notifications')
          .select('id, title, message, kind, entity_type, entity_id, link, ' + col + ', created_at')
          .order('created_at', { ascending: false })
          .limit(8);

        if (error) throw error;

        return (data || []).map(function (n) {
          const raw = n[col];
          const isRead = col === 'read_at' ? !!raw : (raw === true);
          return Object.assign({}, n, { __read: isRead });
        });
      } catch (e) {
        console.warn('[nav] loadLatest:', e);
        return [];
      }
    }

    function escapeHtml(s) {
      return String(s || '').replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
    }

    function formatRelative(iso) {
      if (!iso) return '';
      const diff = (Date.now() - new Date(iso).getTime()) / 1000;
      if (diff < 60)     return 'agora';
      if (diff < 3600)   return Math.floor(diff / 60) + ' min';
      if (diff < 86400)  return Math.floor(diff / 3600) + ' h';
      if (diff < 604800) return Math.floor(diff / 86400) + ' d';
      return new Date(iso).toLocaleDateString('pt-BR');
    }

    function resolveNotifLink(n) {
      if (n.link && n.link !== '#') return n.link;

      const type = String(n.entity_type || '').toLowerCase();
      const id   = n.entity_id;

      switch (type) {
        case 'product':        return id ? ('produtos.html?id=' + encodeURIComponent(id)) : 'produtos.html';
        case 'stock_movement': return 'estoque.html';
        case 'purchase':
          if (String(n.title || '').toLowerCase().indexOf('aprov') !== -1) return 'aprovacoes.html';
          return id ? ('compras.html?id=' + encodeURIComponent(id)) : 'compras.html';
        case 'sale':     return id ? ('vendas.html?id=' + encodeURIComponent(id)) : 'vendas.html';
        case 'customer': return id ? ('parceiros.html?id=' + encodeURIComponent(id)) : 'parceiros.html';
        case 'supplier': return 'parceiros.html?kind=supplier';
        case 'financial_entry':
        case 'finance':
        case 'financial_movement':
        case 'financial_account':
        case 'financial_transfer':
          return 'financeiro.html';
        default: return '#';
      }
    }

    async function markAllAsRead() {
      const now = new Date().toISOString();
      const col = await detectReadColumn();

      try {
        const { error } = await window.db.rpc('mark_all_notifications_read');
        if (!error) {
          console.log('[nav] mark-all via RPC: OK');
          return { method: 'rpc' };
        }
        console.warn('[nav] RPC mark_all indisponível:', error.message);
      } catch (rpcErr) {
        console.warn('[nav] RPC mark_all indisponível:', rpcErr.message || rpcErr);
      }

      const isBool = col === 'is_read' || col === 'lida' || col === 'read' || col === 'readed';
      const patch = {};
      patch[col] = isBool ? true : now;

      const query = window.db.from('notifications').update(patch);

      const { data, error } = isBool
        ? await query.or(`${col}.is.null,${col}.eq.false`).select('id')
        : await query.is(col, null).select('id');

      if (error) {
        console.error('[nav] UPDATE falhou:', error);
        throw new Error('Falha no UPDATE: ' + error.message);
      }

      const updated = (data || []).length;
      console.log('[nav] mark-all via UPDATE —', updated, 'linhas afetadas (coluna:', col + ')');

      if (updated === 0) {
        const checkQuery = window.db
          .from('notifications')
          .select('id', { count: 'exact', head: true });

        const { count: pendingCount, error: checkErr } = isBool
          ? await checkQuery.or(`${col}.is.null,${col}.eq.false`)
          : await checkQuery.is(col, null);

        if (!checkErr && pendingCount > 0) {
          throw new Error(
            `RLS bloqueou o UPDATE. ${pendingCount} notificações pendentes no banco mas 0 foram atualizadas.`
          );
        }
      }

      return { method: 'update', column: col, updated };
    }

    function buildMenu() {
      const el = document.createElement('div');
      el.className = 'tnav-notif';
      el.setAttribute('role', 'menu');
      el.hidden = true;

      el.innerHTML = `
        <header class="tnav-notif__head">
          <span>Notificações</span>
          <button type="button" class="tnav-notif__mark" data-action="mark-all">
            Marcar todas como lidas
          </button>
        </header>
        <div class="tnav-notif__list" id="tnav-notif-list">
          <div class="tnav-notif__loading">Carregando...</div>
        </div>
        <footer class="tnav-notif__foot">
          <a href="aprovacoes.html" class="tnav-notif__see-all">
            Ver aprovações pendentes
          </a>
        </footer>
      `;

      document.addEventListener('click', function (e) {
        if (el.hidden) return;
        if (el.contains(e.target) || btn.contains(e.target)) return;
        closeMenu();
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !el.hidden) closeMenu();
      });

      el.addEventListener('click', async function (e) {
        const markAll = e.target.closest('[data-action="mark-all"]');
        if (!markAll) return;
        e.preventDefault();
        if (markAll.disabled) return;

        markAll.disabled = true;
        const originalLabel = markAll.textContent;
        markAll.textContent = 'Marcando…';

        try {
          const result = await markAllAsRead();
          unread = 0;
          renderBadge();

          const rows = await loadLatest();
          renderList(el, rows);
          await loadCount();

          if (result.method === 'rpc') {
            navToast('Notificações marcadas como lidas.', 'success');
          } else {
            navToast(`Notificações marcadas como lidas (${result.updated} atualizadas).`, 'success');
          }
        } catch (err) {
          console.error('[nav] mark-all falhou:', err);
          navToast('Não foi possível marcar como lidas: ' + (err.message || 'erro'), 'error');
          try {
            const rows = await loadLatest();
            renderList(el, rows);
            await loadCount();
          } catch (_) { /* ignora */ }
        } finally {
          markAll.disabled = false;
          markAll.textContent = originalLabel;
        }
      });

      return el;
    }

    function positionNotifMenu(m, anchor) {
      const rect = anchor.getBoundingClientRect();
      const margin = 8, gap = 6;
      const w = Math.min(380, window.innerWidth - 16);

      let left = rect.right - w;
      if (left < margin) left = margin;

      let top = rect.bottom + gap;
      const h = m.offsetHeight || 400;
      if (top + h > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - h - margin);
      }

      m.style.top = top + 'px';
      m.style.left = left + 'px';
      m.style.width = w + 'px';
    }

    function renderList(m, rows) {
      const list = m.querySelector('#tnav-notif-list');
      if (!list) return;

      if (!rows || rows.length === 0) {
        list.innerHTML = `
          <div class="tnav-notif__empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>
            <span>Nenhuma notificação nova</span>
          </div>`;
        return;
      }

      list.innerHTML = rows.map(function (n) {
        const href = resolveNotifLink(n);
        return `
          <a class="tnav-notif__item ${n.__read ? '' : 'is-unread'}"
             href="${href}"
             data-id="${n.id}">
            <span class="tnav-notif__dot" data-kind="${n.kind || 'info'}"></span>
            <span class="tnav-notif__body">
              <strong class="tnav-notif__title">${escapeHtml(n.title || 'Notificação')}</strong>
              ${n.message ? `<span class="tnav-notif__msg">${escapeHtml(n.message)}</span>` : ''}
              <span class="tnav-notif__time">${formatRelative(n.created_at)}</span>
            </span>
          </a>
        `;
      }).join('');

      list.querySelectorAll('.tnav-notif__item').forEach(function (item) {
        item.addEventListener('click', async function (e) {
          const id = item.dataset.id;
          if (!id) return;

          if (item.classList.contains('is-unread')) {
            try {
              const col = await detectReadColumn();
              const isBool = col === 'is_read' || col === 'lida' || col === 'read' || col === 'readed';
              const patch = {};
              patch[col] = isBool ? true : new Date().toISOString();

              let ok = false;
              try {
                const { error } = await window.db.rpc('mark_notification_read', { p_id: id });
                if (!error) ok = true;
              } catch (_) { /* fallback */ }

              if (!ok) {
                await window.db.from('notifications').update(patch).eq('id', id);
              }

              item.classList.remove('is-unread');
              unread = Math.max(0, unread - 1);
              renderBadge();
            } catch (err) {
              console.warn('[nav] mark-notif:', err);
            }
          }

          if (item.getAttribute('href') === '#') {
            e.preventDefault();
            return;
          }

          setTimeout(closeMenu, 100);
        });
      });
    }

    async function openMenu() {
      if (!menu) {
        menu = buildMenu();
        document.body.appendChild(menu);
      }
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      positionNotifMenu(menu, btn);

      const rows = await loadLatest();
      renderList(menu, rows);
      positionNotifMenu(menu, btn);
    }

    function closeMenu() {
      if (menu) menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu && !menu.hidden ? closeMenu() : openMenu();
    });

    window.addEventListener('resize', function () {
      if (menu && !menu.hidden) positionNotifMenu(menu, btn);
    });
    window.addEventListener('scroll', function () {
      if (menu && !menu.hidden) positionNotifMenu(menu, btn);
    }, true);

    loadCount();

    try {
      if (window.db && window.db.channel) {
        window.db
          .channel('notifications-nav')
          .on('postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'notifications' },
              function () {
                loadCount();
                if (menu && !menu.hidden) {
                  loadLatest().then(function (rows) { renderList(menu, rows); });
                }
              })
          .on('postgres_changes',
              { event: 'UPDATE', schema: 'public', table: 'notifications' },
              function () { loadCount(); })
          .subscribe();
      }
    } catch (e) {
      console.warn('[nav] realtime indisponível:', e);
    }
  }

  NAV.notifications = { setup: setupNotifications };
})();