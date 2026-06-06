// Auth guard
(function () {
  if (!localStorage.getItem('jwt')) {
    window.location.href = 'login.html';
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  const skeleton  = document.getElementById('miei-premi-skeleton');
  const empty     = document.getElementById('miei-premi-empty');
  const list      = document.getElementById('miei-premi-list');
  const alertBox  = document.getElementById('miei-premi-alert');
  const refreshBtn = document.getElementById('refresh-btn');

  refreshBtn.addEventListener('click', loadMieiRiscatti);

  loadMieiRiscatti();

  async function loadMieiRiscatti() {
    skeleton.classList.remove('d-none');
    empty.classList.add('d-none');
    list.classList.add('d-none');
    alertBox.classList.add('d-none');

    const res = await api.get('/api/v1/premi/miei');

    skeleton.classList.add('d-none');

    if (!res.ok) {
      showAlert(res.error || 'Impossibile caricare i premi.', 'danger');
      return;
    }

    const riscatti = res.data?.riscatti ?? [];

    if (riscatti.length === 0) {
      empty.classList.remove('d-none');
      return;
    }

    list.innerHTML = riscatti.map(riscattoRow).join('');
    list.classList.remove('d-none');

    list.querySelectorAll('.btn-marca-usato').forEach((btn) => {
      btn.addEventListener('click', () => marcaUsato(btn.dataset.id, btn));
    });
  }

  function riscattoRow(r) {
    const coupon = r.coupon || {};
    const nome   = escHtml(coupon.titolo || 'Coupon');
    const codice = escHtml(r.codiceUnivoco || '—');
    const data   = fmtDate(r.dataRiscatto || r.createdAt);
    const usato  = r.usato;

    const badgeHtml = usato
      ? '<span class="badge bg-secondary">Usato</span>'
      : '<span class="badge bg-success">Disponibile</span>';

    const btnHtml = usato
      ? ''
      : `<button class="btn btn-outline-secondary btn-sm btn-marca-usato" data-id="${escAttr(r._id)}">
           <i class="bi bi-check2-circle me-1"></i>Segna come usato
         </button>`;

    return `
      <div class="list-group-item px-3 py-3" id="riscatto-${escAttr(r._id)}">
        <div class="d-flex flex-column flex-md-row align-items-md-center gap-2 justify-content-between">
          <div class="d-flex flex-column gap-1">
            <div class="d-flex align-items-center gap-2">
              <span class="fw-bold">${nome}</span>
              ${badgeHtml}
            </div>
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <small class="text-muted">Codice:</small>
	              <span
	                class="code-box"
	                title="Clicca per copiare"
	              >${codice}</span>
            </div>
            <small class="text-muted">Riscattato il ${data}</small>
          </div>
          <div>${btnHtml}</div>
        </div>
      </div>`;
  }

  async function marcaUsato(id, btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    const res = await api.patch(`/api/v1/premi/riscatti/${id}/usato`, {});

    if (!res.ok) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i>Segna come usato';
      showAlert(res.error || 'Errore aggiornamento.', 'warning');
      return;
    }

    // update row in-place
    const row = document.getElementById(`riscatto-${id}`);
    if (row) {
      row.querySelector('.badge').outerHTML = '<span class="badge bg-secondary">Usato</span>';
      btn.closest('div').innerHTML = '';
    }
  }

  function showAlert(msg, type = 'danger') {
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = msg;
    alertBox.classList.remove('d-none');
  }
});

window.copyCode = function (el) {
  navigator.clipboard.writeText(el.textContent.trim()).then(() => {
    const orig = el.textContent;
    el.textContent = 'Copiato!';
    setTimeout(() => { el.textContent = orig; }, 1500);
  });
};

document.addEventListener('click', (event) => {
  const codeBox = event.target.closest('.code-box');
  if (codeBox) window.copyCode(codeBox);
});

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}
