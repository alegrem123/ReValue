const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { notSospeso } = require('../middleware/notSospesoMiddleware');
const {
  creaPrenotazione,
  annullaPrenotazione,
  getMiePrenotazioni,
  getPrenotazione,
  segnalaMancatoRitiro,
  disdiciPrenotazione,
} = require('../controllers/prenotazioniController');

const router = Router();

// route protette — richiedono autenticazione
router.post('/', authenticate, notSospeso, creaPrenotazione);
router.get('/me', authenticate, getMiePrenotazioni);
router.get('/:id', authenticate, getPrenotazione);
router.delete('/:id', authenticate, notSospeso, annullaPrenotazione);
router.post('/:id/no-show', authenticate, notSospeso, segnalaMancatoRitiro);
router.post('/:id/disdici', authenticate, notSospeso, disdiciPrenotazione);

module.exports = router;
