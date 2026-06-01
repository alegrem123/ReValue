const { Router } = require('express');
const { authenticate, optionalAuthenticate } = require('../middleware/authMiddleware');
const { validateObjectIdParam } = require('../middleware/validateObjectId');
const {
  getCatalogo,
  getAnnuncio,
  creaAnnuncio,
  modificaAnnuncio,
  cancellaAnnuncio,
  cambiaStatoAnnuncio,
  getMieiAnnunci,
} = require('../controllers/annunciController');

const router = Router();

// RF4/UC8: catalogo pubblico — auth opzionale (cambia visibilità lat/lng)
router.get('/', optionalAuthenticate, getCatalogo);

// route protette — richiedono autenticazione
router.get('/me', authenticate, getMieiAnnunci);
router.get('/:id', validateObjectIdParam('id'), optionalAuthenticate, getAnnuncio);
router.post('/', authenticate, creaAnnuncio);
router.put('/:id', authenticate, validateObjectIdParam('id'), modificaAnnuncio);
router.delete('/:id', authenticate, validateObjectIdParam('id'), cancellaAnnuncio);
router.patch('/:id/stato', authenticate, validateObjectIdParam('id'), cambiaStatoAnnuncio);

module.exports = router;
