(function () {
  let barChart = null;
  let donutChart = null;

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
      <div class="col-6 col-md-4 col-xl">
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
      metricCard('Scambi questo mese', data.scambiMensili ?? 0, 'bi-arrow-repeat'),
      metricCard('Utenti registrati', data.totaleUtenti ?? 0, 'bi-people', 'primary'),
      metricCard('Crediti in circolazione', data.liquiditaAttuale ?? 0, 'bi-wallet2', 'info'),
      metricCard('Crediti erogati (mese)', data.creditiErogatiMese ?? 0, 'bi-coin'),
      metricCard('Segnalazioni pendenti', data.segnalazioniPendenti ?? 0, 'bi-flag', 'warning'),
    ].join('');

    renderBarChart(data.storicoMensile || []);
    renderDonutChart(data);
  }

  function renderBarChart(history) {
    const labels = history.map((item) => `${String(item.mese).padStart(2, '0')}/${item.anno}`);
    const values = history.map((item) => item.totale);
    const ctx = document.getElementById('stats-chart');
    if (!ctx) return;

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(46, 125, 50, 0.85)');
    gradient.addColorStop(1, 'rgba(46, 125, 50, 0.25)');

    if (barChart) barChart.destroy();
    barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['Nessuno scambio'],
        datasets: [{
          label: 'Scambi completati',
          data: values.length ? values : [0],
          backgroundColor: gradient,
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => `Mese: ${items[0].label}`,
              label: (item) => ` ${item.raw} scambi`,
            },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: { precision: 0 },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
        },
      },
    });
  }

  function renderDonutChart(data) {
    const attivi = data.utentiAttivi ?? 0;
    const sospesi = data.utentiSospesi ?? 0;
    const bannati = data.utentiBannati ?? 0;
    const totale = data.totaleUtenti ?? attivi + sospesi + bannati;
    const ctx = document.getElementById('stats-chart-donut');
    if (!ctx) return;

    const centerLabelPlugin = {
      id: 'centerLabel',
      beforeDraw(chart) {
        const { ctx: chartCtx, chartArea } = chart;
        if (!chartArea) return;

        const centerX = (chartArea.left + chartArea.right) / 2;
        const centerY = (chartArea.top + chartArea.bottom) / 2;
        chartCtx.save();
        chartCtx.textAlign = 'center';
        chartCtx.textBaseline = 'middle';
        chartCtx.fillStyle = '#212529';
        chartCtx.font = '700 24px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        chartCtx.fillText(String(totale), centerX, centerY - 8);
        chartCtx.fillStyle = '#6c757d';
        chartCtx.font = '500 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        chartCtx.fillText('utenti', centerX, centerY + 16);
        chartCtx.restore();
      },
    };

    if (donutChart) donutChart.destroy();
    donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Attivi', 'Sospesi', 'Bannati'],
        datasets: [{
          data: [attivi, sospesi, bannati],
          backgroundColor: ['#2e7d32', '#f59e0b', '#dc2626'],
          borderWidth: 2,
          borderColor: '#fff',
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10 },
          },
          tooltip: {
            callbacks: {
              label: (item) => ` ${item.label}: ${item.raw}`,
            },
          },
        },
      },
      plugins: [centerLabelPlugin],
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
