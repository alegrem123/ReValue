(function () {
  let chart = null;

  function metricCard(label, value, icon, variant = 'success') {
    return `
      <div class="col-md-4">
        <div class="metric-card bg-white border rounded p-3 h-100">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <p class="text-muted small mb-1">${label}</p>
              <div class="h3 mb-0">${value}</div>
            </div>
            <i class="bi ${icon} text-${variant} fs-3"></i>
          </div>
        </div>
      </div>`;
  }

  function renderStats(data) {
    const cards = document.getElementById('stats-cards');
    cards.innerHTML = [
      metricCard('Scambi nel mese', data.scambiMensili ?? 0, 'bi-arrow-repeat'),
      metricCard('Utenti totali', data.totaleUtenti ?? 0, 'bi-people'),
      metricCard('Crediti erogati', data.totaleCrediti ?? 0, 'bi-wallet2'),
    ].join('');

    const history = data.storicoMensile || [];
    const labels = history.map((item) => `${String(item.mese).padStart(2, '0')}/${item.anno}`);
    const values = history.map((item) => item.totale);
    const ctx = document.getElementById('stats-chart');

    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['Nessuno scambio'],
        datasets: [{
          label: 'Scambi completati',
          data: values.length ? values : [0],
          backgroundColor: '#2e7d32',
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }

  async function loadStats() {
    const res = await window.revalueAdmin.adminRequest('/admin/statistiche');
    if (!res.ok) {
      window.revalueAdmin.showAdminAlert(res.error || 'Impossibile caricare le statistiche.');
      return;
    }
    renderStats(res.data);
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.revalueAdmin.guardAdminPage();
    document.getElementById('admin-logout')?.addEventListener('click', () => {
      window.revalueAdmin.clearAdminToken();
      window.location.href = 'login.html';
    });
    loadStats();
  });
})();
