// Auth guard
(function () {
  if (!localStorage.getItem('jwt')) {
    window.location.href = 'login.html';
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  const params     = new URLSearchParams(window.location.search);
  const userId     = params.get('userId')?.trim() || '';
  const annuncioId = params.get('annuncioId')?.trim() || '';

  const formWrap       = document.getElementById('segnala-form-wrap');
  const successEl      = document.getElementById('segnala-success');
  const alertBox       = document.getElementById('segnala-alert');
  const form           = document.getElementById('segnala-form');
  const submitBtn      = document.getElementById('segnala-submit');
  const backBtn        = document.getElementById('segnala-back');
  const segnDisplay    = document.getElementById('segnalato-display');
  const segnNomeInput  = document.getElementById('segnalato-nome-display');
  const segnIdInput    = document.getElementById('segnalato-id');
  const segnManualWrap = document.getElementById('segnalato-input-wrap');
  const segnManual     = document.getElementById('segnalato-manual');
  const tipoSel        = document.getElementById('segnala-tipo');
  const motivoTa       = document.getElementById('segnala-motivo');

  // populate utente segnalato from query param
  if (userId) {
    segnDisplay.classList.remove('d-none');
    segnNomeInput.value = userId;
    segnIdInput.value   = userId;
  } else {
    segnManualWrap.classList.remove('d-none');
  }

  backBtn.addEventListener('click', () => {
    if (document.referrer) {
      history.back();
    } else {
      window.location.href = 'catalog.html';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.classList.add('d-none');

    const segnalatoId = userId || segnManual.value.trim();

    if (!segnalatoId) {
      showAlert('Inserisci l\'ID dell\'utente da segnalare.', 'warning');
      return;
    }

    const motivo = motivoTa.value.trim();
    if (!motivo) {
      showAlert('Il motivo è obbligatorio (OCL #18).', 'warning');
      return;
    }

    const body = {
      segnalato: segnalatoId,
      tipo: tipoSel.value,
      motivo,
    };
    if (annuncioId) body.annuncio = annuncioId;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Invio...';

    const res = await api.post('/api/v1/segnalazioni', body);

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="bi bi-flag me-1"></i>Invia segnalazione';

    if (!res.ok) {
      if (res.status === 409) {
        showAlert('Non puoi segnalare te stesso (OCL #19).', 'warning');
      } else {
        showAlert(res.error || 'Errore invio segnalazione.', 'danger');
      }
      return;
    }

    formWrap.classList.add('d-none');
    successEl.classList.remove('d-none');
  });

  function showAlert(msg, type = 'danger') {
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = msg;
    alertBox.classList.remove('d-none');
  }
});
