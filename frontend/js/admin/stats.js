(function () {
  let chart = null;

  function card(label, value, icon) {
    return `
      <div class="col-md-4">
        <div class="card h-100">
          <div class="card-body">
            <div class="text-muted small mb-1"><i class="bi ${icon} me-1"></i>${label}</div>
            <div class="h3 fw-bold mb-0">${AdminApi.escapeHtml(value)}</div>
          </div>
        </div>
      </div>`;
  }

  async function load() {
    const alert = document.getElementById('admin-stats-alert');
    const cards = document.getElementById('admin-stats-cards');
    const res = await AdminApi.get('/api/v1/admin/statistiche');

    if (!res.ok) {
      alert.className = 'alert alert-danger';
      alert.textContent = res.error || 'Errore caricamento statistiche';
      alert.classList.remove('d-none');
      return;
    }

    alert.classList.add('d-none');
    const d = res.data || {};
    cards.innerHTML = [
      card('Scambi mese', d.scambiMensili ?? 0, 'bi-arrow-repeat'),
      card('Utenti totali', d.totaleUtenti ?? 0, 'bi-people'),
      card('Crediti erogati', d.creditiErogatiTotali ?? d.totaleCrediti ?? 0, 'bi-coin'),
      card('Crediti mese', d.creditiErogatiMese ?? 0, 'bi-calendar-check'),
      card('Segnalazioni aperte', d.segnalazioniPendenti ?? 0, 'bi-flag'),
      card('Liquidità wallet', d.liquiditaAttuale ?? 0, 'bi-wallet2'),
    ].join('');

    const canvas = document.getElementById('admin-stats-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Scambi mese', 'Crediti mese', 'Segnalazioni aperte'],
        datasets: [{
          label: 'Metriche operative',
          data: [d.scambiMensili ?? 0, d.creditiErogatiMese ?? 0, d.segnalazioniPendenti ?? 0],
          backgroundColor: ['#2E7D32', '#FFD54F', '#C62828'],
        }],
      },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });
  }

  window.AdminStats = { init: load, load };
})();
