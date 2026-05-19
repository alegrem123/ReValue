const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { getPremi, riscattaCoupon, getMieiRiscatti, marcaUsato } = require('../controllers/premiController');

const router = Router();

// UC7: lista coupon attivi — pubblica ma auth preferibile per coerenza
router.get('/', authenticate, getPremi);

// UC7: riscatta coupon (OCL #17 — verifica saldo)
router.post('/:id/riscatta', authenticate, riscattaCoupon);

// UC7: lista riscatti utente autenticato
router.get('/miei', authenticate, getMieiRiscatti);

// UC7: marca riscatto come usato
router.patch('/riscatti/:id/usato', authenticate, marcaUsato);

module.exports = router;
