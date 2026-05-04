const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { getQR, validaScambio } = require('../controllers/scambiController');

const router = Router();

// UC3 step 1: donatore mostra QR all'acquirente
router.get('/:prenotazioneId/qr', authenticate, getQR);

// UC3 step 3-4: acquirente scansiona e valida QR (RF27)
router.post('/:prenotazioneId/valida', authenticate, validaScambio);

module.exports = router;
