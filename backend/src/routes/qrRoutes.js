const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { notSospeso } = require('../middleware/notSospesoMiddleware');
const { generaQR, validaQR } = require('../controllers/qrController');

const router = Router();

// RF17: genera QR dinamicamente
router.post('/genera', authenticate, notSospeso, generaQR);

// RF27: acquirente valida il QR Code
router.post('/valida', authenticate, notSospeso, validaQR);

module.exports = router;
