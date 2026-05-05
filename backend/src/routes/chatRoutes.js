const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { getConversazioniMe } = require('../controllers/chatController');

const router = Router();

// GET /api/conversazioni/me — lista conversazioni utente + ultimo msg + non letti
router.get('/me', authenticate, getConversazioniMe);

module.exports = router;
