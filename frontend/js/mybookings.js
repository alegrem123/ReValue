/**
 * mybookings.js
 * Pagina "Le mie prenotazioni" — UC2.
 * Mostra prenotazioni con stati visivi + annullamento entro 15min (RF26).
 */

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const bookingsList  = document.getElementById('bookings-list');
const bookingsAlert = document.getElementById('bookings-alert');

let allBookings    = [];
let filtroAttivo   = '';
let pendingAnnulla = null;

function showAlert(msg, type = 'danger') {
  bookingsAlert.textContent = msg;
  bookingsAlert.className = `alert alert-${type}`;
  bookingsAlert.classList.remove('d-none');
}

function formatDate(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

function statoBadge(stato) {
  const map = {
    ATTIVA:     { cls: 'bg-success',   label: 'Attiva' },
    COMPLETATA: { cls: 'bg-primary',   label: 'Completata' },
    ANNULLATA:  { cls: 'bg-danger',    label: 'Annullata' },
  };
  const s = map[stato] || { cls: 'bg-secondary', label: stato };
  return `<span class="badge ${s.cls}">${s.label}</span>`;
}

function entroQuindiciMinuti(dataPrenotazione) {
  const diff = Date.now() - new Date(dataPrenotazione).getTime();
  return diff <= 15 * 60 * 1000;
}

function buildCard(p) {
  const titolo   = escapeHtml(p.annuncio?.titolo) || 'Annuncio rimosso';
  const donatore = p.donatore ? escapeHtml(`${p.donatore.nome} ${p.donatore.cognome}`) : '—';
  const puoAnnullare = p.stato === 'ATTIVA' && entroQuindiciMinuti(p.dataPrenotazione);

  return `
    <div class="card booking-card shadow-sm border-0 mb-3" data-id="${p._id}">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <h5 class="fw-bold mb-1">${titolo}</h5>
            <p class="text-muted small mb-1">
              <i class="bi bi-person me-1"></i>Donatore: ${donatore}
            </p>
            <p class="text-muted small mb-0">
              <i class="bi bi-calendar3 me-1"></i>${formatDate(p.dataPrenotazione)}
            </p>
          </div>
          <div>${statoBadge(p.stato)}</div>
        </div>

        ${p.stato === 'ATTIVA' ? `
        <div class="d-flex flex-column flex-sm-row gap-2 mt-3">
          <a href="annuncio.html?id=${p.annuncio?._id}" class="btn btn-outline-success btn-sm">
            <i class="bi bi-eye me-1"></i>Vedi annuncio
          </a>
          ${puoAnnullare ? `
          <button class="btn btn-outline-danger btn-sm btn-annulla" data-id="${p._id}" data-titolo="${titolo}">
            <i class="bi bi-x-circle me-1"></i>Annulla
          </button>` : `
          <span class="text-muted small align-self-center">
            <i class="bi bi-clock me-1"></i>Finestra annullamento scaduta
          </span>`}
        </div>` : ''}

        ${p.stato === 'COMPLETATA' ? `
        <div class="mt-3">
          <span class="text-success small"><i class="bi bi-check-circle me-1"></i>Scambio completato</span>
        </div>` : ''}
      </div>
    </div>`;
}

function renderBookings(bookings) {
  if (bookings.length === 0) {
    bookingsList.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-inbox display-5 d-block mb-3"></i>
        Nessuna prenotazione trovata.
      </div>`;
    return;
  }
  bookingsList.innerHTML = bookings.map(buildCard).join('');
  attachAnnullaListeners();
}

function attachAnnullaListeners() {
  bookingsList.querySelectorAll('.btn-annulla').forEach((btn) => {
    btn.addEventListener('click', () => {
      pendingAnnulla = btn.dataset.id;
      document.getElementById('modal-annulla-titolo').textContent = btn.dataset.titolo;
      const modal = new bootstrap.Modal(document.getElementById('modalAnnulla'));
      modal.show();
    });
  });
}

async function annullaPrenotazione() {
  if (!pendingAnnulla) return;

  const confirmBtn = document.getElementById('modal-annulla-confirm');
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Annullamento...';

  const res = await api.delete(`/api/v1/prenotazioni/${pendingAnnulla}`);

  confirmBtn.disabled = false;
  confirmBtn.textContent = 'Annulla prenotazione';

  const modal = bootstrap.Modal.getInstance(document.getElementById('modalAnnulla'));
  modal?.hide();

  if (!res.ok) {
    window.showToast?.(res.error || "Impossibile annullare la prenotazione.", 'danger');
    return;
  }

  allBookings = allBookings.map((p) =>
    p._id === pendingAnnulla ? { ...p, stato: 'ANNULLATA' } : p
  );
  pendingAnnulla = null;
  applyFilter();
  window.showToast?.('Prenotazione annullata.', 'success');
}

function applyFilter() {
  const filtered = filtroAttivo
    ? allBookings.filter((p) => p.stato === filtroAttivo)
    : allBookings;
  renderBookings(filtered);
}

async function loadBookings() {
  if (!localStorage.getItem('jwt')) {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
    return;
  }

  const res = await api.get('/api/v1/prenotazioni/me');
  if (!res.ok) {
    bookingsList.innerHTML = '';
    showAlert(res.error || 'Impossibile caricare le prenotazioni.');
    return;
  }

  allBookings = res.data || [];
  applyFilter();
}

// Filtri
document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    filtroAttivo = btn.dataset.stato;
    applyFilter();
  });
});

// Conferma annullamento
document.getElementById('modal-annulla-confirm').addEventListener('click', annullaPrenotazione);

window.addEventListener('DOMContentLoaded', loadBookings);
