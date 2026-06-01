(function () {
  const API_PREFIX = '/api/v1';
  const LOGIN_URL = 'login.html';
  const DASHBOARD_URL = 'dashboard.html';

  function getAdminToken() {
    return localStorage.getItem('adminToken');
  }

  function setAdminToken(token) {
    localStorage.setItem('adminToken', token);
  }

  function clearAdminToken() {
    localStorage.removeItem('adminToken');
  }

  function showAdminAlert(message, variant = 'danger') {
    const alert = document.getElementById('admin-alert');
    if (!alert) return;
    alert.className = `alert alert-${variant}`;
    alert.textContent = message;
  }

  function guardAdminPage() {
    if (!getAdminToken()) {
      window.location.href = LOGIN_URL;
    }
  }

  async function adminRequest(endpoint, { method = 'GET', body = null } = {}) {
    const token = getAdminToken();
    const headers = new Headers();
    if (body !== null) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(`${API_PREFIX}${endpoint}`, {
      method,
      headers,
      body: body !== null ? JSON.stringify(body) : undefined,
    });

    const json = await res.json().catch(() => null);
    const payload = json?.ok ? json.data : json;
    const message = json?.message || json?.error || `Errore ${res.status}`;

    if (res.status === 401 || res.status === 403) {
      clearAdminToken();
      window.location.href = LOGIN_URL;
    }

    return {
      ok: res.ok && json?.ok !== false,
      status: res.status,
      data: payload,
      error: res.ok ? null : message,
    };
  }

  window.revalueAdmin = {
    DASHBOARD_URL,
    getAdminToken,
    setAdminToken,
    clearAdminToken,
    showAdminAlert,
    guardAdminPage,
    adminRequest,
  };
})();
