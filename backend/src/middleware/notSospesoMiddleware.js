/**
 * Middleware: blocca utenti sospesi su route che richiedono account attivo.
 *
 * Deve essere usato dopo `authenticate`, che popola req.user.isSospeso
 * con il valore fresco dal DB. La query DB di fallback è irraggiungibile
 * in quel contesto ed è stata rimossa (OCL #3).
 */
function notSospeso(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Autenticazione richiesta' });
  }
  if (req.user.isSospeso) {
    return res.status(403).json({ error: 'Account sospeso' });
  }
  next();
}

module.exports = { notSospeso };
