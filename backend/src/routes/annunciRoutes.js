const { Router } = require('express');
const { authenticate, optionalAuthenticate } = require('../middleware/authMiddleware');
const { notSospeso } = require('../middleware/notSospesoMiddleware');
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

function onlyRegularUser(req, res, next) {
  if (req.user?.ruolo === 'admin') {
    return res.status(403).json({ error: 'Gli amministratori non possono eseguire questa operazione' });
  }
  return next();
}

// RF4/UC8: catalogo pubblico — auth opzionale (cambia visibilità lat/lng)
router.get('/', optionalAuthenticate, getCatalogo);

// route protette — richiedono autenticazione
router.get('/me', authenticate, getMieiAnnunci);
router.get('/:id', validateObjectIdParam('id'), optionalAuthenticate, getAnnuncio);
router.post('/', authenticate, notSospeso, onlyRegularUser, creaAnnuncio);
router.put('/:id', authenticate, notSospeso, validateObjectIdParam('id'), modificaAnnuncio);
router.delete('/:id', authenticate, notSospeso, validateObjectIdParam('id'), cancellaAnnuncio);
router.patch('/:id/stato', authenticate, notSospeso, validateObjectIdParam('id'), cambiaStatoAnnuncio);

module.exports = router;
