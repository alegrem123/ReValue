(function () {
  let currentPage = 1;
  let currentSearch = '';
  let currentStato = '';
  let pendingAction = null;
  let confirmModal = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function statusBadge(user) {
    if (user.bannato) return '<span class="badge text-bg-danger">Bannato</span>';
    if (user.isSospeso) return '<span class="badge text-bg-warning">Sospeso</span>';
    return '<span class="badge text-bg-success">Attivo</span>';
  }

  function actionButtons(user) {
    const id = escapeAttr(user._id);
    const email = escapeAttr(user.email || '');

    if (user.bannato || user.isSospeso) {
      return `
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-outline-success" data-user-action="riabilita" data-user-id="${id}" data-user-email="${email}">
            Riabilita
          </button>
          ${!user.bannato ? `
          <button class="btn btn-outline-danger" data-user-action="ban" data-user-id="${id}" data-user-email="${email}">
            Banna
          </button>` : ''}
        </div>`;
    }

    return `
      <div class="btn-group btn-group-sm" role="group">
        <button class="btn btn-outline-warning" data-user-action="sospendi" data-user-id="${id}" data-user-email="${email}">
          Sospendi
        </button>
        <button class="btn btn-outline-danger" data-user-action="ban" data-user-id="${id}" data-user-email="${email}">
          Banna
        </button>
      </div>`;
  }

  function renderUsers(data) {
    const tbody = document.getElementById('users-table-body');
    const users = data.users || [];
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Nessun utente trovato.</td></tr>';
    } else {
      tbody.innerHTML = users.map((user) => `
        <tr>
          <td>${escapeHtml(`${user.nome || ''} ${user.cognome || ''}`.trim())}</td>
          <td>${escapeHtml(user.email)}</td>
          <td>${statusBadge(user)}</td>
          <td>${user.malusCount ?? 0}</td>
          <td class="text-end">${actionButtons(user)}</td>
        </tr>`).join('');
    }

    const pagination = data.pagination || { page: 1, pages: 1, total: users.length };
    document.getElementById('users-pagination').innerHTML = `
      <span class="text-muted small">Pagina ${pagination.page} di ${pagination.pages} - ${pagination.total} utenti</span>
      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-secondary" id="users-prev" ${pagination.page <= 1 ? 'disabled' : ''}>Precedente</button>
        <button class="btn btn-outline-secondary" id="users-next" ${pagination.page >= pagination.pages ? 'disabled' : ''}>Successiva</button>
      </div>`;

    document.getElementById('users-prev')?.addEventListener('click', () => loadUsers(currentPage - 1));
    document.getElementById('users-next')?.addEventListener('click', () => loadUsers(currentPage + 1));
    tbody.querySelectorAll('[data-user-action]').forEach((button) => {
      button.addEventListener('click', () => openConfirm(button));
    });
  }

  async function loadUsers(page = 1) {
    currentPage = Math.max(1, page);
    const params = new URLSearchParams({
      page: currentPage,
      limit: 20,
      ...(currentSearch ? { search: currentSearch } : {}),
      ...(currentStato ? { stato: currentStato } : {}),
    });

    const res = await window.revalueAdmin.adminRequest(`/admin/users?${params.toString()}`);
    if (!res.ok) {
      window.revalueAdmin.showAdminAlert(res.error || 'Impossibile caricare gli utenti.');
      return;
    }
    renderUsers(res.data);
  }

  function openConfirm(button) {
    pendingAction = {
      action: button.dataset.userAction,
      id: button.dataset.userId,
      email: button.dataset.userEmail,
    };

    const labels = {
      sospendi: 'sospendere',
      ban: 'bannare',
      riabilita: 'riabilitare',
    };
    document.getElementById('confirm-user-title').textContent = 'Conferma azione utente';
    document.getElementById('confirm-user-body').textContent = `Vuoi ${labels[pendingAction.action]} ${pendingAction.email}?`;
    confirmModal.show();
  }

  async function runPendingAction() {
    if (!pendingAction) return;

    const endpoint = `/admin/utenti/${pendingAction.id}/${pendingAction.action}`;
    const res = await window.revalueAdmin.adminRequest(endpoint, { method: 'POST' });
    if (!res.ok) {
      window.revalueAdmin.showAdminAlert(res.error || 'Azione non riuscita.');
    } else {
      window.revalueAdmin.showAdminAlert(res.data?.message || 'Azione completata.', 'success');
      await loadUsers(currentPage);
    }
    pendingAction = null;
    confirmModal.hide();
  }

  document.addEventListener('DOMContentLoaded', () => {
    confirmModal = new bootstrap.Modal(document.getElementById('confirm-user-modal'));
    document.getElementById('confirm-user-action')?.addEventListener('click', runPendingAction);
    document.getElementById('users-search-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      currentSearch = document.getElementById('users-search').value.trim();
      currentStato = document.getElementById('users-stato-filter').value;
      loadUsers(1);
    });
    document.getElementById('users-stato-filter')?.addEventListener('change', (event) => {
      currentSearch = document.getElementById('users-search').value.trim();
      currentStato = event.target.value;
      loadUsers(1);
    });
    loadUsers();
  });
})();
