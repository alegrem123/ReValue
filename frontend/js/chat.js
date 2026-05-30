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
let searchQuery = '';   // query corrente di ricerca
let searchIdx   = -1;   // indice risultato attivo
let searchTotal = 0;    // totale risultati trovati

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

function buildBubble(msg, highlightQ = '') {
  const mine = isMine(msg);
  const time = formatTime(msg.timestamp);

  let tick = '';
  if (mine) {
    const cls = msg.letto ? 'tick-letto' : 'tick-inviato';
    tick = `<span class="read-tick ${cls} ms-1"><i class="bi bi-check2-all"></i></span>`;
  }

  const testoHtml = highlightQ
    ? highlightText(escapeHtml(msg.testo), highlightQ)
    : escapeHtml(msg.testo);

  return `
    <div class="bubble-row ${mine ? 'mine' : 'other'}" data-id="${msg._id}" data-letto="${msg.letto}">
      <div class="bubble ${mine ? 'mine' : 'other'}">
        <div>${testoHtml}</div>
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

/* ── Ricerca nei messaggi ─────────────────────────────────────────── */

const searchToggle = document.getElementById('search-toggle');
const searchBar    = document.getElementById('search-bar');
const searchInput  = document.getElementById('search-input');
const searchNav    = document.getElementById('search-nav');
const searchCount  = document.getElementById('search-count');
const searchPrev   = document.getElementById('search-prev');
const searchNext   = document.getElementById('search-next');
const searchClose  = document.getElementById('search-close');

let searchDebounce = null;

/**
 * Evidenzia tutte le occorrenze di `query` nel testo già HTML-escaped.
 * Restituisce HTML con <mark class="search-hl"> attorno ai match.
 */
function highlightText(escapedHtml, query) {
  if (!query) return escapedHtml;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return escapedHtml.replace(regex, '<mark class="search-hl">$1</mark>');
}

/**
 * Esegue la ricerca: fetch GET .../messaggi?q=X&limit=100,
 * renderizza con highlight, aggiorna contatore e navigazione.
 */
async function performSearch(query) {
  searchQuery = query.trim();
  searchIdx = -1;
  searchTotal = 0;

  if (!searchQuery) {
    // Nessuna query → ripristina vista normale
    searchNav.style.display = 'none';
    await loadMessages(true);
    return;
  }

  const endpoint = `/api/v1/conversazioni/${convId}/messaggi?q=${encodeURIComponent(searchQuery)}&limit=100`;
  const res = await api.get(endpoint);
  if (!res.ok) {
    showAlert('Errore durante la ricerca.', 'danger');
    return;
  }

  const messaggi = res.data?.data?.messaggi || res.data?.messaggi || [];

  if (messaggi.length === 0) {
    messagesArea.innerHTML = `
      <div class="text-center text-muted py-5">
        <i class="bi bi-search display-6 d-block mb-2"></i>
        Nessun risultato per "<strong>${escapeHtml(searchQuery)}</strong>"
      </div>`;
    searchNav.style.display = 'flex';
    searchCount.textContent = '0 / 0';
    searchPrev.disabled = true;
    searchNext.disabled = true;
    return;
  }

  // Renderizza messaggi con highlight
  const groups = groupByDate(messaggi);
  messagesArea.innerHTML = groups.map((item) => {
    if (item.type === 'divider') {
      return `<div class="date-divider">${item.label}</div>`;
    }
    return buildBubble(item.msg, searchQuery);
  }).join('');

  // Conta match totali (mark tags)
  const marks = messagesArea.querySelectorAll('mark.search-hl');
  searchTotal = marks.length;

  // Mostra navigazione
  searchNav.style.display = 'flex';
  searchPrev.disabled = searchTotal <= 1;
  searchNext.disabled = searchTotal <= 1;

  // Seleziona primo risultato
  if (searchTotal > 0) {
    searchIdx = 0;
    updateSearchHighlight();
  } else {
    searchCount.textContent = '0 / 0';
  }
}

/**
 * Aggiorna il contatore e lo scroll al risultato attivo.
 */
function updateSearchHighlight() {
  const marks = messagesArea.querySelectorAll('mark.search-hl');
  marks.forEach((m) => m.classList.remove('active'));

  if (marks.length > 0 && searchIdx >= 0 && searchIdx < marks.length) {
    const active = marks[searchIdx];
    active.classList.add('active');
    active.scrollIntoView({ behavior: 'smooth', block: 'center' });
    searchCount.textContent = `${searchIdx + 1} / ${searchTotal}`;
  }
}

/**
 * Naviga al risultato successivo o precedente.
 */
function navigateSearch(direction) {
  if (searchTotal === 0) return;
  searchIdx = (searchIdx + direction + searchTotal) % searchTotal;
  updateSearchHighlight();
}

/**
 * Chiude la barra di ricerca e ripristina la vista completa.
 */
function clearSearch() {
  searchQuery = '';
  searchIdx = -1;
  searchTotal = 0;
  searchInput.value = '';
  searchBar.classList.remove('open');
  searchNav.style.display = 'none';
  loadMessages(true);
}

function initSearch() {
  searchToggle.addEventListener('click', () => {
    searchBar.classList.toggle('open');
    if (searchBar.classList.contains('open')) {
      searchInput.focus();
    } else {
      clearSearch();
    }
  });

  searchClose.addEventListener('click', clearSearch);

  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => performSearch(searchInput.value), 350);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(searchDebounce);
      performSearch(searchInput.value);
    }
    if (e.key === 'Escape') {
      clearSearch();
    }
  });

  searchPrev.addEventListener('click', () => navigateSearch(-1));
  searchNext.addEventListener('click', () => navigateSearch(1));
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

  initSearch();
  initInput();
  await Promise.all([loadConversazione(), loadMessages(true)]);

  // Polling ogni 5s (RNF7)
  pollTimer = setInterval(() => loadMessages(false), POLL_INTERVAL);
}

// Stop polling quando si lascia la pagina
window.addEventListener('beforeunload', () => clearInterval(pollTimer));
window.addEventListener('DOMContentLoaded', init);
