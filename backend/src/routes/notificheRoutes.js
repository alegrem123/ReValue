const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const {
  getNotificheMe,
  marcaLetta,
  marcaTutteLette,
} = require('../controllers/notificheController');

const router = Router();

// GET /api/v1/notifiche/me - lista notifiche utente con paginazione e filtro letta (RF12)
router.get('/me', authenticate, getNotificheMe);

// PATCH /api/v1/notifiche/me/leggi-tutte - marca tutte le notifiche come lette
router.patch('/me/leggi-tutte', authenticate, marcaTutteLette);

// PATCH /api/v1/notifiche/:id/letta - marca una singola notifica come letta
router.patch('/:id/letta', authenticate, marcaLetta);

module.exports = router;
