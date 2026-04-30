const { Router } = require('express');
const { authenticate, optionalAuthenticate } = require('../middleware/authMiddleware');
const {
  getCatalogo,
  getAnnuncio,
  creaAnnuncio,
  modificaAnnuncio,
  cancellaAnnuncio,
  prenotaAnnuncio,
  annullaPrenotazione,
  cambiaStatoAnnuncio,
  getMieiAnnunci,
} = require('../controllers/annunciController');

const router = Router();

// RF4/UC8: catalogo pubblico — auth opzionale (cambia visibilità lat/lng)
router.get('/', optionalAuthenticate, getCatalogo);

// route protette — richiedono autenticazione
router.get('/me', authenticate, getMieiAnnunci);
router.get('/:id', optionalAuthenticate, getAnnuncio);
router.post('/', authenticate, creaAnnuncio);
router.put('/:id', authenticate, modificaAnnuncio);
router.delete('/:id', authenticate, cancellaAnnuncio);
router.post('/:id/prenota', authenticate, prenotaAnnuncio);
router.delete('/:id/prenotazione', authenticate, annullaPrenotazione);
router.patch('/:id/stato', authenticate, cambiaStatoAnnuncio);

module.exports = router;
