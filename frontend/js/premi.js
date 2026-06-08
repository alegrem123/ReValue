/* ── Guard ── */
if (!localStorage.getItem('jwt')) {
  window.location.href = 'login.html?redirect=premi.html';
}

let currentCouponId = null;

const modalRiscatta   = new bootstrap.Modal(document.getElementById('modal-riscatta'));
const modalErrore     = new bootstrap.Modal(document.getElementById('modal-errore'));

/* ── Fetch e render premi ── */
async function loadPremi() {
  const costoMax = document.getElementById('filter-costo').value;
  const qs = costoMax ? `?costoMax=${costoMax}` : '';

  document.getElementById('results-info').textContent = 'Caricamento…';
  document.getElementById('premi-grid').innerHTML = skeletonGrid();

  const res = await api.get('/api/v1/premi' + qs);

  if (!res.ok) {
    document.getElementById('premi-grid').innerHTML = `
      <div class="col-12 text-center text-danger py-5">
        <i class="bi bi-exclamation-triangle fs-3 d-block mb-2"></i>
        ${res.error || 'Errore caricamento premi.'}
      </div>`;
    document.getElementById('results-info').textContent = '';
    return;
  }

  const premi = res.data?.coupon ?? [];

  document.getElementById('results-info').textContent =
    premi.length === 0 ? 'Nessun premio disponibile.' : `${premi.length} premi disponibili`;

  if (premi.length === 0) {
    document.getElementById('premi-grid').innerHTML = `
      <div class="col-12 text-center text-muted py-5">
        <i class="bi bi-inbox fs-2 d-block mb-2"></i>
        Nessun premio in questa fascia di costo.
      </div>`;
    return;
  }

  document.getElementById('premi-grid').innerHTML = premi.map(couponCard).join('');

  document.querySelectorAll('.btn-riscatta').forEach(btn => {
    btn.addEventListener('click', () => apriModalRiscatta(btn.dataset));
  });
}

/* ── Skeleton placeholder ── */
function skeletonGrid() {
  return [1,2,3,4,5,6].map(() => `
    <div class="col-sm-6 col-lg-4">
      <div class="card h-100 shadow-sm">
        <div class="skeleton" style="height:140px;"></div>
        <div class="card-body">
          <div class="skeleton rounded mb-2" style="height:1rem;width:70%;"></div>
          <div class="skeleton rounded mb-3" style="height:0.8rem;width:45%;"></div>
          <div class="skeleton rounded" style="height:0.8rem;width:90%;"></div>
        </div>
      </div>
    </div>`).join('');
}

/* ── Card singolo coupon ── */
function couponCard(c) {
  const stockBadge = c.stock > 0
    ? `<span class="badge bg-success-subtle text-success-emphasis ms-1">${c.stock} rimasti</span>`
    : `<span class="badge bg-info-subtle text-info-emphasis ms-1">Illimitato</span>`;

  return `
    <div class="col-sm-6 col-lg-4">
      <div class="card h-100 shadow-sm coupon-card">
        <div class="coupon-img-placeholder rounded-top">
          <i class="bi bi-gift"></i>
        </div>
        <div class="card-body d-flex flex-column">
          <div class="d-flex align-items-start justify-content-between mb-1">
            <h5 class="card-title fw-bold mb-0 me-2" style="font-size:1rem;">${escHtml(c.titolo)}</h5>
            <span class="badge costo-badge text-nowrap">${c.costoCrediti} cr.</span>
          </div>
          <p class="text-muted small mb-1">
            <i class="bi bi-building me-1"></i>${escHtml(c.partner)}${stockBadge}
          </p>
          <p class="card-text text-muted small flex-grow-1" style="overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">
            ${escHtml(c.descrizione)}
          </p>
          <button
            class="btn btn-success btn-sm mt-3 btn-riscatta"
            data-id="${c._id}"
            data-nome="${escAttr(c.titolo)}"
            data-costo="${c.costoCrediti}"
          >
            <i class="bi bi-ticket-perforated me-1"></i>Riscatta
          </button>
        </div>
      </div>
    </div>`;
}

/* ── Apri modale riscatto ── */
async function apriModalRiscatta({ id, nome, costo }) {
  currentCouponId = id;

  // reset modale allo stato iniziale
  document.getElementById('modal-body-confirm').classList.remove('d-none');
  document.getElementById('modal-body-success').classList.add('d-none');
  document.getElementById('modal-footer-confirm').classList.remove('d-none');
  document.getElementById('modal-footer-success').classList.add('d-none');
  document.getElementById('btn-riscatta-spinner').classList.add('d-none');
  document.getElementById('btn-conferma-riscatto').disabled = false;

  document.getElementById('modal-coupon-nome').textContent = nome;
  document.getElementById('modal-costo').textContent = `${costo} cr.`;
  document.getElementById('modal-saldo').textContent = '…';

  modalRiscatta.show();

  // carica saldo
  const walletRes = await api.get('/api/v1/wallet/saldo');
  document.getElementById('modal-saldo').textContent =
    walletRes.ok ? `${walletRes.data?.bilancio ?? 0} cr.` : '— cr.';
}

/* ── Conferma riscatto ── */
document.getElementById('btn-conferma-riscatto').addEventListener('click', async () => {
  if (!currentCouponId) return;

  const spinner = document.getElementById('btn-riscatta-spinner');
  const btnConferma = document.getElementById('btn-conferma-riscatto');
  spinner.classList.remove('d-none');
  btnConferma.disabled = true;

  const res = await api.post(`/api/v1/premi/${currentCouponId}/riscatta`, {});

  spinner.classList.add('d-none');

  if (!res.ok) {
    // OCL #17: saldo insufficiente o stock esaurito
    modalRiscatta.hide();
    document.getElementById('modal-errore-titolo').textContent =
      res.status === 409 ? 'Crediti insufficienti o stock esaurito' : 'Errore riscatto';
    document.getElementById('modal-errore-msg').textContent =
      res.error || 'Impossibile completare il riscatto.';
    modalErrore.show();
    return;
  }

  const codice = res.data?.riscatto?.codiceUnivoco ?? res.data?.codiceUnivoco ?? '';

  // mostra stato successo
  document.getElementById('modal-body-confirm').classList.add('d-none');
  document.getElementById('modal-body-success').classList.remove('d-none');
  document.getElementById('modal-footer-confirm').classList.add('d-none');
  document.getElementById('modal-footer-success').classList.remove('d-none');

  const codiceEl = document.getElementById('modal-codice');
  codiceEl.textContent = codice;
  codiceEl.onclick = () => {
    navigator.clipboard.writeText(codice).catch(() => {});
  };

  // aggiorna griglia (stock -1) senza refetch completo
  loadPremi();
});

/* ── Utility ── */
function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function escAttr(s) {
  return escHtml(s).replace(/`/g, '&#96;');
}

/* ── Event listeners filtri ── */
document.getElementById('filter-form').addEventListener('submit', e => {
  e.preventDefault();
  loadPremi();
});

document.getElementById('btn-reset').addEventListener('click', () => {
  document.getElementById('filter-costo').value = '';
  loadPremi();
});

document.addEventListener('DOMContentLoaded', loadPremi);
