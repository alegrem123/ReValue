/**
 * chat.js
 * Pagina chat singola — bolle stile WhatsApp, invio messaggio, polling 5s (RNF7).
 * RF10: invio messaggi | RF11: storico | RF13: solo partecipanti (enforced backend)
 * RF14: solo autenticati
 */

const POLL_INTERVAL = 5000;
const SEND_RETRY_DELAYS = [400, 1200];

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
let lastTs      = null; // ultimo timestamp visto — cursore per polling ottimizzato (RNF7)
let searchQuery = '';   // query corrente di ricerca
let searchIdx   = -1;   // indice risultato attivo
let searchTotal = 0;    // totale risultati trovati
let pendingImage = null; // { base64, name, size } immagine in attesa di invio
let typingDebounce = null; // timer debounce per segnale "sta scrivendo"

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function showAlert(msg, type = 'danger') {
  chatAlert.textContent = msg;
  chatAlert.className = `alert alert-${type} shadow`;
  chatAlert.classList.remove('d-none');
  setTimeout(() => chatAlert.classList.add('d-none'), 4000);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriableSendError(res) {
  return !res.ok && (res.status === 0 || res.status === 408 || res.status === 429 || res.status >= 500);
}

async function postMessageWithRetry(body) {
  let res = null;
  for (let attempt = 0; attempt <= SEND_RETRY_DELAYS.length; attempt += 1) {
    res = await api.post(`/api/v1/conversazioni/${convId}/messaggi`, body);
    if (!isRetriableSendError(res) || attempt === SEND_RETRY_DELAYS.length) {
      return res;
    }
    await wait(SEND_RETRY_DELAYS[attempt]);
  }
  return res;
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

  // Immagine allegata (base64)
  let imgHtml = '';
  if (msg.immagine) {
    imgHtml = `<img class="bubble-img" src="${msg.immagine}" alt="Immagine allegata" loading="lazy" onclick="openLightbox(this.src)" />`;
  }

  return `
    <div class="bubble-row ${mine ? 'mine' : 'other'}" data-id="${msg._id}" data-letto="${msg.letto}">
      <div class="bubble ${mine ? 'mine' : 'other'}">
        ${imgHtml}
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

  // Aggiorna lastTs con il timestamp dell'ultimo messaggio
  if (messaggi.length > 0) {
    lastTs = messaggi[messaggi.length - 1].timestamp;
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
  if (msg.timestamp) lastTs = msg.timestamp;
}

async function loadMessages(initial = false) {
  let res;

  if (initial || !lastTs) {
    // Caricamento iniziale: tutti i messaggi
    res = await api.get(`/api/v1/conversazioni/${convId}/messaggi?limit=100`);
  } else {
    // Polling ottimizzato: solo messaggi dopo lastTs (RNF7, O(Δt))
    res = await api.get(
      `/api/v1/conversazioni/${convId}/messaggi/recenti?since=${encodeURIComponent(lastTs)}`
    );
  }

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
    // Polling: appendi solo messaggi nuovi
    messaggi.forEach((m) => {
      if (!messagesArea.querySelector(`[data-id="${m._id}"]`)) {
        appendBubble(m);
      }
    });

    // Indicatore "sta scrivendo" dall'altro partecipante
    const isTyping = res.data?.data?.typing === true;
    if (messaggi.length > 0) {
      // L'altro ha inviato un messaggio → non sta più scrivendo
      hideTypingIndicator();
    } else if (isTyping) {
      showTypingIndicator();
    } else {
      hideTypingIndicator();
    }
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
  if (!testo && !pendingImage) return;

  sendBtn.disabled = true;
  msgInput.disabled = true;

  const body = { testo: testo || '📷 Immagine' };
  if (pendingImage) {
    body.immagine = pendingImage.base64;
  }

  const res = await postMessageWithRetry(body);

  sendBtn.disabled = false;
  msgInput.disabled = false;
  msgInput.focus();

  if (!res.ok) {
    showAlert(res.error || 'Impossibile inviare il messaggio.');
    return;
  }

  msgInput.value = '';
  msgInput.style.height = 'auto';
  clearPendingImage();
  updateSendBtnState();

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

/* ── Allegato immagine ────────────────────────────────────────────── */

const MAX_IMG_SIZE = 1024 * 1024; // 1 MB

const fileInput      = document.getElementById('file-input');
const attachBtn      = document.getElementById('attach-btn');
const imgPreview     = document.getElementById('img-preview');
const previewThumb   = document.getElementById('preview-thumb');
const previewName    = document.getElementById('preview-name');
const previewSize    = document.getElementById('preview-size');
const previewRemove  = document.getElementById('preview-remove');

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Aggiorna lo stato del bottone Invia: abilitato se c'è testo O immagine.
 */
function updateSendBtnState() {
  sendBtn.disabled = msgInput.value.trim().length === 0 && !pendingImage;
}

/**
 * Gestisce la selezione di un file immagine.
 * Legge con FileReader API, valida dimensione < 1 MB, mostra anteprima.
 */
function handleFileSelect(file) {
  if (!file) return;

  // Verifica tipo
  if (!file.type.startsWith('image/')) {
    showAlert('Il file selezionato non è un\'immagine.', 'warning');
    return;
  }

  // Verifica dimensione < 1 MB
  if (file.size > MAX_IMG_SIZE) {
    showAlert(`L'immagine supera il limite di 1 MB (${formatFileSize(file.size)}).`, 'warning');
    fileInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result; // data:image/...;base64,...

    pendingImage = { base64, name: file.name, size: file.size };

    // Mostra anteprima
    previewThumb.src = base64;
    previewName.textContent = file.name;
    previewSize.textContent = formatFileSize(file.size);
    imgPreview.classList.add('visible');

    updateSendBtnState();
  };
  reader.onerror = () => {
    showAlert('Errore nella lettura del file.', 'danger');
  };
  reader.readAsDataURL(file);
}

/**
 * Rimuove l'immagine pendente e nasconde l'anteprima.
 */
function clearPendingImage() {
  pendingImage = null;
  fileInput.value = '';
  previewThumb.src = '';
  previewName.textContent = '';
  previewSize.textContent = '';
  imgPreview.classList.remove('visible');
}

function initAttachment() {
  attachBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileSelect(fileInput.files[0]);
    }
  });

  previewRemove.addEventListener('click', () => {
    clearPendingImage();
    updateSendBtnState();
  });
}

/* ── Lightbox immagine ─────────────────────────────────────────────── */

const lightbox    = document.getElementById('img-lightbox');
const lightboxImg = document.getElementById('lightbox-img');

/**
 * Apre il lightbox full-screen con l'immagine specificata.
 * Funzione globale richiamata dall'onclick inline nel bubble.
 */
window.openLightbox = function (src) {
  lightboxImg.src = src;
  lightbox.classList.add('open');
};

function initLightbox() {
  lightbox.addEventListener('click', () => {
    lightbox.classList.remove('open');
    lightboxImg.src = '';
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('open')) {
      lightbox.classList.remove('open');
      lightboxImg.src = '';
    }
  });
}

/* ── Indicatore "sta scrivendo" ─────────────────────────────────────── */

const typingIndicator = document.getElementById('typing-indicator');

/**
 * Invia segnale "sta scrivendo" al backend con debounce(2s).
 * Fire-and-forget: non blocca l'UI in caso di errore.
 */
function sendTypingSignal() {
  clearTimeout(typingDebounce);
  typingDebounce = setTimeout(() => {
    api.post(`/api/v1/conversazioni/${convId}/typing`, {}).catch(() => {});
  }, 300); // piccolo ritardo per evitare flood ad ogni tasto
}

function showTypingIndicator() {
  if (typingIndicator) typingIndicator.classList.add('visible');
}

function hideTypingIndicator() {
  if (typingIndicator) typingIndicator.classList.remove('visible');
}

function initInput() {
  msgInput.addEventListener('input', () => {
    updateSendBtnState();
    // Auto-resize textarea
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px';
    // Segnala "sta scrivendo" con debounce
    if (msgInput.value.trim().length > 0) {
      sendTypingSignal();
    }
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
  initAttachment();
  initLightbox();
  initInput();
  await Promise.all([loadConversazione(), loadMessages(true)]);

  // Polling ottimizzato ogni 5s — usa /recenti?since= per payload O(Δt) (RNF7)
  pollTimer = setInterval(() => loadMessages(false), POLL_INTERVAL);
}

// Stop polling quando si lascia la pagina
window.addEventListener('beforeunload', () => clearInterval(pollTimer));
window.addEventListener('DOMContentLoaded', init);
