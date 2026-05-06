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

    fetch('/api/wallet/saldo', {
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

  // Logout
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('jwt');
      window.location.href = homeUrl;
    });
  }
}

// Avvia quando il DOM è pronto
document.addEventListener('DOMContentLoaded', initLayout);
