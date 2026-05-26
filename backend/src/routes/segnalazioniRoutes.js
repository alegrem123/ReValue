const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { notSospeso } = require('../middleware/notSospesoMiddleware');
const { creaSegnalazione } = require('../controllers/segnalazioniController');

const router = Router();

router.post('/', authenticate, notSospeso, creaSegnalazione);

module.exports = router;
