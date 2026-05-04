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

async function loadAnnuncio() {
  const id = parseQueryParam('id');
  if (!id) {
    annuncioAlert.textContent = 'ID annuncio mancante.';
    annuncioAlert.className = 'alert alert-danger';
    annuncioAlert.classList.remove('d-none');
    return;
  }

  const response = await api.get(`/api/annunci/${encodeURIComponent(id)}`, {
    auth: false,
  });
  if (!response.ok) {
    annuncioAlert.textContent =
      response.error || "Impossibile caricare l'annuncio.";
    annuncioAlert.className = 'alert alert-danger';
    annuncioAlert.classList.remove('d-none');
    annuncioTitle.textContent = 'Annuncio non disponibile';
    return;
  }

  const annuncio = response.data;
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
      ? `Lat: ${annuncio.latitudine.toFixed(4)}, Lng: ${annuncio.longitudine.toFixed(4)}`
      : 'Visibile solo per utenti autenticati';

  const foto = annuncio.oggetto?.foto?.[0];
  if (foto) {
    annuncioImage.src = foto;
    annuncioImage.alt = `Immagine annuncio ${annuncio.titolo}`;
  }

  if (annuncioAction) {
    annuncioAction.href = '/views/catalog.html';
  }
}

window.addEventListener('DOMContentLoaded', loadAnnuncio);
