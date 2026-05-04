const User = require('../models/userModel');

async function notSospeso(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Autenticazione richiesta' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    if (user.isSospeso) {
      return res.status(403).json({ error: 'Account sospeso' });
    }

    next();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { notSospeso };
