/**
 * publicProfile.js
 * Logica della pagina profilo pubblico utente.
 */

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const alertBox = document.getElementById('public-profile-alert');
const profileAvatar = document.getElementById('public-profile-avatar');
const profileName = document.getElementById('public-profile-name');
const profileMeta = document.getElementById('public-profile-meta');
const profileCity = document.getElementById('public-profile-city');
const profileDescription = document.getElementById('public-profile-description');
const profileCreated = document.getElementById('public-profile-created');
const reviewTotal = document.getElementById('review-total');
const reviewPositive = document.getElementById('review-positive');
const reviewNegative = document.getElementById('review-negative');
const reviewsContainer = document.getElementById('public-profile-reviews');
const btnSegnalaUtente = document.getElementById('btn-segnala-utente');

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

function renderReviews(reviews) {
  const items = reviews?.recenti || [];
  if (items.length === 0) {
    reviewsContainer.innerHTML = '<p class="text-muted mb-0">Nessuna recensione ricevuta.</p>';
    return;
  }

  reviewsContainer.innerHTML = items.map((review) => {
    const icon = review.positiva
      ? '<i class="bi bi-hand-thumbs-up-fill text-success"></i>'
      : '<i class="bi bi-hand-thumbs-down-fill text-danger"></i>';
    const author = review.recensore
      ? escapeHtml(`${review.recensore.nome || ''} ${review.recensore.cognome || ''}`.trim())
      : 'Utente';

    return `
      <article class="border rounded-3 p-3">
        <div class="d-flex justify-content-between gap-3 mb-2">
          <span class="fw-semibold">${icon} ${author}</span>
          <span class="text-muted small">${formatDate(review.data)}</span>
        </div>
        <p class="mb-0 text-muted">${escapeHtml(review.testo) || 'Nessun commento testuale.'}</p>
      </article>
    `;
  }).join('');
}

async function loadPublicProfile() {
  const id = getProfileId();
  if (!id) {
    showProfileAlert('ID profilo mancante.');
    profileName.textContent = 'Profilo non disponibile';
    return;
  }
  if (btnSegnalaUtente) btnSegnalaUtente.href = `segnala.html?userId=${encodeURIComponent(id)}`;

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

  reviewTotal.textContent = recensioni?.totale ?? 0;
  reviewPositive.textContent = recensioni?.positive ?? 0;
  reviewNegative.textContent = recensioni?.negative ?? 0;
  renderAvatar(user);
  renderReviews(recensioni);
}

window.addEventListener('DOMContentLoaded', loadPublicProfile);
