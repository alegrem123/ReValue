(function () {
  const API_BASE = (function () {
    if (window.REVALUE_API_BASE) return window.REVALUE_API_BASE;
    if (['127.0.0.1', 'localhost'].includes(window.location.hostname)) return 'http://127.0.0.1:3000';
    return 'https://revalue-backend-84jb.onrender.com';
  })();

  function token() {
    return localStorage.getItem('adminToken');
  }

  async function request(endpoint, { method = 'GET', body = null } = {}) {
    const headers = new Headers();
    if (body !== null) headers.set('Content-Type', 'application/json');
    if (token()) headers.set('Authorization', `Bearer ${token()}`);

    const res = await fetch(API_BASE + endpoint, {
      method,
      headers,
      body: body === null ? undefined : JSON.stringify(body),
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('adminToken');
      window.location.href = 'login.html';
      return { ok: false, status: res.status, data: null, error: 'Accesso non autorizzato' };
    }

    const data = res.headers.get('Content-Type')?.includes('application/json') ? await res.json() : null;
    return {
      ok: res.ok,
      status: res.status,
      data,
      error: res.ok ? null : data?.error || data?.message || `Errore ${res.status}`,
    };
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function toast(message, type = 'success') {
    const container = document.getElementById('rv-toast-container');
    if (!container || typeof bootstrap === 'undefined') return;
    const id = `admin-toast-${Date.now()}`;
    container.insertAdjacentHTML('beforeend', `
      <div id="${id}" class="toast text-bg-${type} border-0" role="alert">
        <div class="d-flex">
          <div class="toast-body">${escapeHtml(message)}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Chiudi"></button>
        </div>
      </div>`);
    const el = document.getElementById(id);
    const instance = new bootstrap.Toast(el, { delay: 3500 });
    instance.show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
  }

  window.AdminApi = {
    get: (endpoint) => request(endpoint),
    post: (endpoint, body = {}) => request(endpoint, { method: 'POST', body }),
    patch: (endpoint, body = {}) => request(endpoint, { method: 'PATCH', body }),
    delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
    escapeHtml,
    toast,
  };
})();
