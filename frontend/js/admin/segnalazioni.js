(function () {
  let pendingReport = null;
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
    return date.toLocaleString('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  function userCell(user) {
    if (!user) return '-';
    const name = `${user.nome || ''} ${user.cognome || ''}`.trim();
    return `
      <div>${escapeHtml(name || '-')}</div>
      <div class="text-muted small">${escapeHtml(user.email || '-')}</div>`;
  }

  function reportAction(segnalazione) {
    if (segnalazione.malusApplicato) {
      return '<span class="badge text-bg-success">Malus applicato</span>';
    }

    return `
      <button class="btn btn-outline-danger btn-sm" data-segnalazione-action="malus" data-segnalazione-id="${segnalazione._id}" data-segnalato-email="${escapeHtml(segnalazione.segnalato?.email || '')}">
        Applica malus
      </button>`;
  }

  function renderSegnalazioni(segnalazioni) {
    const tbody = document.getElementById('segnalazioni-table-body');
    if (!segnalazioni.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Nessuna segnalazione presente.</td></tr>';
    } else {
      tbody.innerHTML = segnalazioni.map((segnalazione) => `
        <tr>
          <td>${userCell(segnalazione.segnalante)}</td>
          <td>${userCell(segnalazione.segnalato)}</td>
          <td>
            <div class="fw-semibold">${escapeHtml(segnalazione.tipo || 'altro')}</div>
            <div>${escapeHtml(segnalazione.motivo)}</div>
          </td>
          <td>${escapeHtml(segnalazione.annuncio?.titolo || '-')}</td>
          <td>${formatDate(segnalazione.data)}</td>
          <td class="text-end">${reportAction(segnalazione)}</td>
        </tr>`).join('');
    }

    tbody.querySelectorAll('[data-segnalazione-action="malus"]').forEach((button) => {
      button.addEventListener('click', () => openMalusConfirm(button));
    });
  }

  async function loadSegnalazioni() {
    const res = await window.revalueAdmin.adminRequest('/admin/segnalazioni');
    if (!res.ok) {
      window.revalueAdmin.showAdminAlert(res.error || 'Impossibile caricare le segnalazioni.');
      return;
    }
    renderSegnalazioni(Array.isArray(res.data) ? res.data : []);
  }

  function openMalusConfirm(button) {
    pendingReport = {
      id: button.dataset.segnalazioneId,
      email: button.dataset.segnalatoEmail || 'utente segnalato',
    };

    document.getElementById('confirm-segnalazione-title').textContent = 'Conferma malus';
    document.getElementById('confirm-segnalazione-body').textContent = `Vuoi applicare un malus a ${pendingReport.email}?`;
    confirmModal.show();
  }

  async function applyPendingMalus() {
    if (!pendingReport) return;

    const res = await window.revalueAdmin.adminRequest(`/admin/segnalazioni/${pendingReport.id}/malus`, {
      method: 'POST',
    });
    if (!res.ok) {
      window.revalueAdmin.showAdminAlert(res.error || 'Malus non applicato.');
    } else {
      window.revalueAdmin.showAdminAlert(res.data?.message || 'Malus applicato.', 'success');
      await loadSegnalazioni();
    }
    pendingReport = null;
    confirmModal.hide();
  }

  document.addEventListener('DOMContentLoaded', () => {
    confirmModal = new bootstrap.Modal(document.getElementById('confirm-segnalazione-modal'));
    document.getElementById('confirm-segnalazione-action')?.addEventListener('click', applyPendingMalus);
    loadSegnalazioni();
  });
})();
