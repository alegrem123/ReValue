/**
 * qr-scan.js
 * Pagina QR scan per l'acquirente (UC3, RF27).
 * Modalità webcam via html5-qrcode + fallback inserimento manuale.
 * Chiama POST /api/v1/qr/valida con il codice scansionato.
 */

const scanAlert      = document.getElementById('scan-alert');
const webcamSection  = document.getElementById('webcam-section');
const manualSection  = document.getElementById('manual-section');
const btnWebcam      = document.getElementById('btn-webcam');
const btnManual      = document.getElementById('btn-manual');
const btnValidaManual = document.getElementById('btn-valida-manual');
const manualCode     = document.getElementById('manual-code');

let html5QrCode = null;
let scanning    = false;
let validated   = false;

function showAlert(msg, type = 'danger') {
  scanAlert.textContent = msg;
  scanAlert.className = `alert alert-${type}`;
  scanAlert.classList.remove('d-none');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function validaCodice(codice) {
  if (validated) return;
  if (!codice || !codice.trim()) {
    showAlert('Codice non valido.');
    return;
  }

  validated = true;
  stopScanner();

  const res = await api.post('/api/v1/qr/valida', { codice: codice.trim() });

  if (!res.ok) {
    validated = false;
    showAlert(res.error || 'Codice QR non valido o scaduto.');
    return;
  }

  const crediti = res.data?.creditiAssegnati ?? res.creditiAssegnati ?? 50;
  window.location.href = `swap-success.html?crediti=${crediti}`;
}

function stopScanner() {
  if (html5QrCode && scanning) {
    html5QrCode.stop().catch(() => {});
    scanning = false;
  }
}

function startScanner() {
  if (scanning) return;

  html5QrCode = new Html5Qrcode('qr-reader');

  html5QrCode.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    (decodedText) => validaCodice(decodedText),
    () => {}  // errori di frame ignorati silenziosamente
  ).then(() => {
    scanning = true;
  }).catch((err) => {
    showAlert(`Webcam non disponibile: ${err}. Usa l'inserimento manuale.`, 'warning');
    switchMode('manual');
  });
}

function switchMode(mode) {
  if (mode === 'webcam') {
    webcamSection.classList.remove('d-none');
    manualSection.classList.add('d-none');
    btnWebcam.classList.add('active');
    btnManual.classList.remove('active');
    startScanner();
  } else {
    stopScanner();
    webcamSection.classList.add('d-none');
    manualSection.classList.remove('d-none');
    btnManual.classList.add('active');
    btnWebcam.classList.remove('active');
  }
}

btnWebcam.addEventListener('click', () => switchMode('webcam'));
btnManual.addEventListener('click', () => switchMode('manual'));

btnValidaManual.addEventListener('click', () => validaCodice(manualCode.value));
manualCode.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') validaCodice(manualCode.value);
});

function init() {
  if (!localStorage.getItem('jwt')) {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    return;
  }
  startScanner();
}

window.addEventListener('DOMContentLoaded', init);

// Ferma scanner se si naviga via
window.addEventListener('beforeunload', stopScanner);
