const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { getQR, validaScambio, segnalaNoShow, disdiciRitiro } = require('../controllers/scambiController');

const router = Router();

// UC3 step 1: donatore mostra QR all'acquirente
router.get('/:prenotazioneId/qr', authenticate, getQR);

// UC3 step 3-4: acquirente scansiona e valida QR (RF27)
router.post('/:prenotazioneId/valida', authenticate, validaScambio);

// RF19: donatore segnala no-show
router.post('/:prenotazioneId/noshow', authenticate, segnalaNoShow);

// RF20: donatore disdice ritiro entro 3 giorni
router.delete('/:prenotazioneId/disdici', authenticate, disdiciRitiro);

module.exports = router;
