/**
 * annuncio.js
 * Logica pagina dettaglio annuncio.
 */

const annuncioTitle = document.getElementById('annuncio-title');
const annuncioDescription = document.getElementById('annuncio-description');
const annuncioImage = document.getElementById('annuncio-image');
const annuncioDonatore = document.getElementById('annuncio-donatore');
const annuncioDeadline = document.getElementById('annuncio-deadline');
const annuncioCategory = document.getElementById('annuncio-category');
const annuncioMaterial = document.getElementById('annuncio-material');
const annuncioSize = document.getElementById('annuncio-size');
const annuncioValue = document.getElementById('annuncio-value');
const annuncioLocation = document.getElementById('annuncio-location');
const annuncioAlert = document.getElementById('annuncio-alert');
const annuncioAction = document.getElementById('annuncio-action');
const annuncioDonorProfile = document.getElementById('annuncio-donor-profile');

let currentAnnuncio = null;

function parseQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function formatItalianDate(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return 'Data non disponibile';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function normalizeDimensione(value) {
  if (value == null) return 1;
  const parsed = parseFloat(value);
  if (!Number.isNaN(parsed)) return parsed;

  switch (String(value).trim().toLowerCase()) {
    case 'piccolo':
    case 'small':
    case 's':
      return 1;
    case 'medio':
    case 'medium':
    case 'm':
      return 2;
    case 'grande':
    case 'large':
    case 'l':
      return 3;
    case 'molto grande':
    case 'extra large':
    case 'xl':
    case 'xlarge':
      return 4;
    default:
      return 1;
  }
}

function calculateEstimatedCredits(annuncio) {
  const dimensione = normalizeDimensione(annuncio.oggetto?.dimensioni);
  const giorni = annuncio.dataScadenza
    ? Math.max(
        0,
        (new Date(annuncio.dataScadenza) - new Date()) / (1000 * 60 * 60 * 24)
      )
    : 0;
  if (!annuncio.dataScadenza || giorni <= 0) return 'N/A';
  return Math.max(1, Math.round(dimensione * giorni)).toString();
}

function showAlert(message, type = 'danger') {
  annuncioAlert.textContent = message;
  annuncioAlert.className = `alert alert-${type}`;
  annuncioAlert.classList.remove('d-none');
}

function setActionState(annuncio) {
  if (!annuncioAction) return;

  const token = localStorage.getItem('jwt');
  if (!token) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    annuncioAction.textContent = 'Accedi per prenotare';
    annuncioAction.className = 'btn btn-outline-success btn-lg';
    annuncioAction.addEventListener('click', () => {
      window.location.href = `login.html?redirect=${redirect}`;
    });
    return;
  }

  if (annuncio.stato !== 'DISPONIBILE') {
    annuncioAction.textContent = 'Annuncio non disponibile';
    annuncioAction.disabled = true;
    return;
  }

  annuncioAction.addEventListener('click', prenotaAnnuncio);
}

async function prenotaAnnuncio() {
  if (!currentAnnuncio?._id || !annuncioAction) return;

  annuncioAction.disabled = true;
  annuncioAction.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Prenotazione...';

  const response = await api.post('/api/prenotazioni', {
    annuncioId: currentAnnuncio._id,
  });

  if (!response.ok) {
    annuncioAction.disabled = false;
    annuncioAction.textContent = 'Prenota annuncio';
    showAlert(response.error || 'Impossibile prenotare questo annuncio.');
    return;
  }

  showAlert('Annuncio prenotato. Trovi i dettagli nelle tue prenotazioni.', 'success');
  annuncioAction.textContent = 'Prenotato';
  annuncioAction.className = 'btn btn-success btn-lg';
}

async function loadAnnuncio() {
  const id = parseQueryParam('id');
  if (!id) {
    showAlert('ID annuncio mancante.');
    return;
  }

  const response = await api.get(`/api/annunci/${encodeURIComponent(id)}`);
  if (!response.ok) {
    showAlert(response.error || "Impossibile caricare l'annuncio.");
    annuncioTitle.textContent = 'Annuncio non disponibile';
    return;
  }

  const annuncio = response.data;
  currentAnnuncio = annuncio;
  annuncioTitle.textContent = annuncio.titolo || 'Annuncio senza titolo';
  annuncioDonatore.textContent = `Donatore: ${annuncio.donatore?.nome || 'Utente anonimo'}`;
  annuncioDescription.textContent =
    annuncio.oggetto?.descrizione || 'Descrizione non disponibile.';
  annuncioDeadline.textContent = formatItalianDate(annuncio.dataScadenza);
  annuncioCategory.textContent =
    annuncio.oggetto?.categoria || 'Non specificato';
  annuncioMaterial.textContent =
    annuncio.oggetto?.materiale || 'Non specificato';
  annuncioSize.textContent = annuncio.oggetto?.dimensioni || 'Non specificato';
  annuncioValue.textContent = `${calculateEstimatedCredits(annuncio)} crediti`;
  annuncioLocation.textContent =
    annuncio.latitudine != null && annuncio.longitudine != null
      ? `Lat: ${Number(annuncio.latitudine).toFixed(4)}, Lng: ${Number(annuncio.longitudine).toFixed(4)}`
      : 'Visibile solo per utenti autenticati';

  const foto = annuncio.oggetto?.foto?.[0];
  if (foto) {
    annuncioImage.src = foto;
    annuncioImage.alt = `Immagine annuncio ${annuncio.titolo}`;
  }

  if (annuncioDonorProfile && annuncio.donatore?._id) {
    annuncioDonorProfile.href = `public-profile.html?id=${annuncio.donatore._id}`;
  } else if (annuncioDonorProfile) {
    annuncioDonorProfile.classList.add('d-none');
  }

  setActionState(annuncio);
}

window.addEventListener('DOMContentLoaded', loadAnnuncio);
