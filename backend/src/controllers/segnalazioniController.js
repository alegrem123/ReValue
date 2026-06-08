const Segnalazione = require('../models/segnalazioneModel');
const notificheService = require('../services/notificheService');
const User = require('../models/userModel');
const { isValidObjectId } = require('../middleware/validateObjectId');

/**
 * POST /api/v1/segnalazioni
 * Crea segnalazione. OCL #18: motivo non vuoto. OCL #19: segnalante !== segnalato.
 * RF9
 */
async function createSegnalazione(req, res, next) {
  try {
    const { segnalato, tipo, motivo, annuncio } = req.body;

    if (!segnalato) {
      return res.status(400).json({ error: 'segnalato è obbligatorio' });
    }
    if (!isValidObjectId(segnalato)) {
      return res.status(400).json({ error: 'segnalato non valido' });
    }
    if (annuncio && !isValidObjectId(annuncio)) {
      return res.status(400).json({ error: 'annuncio non valido' });
    }

    const TIPI_VALIDI = ['descrizione', 'inappropriato', 'altro'];
    if (!tipo || !TIPI_VALIDI.includes(tipo)) {
      return res.status(400).json({ error: `tipo deve essere uno di: ${TIPI_VALIDI.join(', ')}` });
    }

    // OCL #18 — motivo non vuoto
    if (!motivo || motivo.trim().length === 0) {
      return res.status(400).json({ error: 'motivo non può essere vuoto (OCL #18)' });
    }

    // OCL #19 — segnalante !== segnalato
    if (req.user.id === segnalato) {
      return res.status(409).json({ error: 'Non puoi segnalare te stesso (OCL #19)' });
    }

    const segnalazione = await Segnalazione.create({
      segnalante: req.user.id,
      segnalato,
      tipo,
      motivo: motivo.trim(),
      ...(annuncio && { annuncio }),
    });

    const admin = await User.findOne({ ruolo: 'admin' }).select('_id').lean();
    if (admin) {
      notificheService
        .creaNotifica(admin._id, 'segnalazione', `Nuova segnalazione da ${req.user.id}`, '/api/v1/admin/segnalazioni')
        .catch((e) => console.error('[notifica] createSegnalazione fallita', e));
    }

    return res.status(201).json({ segnalazione });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/segnalazioni/me
 * Lista segnalazioni inviate dall'utente autenticato.
 * RF9
 */
async function getMieSegnalazioni(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const [segnalazioni, totale] = await Promise.all([
      Segnalazione.find({ segnalante: req.user.id })
        .populate('segnalato', 'nome email')
        .populate('annuncio', 'titolo')
        .sort({ data: -1 })
        .skip(skip)
        .limit(limit),
      Segnalazione.countDocuments({ segnalante: req.user.id }),
    ]);

    return res.status(200).json({ segnalazioni, totale, page, limit });
  } catch (err) {
    return next(err);
  }
}

module.exports = { createSegnalazione, getMieSegnalazioni };
