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
const btnSegnalaAnnuncio = document.getElementById('btn-segnala-annuncio');

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

function formatPublicLocation(annuncio) {
  const comune = annuncio.indirizzo?.comune || annuncio.comune;
  const provincia = annuncio.indirizzo?.provincia || annuncio.provincia;
  if (comune && provincia) return `${comune}, ${provincia}`;
  if (comune) return comune;
  return 'Area approssimativa. Indirizzo esatto visibile dopo la prenotazione.';
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

const DETAIL_TIER_A = { acqMin: 10, acqMax: 100 };
const DETAIL_TIER_B = { acqMin:  6, acqMax:  60 };
const DETAIL_TIER_C = { acqMin:  3, acqMax:  30 };

const DETAIL_CATEGORIA_TIER = {
  'Elettronica':          DETAIL_TIER_A,
  'Elettrodomestici':     DETAIL_TIER_A,
  'Arredo e mobili':      DETAIL_TIER_A,
  'Biciclette e mobilita': DETAIL_TIER_A,
  'Ricambi auto e moto':  DETAIL_TIER_A,
  'Utensili e attrezzi':  DETAIL_TIER_A,
  'Cucina e casalinghi':  DETAIL_TIER_B,
  'Sport e tempo libero': DETAIL_TIER_B,
  'Musica e strumenti':   DETAIL_TIER_B,
  'Ferramenta':           DETAIL_TIER_B,
  'Giardino e outdoor':   DETAIL_TIER_B,
  'Edilizia leggera':     DETAIL_TIER_B,
  'Bagno e sanitari':     DETAIL_TIER_B,
  'Illuminazione':        DETAIL_TIER_B,
  'Libri e manuali':      DETAIL_TIER_C,
  'Cancelleria':          DETAIL_TIER_C,
  'Decorazioni':          DETAIL_TIER_C,
  'Giocattoli':           DETAIL_TIER_C,
  'Infanzia':             DETAIL_TIER_C,
  'Materiale scolastico': DETAIL_TIER_C,
  'Tessili e biancheria': DETAIL_TIER_C,
  'Vasi e contenitori':   DETAIL_TIER_C,
  'Altro':                DETAIL_TIER_C,
};

const MAX_FINESTRA_DETAIL_MS = 14 * 24 * 60 * 60 * 1000;

function calculateEstimatedCredits(annuncio) {
  if (!annuncio?.dataScadenza) return DETAIL_TIER_C.acqMin;
  const tier = DETAIL_CATEGORIA_TIER[annuncio.oggetto?.categoria] || DETAIL_TIER_C;
  const remaining = Math.max(0, new Date(annuncio.dataScadenza).getTime() - Date.now());
  const ratio = 1 - Math.min(1, remaining / MAX_FINESTRA_DETAIL_MS);
  return Math.round(tier.acqMin + (tier.acqMax - tier.acqMin) * ratio);
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

  annuncioAction.addEventListener('click', () => apriModalePrenota(annuncio));
}

function apriModalePrenota(annuncio) {
  document.getElementById('modal-titolo').textContent   = annuncio.titolo || '—';
  document.getElementById('modal-scadenza').textContent = formatItalianDate(annuncio.dataScadenza);
  document.getElementById('modal-crediti').textContent  = `${calculateEstimatedCredits(annuncio)} crediti`;

  const confirmBtn = document.getElementById('modal-confirm-btn');
  // Rimuove listener precedenti clonando il nodo
  const fresh = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(fresh, confirmBtn);
  fresh.addEventListener('click', prenotaAnnuncio);

  const modal = new bootstrap.Modal(document.getElementById('modalPrenota'));
  modal.show();
}

async function prenotaAnnuncio() {
  if (!currentAnnuncio?._id) return;

  const modal      = bootstrap.Modal.getInstance(document.getElementById('modalPrenota'));
  const confirmBtn = document.getElementById('modal-confirm-btn');

  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Prenotazione...';

  const response = await api.post('/api/v1/prenotazioni', {
    annuncioId: currentAnnuncio._id,
  });

  confirmBtn.disabled = false;
  confirmBtn.textContent = 'Conferma prenotazione';

  if (!response.ok) {
    modal?.hide();
    showAlert(response.error || 'Impossibile prenotare questo annuncio.');
    return;
  }

  modal?.hide();
  showAlert('Annuncio prenotato! Trovi i dettagli nelle tue prenotazioni.', 'success');
  annuncioAction.textContent = 'Prenotato ✓';
  annuncioAction.disabled = true;
  annuncioAction.className = 'btn btn-success btn-lg';
}

async function loadAnnuncio() {
  const id = parseQueryParam('id');
  if (!id) {
    showAlert('ID annuncio mancante.');
    return;
  }

  const response = await api.get(`/api/v1/annunci/${encodeURIComponent(id)}`);
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
  annuncioLocation.textContent = formatPublicLocation(annuncio);

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
  if (btnSegnalaAnnuncio && annuncio.donatore?._id) {
    btnSegnalaAnnuncio.href = `segnala.html?userId=${encodeURIComponent(annuncio.donatore._id)}&annuncioId=${encodeURIComponent(annuncio._id)}`;
  } else if (btnSegnalaAnnuncio && !annuncio.donatore?._id) {
    btnSegnalaAnnuncio.classList.add('d-none');
  }

  setActionState(annuncio);
}

window.addEventListener('DOMContentLoaded', loadAnnuncio);
