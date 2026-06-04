const {
  getNotifiche,
  contaNonLette,
  marcaLetta: marcaLettaService,
  marcaTutteLette: marcaTutteLetteService,
} = require('../services/notificheService');

function parseBoolean(value) {
  if (value === undefined) return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

/**
 * GET /api/v1/notifiche/me
 * Restituisce le notifiche dell'utente autenticato con paginazione e filtro letta.
 */
async function getNotificheMe(req, res, next) {
  try {
    const letta = parseBoolean(req.query.letta);
    if (letta === null) {
      return res.status(400).json({ ok: false, error: 'Parametro letta non valido' });
    }

    const result = await getNotifiche(req.user.id, req.query.page, {
      limit: req.query.limit,
      letta,
    });
    const nonLette = await contaNonLette(req.user.id);

    return res.status(200).json({
      ok: true,
      data: {
        ...result,
        nonLette,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/v1/notifiche/:id/letta
 * Marca come letta una singola notifica dell'utente autenticato.
 */
async function marcaLetta(req, res, next) {
  try {
    const notifica = await marcaLettaService(req.user.id, req.params.id);
    return res.status(200).json({ ok: true, data: notifica });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/v1/notifiche/me/leggi-tutte
 * Marca come lette tutte le notifiche non lette dell'utente autenticato.
 */
async function marcaTutteLette(req, res, next) {
  try {
    const aggiornate = await marcaTutteLetteService(req.user.id);
    return res.status(200).json({ ok: true, data: { aggiornate } });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getNotificheMe,
  marcaLetta,
  marcaTutteLette,
};
