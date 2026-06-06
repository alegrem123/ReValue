/**
 * catalog.js
 * Logica della pagina catalogo.
 */

const catalogContainer = document.getElementById('catalog-container');
const catalogSpinner = document.getElementById('catalog-spinner');
const catalogAlert = document.getElementById('catalog-alert');
const catalogGrid = document.getElementById('catalog-grid');
const catalogFilters = document.getElementById('catalog-filters');
const usePositionBtn = document.getElementById('use-position-btn');

const catalogState = {
  lat: null,
  lng: null,
};

function setAlert(message, type = 'danger') {
  if (!catalogAlert) return;
  catalogAlert.textContent = message;
  catalogAlert.classList.remove('d-none', 'alert-success', 'alert-danger', 'alert-warning');
  catalogAlert.classList.add('alert', `alert-${type}`);
}

function clearAlert() {
  if (!catalogAlert) return;
  catalogAlert.classList.add('d-none');
  catalogAlert.textContent = '';
}

function buildCatalogQuery() {
  const params = new URLSearchParams();
  if (!catalogFilters) return params.toString();

  const formData = new FormData(catalogFilters);
  formData.forEach((value, key) => {
    const normalized = String(value).trim();
    if (normalized) params.set(key, normalized);
  });

  if (params.has('raggio') && catalogState.lat != null && catalogState.lng != null) {
    params.set('lat', catalogState.lat);
    params.set('lng', catalogState.lng);
  } else {
    params.delete('raggio');
  }

  return params.toString();
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const earthRadiusKm = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getPublicCoordinates(annuncio) {
  const lat = annuncio.indirizzo?.latitudineComune ?? annuncio.latitudineComune ?? annuncio.latitudine;
  const lng = annuncio.indirizzo?.longitudineComune ?? annuncio.longitudineComune ?? annuncio.longitudine;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  return { lat: Number(lat), lng: Number(lng) };
}

function enrichWithDistance(annunci) {
  if (catalogState.lat == null || catalogState.lng == null) return annunci;

	  const userLat = Number(catalogState.lat);
	  const userLng = Number(catalogState.lng);
	  return annunci.map((annuncio) => {
	    const coords = getPublicCoordinates(annuncio);
	    if (!coords) {
	      return annuncio;
	    }

    return {
      ...annuncio,
	      distanza: getDistanceKm(
	        userLat,
	        userLng,
	        coords.lat,
	        coords.lng
	      ),
    };
  });
}

async function loadCatalogo() {
  if (!catalogContainer || !catalogGrid || !catalogSpinner || !catalogAlert)
    return;

  catalogSpinner.classList.remove('d-none');
  clearAlert();
  catalogGrid.innerHTML = '';

  const query = buildCatalogQuery();
  const endpoint = query ? `/api/v1/annunci?${query}` : '/api/v1/annunci';
  const response = await api.get(endpoint);
  catalogSpinner.classList.add('d-none');

  if (!response.ok) {
    setAlert(response.error || 'Errore nel caricamento del catalogo.');
    return;
  }

  const annunci = enrichWithDistance(response.data?.data || []);
  window.updateCatalogMap?.(annunci);

  if (annunci.length === 0) {
    catalogGrid.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info">Nessun annuncio disponibile al momento.</div>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  annunci.forEach((annuncio) => {
    const card = window.createAnnuncioCard(annuncio);
    fragment.appendChild(card);
  });
  catalogGrid.appendChild(fragment);
  if (typeof window.activateCardReveal === 'function') window.activateCardReveal();
}

function handleFilterSubmit(event) {
  event.preventDefault();

  const distance = catalogFilters?.elements?.raggio?.value;
  if (distance && (catalogState.lat == null || catalogState.lng == null)) {
    setAlert('Per filtrare per distanza devi prima usare la tua posizione.', 'warning');
    return;
  }

  loadCatalogo();
}

function handleFilterReset() {
  window.setTimeout(loadCatalogo, 0);
}

function useCurrentPosition() {
  if (!navigator.geolocation) {
    setAlert('Geolocalizzazione non supportata dal browser.', 'warning');
    return;
  }

  if (usePositionBtn) {
    usePositionBtn.disabled = true;
    usePositionBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Rilevo posizione';
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      catalogState.lat = position.coords.latitude.toFixed(6);
      catalogState.lng = position.coords.longitude.toFixed(6);
      if (usePositionBtn) {
        usePositionBtn.disabled = false;
        usePositionBtn.innerHTML = '<i class="bi bi-geo-alt-fill"></i> Posizione attiva';
      }
      const distanceSelect = catalogFilters?.elements?.raggio;
      const distanceHelp = document.getElementById('filter-distance-help');
      if (distanceSelect) distanceSelect.disabled = false;
      if (distanceHelp) distanceHelp.textContent = 'Seleziona un raggio per filtrare gli annunci vicini.';
      clearAlert();
      loadCatalogo();
    },
    () => {
      if (usePositionBtn) {
        usePositionBtn.disabled = false;
        usePositionBtn.innerHTML = '<i class="bi bi-geo-alt"></i> Usa posizione';
      }
      setAlert('Non è stato possibile rilevare la posizione.', 'warning');
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
}

function tickCredits() {
  document.querySelectorAll('.rv-card-credits[data-scadenza]').forEach((el) => {
    const categoria = el.dataset.categoria;
    const dataScadenza = el.dataset.scadenza;
    if (!dataScadenza) return;

    const nuovi = window.calcolaCreditiCard(categoria, dataScadenza);
    const valueEl = el.querySelector('.rv-credits-value');
    if (!valueEl) return;

    const attuali = parseInt(valueEl.textContent, 10);
    if (nuovi !== attuali) {
      valueEl.textContent = nuovi;
      el.classList.remove('rv-card-credits--bump');
      void el.offsetWidth; // reflow per ripartire animazione
      el.classList.add('rv-card-credits--bump');
      el.addEventListener('animationend', () => el.classList.remove('rv-card-credits--bump'), { once: true });
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  window.initCatalogMap?.();
  catalogFilters?.addEventListener('submit', handleFilterSubmit);
  catalogFilters?.addEventListener('reset', handleFilterReset);
  usePositionBtn?.addEventListener('click', useCurrentPosition);
  loadCatalogo();
  setInterval(tickCredits, 60_000);
});
