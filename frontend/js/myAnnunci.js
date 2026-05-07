/**
 * myAnnunci.js
 * Gestione pagina "I miei annunci".
 */

const listEl = document.getElementById('my-annunci-list');
const loadingEl = document.getElementById('my-annunci-loading');
const emptyEl = document.getElementById('my-annunci-empty');
const alertEl = document.getElementById('my-annunci-alert');
const refreshBtn = document.getElementById('refresh-annunci-btn');
const editForm = document.getElementById('edit-annuncio-form');
const editSubmit = document.getElementById('edit-annuncio-submit');
const editModalEl = document.getElementById('edit-annuncio-modal');

let annunci = [];
let editModal = null;

function requireAuth() {
  if (!localStorage.getItem('jwt')) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `login.html?redirect=${redirect}`;
    return false;
  }
  return true;
}

function showAlert(message, type = 'danger') {
  alertEl.textContent = message;
  alertEl.className = `alert alert-${type}`;
  alertEl.classList.remove('d-none');
}

function clearAlert() {
  alertEl.classList.add('d-none');
  alertEl.textContent = '';
}

function formatDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatDateItalian(value) {
  if (!value) return 'Non indicata';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusClass(stato) {
  const classes = {
    DISPONIBILE: 'bg-success',
    PRENOTATO: 'bg-warning text-dark',
    RITIRATO: 'bg-secondary',
    SCADUTO: 'bg-danger',
  };
  return classes[stato] || 'bg-secondary';
}

function getAnnuncioById(id) {
  return annunci.find((annuncio) => annuncio._id === id);
}

function setLoading(isLoading) {
  loadingEl.classList.toggle('d-none', !isLoading);
  refreshBtn.disabled = isLoading;
}

function renderAnnunci() {
  listEl.innerHTML = '';
  emptyEl.classList.toggle('d-none', annunci.length !== 0);

  annunci.forEach((annuncio) => {
    const foto = annuncio.oggetto?.foto?.[0] || '';
    const item = document.createElement('article');
    item.className = 'list-group-item p-3';
    item.innerHTML = `
      <div class="d-flex flex-column flex-lg-row gap-3 align-items-lg-center">
        <img
          src="${foto || 'https://via.placeholder.com/160x120/ced4da/6c757d?text=Foto'}"
          class="annuncio-thumb rounded-3 flex-shrink-0"
          alt="Foto annuncio ${annuncio.titolo || ''}"
        />
        <div class="flex-grow-1">
          <div class="d-flex flex-wrap gap-2 align-items-center mb-1">
            <h3 class="h5 fw-bold mb-0">${annuncio.titolo || 'Annuncio senza titolo'}</h3>
            <span class="badge status-badge ${statusClass(annuncio.stato)}">${annuncio.stato || 'N/D'}</span>
          </div>
          <p class="text-muted mb-1">${annuncio.oggetto?.categoria || 'Categoria non indicata'}</p>
          <p class="small text-muted mb-0">Scadenza: ${formatDateItalian(annuncio.dataScadenza)}</p>
        </div>
        <div class="d-flex flex-column flex-sm-row gap-2">
          <a href="annuncio.html?id=${encodeURIComponent(annuncio._id)}" class="btn btn-outline-success btn-sm">
            <i class="bi bi-eye me-1"></i>Apri
          </a>
          <button type="button" class="btn btn-outline-secondary btn-sm" data-action="edit" data-id="${annuncio._id}">
            <i class="bi bi-pencil me-1"></i>Modifica
          </button>
          <button type="button" class="btn btn-outline-danger btn-sm" data-action="delete" data-id="${annuncio._id}">
            <i class="bi bi-trash me-1"></i>Elimina
          </button>
        </div>
      </div>
    `;
    listEl.appendChild(item);
  });
}

function fillEditForm(annuncio) {
  editForm.elements.titolo.value = annuncio.titolo || '';
  editForm.elements.descrizione.value = annuncio.oggetto?.descrizione || '';
  editForm.elements.categoria.value = annuncio.oggetto?.categoria || '';
  editForm.elements.materiale.value = annuncio.oggetto?.materiale || '';
  editForm.elements.dimensioni.value = annuncio.oggetto?.dimensioni || 'piccolo';
  editForm.elements.dataScadenza.value = formatDateTimeInput(annuncio.dataScadenza);
  editForm.elements.latitudine.value = annuncio.latitudine ?? '';
  editForm.elements.longitudine.value = annuncio.longitudine ?? '';
  document.getElementById('edit-annuncio-id').value = annuncio._id;
}

function openEditModal(id) {
  const annuncio = getAnnuncioById(id);
  if (!annuncio) return;

  clearAlert();
  fillEditForm(annuncio);
  editModal.show();
}

async function loadAnnunci() {
  clearAlert();
  setLoading(true);

  const response = await api.get('/api/annunci/me');
  setLoading(false);

  if (!response.ok) {
    showAlert(response.error || 'Impossibile caricare i tuoi annunci.');
    return;
  }

  annunci = Array.isArray(response.data) ? response.data : [];
  renderAnnunci();
}

function buildEditPayload() {
  const id = document.getElementById('edit-annuncio-id').value;
  const current = getAnnuncioById(id);
  const data = new FormData(editForm);
  const latitudine = data.get('latitudine');
  const longitudine = data.get('longitudine');

  return {
    titolo: String(data.get('titolo')).trim(),
    dataScadenza: new Date(data.get('dataScadenza')).toISOString(),
    latitudine: latitudine ? Number(latitudine) : undefined,
    longitudine: longitudine ? Number(longitudine) : undefined,
    oggetto: {
      categoria: String(data.get('categoria')).trim(),
      descrizione: String(data.get('descrizione')).trim(),
      dimensioni: data.get('dimensioni'),
      materiale: String(data.get('materiale') || '').trim(),
      foto: current?.oggetto?.foto || [],
    },
  };
}

async function handleEditSubmit(event) {
  event.preventDefault();
  clearAlert();

  const id = document.getElementById('edit-annuncio-id').value;
  editSubmit.disabled = true;
  editSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Salvataggio...';

  const response = await api.put(`/api/annunci/${encodeURIComponent(id)}`, buildEditPayload());

  editSubmit.disabled = false;
  editSubmit.textContent = 'Salva modifiche';

  if (!response.ok) {
    showAlert(response.error || "Impossibile modificare l'annuncio.");
    return;
  }

  editModal.hide();
  showAlert('Annuncio modificato correttamente.', 'success');
  await loadAnnunci();
}

async function deleteAnnuncio(id) {
  const annuncio = getAnnuncioById(id);
  const title = annuncio?.titolo || 'questo annuncio';
  if (!window.confirm(`Eliminare "${title}"?`)) return;

  clearAlert();
  const response = await api.delete(`/api/annunci/${encodeURIComponent(id)}`);
  if (!response.ok) {
    showAlert(response.error || "Impossibile eliminare l'annuncio.");
    return;
  }

  showAlert('Annuncio eliminato correttamente.', 'success');
  await loadAnnunci();
}

function handleListClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const id = button.dataset.id;
  if (button.dataset.action === 'edit') {
    openEditModal(id);
  } else if (button.dataset.action === 'delete') {
    deleteAnnuncio(id);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;

  editModal = new bootstrap.Modal(editModalEl);
  refreshBtn.addEventListener('click', loadAnnunci);
  listEl.addEventListener('click', handleListClick);
  editForm.addEventListener('submit', handleEditSubmit);
  loadAnnunci();
});
