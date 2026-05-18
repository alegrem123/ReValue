const { Router } = require('express');

const router = Router();

// Endpoint legacy mantenuti per compatibilita': il flusso ufficiale resta /api/v1/qr.
function deprecatedScambiRoute(req, res) {
  res.set('Deprecation', 'true');
  return res.status(410).json({
    error: 'Endpoint legacy deprecato. Usa /api/v1/qr.',
  });
}

router.get('/:prenotazioneId/qr', deprecatedScambiRoute);

router.post('/:prenotazioneId/valida', deprecatedScambiRoute);

module.exports = router;
