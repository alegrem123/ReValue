const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { validateObjectIdParam } = require('../middleware/validateObjectId');
const { getPremi, riscattaCoupon, getMieiRiscatti, marcaUsato } = require('../controllers/premiController');

const router = Router();

// UC7: lista coupon attivi — richiede utente autenticato
router.get('/', authenticate, getPremi);

// UC7: riscatta coupon (OCL #17 — verifica saldo)
router.post('/:id/riscatta', authenticate, validateObjectIdParam('id'), riscattaCoupon);

// UC7: lista riscatti utente autenticato
router.get('/miei', authenticate, getMieiRiscatti);

// UC7: marca riscatto come usato
router.patch('/riscatti/:id/usato', authenticate, validateObjectIdParam('id'), marcaUsato);

module.exports = router;
