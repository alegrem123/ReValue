const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { notSospeso } = require('../middleware/notSospesoMiddleware');
const { validateObjectIdParam } = require('../middleware/validateObjectId');
const {
  createRecensione,
  getRecensioniRicevute,
  getRecensioniScritte,
  deleteRecensione,
} = require('../controllers/recensioniController');

const router = Router();

// route protette — richiedono autenticazione
router.post('/', authenticate, notSospeso, createRecensione);
router.get('/me/ricevute', authenticate, getRecensioniRicevute);
router.get('/me/scritte', authenticate, getRecensioniScritte);
router.delete('/:id', authenticate, validateObjectIdParam('id'), notSospeso, deleteRecensione);

module.exports = router;
