const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { getStorico, invia, marcaLetto } = require('../controllers/messaggiController');

const router = Router();

// RF11/UC6: storico messaggi per prenotazione — solo partecipanti
router.get('/:prenotazioneId', authenticate, getStorico);

// RF10/UC6: invia messaggio — solo partecipanti autenticati (RF14)
router.post('/:prenotazioneId', authenticate, invia);

// PATCH /api/messaggi/:id/letto — marca messaggio come letto, solo partecipante
router.patch('/:id/letto', authenticate, marcaLetto);

module.exports = router;
