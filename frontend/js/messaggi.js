/**
 * messaggi.js
 * Pagina lista conversazioni — RF11, RF12.
 * Fetch GET /api/v1/conversazioni/me, render card per ogni conversazione.
 */

const convList = document.getElementById('conv-list');
const msgAlert = document.getElementById('msg-alert');

function showAlert(msg, type = 'danger') {
  msgAlert.textContent = msg;
  msgAlert.className = `alert alert-${type}`;
  msgAlert.classList.remove('d-none');
}

function formatTime(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  return isToday
    ? new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(d)
    : new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit' }).format(d);
}

function initials(nome = '', cognome = '') {
  return `${nome.charAt(0)}${cognome.charAt(0)}`.toUpperCase() || '?';
}

function buildCard(conv, myId) {
  const altri = (conv.partecipanti || []).filter((p) => p._id !== myId);
  const altro = altri[0];
  const nomeAltro = altro ? `${altro.nome} ${altro.cognome}` : 'Utente';
  const ini = altro ? initials(altro.nome, altro.cognome) : '?';

  const hasUnread = conv.nonLetti > 0;
  const preview = conv.ultimoMessaggio?.testo || 'Nessun messaggio';
  const timestamp = formatTime(conv.ultimoMessaggio?.timestamp || conv.createdAt);

  return `
    <a href="chat.html?id=${conv._id}"
       class="conv-card card border-0 shadow-sm mb-3 p-3 d-block ${hasUnread ? 'unread' : ''}">
      <div class="d-flex align-items-center gap-3">
        <div class="avatar">${ini}</div>
        <div class="flex-grow-1 overflow-hidden">
          <div class="d-flex justify-content-between align-items-center gap-2">
            <span class="fw-bold ${hasUnread ? 'text-dark' : 'text-secondary'}">${nomeAltro}</span>
            <span class="text-muted small flex-shrink-0">${timestamp}</span>
          </div>
          <div class="d-flex justify-content-between align-items-center gap-2 mt-1">
            <span class="preview-text small ${hasUnread ? 'fw-semibold text-dark' : 'text-muted'}">
              ${preview}
            </span>
            ${hasUnread ? `<div class="unread-badge">${conv.nonLetti}</div>` : ''}
          </div>
        </div>
      </div>
    </a>`;
}

async function load() {
  if (!localStorage.getItem('jwt')) {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
    return;
  }

  // Recupera id utente dal JWT (payload base64)
  let myId = null;
  try {
    const payload = JSON.parse(atob(localStorage.getItem('jwt').split('.')[1]));
    myId = payload.id;
  } catch { /* non critico */ }

  const res = await api.get('/api/v1/conversazioni/me');

  if (!res.ok) {
    convList.innerHTML = '';
    showAlert(res.error || 'Impossibile caricare le conversazioni.');
    return;
  }

  const convs = res.data || [];

  if (convs.length === 0) {
    convList.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-chat-dots display-5 d-block mb-3"></i>
        Nessuna conversazione ancora.<br>
        <small>Le chat si aprono automaticamente quando prenoti un oggetto.</small>
      </div>`;
    return;
  }

  convList.innerHTML = convs.map((c) => buildCard(c, myId)).join('');
}

window.addEventListener('DOMContentLoaded', load);
