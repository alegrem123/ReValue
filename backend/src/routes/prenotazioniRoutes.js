const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { notSospeso } = require('../middleware/notSospesoMiddleware');
const { validateObjectIdParam } = require('../middleware/validateObjectId');
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
router.get('/:id', authenticate, validateObjectIdParam('id'), getPrenotazione);
router.delete('/:id', authenticate, validateObjectIdParam('id'), notSospeso, annullaPrenotazione);
router.post('/:id/no-show', authenticate, validateObjectIdParam('id'), notSospeso, segnalaMancatoRitiro);
router.post('/:id/disdici', authenticate, validateObjectIdParam('id'), notSospeso, disdiciPrenotazione);

module.exports = router;
