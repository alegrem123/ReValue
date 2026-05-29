/**
 * publicProfile.js
 * Logica della pagina profilo pubblico utente (RF8).
 *
 * Carica il profilo via GET /api/v1/users/:id/profilo (contatori + ultime 5 recensioni).
 * Per la paginazione usa GET /api/v1/users/:id/recensioni?page=N&limit=10.
 * Mostra contatori "X positive, Y negative" nell'header profilo e nella card riepilogativa.
 */

const alertBox = document.getElementById('public-profile-alert');
const profileAvatar = document.getElementById('public-profile-avatar');
const profileName = document.getElementById('public-profile-name');
const profileMeta = document.getElementById('public-profile-meta');
const profileCity = document.getElementById('public-profile-city');
const profileDescription = document.getElementById('public-profile-description');
const profileCreated = document.getElementById('public-profile-created');
const reviewCounters = document.getElementById('review-counters');
const reviewPositive = document.getElementById('review-positive');
const reviewNegative = document.getElementById('review-negative');
const reviewTotal = document.getElementById('review-total');
const reviewPositiveCard = document.getElementById('review-positive-card');
const reviewNegativeCard = document.getElementById('review-negative-card');
const reviewsContainer = document.getElementById('public-profile-reviews');
const reviewCountLabel = document.getElementById('review-count-label');
const loadMoreWrapper = document.getElementById('load-more-wrapper');
const btnLoadMore = document.getElementById('btn-load-more-reviews');

/** Stato paginazione recensioni */
let currentPage = 1;
let totalPages = 1;
const PAGE_SIZE = 10;

function getProfileId() {
  return new URLSearchParams(window.location.search).get('id');
}

function showProfileAlert(message) {
  alertBox.textContent = message;
  alertBox.className = 'alert alert-danger';
  alertBox.classList.remove('d-none');
}

function formatDate(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function renderAvatar(user) {
  const first = user.nome?.[0] || '';
  const second = user.cognome?.[0] || '';
  const initials = `${first}${second}`.trim().toUpperCase();
  if (!initials) return;
  profileAvatar.innerHTML = '';
  profileAvatar.textContent = initials;
}

/**
 * Popola i contatori recensioni sia nell'header che nella card.
 * @param {{ positive: number, negative: number, totale: number }} riepilogo
 */
function renderCounters(riepilogo) {
  const pos = riepilogo?.positive ?? 0;
  const neg = riepilogo?.negative ?? 0;
  const tot = riepilogo?.totale ?? pos + neg;

  // Header profilo
  reviewPositive.textContent = pos;
  reviewNegative.textContent = neg;
  reviewCounters.classList.remove('d-none');

  // Card riepilogativa
  reviewTotal.textContent = tot;
  reviewPositiveCard.textContent = pos;
  reviewNegativeCard.textContent = neg;

  // Badge conteggio nella sezione lista
  if (tot > 0) {
    reviewCountLabel.textContent = tot;
    reviewCountLabel.classList.remove('d-none');
  }
}

/**
 * Renderizza una singola recensione come HTML.
 * @param {Object} review
 * @returns {string}
 */
function renderReviewItem(review) {
  const icon = review.positiva
    ? '<i class="bi bi-hand-thumbs-up-fill review-icon-positive"></i>'
    : '<i class="bi bi-hand-thumbs-down-fill review-icon-negative"></i>';

  const author = review.recensore
    ? `${review.recensore.nome || ''} ${review.recensore.cognome || ''}`.trim()
    : 'Utente';

  const testoHtml = review.testo
    ? `<p class="review-text mb-0 mt-2">${escapeHtml(review.testo)}</p>`
    : '<p class="review-text mb-0 mt-2 fst-italic">Nessun commento testuale.</p>';

  return `
    <article class="review-item">
      <div class="d-flex justify-content-between align-items-center gap-3">
        <span class="fw-semibold">${icon} ${escapeHtml(author)}</span>
        <span class="text-muted small">${formatDate(review.data)}</span>
      </div>
      ${testoHtml}
    </article>
  `;
}

/**
 * Renderizza le recensioni iniziali (da /profilo).
 * @param {Object} recensioni — { recenti: [], positive, negative, totale }
 */
function renderInitialReviews(recensioni) {
  const items = recensioni?.recenti || [];
  if (items.length === 0) {
    reviewsContainer.innerHTML = '<p class="text-muted mb-0">Nessuna recensione ricevuta.</p>';
    return;
  }

  reviewsContainer.innerHTML = items.map(renderReviewItem).join('');
}

/**
 * Carica recensioni paginate via GET /api/v1/users/:id/recensioni?page=N&limit=10.
 * Appende i risultati alla lista esistente.
 */
async function loadMoreReviews() {
  const id = getProfileId();
  if (!id) return;

  btnLoadMore.disabled = true;
  btnLoadMore.classList.add('btn-loading');

  const res = await api.get(
    `/api/v1/users/${encodeURIComponent(id)}/recensioni?page=${currentPage}&limit=${PAGE_SIZE}`
  );

  btnLoadMore.disabled = false;
  btnLoadMore.classList.remove('btn-loading');

  if (!res.ok) return;

  const { data: reviews, pagination } = res.data;
  totalPages = pagination?.pagine ?? 1;

  if (reviews && reviews.length > 0) {
    const html = reviews.map(renderReviewItem).join('');
    reviewsContainer.insertAdjacentHTML('beforeend', html);
  }

  // Nascondi il bottone se non ci sono altre pagine
  if (currentPage >= totalPages) {
    loadMoreWrapper.classList.add('d-none');
  }
}

/**
 * Escape semplice per evitare XSS nel rendering.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

async function loadPublicProfile() {
  const id = getProfileId();
  if (!id) {
    showProfileAlert('ID profilo mancante.');
    profileName.textContent = 'Profilo non disponibile';
    return;
  }

  const response = await api.get(`/api/v1/users/${encodeURIComponent(id)}/profilo`, {
    auth: false,
  });
  if (!response.ok) {
    showProfileAlert(response.error || 'Impossibile caricare il profilo pubblico.');
    profileName.textContent = 'Profilo non disponibile';
    return;
  }

  const { user, recensioni } = response.data;
  const fullName = `${user.nome || ''} ${user.cognome || ''}`.trim() || 'Utente RE-VALUE';
  profileName.textContent = fullName;
  profileMeta.textContent = user.isSospeso ? 'Account sospeso' : 'Utente registrato';
  profileCity.textContent = user.citta || 'Non indicata';
  profileDescription.textContent = user.descrizione || 'Nessuna descrizione pubblica.';
  profileCreated.textContent = formatDate(user.createdAt);

  renderAvatar(user);
  renderCounters(recensioni);
  renderInitialReviews(recensioni);

  // Se ci sono più di 5 recensioni totali, mostra il pulsante "Carica altre"
  const totale = recensioni?.totale ?? 0;
  if (totale > 5) {
    // La prima pagina (limit=5) è già mostrata dal /profilo endpoint.
    // Il paginato parte dalla pagina 1 con limit=10, quindi per evitare
    // duplicati rimuoviamo le iniziali e ricarchiamo dalla pagina 1.
    // Approccio più semplice: alla prima pressione, puliamo e carichiamo pagina 1.
    currentPage = 1;
    totalPages = Math.ceil(totale / PAGE_SIZE);
    loadMoreWrapper.classList.remove('d-none');
  }
}

// ── Event Listeners ──
btnLoadMore.addEventListener('click', async () => {
  // Al primo click: pulisci le anteprime e carica la pagina 1 completa (10 elementi)
  if (currentPage === 1) {
    reviewsContainer.innerHTML = '';
  }
  await loadMoreReviews();
  currentPage++;
  if (currentPage > totalPages) {
    loadMoreWrapper.classList.add('d-none');
  }
});

window.addEventListener('DOMContentLoaded', loadPublicProfile);
