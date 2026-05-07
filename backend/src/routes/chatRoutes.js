const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { requireParticipant } = require('../middleware/requireParticipant');
const { getConversazioniMe, getMessaggi, inviaMessaggio, getNonLettiCount } = require('../controllers/chatController');

const router = Router();

// GET /api/conversazioni/me — lista conversazioni utente + ultimo msg + non letti
router.get('/me', authenticate, getConversazioniMe);

// GET /api/conversazioni/me/non-letti — count totale non letti per badge UI (RF12)
router.get('/me/non-letti', authenticate, getNonLettiCount);

// GET /api/conversazioni/:id/messaggi — storico paginato, solo partecipante (RF11, RF13)
router.get('/:id/messaggi', authenticate, requireParticipant, getMessaggi);

// POST /api/conversazioni/:id/messaggi — invia messaggio, solo autenticato + partecipante (RF10, RF14)
router.post('/:id/messaggi', authenticate, requireParticipant, inviaMessaggio);

module.exports = router;
