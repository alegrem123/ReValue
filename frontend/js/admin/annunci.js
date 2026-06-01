(function () {
  const body = () => document.getElementById('admin-annunci-body');
  const search = () => document.getElementById('admin-annunci-search');
  const alertBox = () => document.getElementById('admin-annunci-alert');
  const stati = ['DISPONIBILE', 'PRENOTATO', 'CEDUTO', 'SCADUTO'];

  function row(annuncio) {
    const donor = annuncio.donatore || {};
    return `
      <tr>
        <td>
          <div class="fw-semibold">${AdminApi.escapeHtml(annuncio.titolo)}</div>
          <div class="small text-muted">${AdminApi.escapeHtml(annuncio.oggetto?.categoria || '')}</div>
        </td>
        <td>${AdminApi.escapeHtml(donor.email || `${donor.nome || ''} ${donor.cognome || ''}`)}</td>
        <td><span class="badge bg-secondary">${AdminApi.escapeHtml(annuncio.stato)}</span></td>
        <td>
          <div class="d-flex gap-2">
            <select class="form-select form-select-sm" data-id="${annuncio._id}">
              ${stati.map((s) => `<option value="${s}" ${s === annuncio.stato ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <button class="btn btn-sm btn-outline-success" data-action="forza" data-id="${annuncio._id}">Forza</button>
            <button class="btn btn-sm btn-outline-danger" data-action="remove" data-id="${annuncio._id}">Rimuovi</button>
          </div>
        </td>
      </tr>`;
  }

  async function load() {
    const q = encodeURIComponent(search().value.trim());
    const res = await AdminApi.get(`/api/v1/admin/annunci?limit=50${q ? `&q=${q}` : ''}`);
    if (!res.ok) {
      alertBox().className = 'alert alert-danger';
      alertBox().textContent = res.error || 'Errore caricamento annunci';
      alertBox().classList.remove('d-none');
      return;
    }
    alertBox().classList.add('d-none');
    const annunci = res.data?.annunci ?? [];
    body().innerHTML = annunci.length ? annunci.map(row).join('') : '<tr><td colspan="4" class="text-muted">Nessun annuncio trovato.</td></tr>';
  }

  async function action(event) {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'remove') {
      if (!confirm('Rimuovere questo annuncio?')) return;
      const res = await AdminApi.delete(`/api/v1/admin/annunci/${btn.dataset.id}`);
      if (!res.ok) return AdminApi.toast(res.error || 'Rimozione fallita', 'danger');
      AdminApi.toast('Annuncio rimosso');
      load();
      return;
    }

    const select = body().querySelector(`select[data-id="${btn.dataset.id}"]`);
    const res = await AdminApi.patch(`/api/v1/admin/annunci/${btn.dataset.id}/forza`, { stato: select?.value });
    if (!res.ok) return AdminApi.toast(res.error || 'Aggiornamento fallito', 'danger');
    AdminApi.toast(res.data?.message || 'Annuncio aggiornato');
    load();
  }

  function init() {
    document.getElementById('admin-annunci-refresh').addEventListener('click', load);
    search().addEventListener('keydown', (event) => {
      if (event.key === 'Enter') load();
    });
    body().addEventListener('click', action);
    load();
  }

  window.AdminAnnunci = { init, load };
})();
