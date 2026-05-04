/**
 * catalog.js
 * Logica della pagina catalogo.
 */

const catalogContainer = document.getElementById('catalog-container');
const catalogSpinner = document.getElementById('catalog-spinner');
const catalogAlert = document.getElementById('catalog-alert');
const catalogGrid = document.getElementById('catalog-grid');

async function loadCatalogo() {
  if (!catalogContainer || !catalogGrid || !catalogSpinner || !catalogAlert) return;

  catalogSpinner.classList.remove('d-none');
  catalogAlert.classList.add('d-none');
  catalogGrid.innerHTML = '';

  const response = await api.get('/api/annunci', { auth: false });
  catalogSpinner.classList.add('d-none');

  if (!response.ok) {
    catalogAlert.textContent = response.error || 'Errore nel caricamento del catalogo.';
    catalogAlert.classList.remove('d-none', 'alert-success');
    catalogAlert.classList.add('alert', 'alert-danger');
    return;
  }

  const annunci = response.data?.data || [];
  if (annunci.length === 0) {
    catalogGrid.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info">Nessun annuncio disponibile al momento.</div>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  annunci.forEach((annuncio) => {
    const card = window.createAnnuncioCard(annuncio);
    fragment.appendChild(card);
  });
  catalogGrid.appendChild(fragment);
}

window.addEventListener('DOMContentLoaded', loadCatalogo);
