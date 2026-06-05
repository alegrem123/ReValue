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
const filterDistance = document.getElementById('filter-distance');
const distanceHelp = document.getElementById('filter-distance-help');
const activeFilters = document.getElementById('catalog-active-filters');
const resultsStatus = document.getElementById('catalog-results-status');

const catalogState = {
  lat: null,
  lng: null,
};

const filterLabels = {
  categoria: 'Categoria',
  dimensione: 'Dimensione',
  materiale: 'Materiale',
  raggio: 'Distanza',
  scadenzaPrima: 'Scadenza entro',
  ordinamento: 'Ordina',
};

const sortLabels = {
  dataScadenza_asc: 'Scadenza più vicina',
  dataScadenza_desc: 'Scadenza più lontana',
  valore_desc: 'Valore più alto',
  valore_asc: 'Valore più basso',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setResultsStatus(message) {
  if (resultsStatus) resultsStatus.textContent = message;
}

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

function updateDistanceControl() {
  const hasPosition = catalogState.lat != null && catalogState.lng != null;
  if (filterDistance) {
    filterDistance.disabled = !hasPosition;
    if (!hasPosition) filterDistance.value = '';
  }
  if (distanceHelp) {
    distanceHelp.textContent = hasPosition
      ? 'La distanza usa la tua posizione approssimata.'
      : 'Attiva la posizione per usare questo filtro.';
  }
}

function formatActiveFilterValue(key, value) {
  if (key === 'ordinamento') return sortLabels[value] || value;
  if (key === 'raggio') return `Entro ${value} km`;
  if (key === 'scadenzaPrima') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('it-IT').format(date);
    }
  }
  return value;
}

function updateActiveFilters() {
  if (!catalogFilters || !activeFilters) return;
  const chips = [];
  const formData = new FormData(catalogFilters);
  formData.forEach((value, key) => {
    const normalized = String(value).trim();
    if (!normalized) return;
    if (key === 'ordinamento' && normalized === 'dataScadenza_asc') return;
    chips.push(
      `<span class="catalog-active-filter">${escapeHtml(filterLabels[key] || key)}: ${escapeHtml(formatActiveFilterValue(key, normalized))}</span>`
    );
  });

  activeFilters.innerHTML = chips.join('');
  activeFilters.classList.toggle('d-none', chips.length === 0);
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

function enrichWithDistance(annunci) {
  if (catalogState.lat == null || catalogState.lng == null) return annunci;

  const userLat = Number(catalogState.lat);
  const userLng = Number(catalogState.lng);
  return annunci.map((annuncio) => {
    if (
      !Number.isFinite(Number(annuncio.latitudine)) ||
      !Number.isFinite(Number(annuncio.longitudine))
    ) {
      return annuncio;
    }

    return {
      ...annuncio,
      distanza: getDistanceKm(
        userLat,
        userLng,
        Number(annuncio.latitudine),
        Number(annuncio.longitudine)
      ),
    };
  });
}

async function loadCatalogo() {
  if (!catalogContainer || !catalogGrid || !catalogSpinner || !catalogAlert)
    return;

  updateDistanceControl();
  updateActiveFilters();
  setResultsStatus('Caricamento annunci...');
  catalogSpinner.classList.remove('d-none');
  clearAlert();
  catalogGrid.innerHTML = '';

  const query = buildCatalogQuery();
  const endpoint = query ? `/api/v1/annunci?${query}` : '/api/v1/annunci';
  const response = await api.get(endpoint);
  catalogSpinner.classList.add('d-none');

  if (!response.ok) {
    setAlert(response.error || 'Errore nel caricamento del catalogo.');
    setResultsStatus('Non è stato possibile caricare gli annunci.');
    return;
  }

  const annunci = enrichWithDistance(response.data?.data || []);
  window.updateCatalogMap?.(annunci);
  setResultsStatus(
    annunci.length === 1
      ? '1 annuncio trovato.'
      : `${annunci.length} annunci trovati.`
  );

  if (annunci.length === 0) {
    catalogGrid.innerHTML = `
      <div class="col-12">
        <div class="catalog-empty-state">
          <i class="bi bi-search" aria-hidden="true"></i>
          <h3>Nessun annuncio trovato</h3>
          <p>Prova a rimuovere qualche filtro o controlla gli annunci disponibili senza limitare la distanza.</p>
          <button id="catalog-empty-reset" type="button" class="btn btn-outline-success">Pulisci filtri</button>
        </div>
      </div>
    `;
    document.getElementById('catalog-empty-reset')?.addEventListener('click', () => {
      catalogFilters?.reset();
      handleFilterReset();
    });
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
  window.setTimeout(() => {
    updateDistanceControl();
    updateActiveFilters();
    loadCatalogo();
  }, 0);
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
      updateDistanceControl();
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

window.addEventListener('DOMContentLoaded', () => {
  window.initCatalogMap?.();
  updateDistanceControl();
  updateActiveFilters();
  catalogFilters?.addEventListener('submit', handleFilterSubmit);
  catalogFilters?.addEventListener('change', updateActiveFilters);
  catalogFilters?.addEventListener('input', updateActiveFilters);
  catalogFilters?.addEventListener('reset', handleFilterReset);
  usePositionBtn?.addEventListener('click', useCurrentPosition);
  loadCatalogo();
});
