/**
 * notifiche.js
 * Pagina notifiche utente (RF12).
 * Chiama GET /api/v1/notifiche/me e PATCH /api/v1/notifiche/:id/letta.
 */

const notificheAlert = document.getElementById('notifiche-alert');
const notificheList  = document.getElementById('notifiche-list');
const btnLeggiTutte  = document.getElementById('btn-leggi-tutte');

function showAlert(msg, type = 'danger') {
  notificheAlert.textContent = msg;
  notificheAlert.className = `alert alert-${type}`;
  notificheAlert.classList.remove('d-none');
}

function formatData(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderNotifiche(notifiche) {
  if (!notifiche || notifiche.length === 0) {
    notificheList.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-bell-slash fs-1 d-block mb-3"></i>
        <p class="mb-0">Nessuna notifica al momento.</p>
      </div>`;
    return;
  }

  notificheList.innerHTML = notifiche
    .map(
      (n) => `
    <div class="card notifica-card mb-3 ${n.letta ? 'letta' : 'non-letta'}" id="notifica-${n._id}">
      <div class="card-body d-flex justify-content-between align-items-start gap-3">
        <div class="flex-grow-1">
          <p class="mb-1">${n.testo}</p>
          <small class="text-muted"><i class="bi bi-clock me-1"></i>${formatData(n.data)}</small>
        </div>
        ${
          !n.letta
            ? `<button
                class="btn btn-sm btn-outline-success flex-shrink-0 btn-segna-letta"
                data-id="${n._id}">
                Segna letta
              </button>`
            : `<span class="text-success small flex-shrink-0"><i class="bi bi-check2"></i> Letta</span>`
        }
      </div>
    </div>`
    )
    .join('');

  // Attach listeners to "Segna letta" buttons
  notificheList.querySelectorAll('.btn-segna-letta').forEach((btn) => {
    btn.addEventListener('click', () => segnaLetta(btn.dataset.id));
  });
}

async function caricaNotifiche() {
  notificheList.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border text-success" role="status">
        <span class="visually-hidden">Caricamento...</span>
      </div>
    </div>`;

  const res = await api.get('/api/v1/notifiche/me');

  if (!res.ok) {
    notificheList.innerHTML = '';
    showAlert(res.error || 'Errore nel caricamento delle notifiche.');
    return;
  }

  const notifiche = res.data?.data?.notifiche ?? res.data?.notifiche ?? [];
  renderNotifiche(notifiche);
}

async function segnaLetta(id) {
  const res = await api.patch(`/api/v1/notifiche/${id}/letta`, {});

  if (!res.ok) {
    showAlert(res.error || 'Impossibile aggiornare la notifica.', 'warning');
    return;
  }

  // Update card in-place: remove "non-letta" styling, swap button for checkmark
  const card = document.getElementById(`notifica-${id}`);
  if (card) {
    card.classList.remove('non-letta');
    card.classList.add('letta');
    const btn = card.querySelector('.btn-segna-letta');
    if (btn) {
      btn.outerHTML = `<span class="text-success small flex-shrink-0"><i class="bi bi-check2"></i> Letta</span>`;
    }
  }
}

async function segnaLettaTutte() {
  const res = await api.patch('/api/v1/notifiche/me/leggi-tutte', {});

  if (!res.ok) {
    showAlert(res.error || 'Impossibile aggiornare le notifiche.', 'warning');
    return;
  }

  // Reload to reflect updated state
  caricaNotifiche();
}

function init() {
  if (!localStorage.getItem('jwt')) {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    return;
  }
  caricaNotifiche();
}

btnLeggiTutte.addEventListener('click', segnaLettaTutte);

window.addEventListener('DOMContentLoaded', init);
