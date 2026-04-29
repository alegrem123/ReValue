const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { me, saldo, storico } = require('../controllers/walletController');

const router = Router();

// RF5+RF6/UC10+UC11: saldo + storico in una risposta — solo utente autenticato
router.get('/me', authenticate, me);

// RF5/UC10: solo saldo
router.get('/saldo', authenticate, saldo);

// RF6/UC11: storico paginato e filtrabile per tipo/data
router.get('/storico', authenticate, storico);

module.exports = router;
