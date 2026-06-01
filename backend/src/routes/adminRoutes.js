const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');
const {
  getStatistiche,
  listUsers,
  listAnnunci,
  getSegnalazioni,
  applicaMalusSegnalazione,
  bannaUtente,
  sospendiUtente,
  riabilitaUtente,
  forzaStatoAnnuncio,
  rimuoviAnnuncio,
} = require('../controllers/adminController');

const router = Router();

// tutte le route admin richiedono autenticazione + ruolo admin
router.use(authenticate, requireAdmin);

// RF30/UC14: dashboard statistiche
router.get('/statistiche', getStatistiche);

// RF29: lista utenti per dashboard admin
router.get('/users', listUsers);

// RF31: lista annunci per dashboard admin
router.get('/annunci', listAnnunci);

// UC13: gestione segnalazioni
router.get('/segnalazioni', getSegnalazioni);
router.post('/segnalazioni/:id/malus', applicaMalusSegnalazione);

// RF29/D2 §2.2.2: gestione account
router.post('/utenti/:id/ban', bannaUtente);
router.post('/utenti/:id/sospendi', sospendiUtente);
router.post('/utenti/:id/riabilita', riabilitaUtente);

// RF31/D2 §2.2.2: gestione annunci
router.patch('/annunci/:id/forza', forzaStatoAnnuncio);
router.delete('/annunci/:id', rimuoviAnnuncio);

module.exports = router;
