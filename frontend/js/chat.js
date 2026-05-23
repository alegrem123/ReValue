/**
 * chat.js
 * Pagina chat singola — bolle stile WhatsApp, invio messaggio, polling 5s (RNF7).
 * RF10: invio messaggi | RF11: storico | RF13: solo partecipanti (enforced backend)
 * RF14: solo autenticati
 */

const POLL_INTERVAL = 5000;

const messagesArea = document.getElementById('messages-area');
const msgInput     = document.getElementById('msg-input');
const sendBtn      = document.getElementById('send-btn');
const headerAvatar = document.getElementById('header-avatar');
const headerName   = document.getElementById('header-name');
const headerSub    = document.getElementById('header-sub');
const chatAlert    = document.getElementById('chat-alert');

let convId      = null;
let myId        = null;
let pollTimer   = null;
let lastMsgId   = null; // per rilevare nuovi messaggi senza re-render totale

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function showAlert(msg, type = 'danger') {
  chatAlert.textContent = msg;
  chatAlert.className = `alert alert-${type} shadow`;
  chatAlert.classList.remove('d-none');
  setTimeout(() => chatAlert.classList.add('d-none'), 4000);
}

function formatTime(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(d);
}

function formatDateLabel(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Oggi';
  if (d.toDateString() === yesterday.toDateString()) return 'Ieri';
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
}

function isMine(msg) {
  const mid = msg.mittente?._id || msg.mittente;
  return mid?.toString() === myId;
}

function buildBubble(msg) {
  const mine = isMine(msg);
  const time = formatTime(msg.timestamp);

  let tick = '';
  if (mine) {
    const cls = msg.letto ? 'tick-letto' : 'tick-inviato';
    tick = `<span class="read-tick ${cls} ms-1"><i class="bi bi-check2-all"></i></span>`;
  }

  return `
    <div class="bubble-row ${mine ? 'mine' : 'other'}" data-id="${msg._id}" data-letto="${msg.letto}">
      <div class="bubble ${mine ? 'mine' : 'other'}">
        <div>${escapeHtml(msg.testo)}</div>
        <div class="bubble-time">${time}${tick}</div>
      </div>
    </div>`;
}

function markReceivedAsRead(messaggi) {
  const unread = messaggi.filter((m) => !isMine(m) && !m.letto && m._id);
  if (unread.length === 0) return;
  Promise.all(unread.map((m) => api.patch(`/api/v1/messaggi/${m._id}/letto`, {}))).catch(() => {});
}

function updateTicksInDom(messaggi) {
  messaggi.forEach((msg) => {
    if (!isMine(msg) || !msg.letto) return;
    const row = messagesArea.querySelector(`[data-id="${msg._id}"]`);
    if (!row || row.dataset.letto === 'true') return;
    const tick = row.querySelector('.read-tick');
    if (tick) {
      tick.classList.remove('tick-inviato');
      tick.classList.add('tick-letto');
    }
    row.dataset.letto = 'true';
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function groupByDate(messaggi) {
  const groups = [];
  let currentDate = null;

  messaggi.forEach((msg) => {
    const d = new Date(msg.timestamp).toDateString();
    if (d !== currentDate) {
      currentDate = d;
      groups.push({ type: 'divider', label: formatDateLabel(msg.timestamp) });
    }
    groups.push({ type: 'msg', msg });
  });

  return groups;
}

function renderMessages(messaggi) {
  if (messaggi.length === 0) {
    messagesArea.innerHTML = `
      <div class="text-center text-muted py-5">
        <i class="bi bi-chat-dots display-6 d-block mb-2"></i>
        Nessun messaggio ancora. Scrivi il primo!
      </div>`;
    return;
  }

  const groups = groupByDate(messaggi);
  messagesArea.innerHTML = groups.map((item) => {
    if (item.type === 'divider') {
      return `<div class="date-divider">${item.label}</div>`;
    }
    return buildBubble(item.msg);
  }).join('');

  // Scroll in fondo
  messagesArea.scrollTop = messagesArea.scrollHeight;

  // Aggiorna lastMsgId
  if (messaggi.length > 0) {
    lastMsgId = messaggi[messaggi.length - 1]._id;
  }
}

function appendBubble(msg) {
  const wasAtBottom =
    messagesArea.scrollHeight - messagesArea.scrollTop - messagesArea.clientHeight < 60;

  // Aggiungi eventuale divisore data
  const d = new Date(msg.timestamp).toDateString();
  const lastBubble = messagesArea.querySelector('.bubble-row:last-of-type');
  if (lastBubble) {
    const lastTime = lastBubble.querySelector('.bubble-time')?.textContent?.trim();
    // solo controllo grossolano — date-divider già presente se stessa data
  }

  const div = document.createElement('div');
  div.innerHTML = buildBubble(msg);
  messagesArea.appendChild(div.firstElementChild);

  if (wasAtBottom) messagesArea.scrollTop = messagesArea.scrollHeight;
  lastMsgId = msg._id;
}

async function loadMessages(initial = false) {
  const res = await api.get(`/api/v1/conversazioni/${convId}/messaggi?limit=100`);
  if (!res.ok) {
    if (initial) {
      messagesArea.innerHTML = `<div class="text-danger p-3">Impossibile caricare i messaggi.</div>`;
    }
    return;
  }

  const messaggi = res.data?.data?.messaggi || res.data?.messaggi || [];

  if (initial) {
    renderMessages(messaggi);
  } else {
    // Polling: aggiungi messaggi nuovi e aggiorna tick esistenti
    const newMsgs = messaggi.filter(
      (m) => lastMsgId === null || m._id > lastMsgId
    );
    newMsgs.forEach((m) => {
      if (!messagesArea.querySelector(`[data-id="${m._id}"]`)) {
        appendBubble(m);
      }
    });
    updateTicksInDom(messaggi);
  }

  // Marca come letti i messaggi ricevuti non ancora letti
  markReceivedAsRead(messaggi);
}

async function loadConversazione() {
  const res = await api.get('/api/v1/conversazioni/me');
  if (!res.ok) return;

  const conv = (res.data || []).find((c) => c._id === convId);
  if (!conv) return;

  const altri = (conv.partecipanti || []).filter((p) => p._id !== myId);
  const altro = altri[0];

  if (altro) {
    const nome = `${altro.nome} ${altro.cognome}`;
    headerName.textContent = nome;
    headerAvatar.textContent = `${altro.nome.charAt(0)}${altro.cognome.charAt(0)}`.toUpperCase();
    headerSub.textContent = conv.prenotazione?.stato
      ? `Prenotazione ${conv.prenotazione.stato.toLowerCase()}`
      : '';
  }
}

async function sendMessage() {
  const testo = msgInput.value.trim();
  if (!testo) return;

  sendBtn.disabled = true;
  msgInput.disabled = true;

  const res = await api.post(`/api/v1/conversazioni/${convId}/messaggi`, { testo });

  sendBtn.disabled = false;
  msgInput.disabled = false;
  msgInput.focus();

  if (!res.ok) {
    showAlert(res.error || 'Impossibile inviare il messaggio.');
    return;
  }

  msgInput.value = '';
  msgInput.style.height = 'auto';
  sendBtn.disabled = true;

  // Messaggio inviato → aggiungi bolla immediatamente
  const salvato = res.data?.data || res.data;
  if (salvato?._id) {
    appendBubble(salvato);
  }
}

function initInput() {
  msgInput.addEventListener('input', () => {
    sendBtn.disabled = msgInput.value.trim().length === 0;
    // Auto-resize textarea
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px';
  });

  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);
}

async function init() {
  if (!localStorage.getItem('jwt')) {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    return;
  }

  convId = getQueryParam('id');
  if (!convId) {
    window.location.href = 'messaggi.html';
    return;
  }

  // Estrai myId dal JWT
  try {
    const payload = JSON.parse(atob(localStorage.getItem('jwt').split('.')[1]));
    myId = payload.id;
  } catch { /* non critico */ }

  initInput();
  await Promise.all([loadConversazione(), loadMessages(true)]);

  // Polling ogni 5s (RNF7)
  pollTimer = setInterval(() => loadMessages(false), POLL_INTERVAL);
}

// Stop polling quando si lascia la pagina
window.addEventListener('beforeunload', () => clearInterval(pollTimer));
window.addEventListener('DOMContentLoaded', init);
