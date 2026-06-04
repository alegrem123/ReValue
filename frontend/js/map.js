/**
 * map.js
 * Integrazione Leaflet + OpenStreetMap per il catalogo annunci.
 */

const DEFAULT_CENTER = [46.0667, 11.1211]; // Trento
const DEFAULT_ZOOM = 12;

let catalogMap = null;
let markerLayer = null;
let activeMarker = null;
const markerByAnnuncioId = new Map();

function hasCoordinates(annuncio) {
  return (
    Number.isFinite(Number(annuncio.latitudine)) &&
    Number.isFinite(Number(annuncio.longitudine))
  );
}

function buildPopupContent(annuncio) {
  const titolo = annuncio.titolo || 'Annuncio senza titolo';
  const categoria = annuncio.oggetto?.categoria || 'Categoria non indicata';
  const descrizione = annuncio.oggetto?.descrizione || 'Descrizione non disponibile';
  const materiale = annuncio.oggetto?.materiale || 'N/D';
  const dimensioni = annuncio.oggetto?.dimensioni || 'N/D';
  const distanza = Number.isFinite(Number(annuncio.distanza))
    ? `${Number(annuncio.distanza).toFixed(1)} km`
    : null;
  const dettaglioUrl = `annuncio.html?id=${annuncio._id}`;

  return `
    <article class="map-popup-card">
      <div class="map-popup-header">
        <div>
          <p class="map-popup-kicker">${categoria}</p>
          <h3>${titolo}</h3>
        </div>
        ${distanza ? `<span class="map-popup-distance">${distanza}</span>` : ''}
      </div>
      <p class="map-popup-description">${descrizione}</p>
      <dl class="map-popup-meta">
        <div><dt>Materiale</dt><dd>${materiale}</dd></div>
        <div><dt>Dimensioni</dt><dd>${dimensioni}</dd></div>
      </dl>
      <a class="btn btn-sm btn-success w-100" href="${dettaglioUrl}">Apri annuncio</a>
    </article>
  `;
}

function createMarkerIcon(isActive = false) {
  return L.divIcon({
    className: `catalog-pin ${isActive ? 'catalog-pin-active' : ''}`,
    html: '<span></span>',
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    popupAnchor: [0, -36],
  });
}

function setActiveMarker(marker) {
  if (activeMarker && activeMarker !== marker) {
    activeMarker.setIcon(createMarkerIcon(false));
  }
  activeMarker = marker;
  if (activeMarker) activeMarker.setIcon(createMarkerIcon(true));
}

function initCatalogMap(containerId = 'catalog-map') {
  const container = document.getElementById(containerId);
  if (!container || !window.L) return null;

  if (catalogMap) return catalogMap;

  catalogMap = L.map(container, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    scrollWheelZoom: false,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(catalogMap);

  markerLayer = L.layerGroup().addTo(catalogMap);
  window.setTimeout(() => catalogMap.invalidateSize(), 150);
  return catalogMap;
}

function updateCatalogMap(annunci = []) {
  const map = initCatalogMap();
  const status = document.getElementById('catalog-map-status');
  if (!map || !markerLayer) return;

  markerLayer.clearLayers();
  markerByAnnuncioId.clear();
  activeMarker = null;

  const annunciConCoordinate = annunci.filter(hasCoordinates);
  if (annunciConCoordinate.length === 0) {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    window.setTimeout(() => map.invalidateSize(), 100);
    if (status) {
      status.textContent =
        'Nessuna posizione disponibile per gli annunci mostrati.';
    }
    return;
  }

  const bounds = [];
  annunciConCoordinate.forEach((annuncio) => {
    const lat = Number(annuncio.latitudine);
    const lng = Number(annuncio.longitudine);
    bounds.push([lat, lng]);

    const marker = L.marker([lat, lng], { icon: createMarkerIcon(false) })
      .bindPopup(buildPopupContent(annuncio), {
        className: 'catalog-map-popup',
        closeButton: true,
        maxWidth: 320,
        minWidth: 260,
      })
      .addTo(markerLayer);

    marker.on('click', () => setActiveMarker(marker));
    marker.on('popupopen', () => setActiveMarker(marker));
    marker.on('popupclose', () => {
      if (activeMarker === marker) {
        marker.setIcon(createMarkerIcon(false));
        activeMarker = null;
      }
    });
    markerByAnnuncioId.set(String(annuncio._id), marker);
  });

  window.setTimeout(() => map.invalidateSize(), 100);
  map.fitBounds(bounds, {
    padding: [32, 32],
    maxZoom: 15,
  });

  if (status) {
    status.textContent = `${annunciConCoordinate.length} marker sulla mappa`;
  }
}

window.initCatalogMap = initCatalogMap;
window.updateCatalogMap = updateCatalogMap;
