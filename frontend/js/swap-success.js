/**
 * swap-success.js
 * Pagina success scambio — mostra crediti accreditati.
 * Legge ?crediti=X da query string (passato da qr-scan.js dopo validazione).
 */

window.addEventListener('DOMContentLoaded', () => {
  const crediti = new URLSearchParams(window.location.search).get('crediti');
  const el = document.getElementById('crediti-value');

  if (crediti && !Number.isNaN(Number(crediti))) {
    el.textContent = `+${crediti} crediti`;
  } else {
    el.textContent = 'Crediti accreditati';
  }
});
