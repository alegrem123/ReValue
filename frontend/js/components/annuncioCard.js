/**
 * annuncioCard.js
 * Componente card per la pagina catalogo.
 */

function formatDateItalian(dateInput) {
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatDistanceLabel(distanceKm) {
  if (distanceKm == null || Number.isNaN(distanceKm)) {
    return 'Distanza non disponibile';
  }
  return `${distanceKm.toFixed(1)} km`;
}

function statoBadgeClass(stato) {
  const map = {
    'disponibile': 'badge-stato-disponibile',
    'prenotato':   'badge-stato-prenotato',
    'scambiato':   'badge-stato-scambiato',
    'scaduto':     'badge-stato-scaduto',
    'sospeso':     'badge-stato-sospeso',
  };
  return map[(stato || '').toLowerCase()] || 'badge-stato-disponibile';
}

function createAnnuncioCard(annuncio) {
  const foto =
    annuncio.oggetto?.foto?.[0] ||
    'https://via.placeholder.com/420x220/ced4da/6c757d?text=Immagine+non+disponibile';
  const titolo = annuncio.titolo || 'Annuncio senza titolo';
  const scadenza = annuncio.dataScadenza
    ? formatDateItalian(annuncio.dataScadenza)
    : 'Data non disponibile';
  const distanza = formatDistanceLabel(annuncio.distanza);
  const dettaglioUrl = `annuncio.html?id=${annuncio._id}`;
  const stato = annuncio.stato || 'disponibile';
  const categoria = annuncio.oggetto?.categoria || annuncio.categoria || '';
  const crediti = annuncio.creditiRichiesti ?? annuncio.crediti ?? 0;

  const col = document.createElement('div');
  col.className = 'col-md-6 col-lg-4 mb-4';
  col.innerHTML = `
    <a href="${dettaglioUrl}" class="text-decoration-none text-reset d-block h-100">
      <div class="rv-annuncio-card rv-reveal h-100">
        <div class="rv-card-img-wrapper">
          <img src="${foto}" alt="${titolo}" loading="lazy" />
        </div>
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
            <h3 class="card-title mb-0">${titolo}</h3>
            <span class="badge rounded-pill flex-shrink-0 ${statoBadgeClass(stato)}">${stato}</span>
          </div>
          <p class="text-muted small mb-2">
            <i class="bi bi-tag me-1"></i>${categoria}
          </p>
          <div class="d-flex justify-content-between align-items-center mt-auto">
            <span class="small text-muted">
              <i class="bi bi-clock me-1"></i>${scadenza}
            </span>
            <span class="rv-card-credits">
              <i class="bi bi-gem me-1"></i>${crediti} cr.
            </span>
          </div>
        </div>
      </div>
    </a>
  `;

  return col;
}

window.createAnnuncioCard = createAnnuncioCard;
window.formatDistanceLabel = formatDistanceLabel;

function activateCardReveal() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.rv-annuncio-card.rv-reveal')
      .forEach(function(el) { el.classList.add('rv-visible'); });
    return;
  }
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        e.target.classList.add('rv-visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.rv-annuncio-card.rv-reveal:not(.rv-visible)')
    .forEach(function(el) { observer.observe(el); });
}
window.activateCardReveal = activateCardReveal;
