(function () {
  const form = document.getElementById('admin-login-form');
  const alertBox = document.getElementById('admin-login-alert');
  const submit = document.getElementById('admin-login-submit');

  function showError(message) {
    alertBox.textContent = message;
    alertBox.classList.remove('d-none');
  }

  const ADMIN_API_BASE = (() => {
    const explicit = window.REVALUE_API_BASE || (window.REVALUE_CONFIG && window.REVALUE_CONFIG.API_BASE);
    if (explicit) return String(explicit).replace(/\/+$/, '');
    if (['127.0.0.1', 'localhost'].includes(window.location.hostname)) return 'http://127.0.0.1:3000';
    return 'https://revalue-backend-84jb.onrender.com';
  })();

  async function login(email, password) {
    const res = await fetch(`${ADMIN_API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json().catch(() => null);
    return { res, json, data: json?.data ?? json };
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alertBox.classList.add('d-none');

    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    if (!email || !password) {
      showError('Email e password obbligatorie.');
      return;
    }

    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    submit.classList.add('btn-loading');
    try {
      const { res, json, data } = await login(email, password);
      if (!res.ok || json?.ok === false) {
        showError(json?.message || json?.error || 'Accesso non riuscito.');
        return;
      }

      if (data?.user?.ruolo !== 'admin') {
        showError('Accesso negato.');
        return;
      }

      localStorage.setItem('adminToken', data.token);
      window.location.href = 'dashboard.html';
    } catch {
      showError('Backend non raggiungibile.');
    } finally {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
      submit.classList.remove('btn-loading');
    }
  });
})();
