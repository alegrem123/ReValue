const User = require('../models/userModel');
const { verifyToken } = require('../utils/jwt');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token mancante' });
  }

  let payload;
  try {
    const token = authHeader.slice(7);
    payload = verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: err.message });
  }

  try {
    const user = await User.findById(payload.id);

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    if (user.isSospeso) {
      return res.status(403).json({ error: 'Account sospeso' });
    }

    req.user = {
      ...payload,
      id: user._id.toString(),
      ruolo: user.ruolo,
      nome: user.nome,
      isSospeso: user.isSospeso,
    };

    next();
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: err.message });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.ruolo !== 'admin') {
    return res.status(403).json({ error: 'Accesso riservato agli amministratori' });
  }
  next();
}

/**
 * Middleware di autenticazione opzionale.
 * Se il token è presente e valido, popola req.user.
 * Se manca o è invalido, lascia req.user undefined e passa al next senza errore.
 * Usato per route pubbliche con comportamento differenziato (es. catalogo RF4).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function optionalAuthenticate(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(authHeader.slice(7));
      const user = await User.findById(payload.id);
      if (user && !user.isSospeso) {
        req.user = {
          ...payload,
          id: user._id.toString(),
          ruolo: user.ruolo,
          nome: user.nome,
          isSospeso: user.isSospeso,
        };
      }
    } catch {
      // token invalido — req.user resta undefined, nessun errore
    }
  }
  next();
}

module.exports = { authenticate, optionalAuthenticate, requireAdmin };
