(function () {
  let currentPage = 1;
  let currentSearch = '';
  let currentAttivo = '';
  let couponModal = null;
  const couponById = new Map();

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function statusBadge(coupon) {
    return coupon.attivo
      ? '<span class="badge text-bg-success">Attivo</span>'
      : '<span class="badge text-bg-secondary">Disattivato</span>';
  }

  function stockLabel(stock) {
    return Number(stock) === 0 ? 'Illimitato' : String(stock ?? 0);
  }

  function actionButtons(coupon) {
    return `
      <div class="btn-group btn-group-sm" role="group">
        <button class="btn btn-outline-success" data-coupon-action="edit" data-coupon-id="${coupon._id}">
          Modifica
        </button>
        <button class="btn btn-outline-danger" data-coupon-action="disable" data-coupon-id="${coupon._id}" ${coupon.attivo ? '' : 'disabled'}>
          Disattiva
        </button>
      </div>`;
  }

  function renderCoupon(data) {
    const tbody = document.getElementById('coupon-table-body');
    const coupon = data.coupon || [];
    couponById.clear();
    coupon.forEach((item) => couponById.set(item._id, item));

    if (!coupon.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Nessun coupon trovato.</td></tr>';
    } else {
      tbody.innerHTML = coupon.map((item) => `
        <tr>
          <td>
            <div class="fw-semibold">${escapeHtml(item.titolo)}</div>
            <div class="text-muted small">${escapeHtml(item.descrizione)}</div>
          </td>
          <td>${escapeHtml(item.partner)}</td>
          <td>${item.costoCrediti ?? 0} cr.</td>
          <td>${escapeHtml(stockLabel(item.stock))}</td>
          <td>${statusBadge(item)}</td>
          <td class="text-end">${actionButtons(item)}</td>
        </tr>`).join('');
    }

    const pagination = data.pagination || { page: 1, pages: 1, total: coupon.length };
    document.getElementById('coupon-pagination').innerHTML = `
      <span class="text-muted small">Pagina ${pagination.page} di ${pagination.pages} - ${pagination.total} coupon</span>
      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-secondary" id="coupon-prev" ${pagination.page <= 1 ? 'disabled' : ''}>Precedente</button>
        <button class="btn btn-outline-secondary" id="coupon-next" ${pagination.page >= pagination.pages ? 'disabled' : ''}>Successiva</button>
      </div>`;

    document.getElementById('coupon-prev')?.addEventListener('click', () => loadCoupon(currentPage - 1));
    document.getElementById('coupon-next')?.addEventListener('click', () => loadCoupon(currentPage + 1));
    tbody.querySelectorAll('[data-coupon-action="edit"]').forEach((button) => {
      button.addEventListener('click', () => openCouponModal(couponById.get(button.dataset.couponId)));
    });
    tbody.querySelectorAll('[data-coupon-action="disable"]').forEach((button) => {
      button.addEventListener('click', () => disableCoupon(button.dataset.couponId));
    });
  }

  async function loadCoupon(page = 1) {
    currentPage = Math.max(1, page);
    const params = new URLSearchParams({
      page: currentPage,
      limit: 20,
      ...(currentSearch ? { search: currentSearch } : {}),
      ...(currentAttivo ? { attivo: currentAttivo } : {}),
    });

    const res = await window.revalueAdmin.adminRequest(`/admin/coupon?${params.toString()}`);
    if (!res.ok) {
      window.revalueAdmin.showAdminAlert(res.error || 'Impossibile caricare i coupon.');
      return;
    }
    renderCoupon(res.data);
  }

  function setField(id, value) {
    document.getElementById(id).value = value ?? '';
  }

  function openCouponModal(coupon = null) {
    document.getElementById('coupon-modal-title').textContent = coupon ? 'Modifica coupon' : 'Nuovo coupon';
    setField('coupon-id', coupon?._id || '');
    setField('coupon-titolo', coupon?.titolo || '');
    setField('coupon-partner', coupon?.partner || '');
    setField('coupon-costo', coupon?.costoCrediti || '');
    setField('coupon-stock', coupon?.stock ?? 0);
    setField('coupon-immagine', coupon?.immagine || '');
    setField('coupon-descrizione', coupon?.descrizione || '');
    setField('coupon-attivo', String(coupon?.attivo ?? true));
    couponModal.show();
  }

  function readPayload() {
    return {
      titolo: document.getElementById('coupon-titolo').value.trim(),
      partner: document.getElementById('coupon-partner').value.trim(),
      costoCrediti: Number.parseInt(document.getElementById('coupon-costo').value, 10),
      stock: Number.parseInt(document.getElementById('coupon-stock').value, 10),
      attivo: document.getElementById('coupon-attivo').value === 'true',
      immagine: document.getElementById('coupon-immagine').value.trim() || null,
      descrizione: document.getElementById('coupon-descrizione').value.trim(),
    };
  }

  async function saveCoupon(event) {
    event.preventDefault();
    const id = document.getElementById('coupon-id').value;
    const endpoint = id ? `/admin/coupon/${id}` : '/admin/coupon';
    const method = id ? 'PATCH' : 'POST';
    const submit = document.getElementById('coupon-save');

    submit.disabled = true;
    const res = await window.revalueAdmin.adminRequest(endpoint, {
      method,
      body: readPayload(),
    });
    submit.disabled = false;

    if (!res.ok) {
      window.revalueAdmin.showAdminAlert(res.error || 'Salvataggio coupon non riuscito.');
      return;
    }

    couponModal.hide();
    window.revalueAdmin.showAdminAlert(res.data?.message || 'Coupon salvato.', 'success');
    await loadCoupon(currentPage);
  }

  async function disableCoupon(id) {
    const coupon = couponById.get(id);
    if (!coupon) return;

    const confirmed = window.confirm(`Disattivare "${coupon.titolo}"?`);
    if (!confirmed) return;

    const res = await window.revalueAdmin.adminRequest(`/admin/coupon/${id}/disattiva`, {
      method: 'PATCH',
    });
    if (!res.ok) {
      window.revalueAdmin.showAdminAlert(res.error || 'Disattivazione coupon non riuscita.');
      return;
    }

    window.revalueAdmin.showAdminAlert(res.data?.message || 'Coupon disattivato.', 'success');
    await loadCoupon(currentPage);
  }

  document.addEventListener('DOMContentLoaded', () => {
    couponModal = new bootstrap.Modal(document.getElementById('coupon-modal'));
    document.getElementById('coupon-new')?.addEventListener('click', () => openCouponModal());
    document.getElementById('coupon-form')?.addEventListener('submit', saveCoupon);
    document.getElementById('coupon-filter-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      currentSearch = document.getElementById('coupon-search').value.trim();
      currentAttivo = document.getElementById('coupon-attivo-filter').value;
      loadCoupon(1);
    });
    loadCoupon();
  });
})();
