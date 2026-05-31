const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { requireParticipant } = require('../middleware/requireParticipant');
const { getConversazioniMe, getMessaggi, getMessaggiRecenti, inviaMessaggio, getNonLettiCount, setTyping } = require('../controllers/chatController');

const router = Router();

// GET /api/v1/conversazioni/me — lista conversazioni utente + ultimo msg + non letti
router.get('/me', authenticate, getConversazioniMe);

// GET /api/v1/conversazioni/me/non-letti — count totale non letti per badge UI (RF12)
router.get('/me/non-letti', authenticate, getNonLettiCount);

// GET /api/v1/conversazioni/:id/messaggi/recenti?since=<timestamp> — polling ottimizzato (RNF7)
router.get('/:id/messaggi/recenti', authenticate, requireParticipant, getMessaggiRecenti);

// GET /api/v1/conversazioni/:id/messaggi — storico paginato, solo partecipante (RF11, RF13)
router.get('/:id/messaggi', authenticate, requireParticipant, getMessaggi);

// POST /api/v1/conversazioni/:id/messaggi — invia messaggio, solo autenticato + partecipante (RF10, RF14)
router.post('/:id/messaggi', authenticate, requireParticipant, inviaMessaggio);

// POST /api/v1/conversazioni/:id/typing — segnala "sta scrivendo" (indicatore UI)
router.post('/:id/typing', authenticate, requireParticipant, setTyping);

module.exports = router;
