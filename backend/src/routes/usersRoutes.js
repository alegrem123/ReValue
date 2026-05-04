const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { notSospeso } = require('../middleware/notSospesoMiddleware');
const { updateProfile, getPublicProfile } = require('../controllers/usersController');

const router = Router();

router.put('/me', authenticate, notSospeso, updateProfile);
router.get('/:id/profilo', getPublicProfile);

module.exports = router;
