const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { notSospeso } = require('../middleware/notSospesoMiddleware');
const { creaTicket, getMieiTicket } = require('../controllers/supportoController');

const router = Router();

router.post('/ticket', authenticate, notSospeso, creaTicket);
router.get('/ticket/me', authenticate, getMieiTicket);

module.exports = router;
