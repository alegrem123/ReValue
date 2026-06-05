(function () {
  let chart = null;

  function metricSkeleton(label) {
    return `
      <div class="col-md-4">
        <div class="rv-admin-metric h-100" aria-busy="true">
          <p class="rv-admin-muted small mb-2">${label}</p>
          <span class="skeleton skeleton-title mb-0"></span>
        </div>
      </div>`;
  }

  function renderStatsLoading() {
    const cards = document.getElementById('stats-cards');
    if (!cards) return;
    document.getElementById('stats-chart-panel')?.classList.remove('d-none');
    cards.innerHTML = [
      metricSkeleton('Scambi nel mese'),
      metricSkeleton('Utenti totali'),
      metricSkeleton('Crediti erogati'),
    ].join('');
  }

  function renderStatsError() {
    const cards = document.getElementById('stats-cards');
    if (!cards) return;
    document.getElementById('stats-chart-panel')?.classList.add('d-none');
    cards.innerHTML = `
      <div class="col-12">
        <div class="rv-admin-panel text-center py-4">
          <i class="bi bi-exclamation-circle text-danger fs-4" aria-hidden="true"></i>
          <p class="fw-semibold mb-1 mt-2">Statistiche non disponibili</p>
          <p class="rv-admin-muted mb-0">Controlla il backend o riprova dopo aver effettuato di nuovo l'accesso.</p>
        </div>
      </div>`;
  }

  function metricCard(label, value, icon, variant = 'success') {
    return `
      <div class="col-md-4">
        <div class="rv-admin-metric h-100">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <p class="rv-admin-muted small mb-1">${label}</p>
              <div class="rv-admin-metric-value">${value}</div>
            </div>
            <span class="rv-admin-metric-icon rv-admin-metric-icon-${variant}" aria-hidden="true">
              <i class="bi ${icon}"></i>
            </span>
          </div>
        </div>
      </div>`;
  }

  function renderStats(data) {
    const cards = document.getElementById('stats-cards');
    document.getElementById('stats-chart-panel')?.classList.remove('d-none');
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
    const rootStyle = getComputedStyle(document.documentElement);
    const chartGreen = rootStyle.getPropertyValue('--rv-green').trim() || '#2E7D32';
    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['Nessuno scambio'],
        datasets: [{
          label: 'Scambi completati',
          data: values.length ? values : [0],
          backgroundColor: chartGreen,
          borderRadius: 6,
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
    renderStatsLoading();
    try {
      const res = await window.revalueAdmin.adminRequest('/admin/statistiche');
      if (!res.ok) {
        window.revalueAdmin.showAdminAlert(res.error || 'Impossibile caricare le statistiche.');
        renderStatsError();
        return;
      }
      renderStats(res.data);
    } catch {
      window.revalueAdmin.showAdminAlert('Backend non raggiungibile.');
      renderStatsError();
    }
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
