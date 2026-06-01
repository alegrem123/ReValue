(function () {
  const body = () => document.getElementById('admin-reports-body');
  const alertBox = () => document.getElementById('admin-reports-alert');

  function userLabel(user) {
    if (!user) return 'n/d';
    return user.email || `${user.nome || ''} ${user.cognome || ''}`.trim();
  }

  function row(report) {
    return `
      <tr>
        <td>
          <div class="fw-semibold">${AdminApi.escapeHtml(report.tipo)}</div>
          <div class="small text-muted">${AdminApi.escapeHtml(report.motivo)}</div>
        </td>
        <td>
          <div><span class="text-muted">Da:</span> ${AdminApi.escapeHtml(userLabel(report.segnalante))}</div>
          <div><span class="text-muted">A:</span> ${AdminApi.escapeHtml(userLabel(report.segnalato))}</div>
        </td>
        <td><span class="badge bg-${report.stato === 'IN_ATTESA' ? 'warning text-dark' : 'success'}">${AdminApi.escapeHtml(report.stato)}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-warning" data-action="malus" data-id="${report._id}" ${report.stato !== 'IN_ATTESA' ? 'disabled' : ''}>
            Applica malus
          </button>
        </td>
      </tr>`;
  }

  async function load() {
    const res = await AdminApi.get('/api/v1/admin/segnalazioni');
    if (!res.ok) {
      alertBox().className = 'alert alert-danger';
      alertBox().textContent = res.error || 'Errore caricamento segnalazioni';
      alertBox().classList.remove('d-none');
      return;
    }
    alertBox().classList.add('d-none');
    const reports = Array.isArray(res.data) ? res.data : res.data?.segnalazioni ?? [];
    body().innerHTML = reports.length ? reports.map(row).join('') : '<tr><td colspan="4" class="text-muted">Nessuna segnalazione.</td></tr>';
  }

  async function action(event) {
    const btn = event.target.closest('button[data-action="malus"]');
    if (!btn) return;
    if (!confirm('Applicare un malus al segnalato e chiudere la segnalazione?')) return;
    const res = await AdminApi.post(`/api/v1/admin/segnalazioni/${btn.dataset.id}/malus`);
    if (!res.ok) return AdminApi.toast(res.error || 'Azione fallita', 'danger');
    AdminApi.toast(res.data?.message || 'Malus applicato');
    load();
  }

  function init() {
    document.getElementById('admin-reports-refresh').addEventListener('click', load);
    body().addEventListener('click', action);
    load();
  }

  window.AdminSegnalazioni = { init, load };
})();
