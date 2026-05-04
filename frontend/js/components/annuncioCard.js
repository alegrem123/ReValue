/**
 * annuncioCard.js
 * Componente card per la pagina catalogo.
 */

function formatDateItalian(dateInput) {
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatDistanceLabel(distanceKm) {
  if (distanceKm == null || Number.isNaN(distanceKm)) {
    return 'Distanza non disponibile';
  }
  return `${distanceKm.toFixed(1)} km`; 
}

function createAnnuncioCard(annuncio) {
  const foto = annuncio.oggetto?.foto?.[0] || 'https://via.placeholder.com/420x220/ced4da/6c757d?text=Immagine+non+disponibile';
  const titolo = annuncio.titolo || 'Annuncio senza titolo';
  const scadenza = annuncio.dataScadenza ? formatDateItalian(annuncio.dataScadenza) : 'Data non disponibile';
  const distanza = formatDistanceLabel(annuncio.distanza);
  const dettaglioUrl = `/views/annuncio.html?id=${annuncio._id}`;

  const col = document.createElement('div');
  col.className = 'col-md-6 col-lg-4 mb-4';
  col.innerHTML = `
    <article class="card h-100 shadow-sm border-0">
      <img src="${foto}" class="card-img-top object-fit-cover" alt="Foto annuncio ${titolo}" style="height: 220px;" />
      <div class="card-body d-flex flex-column">
        <h3 class="h5 card-title fw-bold">${titolo}</h3>
        <p class="card-text text-muted mb-2">Scadenza: <strong>${scadenza}</strong></p>
        <p class="card-text text-muted mb-3">${distanza}</p>
        <div class="mt-auto">
          <a href="${dettaglioUrl}" class="btn btn-outline-success w-100">
            Vedi
          </a>
        </div>
      </div>
    </article>
  `;

  return col;
}

window.createAnnuncioCard = createAnnuncioCard;
window.formatDistanceLabel = formatDistanceLabel;
