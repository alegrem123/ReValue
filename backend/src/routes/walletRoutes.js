const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { saldo, storico } = require('../controllers/walletController');

const router = Router();

// RF5/UC10: saldo aggiornato — solo utente autenticato
router.get('/saldo', authenticate, saldo);

// RF6/UC11: storico transazioni — solo utente autenticato
router.get('/storico', authenticate, storico);

module.exports = router;
