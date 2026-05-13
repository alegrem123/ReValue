const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { getQR, validaScambio } = require('../controllers/scambiController');

const router = Router();

// Endpoint legacy mantenuti per compatibilita': il flusso ufficiale resta /api/qr.
router.get('/:prenotazioneId/qr', authenticate, getQR);

router.post('/:prenotazioneId/valida', authenticate, validaScambio);

module.exports = router;
