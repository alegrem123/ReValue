/**
 * editAnnuncio.js
 * Pagina modifica annuncio precompilata.
 */

const form = document.getElementById('edit-annuncio-form');
const alertEl = document.getElementById('edit-annuncio-alert');
const submitBtn = document.getElementById('edit-annuncio-submit');
const photosInput = document.getElementById('annuncio-photos');
const previewGrid = document.getElementById('photo-preview-grid');
const deadlineInput = document.getElementById('annuncio-deadline');

let currentAnnuncio = null;
let selectedPhotos = [];

function getAnnuncioId() {
  return new URLSearchParams(window.location.search).get('id');
}

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

function setMinDeadline() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  deadlineInput.min = now.toISOString().slice(0, 16);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Errore lettura immagine'));
    reader.readAsDataURL(file);
  });
}

function renderPreviews() {
  const photos = selectedPhotos.length > 0 ? selectedPhotos : currentAnnuncio?.oggetto?.foto || [];
  previewGrid.innerHTML = photos.map((src, index) => `
    <div class="col-4">
      <img src="${src}" alt="Foto annuncio ${index + 1}" class="photo-preview rounded-3 border" />
    </div>
  `).join('');
}

async function handlePhotosChange() {
  clearAlert();
  const files = Array.from(photosInput.files || []);
  if (files.length > 5) {
    photosInput.value = '';
    selectedPhotos = [];
    renderPreviews();
    showAlert('Puoi caricare al massimo 5 foto.');
    return;
  }

  try {
    selectedPhotos = await Promise.all(files.map(readFileAsDataUrl));
    renderPreviews();
  } catch (err) {
    showAlert(err.message);
  }
}

function fillForm(annuncio) {
  document.getElementById('edit-annuncio-id').value = annuncio._id;
  form.elements.titolo.value = annuncio.titolo || '';
  form.elements.descrizione.value = annuncio.oggetto?.descrizione || '';
  form.elements.categoria.value = annuncio.oggetto?.categoria || '';
  form.elements.materiale.value = annuncio.oggetto?.materiale || '';
  form.elements.dimensioni.value = annuncio.oggetto?.dimensioni || 'piccolo';
  form.elements.dataScadenza.value = formatDateTimeInput(annuncio.dataScadenza);
  form.elements.latitudine.value = annuncio.latitudine ?? '';
  form.elements.longitudine.value = annuncio.longitudine ?? '';
  form.elements.latitudine.dispatchEvent(new Event('input', { bubbles: true }));
  form.elements.longitudine.dispatchEvent(new Event('input', { bubbles: true }));
  renderPreviews();
}

async function loadAnnuncio() {
  const id = getAnnuncioId();
  if (!id) {
    showAlert('ID annuncio mancante.');
    return;
  }

  const response = await api.get(`/api/v1/annunci/${encodeURIComponent(id)}`);
  if (!response.ok) {
    showAlert(response.error || "Impossibile caricare l'annuncio.");
    return;
  }

  currentAnnuncio = response.data;
  fillForm(currentAnnuncio);
  form.classList.remove('d-none');
}

function buildPayload() {
  const data = new FormData(form);
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
      foto: selectedPhotos.length > 0 ? selectedPhotos : currentAnnuncio?.oggetto?.foto || [],
    },
  };
}

async function handleSubmit(event) {
  event.preventDefault();
  clearAlert();

  if (new Date(deadlineInput.value) <= new Date()) {
    showAlert('La scadenza deve essere nel futuro.');
    return;
  }

  const id = document.getElementById('edit-annuncio-id').value;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Salvataggio...';

  const response = await api.put(`/api/v1/annunci/${encodeURIComponent(id)}`, buildPayload());

  submitBtn.disabled = false;
  submitBtn.textContent = 'Salva modifiche';

  if (!response.ok) {
    showAlert(response.error || "Impossibile modificare l'annuncio.");
    return;
  }

  showAlert('Annuncio modificato correttamente.', 'success');
  window.setTimeout(() => {
    window.location.href = `annuncio.html?id=${encodeURIComponent(id)}`;
  }, 500);
}

window.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  setMinDeadline();
  photosInput.addEventListener('change', handlePhotosChange);
  form.addEventListener('submit', handleSubmit);
  loadAnnuncio();
});
