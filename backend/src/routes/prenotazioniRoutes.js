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

function onlyRegularUser(req, res, next) {
  if (req.user?.ruolo === 'admin') {
    return res.status(403).json({ error: 'Gli amministratori non possono eseguire questa operazione' });
  }
  return next();
}

// route protette — richiedono autenticazione
router.post('/', authenticate, notSospeso, onlyRegularUser, creaPrenotazione);
router.get('/me', authenticate, getMiePrenotazioni);
router.get('/:id', authenticate, validateObjectIdParam('id'), getPrenotazione);
router.delete('/:id', authenticate, validateObjectIdParam('id'), notSospeso, annullaPrenotazione);
router.post('/:id/no-show', authenticate, validateObjectIdParam('id'), notSospeso, segnalaMancatoRitiro);
router.post('/:id/disdici', authenticate, validateObjectIdParam('id'), notSospeso, disdiciPrenotazione);

module.exports = router;
