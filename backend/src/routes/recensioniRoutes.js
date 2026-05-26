const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { notSospeso } = require('../middleware/notSospesoMiddleware');
const { lasciaRecensione } = require('../controllers/recensioniController');

const router = Router();

router.post('/', authenticate, notSospeso, lasciaRecensione);

module.exports = router;
