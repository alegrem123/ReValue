(function () {
  let barChart = null;
  let donutChart = null;

  function metricCard(label, value, icon, colorClass) {
    return `
      <div class="col-6 col-md-4 col-xl">
        <div class="metric-card bg-white border rounded p-3 h-100">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <p class="text-muted small mb-1">${label}</p>
              <div class="h3 mb-0">${value}</div>
            </div>
            <i class="bi ${icon} fs-3 ${colorClass}"></i>
          </div>
        </div>
      </div>`;
  }

  function renderStats(data) {
    const cards = document.getElementById('stats-cards');
    cards.innerHTML = [
      metricCard('Scambi questo mese', data.scambiMensili ?? 0, 'bi-arrow-repeat', 'text-success'),
      metricCard('Utenti registrati', data.totaleUtenti ?? 0, 'bi-people', 'text-primary'),
      metricCard('Crediti in circolazione', data.liquiditaAttuale ?? 0, 'bi-wallet2', 'text-indigo'),
      metricCard('Crediti erogati (mese)', data.creditiErogatiMese ?? 0, 'bi-coin', 'text-teal'),
      metricCard('Segnalazioni pendenti', data.segnalazioniPendenti ?? 0, 'bi-flag', 'text-warning'),
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
