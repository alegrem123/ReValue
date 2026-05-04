const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { notSospeso } = require('../middleware/notSospesoMiddleware');
const { generaQR } = require('../controllers/qrController');

const router = Router();

// RF17: genera QR dinamicamente
router.post('/genera', authenticate, notSospeso, generaQR);

module.exports = router;
