/**
 * locationPicker.js
 * Picker Leaflet per compilare latitudine/longitudine nel form annuncio.
 */

(function initLocationPicker() {
  const mapElement = document.getElementById('annuncio-location-map');
  const latInput = document.getElementById('annuncio-lat');
  const lngInput = document.getElementById('annuncio-lng');

  if (!mapElement || !latInput || !lngInput || !window.L) return;

  const fallbackPosition = [46.0667, 11.1211];
  const startLat = Number(latInput.value);
  const startLng = Number(lngInput.value);
  const hasInitialPosition = Number.isFinite(startLat) && Number.isFinite(startLng);
  const initialPosition = hasInitialPosition ? [startLat, startLng] : fallbackPosition;

  const map = L.map(mapElement, {
    center: initialPosition,
    zoom: hasInitialPosition ? 15 : 13,
    scrollWheelZoom: false,
  });
  let marker = null;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  function setMarker(lat, lng, zoom = false) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const position = [lat, lng];
    if (!marker) {
      marker = L.marker(position).addTo(map);
    } else {
      marker.setLatLng(position);
    }

    if (zoom) {
      map.setView(position, 15);
    }
  }

  function updateInputs(lat, lng) {
    latInput.value = lat.toFixed(6);
    lngInput.value = lng.toFixed(6);
    latInput.dispatchEvent(new Event('change', { bubbles: true }));
    lngInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function syncFromInputs() {
    const lat = Number(latInput.value);
    const lng = Number(lngInput.value);
    setMarker(lat, lng, true);
  }

  function repairMapSize() {
    map.invalidateSize();
    window.requestAnimationFrame(() => map.invalidateSize());
    window.setTimeout(() => map.invalidateSize(), 150);
    window.setTimeout(() => map.invalidateSize(), 500);
  }

  map.on('click', (event) => {
    const { lat, lng } = event.latlng;
    updateInputs(lat, lng);
    setMarker(lat, lng);
  });

  latInput.addEventListener('input', syncFromInputs);
  lngInput.addEventListener('input', syncFromInputs);

  if (hasInitialPosition) {
    setMarker(startLat, startLng);
  } else {
    updateInputs(fallbackPosition[0], fallbackPosition[1]);
    setMarker(fallbackPosition[0], fallbackPosition[1]);
  }

  repairMapSize();
  window.addEventListener('resize', repairMapSize);
})();
