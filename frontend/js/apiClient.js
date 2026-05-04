/**
 * apiClient.js
 * Wrapper attorno a fetch che:
 *  - inietta automaticamente l'header Authorization: Bearer <jwt>
 *  - serializza il body in JSON
 *  - al 401 rimuove il token e reindirizza al login
 *  - restituisce sempre { ok, data, error } — convenzione API del progetto
 */

const API_BASE = (function () {
  // Se stai servendo il frontend da Live Server su 127.0.0.1:5500,
  // punta le richieste verso il backend in esecuzione su 127.0.0.1:3000.
  if (
    window.location.hostname === '127.0.0.1' &&
    window.location.port === '5500'
  ) {
    return 'http://127.0.0.1:3000';
  }
  return '';
})();

/**
 * Legge il JWT da localStorage.
 * @returns {string|null}
 */
function getToken() {
  return localStorage.getItem('jwt');
}

/**
 * Costruisce gli header comuni per ogni richiesta.
 * @param {boolean} withBody — aggiunge Content-Type: application/json se true
 * @returns {Headers}
 */
function buildHeaders(withBody = false) {
  const headers = new Headers();
  if (withBody) headers.set('Content-Type', 'application/json');

  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  return headers;
}

/**
 * Gestisce risposta 401: pulisce localStorage e manda al login.
 * Passa l'URL corrente come ?redirect= per tornare dopo il login.
 */
function handleUnauthorized() {
  localStorage.removeItem('jwt');
  const redirect = encodeURIComponent(
    window.location.pathname + window.location.search
  );
  window.location.href = `/views/login.html?redirect=${redirect}`;
}

/**
 * Core: esegue la fetch con header auth automatico.
 *
 * @param {string} endpoint   — es. '/api/annunci'
 * @param {Object} [options]
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} [options.method='GET']
 * @param {Object|null} [options.body]    — verrà serializzato in JSON
 * @param {boolean} [options.auth=true]   — se false non aggiunge il token
 * @returns {Promise<{ok: boolean, data: *, status: number, error: string|null}>}
 */
async function request(
  endpoint,
  { method = 'GET', body = null, auth = true } = {}
) {
  const hasBody = body !== null && body !== undefined;
  const headers = auth
    ? buildHeaders(hasBody)
    : hasBody
      ? new Headers({ 'Content-Type': 'application/json' })
      : new Headers();

  const init = {
    method,
    headers,
  };
  if (hasBody) init.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(API_BASE + endpoint, init);
  } catch (networkErr) {
    return {
      ok: false,
      data: null,
      status: 0,
      error: 'Errore di rete. Controlla la connessione.',
    };
  }

  if (res.status === 401 && auth) {
    handleUnauthorized();
    return { ok: false, data: null, status: 401, error: 'Non autenticato.' };
  }

  let data = null;
  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  const error = !res.ok
    ? data?.error || data?.message || `Errore ${res.status}`
    : null;

  return { ok: res.ok, data, status: res.status, error };
}

/* ── Shorthand per ogni metodo HTTP ─────────────────────────────────── */

const api = {
  /**
   * GET /endpoint
   * @param {string} endpoint
   * @param {Object} [opts]
   */
  get(endpoint, opts = {}) {
    return request(endpoint, { ...opts, method: 'GET', body: null });
  },

  /**
   * POST /endpoint  con body JSON
   * @param {string} endpoint
   * @param {Object} body
   * @param {Object} [opts]
   */
  post(endpoint, body, opts = {}) {
    return request(endpoint, { ...opts, method: 'POST', body });
  },

  /**
   * PUT /endpoint  con body JSON
   * @param {string} endpoint
   * @param {Object} body
   * @param {Object} [opts]
   */
  put(endpoint, body, opts = {}) {
    return request(endpoint, { ...opts, method: 'PUT', body });
  },

  /**
   * PATCH /endpoint  con body JSON
   * @param {string} endpoint
   * @param {Object} body
   * @param {Object} [opts]
   */
  patch(endpoint, body, opts = {}) {
    return request(endpoint, { ...opts, method: 'PATCH', body });
  },

  /**
   * DELETE /endpoint
   * @param {string} endpoint
   * @param {Object} [opts]
   */
  delete(endpoint, opts = {}) {
    return request(endpoint, { ...opts, method: 'DELETE', body: null });
  },
};

/* ── Esporta sia il core che gli shorthand ───────────────────────────── */
window.api = api;
window.apiRequest = request;
