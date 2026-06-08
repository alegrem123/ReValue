const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { notSospeso } = require('../middleware/notSospesoMiddleware');
const { createSegnalazione, getMieSegnalazioni } = require('../controllers/segnalazioniController');

const router = Router();

// RF9, OCL #18, OCL #19: crea segnalazione
router.post('/', authenticate, notSospeso, createSegnalazione);

// RF9: lista segnalazioni inviate dall'utente
router.get('/me', authenticate, getMieSegnalazioni);

module.exports = router;
