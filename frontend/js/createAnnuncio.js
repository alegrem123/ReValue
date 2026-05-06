/**
 * createAnnuncio.js
 * Form creazione annuncio con foto base64 e datepicker.
 */

const form = document.getElementById('create-annuncio-form');
const alertEl = document.getElementById('create-annuncio-alert');
const submitBtn = document.getElementById('create-annuncio-submit');
const photosInput = document.getElementById('annuncio-photos');
const previewGrid = document.getElementById('photo-preview-grid');
const useLocationBtn = document.getElementById('use-location-btn');
const latInput = document.getElementById('annuncio-lat');
const lngInput = document.getElementById('annuncio-lng');
const deadlineInput = document.getElementById('annuncio-deadline');

let photoBase64 = [];

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
  previewGrid.innerHTML = photoBase64.map((src, index) => `
    <div class="col-4">
      <img src="${src}" alt="Anteprima foto ${index + 1}" class="photo-preview rounded-3 border" />
    </div>
  `).join('');
}

async function handlePhotosChange() {
  clearAlert();
  const files = Array.from(photosInput.files || []);
  if (files.length > 5) {
    photosInput.value = '';
    photoBase64 = [];
    renderPreviews();
    showAlert('Puoi caricare al massimo 5 foto.');
    return;
  }

  try {
    photoBase64 = await Promise.all(files.map(readFileAsDataUrl));
    renderPreviews();
  } catch (err) {
    showAlert(err.message);
  }
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    showAlert('Geolocalizzazione non supportata dal browser.', 'warning');
    return;
  }

  useLocationBtn.disabled = true;
  useLocationBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Rilevo posizione';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      latInput.value = position.coords.latitude.toFixed(6);
      lngInput.value = position.coords.longitude.toFixed(6);
      useLocationBtn.disabled = false;
      useLocationBtn.innerHTML = '<i class="bi bi-geo-alt-fill"></i> Posizione inserita';
    },
    () => {
      useLocationBtn.disabled = false;
      useLocationBtn.innerHTML = '<i class="bi bi-geo-alt"></i> Usa posizione attuale';
      showAlert('Non è stato possibile rilevare la posizione.', 'warning');
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
}

function buildPayload() {
  const data = new FormData(form);
  const deadline = new Date(data.get('dataScadenza'));

  return {
    titolo: String(data.get('titolo')).trim(),
    dataScadenza: deadline.toISOString(),
    latitudine: data.get('latitudine') ? Number(data.get('latitudine')) : undefined,
    longitudine: data.get('longitudine') ? Number(data.get('longitudine')) : undefined,
    oggetto: {
      categoria: String(data.get('categoria')).trim(),
      descrizione: String(data.get('descrizione')).trim(),
      dimensioni: data.get('dimensioni'),
      materiale: String(data.get('materiale') || '').trim(),
      foto: photoBase64,
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

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Pubblicazione...';

  const response = await api.post('/api/annunci', buildPayload());
  if (!response.ok) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Pubblica annuncio';
    showAlert(response.error || "Impossibile creare l'annuncio.");
    return;
  }

  showAlert('Annuncio pubblicato correttamente.', 'success');
  window.setTimeout(() => {
    window.location.href = `annuncio.html?id=${response.data._id}`;
  }, 500);
}

window.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  setMinDeadline();
  photosInput.addEventListener('change', handlePhotosChange);
  useLocationBtn.addEventListener('click', useCurrentLocation);
  form.addEventListener('submit', handleSubmit);
});
