const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { getQR, validaScambio } = require('../controllers/scambiController');

const router = Router();

// Endpoint legacy mantenuti per compatibilita': il flusso ufficiale resta /api/qr.
router.use((req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Wed, 01 Jul 2026 00:00:00 GMT');
  res.set('Link', '</api/qr>; rel="successor-version"');
  next();
});
router.get('/:prenotazioneId/qr', authenticate, getQR);

router.post('/:prenotazioneId/valida', authenticate, validaScambio);

module.exports = router;
