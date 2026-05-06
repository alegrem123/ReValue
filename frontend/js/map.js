/**
 * map.js
 * Integrazione Leaflet + OpenStreetMap per il catalogo annunci.
 */

const DEFAULT_CENTER = [46.0667, 11.1211]; // Trento
const DEFAULT_ZOOM = 12;

let catalogMap = null;
let markerLayer = null;

function hasCoordinates(annuncio) {
  return (
    Number.isFinite(Number(annuncio.latitudine)) &&
    Number.isFinite(Number(annuncio.longitudine))
  );
}

function buildPopupContent(annuncio) {
  const titolo = annuncio.titolo || 'Annuncio senza titolo';
  const categoria = annuncio.oggetto?.categoria || 'Categoria non indicata';
  const dettaglioUrl = `annuncio.html?id=${annuncio._id}`;

  return `
    <div class="fw-semibold mb-1">${titolo}</div>
    <div class="text-muted small mb-2">${categoria}</div>
    <a class="btn btn-sm btn-success" href="${dettaglioUrl}">Apri annuncio</a>
  `;
}

function initCatalogMap(containerId = 'catalog-map') {
  const container = document.getElementById(containerId);
  if (!container || !window.L) return null;

  if (catalogMap) return catalogMap;

  catalogMap = L.map(container, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    scrollWheelZoom: false,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(catalogMap);

  markerLayer = L.layerGroup().addTo(catalogMap);
  return catalogMap;
}

function updateCatalogMap(annunci = []) {
  const map = initCatalogMap();
  const status = document.getElementById('catalog-map-status');
  if (!map || !markerLayer) return;

  markerLayer.clearLayers();

  const annunciConCoordinate = annunci.filter(hasCoordinates);
  if (annunciConCoordinate.length === 0) {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
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

    L.marker([lat, lng])
      .bindPopup(buildPopupContent(annuncio))
      .addTo(markerLayer);
  });

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
