/**
 * createAnnuncio.js
 * Form creazione annuncio con foto base64 e datepicker.
 */

const form = document.getElementById('create-annuncio-form');
const alertEl = document.getElementById('create-annuncio-alert');
const submitBtn = document.getElementById('create-annuncio-submit');
const photosInput = document.getElementById('annuncio-photos');
const previewGrid = document.getElementById('photo-preview-grid');
const useLocationBtn = document.getElementById('use-location-btn');
const latInput = document.getElementById('annuncio-lat');
const lngInput = document.getElementById('annuncio-lng');
const cityLatInput = document.getElementById('annuncio-city-lat');
const cityLngInput = document.getElementById('annuncio-city-lng');
const deadlineInput = document.getElementById('annuncio-deadline');
const paeseInput = document.getElementById('annuncio-paese');
const regioneInput = document.getElementById('annuncio-regione');
const provinciaInput = document.getElementById('annuncio-provincia');
const comuneInput = document.getElementById('annuncio-comune');

let photoBase64 = [];
let territoryOptions = null;

function requireAuth() {
  if (!localStorage.getItem('jwt')) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `login.html?redirect=${redirect}`;
    return false;
  }
  return true;
}

function showAlert(message, type = 'danger') {
  alertEl.textContent = message;
  alertEl.className = `alert alert-${type}`;
  alertEl.classList.remove('d-none');
}

function clearAlert() {
  alertEl.classList.add('d-none');
  alertEl.textContent = '';
}

function normalizeOption(value) {
  return String(value || '').trim().toLocaleLowerCase('it-IT');
}

function matchesTerritoryOption(optionValue, selectedValue) {
  const option = normalizeOption(optionValue);
  const selected = normalizeOption(selectedValue);
  if (!selected) return true;
  return option === selected || option.startsWith(`${selected}/`) || selected.startsWith(`${option}/`);
}

function clearLocationCoordinates() {
  latInput.value = '';
  lngInput.value = '';
  cityLatInput.value = '';
  cityLngInput.value = '';
}

function setSelectOptions(select, options, {
  getValue = (item) => item,
  getLabel = (item) => getValue(item),
  placeholder = '',
  keepValue = true,
} = {}) {
  if (!select || !Array.isArray(options)) return;

  const previousValue = keepValue ? select.value : '';
  const unique = new Map();
  options.forEach((item) => {
    const value = String(getValue(item) || '').trim();
    const label = String(getLabel(item) || value).trim();
    const key = `${value}::${label}`;
    if (!value || unique.has(key)) return;
    unique.set(key, { value, label });
  });

  const placeholderOption = placeholder
    ? `<option value=""${previousValue ? '' : ' selected'} disabled>${escapeOption(placeholder)}</option>`
    : '';

  let selectedAssigned = false;
  select.innerHTML = placeholderOption + Array.from(unique.values())
    .map(({ value, label }) => {
      const selected = value === previousValue && !selectedAssigned;
      if (selected) selectedAssigned = true;
      return `<option value="${escapeOption(value)}"${selected ? ' selected' : ''}>${escapeOption(label)}</option>`;
    })
    .join('');

  if (previousValue && !Array.from(unique.values()).some((option) => option.value === previousValue)) {
    select.value = '';
  }
}

function escapeOption(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function updateProvinceOptions() {
  if (!territoryOptions) return;
  const selectedRegion = regioneInput.value;
  const province = selectedRegion
    ? territoryOptions.province.filter((provincia) => matchesTerritoryOption(provincia.regione, selectedRegion))
    : territoryOptions.province;

  setSelectOptions(provinciaInput, province, {
    getValue: (provincia) => provincia.nome,
    getLabel: (provincia) => [provincia.nome, provincia.sigla, provincia.regione].filter(Boolean).join(' · '),
    placeholder: 'Seleziona provincia',
  });
}

function updateComuneOptions() {
  if (!territoryOptions) return;
  const selectedRegion = regioneInput.value;
  const selectedProvince = provinciaInput.value;
  let comuni = territoryOptions.comuni;

  if (selectedProvince) {
    comuni = comuni.filter((comune) => matchesTerritoryOption(comune.provincia, selectedProvince));
  } else if (selectedRegion) {
    comuni = comuni.filter((comune) => matchesTerritoryOption(comune.regione, selectedRegion));
  }

  setSelectOptions(comuneInput, comuni, {
    getValue: (comune) => comune.nome,
    getLabel: (comune) => [comune.nome, comune.siglaProvincia || comune.provincia, comune.regione].filter(Boolean).join(' · '),
    placeholder: 'Seleziona comune',
  });
}

async function loadTerritoryOptions() {
  try {
    const response = await fetch('../data/italian-territories.json');
    if (!response.ok) throw new Error('territory_options_unavailable');
    territoryOptions = await response.json();

    setSelectOptions(paeseInput, territoryOptions.stati || []);
    setSelectOptions(regioneInput, territoryOptions.regioni || [], {
      placeholder: 'Seleziona regione',
    });
    updateProvinceOptions();
    updateComuneOptions();
  } catch {
    territoryOptions = null;
  }
}

function setMinDeadline() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  deadlineInput.min = now.toISOString().slice(0, 16);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Errore lettura immagine'));
    reader.readAsDataURL(file);
  });
}

function renderPreviews() {
  previewGrid.innerHTML = photoBase64.map((src, index) => `
    <div class="col-4">
      <img src="${src}" alt="Anteprima foto ${index + 1}" class="photo-preview rounded-3 border" />
    </div>
  `).join('');
}

async function handlePhotosChange() {
  clearAlert();
  const files = Array.from(photosInput.files || []);
  if (files.length > 5) {
    photosInput.value = '';
    photoBase64 = [];
    renderPreviews();
    showAlert('Puoi caricare al massimo 5 foto.');
    return;
  }

  try {
    photoBase64 = await Promise.all(files.map(readFileAsDataUrl));
    renderPreviews();
  } catch (err) {
    showAlert(err.message);
  }
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    showAlert('Geolocalizzazione non supportata dal browser.', 'warning');
    return;
  }

  useLocationBtn.disabled = true;
  useLocationBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Rilevo posizione';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      latInput.value = position.coords.latitude.toFixed(6);
      lngInput.value = position.coords.longitude.toFixed(6);
      latInput.dispatchEvent(new Event('input', { bubbles: true }));
      lngInput.dispatchEvent(new Event('input', { bubbles: true }));
      useLocationBtn.disabled = false;
      useLocationBtn.innerHTML = '<i class="bi bi-geo-alt-fill"></i> Posizione inserita';
    },
    () => {
      useLocationBtn.disabled = false;
      useLocationBtn.innerHTML = '<i class="bi bi-geo-alt"></i> Usa posizione attuale';
      showAlert('Non è stato possibile rilevare la posizione.', 'warning');
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
}

function addressValue(data, key) {
  return String(data.get(key) || '').trim();
}

function buildAddressQuery(data, { includeStreet = true } = {}) {
  return [
    includeStreet ? addressValue(data, 'via') : '',
    addressValue(data, 'comune'),
    addressValue(data, 'provincia'),
    addressValue(data, 'regione'),
    addressValue(data, 'paese'),
  ].filter(Boolean).join(', ');
}

async function geocodeAddress(query) {
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

async function ensureGeocoded(data) {
  const cityHasCoordinates = cityLatInput.value && cityLngInput.value;
  const exactHasCoordinates = latInput.value && lngInput.value;
  if (cityHasCoordinates && exactHasCoordinates) return true;

  const cityQuery = buildAddressQuery(data, { includeStreet: false });
  const fullQuery = buildAddressQuery(data, { includeStreet: true });
  const [cityPosition, exactPosition] = await Promise.all([
    cityHasCoordinates ? null : geocodeAddress(cityQuery),
    exactHasCoordinates ? null : geocodeAddress(fullQuery),
  ]);

  if (cityPosition) {
    cityLatInput.value = cityPosition.lat.toFixed(6);
    cityLngInput.value = cityPosition.lng.toFixed(6);
  }

  const position = exactPosition || cityPosition;
  if (position && !exactHasCoordinates) {
    latInput.value = position.lat.toFixed(6);
    lngInput.value = position.lng.toFixed(6);
  }

  return Boolean(latInput.value && lngInput.value && cityLatInput.value && cityLngInput.value);
}

function buildPayload() {
  const data = new FormData(form);
  const deadline = new Date(data.get('dataScadenza'));

  return {
    titolo: String(data.get('titolo')).trim(),
    dataScadenza: deadline.toISOString(),
    latitudine: data.get('latitudine') ? Number(data.get('latitudine')) : undefined,
    longitudine: data.get('longitudine') ? Number(data.get('longitudine')) : undefined,
    indirizzo: {
      paese: addressValue(data, 'paese'),
      regione: addressValue(data, 'regione'),
      provincia: addressValue(data, 'provincia'),
      comune: addressValue(data, 'comune'),
      via: addressValue(data, 'via'),
      latitudineComune: data.get('latitudineComune') ? Number(data.get('latitudineComune')) : undefined,
      longitudineComune: data.get('longitudineComune') ? Number(data.get('longitudineComune')) : undefined,
    },
    oggetto: {
      categoria: String(data.get('categoria')).trim(),
      descrizione: String(data.get('descrizione')).trim(),
      dimensioni: data.get('dimensioni'),
      materiale: String(data.get('materiale') || '').trim(),
      foto: photoBase64,
    },
  };
}

async function handleSubmit(event) {
  event.preventDefault();
  clearAlert();

  if (new Date(deadlineInput.value) <= new Date()) {
    showAlert('La scadenza deve essere nel futuro.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Geocodifica...';

  const data = new FormData(form);
  const geocoded = await ensureGeocoded(data);
  if (!geocoded) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Pubblica annuncio';
    showAlert('Non riesco a localizzare l’indirizzo. Controlla comune e via, oppure clicca sulla mappa.');
    return;
  }

  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Pubblicazione...';

  const response = await api.post('/api/v1/annunci', buildPayload());
  if (!response.ok) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Pubblica annuncio';
    showAlert(response.error || "Impossibile creare l'annuncio.");
    return;
  }

  showAlert('Annuncio pubblicato correttamente.', 'success');
  window.setTimeout(() => {
    window.location.href = `annuncio.html?id=${response.data._id}`;
  }, 500);
}

window.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  setMinDeadline();
  loadTerritoryOptions();
  photosInput.addEventListener('change', handlePhotosChange);
  useLocationBtn.addEventListener('click', useCurrentLocation);
  [paeseInput, regioneInput, provinciaInput, comuneInput].forEach((input) => {
    input.addEventListener('input', clearLocationCoordinates);
    input.addEventListener('change', clearLocationCoordinates);
  });
  regioneInput.addEventListener('change', () => {
    updateProvinceOptions();
    updateComuneOptions();
  });
  provinciaInput.addEventListener('change', updateComuneOptions);
  form.addEventListener('submit', handleSubmit);
});
