/**
 * layout.js
 * Inietta navbar e footer in tutte le pagine che hanno
 * <div id="navbar-container"> e <div id="footer-container">.
 *
 * Gestisce anche:
 * - Evidenziazione link attivo nella navbar
 * - Logout
 * - Mostra/nasconde voci in base al JWT in localStorage
 */

const isViewsPage = window.location.pathname.includes('/views/');
const homeUrl = isViewsPage ? '../index.html' : 'index.html';
const viewUrl = (fileName) => (isViewsPage ? fileName : `views/${fileName}`);

const NAVBAR_HTML = `
<nav class="navbar navbar-expand-lg sticky-top" style="background-color: #2E7D32;">
  <div class="container">
    <a class="navbar-brand fw-bold text-white" href="${homeUrl}">
      RE-VALUE
    </a>
    <button class="navbar-toggler border-white" type="button"
            data-bs-toggle="collapse" data-bs-target="#navbarMain">
      <span class="navbar-toggler-icon" style="filter: invert(1);"></span>
    </button>
    <div class="collapse navbar-collapse" id="navbarMain">
      <ul class="navbar-nav me-auto mb-2 mb-lg-0">
        <li class="nav-item">
          <a class="nav-link text-white" href="${homeUrl}">Home</a>
        </li>
        <li class="nav-item">
          <a class="nav-link text-white" href="${viewUrl('catalog.html')}">Catalogo</a>
        </li>
        <!-- Visibili solo se loggato -->
        <li class="nav-item nav-auth d-none">
          <a class="nav-link text-white" href="${viewUrl('create-annuncio.html')}">Crea annuncio</a>
        </li>
        <li class="nav-item nav-auth d-none">
          <a class="nav-link text-white" href="${viewUrl('my-annunci.html')}">I miei annunci</a>
        </li>
        <li class="nav-item nav-auth d-none">
          <a class="nav-link text-white" href="${viewUrl('mybookings.html')}">Mie prenotazioni</a>
        </li>
        <li class="nav-item nav-auth d-none">
          <a class="nav-link text-white" href="${viewUrl('messaggi.html')}">
            Messaggi
            <span id="unread-badge" class="badge bg-warning text-dark ms-1 d-none">0</span>
          </a>
        </li>
      </ul>

      <ul class="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center">
        <!-- Visibili solo se NON loggato -->
        <li class="nav-item nav-guest">
          <a class="nav-link text-white" href="${viewUrl('login.html')}">Accedi</a>
        </li>
        <li class="nav-item nav-guest">
          <a class="btn btn-warning btn-sm ms-2" href="${viewUrl('register.html')}">Registrati</a>
        </li>
        <!-- Visibili solo se loggato -->
        <li class="nav-item nav-auth d-none">
          <a class="nav-link text-white" href="${viewUrl('profile.html')}">
            <i class="bi bi-person-circle me-1"></i>
            <span id="navbar-username">Profilo</span>
          </a>
        </li>
        <li class="nav-item nav-auth d-none">
          <a class="nav-link text-white" href="${viewUrl('wallethistory.html')}">
             <span id="navbar-balance">0</span> crediti
          </a>
        </li>
        <li class="nav-item nav-auth d-none">
          <button class="btn btn-outline-light btn-sm ms-2" id="btn-logout">Esci</button>
        </li>
      </ul>
    </div>
  </div>
</nav>`;

const FOOTER_HTML = `
<footer style="background-color: #1B5E20;" class="text-white py-4 mt-5">
  <div class="container">
    <div class="row g-3 align-items-center">
      <div class="col-md-4">
        <span class="fw-bold fs-5"> RE-VALUE</span>
        <p class="mb-0 small opacity-75 mt-1">
          Dai nuova vita ai tuoi oggetti.<br/>
          Progetto accademico — UniTN 2026
        </p>
      </div>
      <div class="col-md-4 text-md-center">
        <ul class="list-unstyled mb-0 small">
          <li><a href="${homeUrl}" class="text-white-50 text-decoration-none">Home</a></li>
          <li><a href="${viewUrl('catalog.html')}" class="text-white-50 text-decoration-none">Catalogo</a></li>
          <li><a href="${viewUrl('register.html')}" class="text-white-50 text-decoration-none">Registrati</a></li>
        </ul>
      </div>
      <div class="col-md-4 text-md-end small opacity-75">
        <p class="mb-0">Gruppo 21 · Ingegneria del Software</p>
        <p class="mb-0">Università di Trento · A.A. 2025/2026</p>
      </div>
    </div>
  </div>
</footer>`;

/**
 * Legge il JWT da localStorage e lo decodifica (payload base64).
 * Ritorna null se non c'è token o è scaduto.
 */
function getUser() {
  try {
    const token = localStorage.getItem('jwt');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Controlla scadenza
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      localStorage.removeItem('jwt');
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Evidenzia il link attivo nella navbar in base all'URL corrente.
 */
function setActiveLink() {
  const path = window.location.pathname;
  document.querySelectorAll('.navbar-nav .nav-link').forEach((link) => {
    const href = link.getAttribute('href');
    const target = href ? href.split('/').pop() : '';
    if (target && path.endsWith(target)) {
      link.classList.add('fw-bold');
      link.style.opacity = '1';
    } else {
      link.style.opacity = '0.85';
    }
  });
}

/**
 * Mostra/nasconde voci navbar in base allo stato di autenticazione.
 */
function updateAuthUI(user) {
  const authEls = document.querySelectorAll('.nav-auth');
  const guestEls = document.querySelectorAll('.nav-guest');

  if (user) {
    authEls.forEach((el) => el.classList.remove('d-none'));
    guestEls.forEach((el) => el.classList.add('d-none'));
    const nameEl = document.getElementById('navbar-username');
    if (nameEl) nameEl.textContent = user.nome || 'Profilo';

    fetch('/api/v1/wallet/saldo', {
      headers: { Authorization: `Bearer ${localStorage.getItem('jwt')}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const el = document.getElementById('navbar-balance');
        if (el) el.textContent = data.bilancio ?? 0;
      })
      .catch(() => {});
  } else {
    authEls.forEach((el) => el.classList.add('d-none'));
    guestEls.forEach((el) => el.classList.remove('d-none'));
  }
}

/**
 * Aggiorna badge non letti messaggi (RF12).
 * Chiama GET /api/v1/conversazioni/me/non-letti e mostra count nel badge navbar.
 */
function updateUnreadBadge() {
  const token = localStorage.getItem('jwt');
  if (!token) return;

  fetch('/api/v1/conversazioni/me/non-letti', {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((r) => r.json())
    .then((data) => {
      const badge = document.getElementById('unread-badge');
      if (!badge) return;
      const count = data?.data?.nonLetti ?? data?.nonLetti ?? 0;
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.remove('d-none');
      } else {
        badge.classList.add('d-none');
      }
    })
    .catch(() => {});
}

/**
 * Inizializza navbar e footer, poi aggiorna UI.
 */
function initLayout() {
  const navContainer = document.getElementById('navbar-container');
  const footerContainer = document.getElementById('footer-container');

  if (navContainer) navContainer.innerHTML = NAVBAR_HTML;
  if (footerContainer) footerContainer.innerHTML = FOOTER_HTML;

  const user = getUser();
  updateAuthUI(user);
  setActiveLink();

  // Badge non letti: primo fetch + polling ogni 30s (RF12)
  if (user) {
    updateUnreadBadge();
    setInterval(updateUnreadBadge, 30_000);
  }

  // Logout
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('jwt');
      window.location.href = homeUrl;
    });
  }
}

/**
 * Inietta toast container + skeleton CSS nel documento.
 * Chiamato una volta sola da initLayout.
 */
function injectGlobalStyles() {
  // Toast container (Bootstrap positioning)
  if (!document.getElementById('rv-toast-container')) {
    const tc = document.createElement('div');
    tc.id = 'rv-toast-container';
    tc.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    tc.style.zIndex = '9999';
    document.body.appendChild(tc);
  }

  // Skeleton loader + spinner utility CSS
  if (!document.getElementById('rv-global-style')) {
    const style = document.createElement('style');
    style.id = 'rv-global-style';
    style.textContent = `
      /* ── Mobile responsive globals ── */

      /* Touch targets minimi 44px (Apple HIG / WCAG 2.5.5) */
      .btn, button, [role="button"], a.nav-link {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .btn-sm { min-height: 36px; }

      /* Card action buttons: stack su xs */
      @media (max-width: 575.98px) {
        .card .d-flex.gap-2:not(.flex-nowrap) { flex-direction: column; }
        .filter-btn { flex: 1 1 40%; }
        .container { padding-left: 12px; padding-right: 12px; }
        .modal-footer { flex-direction: column; gap: 8px; }
        .modal-footer .btn { width: 100%; }
        h1.h3, h1.display-6 { font-size: 1.4rem; }
      }

      /* QR image non overflow su schermi piccoli */
      #qr-canvas, img[style*="260px"] { max-width: 100%; height: auto; }

      /* Chat: fix altezza su browser mobile con barre UI */
      .chat-wrapper { height: 100svh; height: 100dvh; }

      /* Skeleton loader */
      .skeleton {
        background: linear-gradient(90deg, #e9ecef 25%, #f8f9fa 50%, #e9ecef 75%);
        background-size: 200% 100%;
        animation: skeleton-shimmer 1.4s infinite;
        border-radius: 6px;
        display: inline-block;
      }
      @keyframes skeleton-shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      .skeleton-text  { height: 1em; width: 100%; margin-bottom: 6px; }
      .skeleton-title { height: 1.4em; width: 60%; margin-bottom: 10px; }
      .skeleton-card  { height: 90px; width: 100%; margin-bottom: 12px; }

      /* Spinner overlay su bottoni */
      .btn-loading { position: relative; pointer-events: none; opacity: 0.75; }
      .btn-loading::after {
        content: '';
        position: absolute;
        width: 16px; height: 16px;
        border: 2px solid transparent;
        border-top-color: currentColor;
        border-radius: 50%;
        animation: btn-spin 0.6s linear infinite;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
      }
      @keyframes btn-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Mostra un toast Bootstrap.
 * @param {string} message  - Testo da mostrare
 * @param {'success'|'danger'|'warning'|'info'} type - Tipo Bootstrap
 * @param {number} delay - ms prima che sparisca (default 4000)
 */
window.showToast = function showToast(message, type = 'success', delay = 4000) {
  const container = document.getElementById('rv-toast-container');
  if (!container) return;

  const icons = { success: '✓', danger: '✕', warning: '⚠', info: 'ℹ' };
  const id = `toast-${Date.now()}`;

  const html = `
    <div id="${id}" class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body fw-semibold">
          <span class="me-2">${icons[type] || ''}</span>${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Chiudi"></button>
      </div>
    </div>`;

  container.insertAdjacentHTML('beforeend', html);
  const toastEl = document.getElementById(id);
  const toast = new bootstrap.Toast(toastEl, { delay });
  toast.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
};

// Avvia quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
  injectGlobalStyles();
  initLayout();
});
