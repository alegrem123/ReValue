const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { notSospeso } = require('../middleware/notSospesoMiddleware');
const {
  getMe,
  updateProfile,
  getPublicProfile,
} = require('../controllers/usersController');
const { getRecensioniUtente } = require('../controllers/recensioniController');

const router = Router();

router.get('/me', authenticate, getMe);
router.put('/me', authenticate, notSospeso, updateProfile);
router.get('/:id/profilo', getPublicProfile);
router.get('/:id/recensioni', getRecensioniUtente);

module.exports = router;
