/**
 * locationPicker.js
 * Picker Leaflet per compilare latitudine/longitudine nel form annuncio.
 */

(function initLocationPicker() {
  const mapElement = document.getElementById('annuncio-location-map');
  const latInput = document.getElementById('annuncio-lat');
  const lngInput = document.getElementById('annuncio-lng');
  const cityLatInput = document.getElementById('annuncio-city-lat');
  const cityLngInput = document.getElementById('annuncio-city-lng');
  const addressInputs = ['annuncio-paese', 'annuncio-regione', 'annuncio-provincia', 'annuncio-comune', 'annuncio-via']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

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
  let geocodeTimer = null;

  function createLocationIcon() {
    return L.divIcon({
      className: 'catalog-pin catalog-pin-active location-picker-pin',
      html: '<span></span>',
      iconSize: [34, 42],
      iconAnchor: [17, 40],
      popupAnchor: [0, -36],
    });
  }

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  function setMarker(lat, lng, zoom = false) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const position = [lat, lng];
    if (!marker) {
      marker = L.marker(position, { icon: createLocationIcon() }).addTo(map);
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

  function setCityCoordinates(lat, lng) {
    if (!cityLatInput || !cityLngInput) return;
    cityLatInput.value = lat.toFixed(6);
    cityLngInput.value = lng.toFixed(6);
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

  function addressValue(id) {
    return document.getElementById(id)?.value.trim() || '';
  }

  function buildAddressQuery({ includeStreet = true } = {}) {
    return [
      includeStreet ? addressValue('annuncio-via') : '',
      addressValue('annuncio-comune'),
      addressValue('annuncio-provincia'),
      addressValue('annuncio-regione'),
      addressValue('annuncio-paese'),
    ].filter(Boolean).join(', ');
  }

  async function geocode(query) {
    if (!query) return null;
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('q', query);

    const response = await fetch(url.toString());
    const results = await response.json().catch(() => []);
    const first = Array.isArray(results) ? results[0] : null;
    if (!first) return null;

    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  async function reverseGeocode(lat, lng) {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'json');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('zoom', '18');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString());
    const result = await response.json().catch(() => null);
    return result?.address || null;
  }

  function setAddressField(id, value) {
    const input = document.getElementById(id);
    if (!input || !value) return;
    if (input.tagName === 'SELECT' && !Array.from(input.options).some((option) => option.value === value)) {
      input.add(new Option(value, value));
    }
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function updateAddressFromPosition(lat, lng) {
    try {
      const address = await reverseGeocode(lat, lng);
      if (!address) return;

      const roadParts = [
        address.road || address.pedestrian || address.footway || address.path,
        address.house_number,
      ].filter(Boolean);

      setAddressField('annuncio-paese', address.country);
      setAddressField('annuncio-regione', address.state || address.region);
      setAddressField('annuncio-provincia', address.province || address.county);
      setAddressField('annuncio-comune', address.city || address.town || address.village || address.municipality);
      setAddressField('annuncio-via', roadParts.join(' '));

      const cityQuery = buildAddressQuery({ includeStreet: false });
      const cityPosition = await geocode(cityQuery);
      if (cityPosition) setCityCoordinates(cityPosition.lat, cityPosition.lng);
    } catch {
      // Reverse geocoding opzionale: il pin resta comunque selezionato.
    }
  }

  async function updatePreviewFromAddress() {
    const cityQuery = buildAddressQuery({ includeStreet: false });
    const fullQuery = buildAddressQuery({ includeStreet: true });

    try {
      const [cityPosition, exactPosition] = await Promise.all([
        geocode(cityQuery),
        geocode(fullQuery),
      ]);

      if (cityPosition) setCityCoordinates(cityPosition.lat, cityPosition.lng);
      const position = exactPosition || cityPosition;
      if (position) {
        updateInputs(position.lat, position.lng);
        setMarker(position.lat, position.lng, true);
        repairMapSize();
      }
    } catch {
      // La geocodifica esterna non deve bloccare la compilazione manuale.
    }
  }

  function scheduleAddressPreview() {
    window.clearTimeout(geocodeTimer);
    geocodeTimer = window.setTimeout(updatePreviewFromAddress, 600);
  }

  map.on('click', (event) => {
    const { lat, lng } = event.latlng;
    updateInputs(lat, lng);
    setMarker(lat, lng);
    updateAddressFromPosition(lat, lng);
  });

  latInput.addEventListener('input', syncFromInputs);
  lngInput.addEventListener('input', syncFromInputs);
  addressInputs.forEach((input) => {
    input.addEventListener('change', scheduleAddressPreview);
    input.addEventListener('blur', scheduleAddressPreview);
  });

  if (hasInitialPosition) {
    setMarker(startLat, startLng);
  } else {
    updateInputs(fallbackPosition[0], fallbackPosition[1]);
    setCityCoordinates(fallbackPosition[0], fallbackPosition[1]);
    setMarker(fallbackPosition[0], fallbackPosition[1]);
  }

  repairMapSize();
  window.addEventListener('resize', repairMapSize);
})();
