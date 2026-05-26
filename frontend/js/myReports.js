// Auth guard
(function () {
  if (!localStorage.getItem('rv_token')) {
    window.location.href = 'login.html';
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  const skeleton   = document.getElementById('reports-skeleton');
  const empty      = document.getElementById('reports-empty');
  const tableWrap  = document.getElementById('reports-table-wrap');
  const tbody      = document.getElementById('reports-tbody');
  const alertBox   = document.getElementById('reports-alert');
  const refreshBtn = document.getElementById('refresh-btn');

  refreshBtn.addEventListener('click', loadReports);

  loadReports();

  async function loadReports() {
    skeleton.classList.remove('d-none');
    empty.classList.add('d-none');
    tableWrap.classList.add('d-none');
    alertBox.classList.add('d-none');

    const res = await api.get('/api/v1/segnalazioni/me');

    skeleton.classList.add('d-none');

    if (!res.ok) {
      showAlert(res.error || 'Impossibile caricare le segnalazioni.', 'danger');
      return;
    }

    const segnalazioni = res.data?.segnalazioni ?? [];

    if (segnalazioni.length === 0) {
      empty.classList.remove('d-none');
      return;
    }

    tbody.innerHTML = segnalazioni.map(reportRow).join('');
    tableWrap.classList.remove('d-none');
  }

  function reportRow(s) {
    const tipo     = escHtml(s.tipo || '—');
    const motivo   = escHtml(s.motivo || '—');
    const segnalato = s.segnalato?.nome
      ? escHtml(`${s.segnalato.nome} (${s.segnalato.email || ''})`)
      : escHtml(s.segnalato?.email || s.segnalato?._id || '—');
    const data     = fmtDate(s.data || s.createdAt);
    const stato    = s.stato === 'CHIUSA'
      ? '<span class="badge bg-secondary">CHIUSA</span>'
      : '<span class="badge bg-warning text-dark">APERTA</span>';

    return `
      <tr>
        <td><span class="badge bg-light text-dark border">${tipo}</span></td>
        <td><span class="motivo-troncato d-block" title="${motivo}">${motivo}</span></td>
        <td class="text-muted small">${segnalato}</td>
        <td class="text-muted small text-nowrap">${data}</td>
        <td>${stato}</td>
      </tr>`;
  }

  function showAlert(msg, type = 'danger') {
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = msg;
    alertBox.classList.remove('d-none');
  }
});

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}
