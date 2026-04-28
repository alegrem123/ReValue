const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { getStorico, invia } = require('../controllers/messaggiController');

const router = Router();

// RF11/UC6: storico messaggi per prenotazione — solo partecipanti
router.get('/:prenotazioneId', authenticate, getStorico);

// RF10/UC6: invia messaggio — solo partecipanti autenticati (RF14)
router.post('/:prenotazioneId', authenticate, invia);

module.exports = router;
