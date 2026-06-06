/**
 * annuncioCard.js
 * Componente card per la pagina catalogo.
 */

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

const CARD_TIER_A = { acqMin: 10, acqMax: 100 };
const CARD_TIER_B = { acqMin:  6, acqMax:  60 };
const CARD_TIER_C = { acqMin:  3, acqMax:  30 };

const CARD_CATEGORIA_TIER = {
  'Elettronica':          CARD_TIER_A,
  'Elettrodomestici':     CARD_TIER_A,
  'Arredo e mobili':      CARD_TIER_A,
  'Biciclette e mobilita': CARD_TIER_A,
  'Ricambi auto e moto':  CARD_TIER_A,
  'Utensili e attrezzi':  CARD_TIER_A,
  'Cucina e casalinghi':  CARD_TIER_B,
  'Sport e tempo libero': CARD_TIER_B,
  'Musica e strumenti':   CARD_TIER_B,
  'Ferramenta':           CARD_TIER_B,
  'Giardino e outdoor':   CARD_TIER_B,
  'Edilizia leggera':     CARD_TIER_B,
  'Bagno e sanitari':     CARD_TIER_B,
  'Illuminazione':        CARD_TIER_B,
  'Libri e manuali':      CARD_TIER_C,
  'Cancelleria':          CARD_TIER_C,
  'Decorazioni':          CARD_TIER_C,
  'Giocattoli':           CARD_TIER_C,
  'Infanzia':             CARD_TIER_C,
  'Materiale scolastico': CARD_TIER_C,
  'Tessili e biancheria': CARD_TIER_C,
  'Vasi e contenitori':   CARD_TIER_C,
  'Altro':                CARD_TIER_C,
};

const MAX_FINESTRA_CARD_MS = 14 * 24 * 60 * 60 * 1000;

function calcolaCreditiCard(categoria, dataScadenza) {
  if (!dataScadenza) return CARD_TIER_C.acqMin;
  const tier = CARD_CATEGORIA_TIER[categoria] || CARD_TIER_C;
  const remaining = Math.max(0, new Date(dataScadenza).getTime() - Date.now());
  const ratio = 1 - Math.min(1, remaining / MAX_FINESTRA_CARD_MS);
  return Math.round(tier.acqMin + (tier.acqMax - tier.acqMin) * ratio);
}

function createAnnuncioCard(annuncio) {
  const foto =
    annuncio.oggetto?.foto?.[0] ||
    'https://via.placeholder.com/420x220/ced4da/6c757d?text=Immagine+non+disponibile';
  const titolo = escapeHtml(annuncio.titolo) || 'Annuncio senza titolo';
  const scadenza = annuncio.dataScadenza
    ? formatDateItalian(annuncio.dataScadenza)
    : 'Data non disponibile';
  const distanza = formatDistanceLabel(annuncio.distanza);
  const dettaglioUrl = `annuncio.html?id=${encodeURIComponent(annuncio._id)}`;
  const stato = escapeHtml(annuncio.stato) || 'disponibile';
  const categoria = escapeHtml(annuncio.oggetto?.categoria || annuncio.categoria || '');
  const crediti = calcolaCreditiCard(categoria, annuncio.dataScadenza);

  const col = document.createElement('div');
  col.className = 'col-md-6 col-lg-4 mb-4';
  col.innerHTML = `
    <a href="${dettaglioUrl}" class="text-decoration-none text-reset d-block h-100">
      <div class="rv-annuncio-card rv-reveal h-100">
        <div class="rv-card-img-wrapper">
          <img src="${escapeHtml(foto)}" alt="${titolo}" loading="lazy" />
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
            <span class="rv-card-credits"
                  data-categoria="${escapeHtml(categoria)}"
                  data-scadenza="${escapeHtml(annuncio.dataScadenza || '')}">
              <i class="bi bi-gem me-1"></i><span class="rv-credits-value">${crediti}</span> cr.
            </span>
          </div>
        </div>
      </div>
    </a>
  `;

  return col;
}

window.calcolaCreditiCard = calcolaCreditiCard;

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
