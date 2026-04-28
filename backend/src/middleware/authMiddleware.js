const { verifyToken } = require('../utils/jwt');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token mancante' });
  }

  try {
    const token = authHeader.slice(7);
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: err.message });
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
function optionalAuthenticate(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(authHeader.slice(7));
    } catch {
      // token invalido — req.user resta undefined, nessun errore
    }
  }
  next();
}

module.exports = { authenticate, optionalAuthenticate, requireAdmin };
