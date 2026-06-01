(function () {
  let currentPage = 1;
  let currentSearch = '';
  let pendingAction = null;
  let confirmModal = null;

  function statusBadge(user) {
    if (user.bannato) return '<span class="badge text-bg-danger">Bannato</span>';
    if (user.isSospeso) return '<span class="badge text-bg-warning">Sospeso</span>';
    return '<span class="badge text-bg-success">Attivo</span>';
  }

  function actionButtons(user) {
    return `
      <div class="btn-group btn-group-sm" role="group">
        <button class="btn btn-outline-warning" data-user-action="sospendi" data-user-id="${user._id}" data-user-email="${user.email}">
          Sospendi
        </button>
        <button class="btn btn-outline-danger" data-user-action="ban" data-user-id="${user._id}" data-user-email="${user.email}">
          Banna
        </button>
        <button class="btn btn-outline-success" data-user-action="riabilita" data-user-id="${user._id}" data-user-email="${user.email}">
          Riabilita
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
          <td>${user.nome || ''} ${user.cognome || ''}</td>
          <td>${user.email}</td>
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
      loadUsers(1);
    });
    loadUsers();
  });
})();
