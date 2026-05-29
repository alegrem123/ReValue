/**
 * swap-success.js
 * Pagina success scambio — mostra crediti accreditati e sezione recensione.
 * Legge ?crediti=X&prenotazioneId=Y da query string
 * (passato da qr-scan.js dopo validazione).
 *
 * Recensione (RF21, RF28):
 * - Controlla se l'utente ha già recensito questo scambio
 *   (GET /api/v1/recensioni/me/scritte, filtro lato client su prenotazione)
 * - Se non ancora recensito, mostra il form
 * - Al submit chiama POST /api/v1/recensioni con { prenotazioneId, positiva, testo }
 * - OCL #21: il backend impedisce duplicati (index unique recensore+prenotazione)
 */

window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const crediti = params.get('crediti');
  const prenotazioneId = params.get('prenotazioneId');
  const elCrediti = document.getElementById('crediti-value');

  // ── Mostra crediti ──
  if (crediti && !Number.isNaN(Number(crediti))) {
    elCrediti.textContent = `+${crediti} crediti`;
  } else {
    elCrediti.textContent = 'Crediti accreditati';
  }

  // ── Recensione ──
  if (!prenotazioneId) return; // nessuna prenotazione → niente sezione recensione

  const reviewSection     = document.getElementById('review-section');
  const reviewForm        = document.getElementById('review-form');
  const reviewAlreadyDone = document.getElementById('review-already-done');
  const reviewAlert       = document.getElementById('review-alert');
  const btnPositive       = document.getElementById('btn-review-positive');
  const btnNegative       = document.getElementById('btn-review-negative');
  const btnSubmit         = document.getElementById('btn-submit-review');
  const textarea          = document.getElementById('review-textarea');

  let selectedPositiva = null; // null = nessuna selezione, true/false = scelta

  // Mostra la sezione
  reviewSection.classList.remove('d-none');

  // ── Controlla se già recensito ──
  checkAlreadyReviewed();

  async function checkAlreadyReviewed() {
    const res = await api.get('/api/v1/recensioni/me/scritte');
    if (res.ok && Array.isArray(res.data)) {
      const existing = res.data.find(
        (r) => r.prenotazione === prenotazioneId || r.prenotazione?._id === prenotazioneId
      );
      if (existing) {
        showAlreadyDone();
      }
    }
    // Se la chiamata fallisce, mostriamo comunque il form —
    // il backend impedirà duplicati con OCL #21 (index unique).
  }

  function showAlreadyDone() {
    reviewForm.classList.add('d-none');
    reviewAlreadyDone.classList.remove('d-none');
  }

  function showReviewAlert(msg, type = 'danger') {
    reviewAlert.textContent = msg;
    reviewAlert.className = `alert alert-${type}`;
    reviewAlert.classList.remove('d-none');
  }

  // ── Selezione pollice su / giù ──
  btnPositive.addEventListener('click', () => {
    selectedPositiva = true;
    btnPositive.classList.add('selected-positive');
    btnNegative.classList.remove('selected-negative');
    btnSubmit.disabled = false;
  });

  btnNegative.addEventListener('click', () => {
    selectedPositiva = false;
    btnNegative.classList.add('selected-negative');
    btnPositive.classList.remove('selected-positive');
    btnSubmit.disabled = false;
  });

  // ── Invio recensione ──
  btnSubmit.addEventListener('click', async () => {
    if (selectedPositiva === null) return;

    btnSubmit.disabled = true;
    btnSubmit.classList.add('btn-loading');
    reviewAlert.classList.add('d-none');

    const body = {
      prenotazioneId,
      positiva: selectedPositiva,
      testo: textarea.value.trim(),
    };

    const res = await api.post('/api/v1/recensioni', body);

    btnSubmit.classList.remove('btn-loading');

    if (res.ok) {
      showReviewAlert('Recensione inviata con successo! Grazie.', 'success');
      // Nascondi il form e mostra il messaggio di conferma
      reviewForm.classList.add('d-none');
      reviewAlreadyDone.classList.remove('d-none');
    } else if (res.status === 409) {
      // OCL #21: duplicato — già recensito
      showAlreadyDone();
    } else {
      showReviewAlert(res.error || 'Errore durante l\'invio della recensione.');
      btnSubmit.disabled = false;
    }
  });
});
