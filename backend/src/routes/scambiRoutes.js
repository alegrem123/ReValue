const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { getQR, validaScambio } = require('../controllers/scambiController');

const router = Router();

// Endpoint legacy: il flusso ufficiale Sprint 2 resta /api/v1/qr.
router.use((req, res) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Wed, 01 Jul 2026 00:00:00 GMT');
  res.set('Link', '</api/v1/qr>; rel="successor-version"');
  return res.status(410).json({
    error: 'SCAMBI_LEGACY_DEPRECATED',
    message: 'Endpoint legacy deprecato: usa /api/v1/qr/genera e /api/v1/qr/valida',
  });
});
router.get('/:prenotazioneId/qr', authenticate, getQR);

router.post('/:prenotazioneId/valida', authenticate, validaScambio);

module.exports = router;
