/**
 * qr-display.js
 * Pagina QR display per il donatore (UC3).
 * Chiama POST /api/qr/genera, renderizza QR via qrcode.js, mostra countdown scadenza.
 */

const qrLoading       = document.getElementById('qr-loading');
const qrContent       = document.getElementById('qr-content');
const qrAlert         = document.getElementById('qr-alert');
const qrCanvas        = document.getElementById('qr-canvas');
const qrAnnuncioTitle = document.getElementById('qr-annuncio-title');
const qrCountdown     = document.getElementById('qr-countdown');
const btnRigenera     = document.getElementById('btn-rigenera');

let scadenzaDate  = null;
let countdownTimer = null;

function showAlert(msg, type = 'danger') {
  qrAlert.textContent = msg;
  qrAlert.className = `alert alert-${type}`;
  qrAlert.classList.remove('d-none');
}

function parseQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);

  function tick() {
    if (!scadenzaDate) return;
    const diff = scadenzaDate.getTime() - Date.now();
    if (diff <= 0) {
      qrCountdown.textContent = 'QR scaduto — rigenera';
      qrCountdown.classList.add('text-danger');
      clearInterval(countdownTimer);
      return;
    }
    const h  = Math.floor(diff / 3600000);
    const m  = Math.floor((diff % 3600000) / 60000);
    const s  = Math.floor((diff % 60000) / 1000);
    qrCountdown.textContent =
      `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    qrCountdown.classList.remove('text-danger');
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

async function generaQR(prenotazioneId) {
  qrLoading.classList.remove('d-none');
  qrContent.classList.add('d-none');
  qrAlert.classList.add('d-none');

  const res = await api.post('/api/qr/genera', { prenotazioneId });

  qrLoading.classList.add('d-none');

  if (!res.ok) {
    showAlert(res.error || 'Impossibile generare il QR.');
    return;
  }

  const { codice, scadenza, annuncio } = res.data ?? res;

  // Render QR su canvas
  await QRCode.toCanvas(qrCanvas, codice, {
    width: 280,
    color: { dark: '#1B5E20', light: '#ffffff' },
  });

  scadenzaDate = new Date(scadenza);
  if (annuncio?.titolo) qrAnnuncioTitle.textContent = annuncio.titolo;

  startCountdown();
  qrContent.classList.remove('d-none');
}

async function init() {
  if (!localStorage.getItem('jwt')) {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    return;
  }

  const prenotazioneId = parseQueryParam('prenotazione');
  if (!prenotazioneId) {
    showAlert('ID prenotazione mancante. Torna alle prenotazioni.');
    return;
  }

  btnRigenera.addEventListener('click', () => generaQR(prenotazioneId));

  await generaQR(prenotazioneId);
}

window.addEventListener('DOMContentLoaded', init);
