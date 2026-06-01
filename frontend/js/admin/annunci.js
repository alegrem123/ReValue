(function () {
  const STATI_FORZABILI = ['DISPONIBILE', 'SCADUTO', 'RITIRATO'];
  let currentPage = 1;
  let currentStato = '';
  let pendingRemove = null;
  let confirmModal = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('it-IT');
  }

  function statoBadge(stato) {
    const variants = {
      DISPONIBILE: 'success',
      PRENOTATO: 'primary',
      SCADUTO: 'secondary',
      RITIRATO: 'dark',
    };
    return `<span class="badge text-bg-${variants[stato] || 'secondary'}">${escapeHtml(stato)}</span>`;
  }

  function activeBadge(annuncio) {
    return annuncio.isAttivo
      ? '<span class="badge text-bg-success">Si</span>'
      : '<span class="badge text-bg-secondary">No</span>';
  }

  function forceSelect(annuncio) {
    const options = STATI_FORZABILI.map((stato) => `
      <option value="${stato}" ${annuncio.stato === stato ? 'selected' : ''}>${stato}</option>
    `).join('');

    return `
      <div class="input-group input-group-sm">
        <select class="form-select" data-annuncio-status="${annuncio._id}">
          ${options}
        </select>
        <button class="btn btn-outline-success" data-annuncio-action="forza" data-annuncio-id="${annuncio._id}" data-annuncio-title="${escapeHtml(annuncio.titolo)}">
          Forza
        </button>
      </div>`;
  }

  function actionButtons(annuncio) {
    return `
      <div class="d-flex flex-column flex-lg-row justify-content-end gap-2">
        ${forceSelect(annuncio)}
        <button class="btn btn-outline-danger btn-sm" data-annuncio-action="rimuovi" data-annuncio-id="${annuncio._id}" data-annuncio-title="${escapeHtml(annuncio.titolo)}">
          Rimuovi
        </button>
      </div>`;
  }

  function renderAnnunci(data) {
    const tbody = document.getElementById('annunci-table-body');
    const annunci = data.annunci || [];
    if (!annunci.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Nessun annuncio trovato.</td></tr>';
    } else {
      tbody.innerHTML = annunci.map((annuncio) => {
        const donor = annuncio.donatore || {};
        return `
          <tr>
            <td>
              <div class="fw-semibold">${escapeHtml(annuncio.titolo)}</div>
              <div class="text-muted small">${escapeHtml(annuncio.oggetto?.categoria || '-')}</div>
            </td>
            <td>
              <div>${escapeHtml(`${donor.nome || ''} ${donor.cognome || ''}`.trim() || '-')}</div>
              <div class="text-muted small">${escapeHtml(donor.email || '-')}</div>
            </td>
            <td>${statoBadge(annuncio.stato)}</td>
            <td>${formatDate(annuncio.dataScadenza)}</td>
            <td>${activeBadge(annuncio)}</td>
            <td class="text-end">${actionButtons(annuncio)}</td>
          </tr>`;
      }).join('');
    }

    const pagination = data.pagination || { page: 1, pages: 1, total: annunci.length };
    document.getElementById('annunci-pagination').innerHTML = `
      <span class="text-muted small">Pagina ${pagination.page} di ${pagination.pages} - ${pagination.total} annunci</span>
      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-secondary" id="annunci-prev" ${pagination.page <= 1 ? 'disabled' : ''}>Precedente</button>
        <button class="btn btn-outline-secondary" id="annunci-next" ${pagination.page >= pagination.pages ? 'disabled' : ''}>Successiva</button>
      </div>`;

    document.getElementById('annunci-prev')?.addEventListener('click', () => loadAnnunci(currentPage - 1));
    document.getElementById('annunci-next')?.addEventListener('click', () => loadAnnunci(currentPage + 1));
    tbody.querySelectorAll('[data-annuncio-action="forza"]').forEach((button) => {
      button.addEventListener('click', () => forceStatus(button));
    });
    tbody.querySelectorAll('[data-annuncio-action="rimuovi"]').forEach((button) => {
      button.addEventListener('click', () => openRemoveConfirm(button));
    });
  }

  async function loadAnnunci(page = 1) {
    currentPage = Math.max(1, page);
    const params = new URLSearchParams({
      page: currentPage,
      limit: 20,
      ...(currentStato ? { stato: currentStato } : {}),
    });

    const res = await window.revalueAdmin.adminRequest(`/admin/annunci?${params.toString()}`);
    if (!res.ok) {
      window.revalueAdmin.showAdminAlert(res.error || 'Impossibile caricare gli annunci.');
      return;
    }
    renderAnnunci(res.data);
  }

  async function forceStatus(button) {
    const id = button.dataset.annuncioId;
    const select = document.querySelector(`[data-annuncio-status="${id}"]`);
    const stato = select?.value;
    if (!stato) return;

    const res = await window.revalueAdmin.adminRequest(`/admin/annunci/${id}/forza`, {
      method: 'PATCH',
      body: { stato },
    });
    if (!res.ok) {
      window.revalueAdmin.showAdminAlert(res.error || 'Impossibile forzare lo stato.');
      return;
    }
    window.revalueAdmin.showAdminAlert(res.data?.message || 'Stato aggiornato.', 'success');
    await loadAnnunci(currentPage);
  }

  function openRemoveConfirm(button) {
    pendingRemove = {
      id: button.dataset.annuncioId,
      title: button.dataset.annuncioTitle,
    };

    document.getElementById('confirm-annuncio-title').textContent = 'Conferma rimozione annuncio';
    document.getElementById('confirm-annuncio-body').textContent = `Vuoi rimuovere "${pendingRemove.title}"?`;
    confirmModal.show();
  }

  async function removePendingAnnuncio() {
    if (!pendingRemove) return;

    const res = await window.revalueAdmin.adminRequest(`/admin/annunci/${pendingRemove.id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      window.revalueAdmin.showAdminAlert(res.error || 'Rimozione non riuscita.');
    } else {
      window.revalueAdmin.showAdminAlert(res.data?.message || 'Annuncio rimosso.', 'success');
      await loadAnnunci(currentPage);
    }
    pendingRemove = null;
    confirmModal.hide();
  }

  document.addEventListener('DOMContentLoaded', () => {
    confirmModal = new bootstrap.Modal(document.getElementById('confirm-annuncio-modal'));
    document.getElementById('confirm-annuncio-action')?.addEventListener('click', removePendingAnnuncio);
    document.getElementById('annunci-filter-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      currentStato = document.getElementById('annunci-stato-filter').value;
      loadAnnunci(1);
    });
    loadAnnunci();
  });
})();
