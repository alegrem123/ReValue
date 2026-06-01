(function () {
  const body = () => document.getElementById('admin-users-body');
  const search = () => document.getElementById('admin-users-search');
  const alertBox = () => document.getElementById('admin-users-alert');

  function statusBadges(user) {
    if (user.bannato) return '<span class="badge bg-danger">Bannato</span>';
    if (user.isSospeso) return '<span class="badge bg-warning text-dark">Sospeso</span>';
    if (user.ruolo === 'admin') return '<span class="badge bg-dark">Admin</span>';
    return '<span class="badge bg-success">Attivo</span>';
  }

  function row(user) {
    const id = user._id || user.id;
    const disabled = user.ruolo === 'admin' ? 'disabled' : '';
    return `
      <tr>
        <td>
          <div class="fw-semibold">${AdminApi.escapeHtml(user.nome)} ${AdminApi.escapeHtml(user.cognome)}</div>
          <div class="small text-muted">${AdminApi.escapeHtml(user.email)}</div>
        </td>
        <td>${statusBadges(user)}</td>
        <td>${AdminApi.escapeHtml(user.malusCount ?? 0)}</td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-warning" data-action="sospendi" data-id="${id}" ${disabled}>Sospendi</button>
            <button class="btn btn-outline-danger" data-action="ban" data-id="${id}" ${disabled}>Banna</button>
            <button class="btn btn-outline-success" data-action="riabilita" data-id="${id}" ${disabled}>Riabilita</button>
          </div>
        </td>
      </tr>`;
  }

  async function load() {
    const q = encodeURIComponent(search().value.trim());
    const res = await AdminApi.get(`/api/v1/admin/utenti?limit=50${q ? `&q=${q}` : ''}`);
    if (!res.ok) {
      alertBox().className = 'alert alert-danger';
      alertBox().textContent = res.error || 'Errore caricamento utenti';
      alertBox().classList.remove('d-none');
      return;
    }
    alertBox().classList.add('d-none');
    const users = res.data?.utenti ?? [];
    body().innerHTML = users.length ? users.map(row).join('') : '<tr><td colspan="4" class="text-muted">Nessun utente trovato.</td></tr>';
  }

  async function action(event) {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const label = btn.dataset.action;
    if (!confirm(`Confermi azione "${label}" sull'utente selezionato?`)) return;
    const res = await AdminApi.post(`/api/v1/admin/utenti/${btn.dataset.id}/${label}`);
    if (!res.ok) {
      AdminApi.toast(res.error || 'Azione fallita', 'danger');
      return;
    }
    AdminApi.toast(res.data?.message || 'Azione completata');
    load();
  }

  function init() {
    document.getElementById('admin-users-refresh').addEventListener('click', load);
    search().addEventListener('keydown', (event) => {
      if (event.key === 'Enter') load();
    });
    body().addEventListener('click', action);
    load();
  }

  window.AdminUsers = { init, load };
})();
