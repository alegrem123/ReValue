const Conversazione = require('../models/conversazioneModel');

/**
 * GET /api/v1/conversazioni/me
 * Lista conversazioni dell'utente autenticato.
 * Per ogni conversazione: ultimo messaggio + count messaggi non letti (RF12).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getConversazioniMe(req, res) {
  try {
    const conversazioni = await Conversazione.find({
      partecipanti: req.user.id,
    })
      .populate('partecipanti', 'nome cognome')
      .populate('prenotazione', 'stato dataPrenotazione')
      .lean();

    const result = conversazioni.map((conv) => {
      const messaggi = conv.messaggi || [];

      const ultimoMessaggio = messaggi.length > 0
        ? messaggi[messaggi.length - 1]
        : null;

      // Non letti: mittente !== me E letto=false
      const nonLetti = messaggi.filter(
        (m) => m.mittente.toString() !== req.user.id && !m.letto
      ).length;

      return {
        _id:             conv._id,
        prenotazione:    conv.prenotazione,
        partecipanti:    conv.partecipanti,
        createdAt:       conv.createdAt,
        ultimoMessaggio: ultimoMessaggio
          ? {
              testo:     ultimoMessaggio.testo,
              mittente:  ultimoMessaggio.mittente,
              timestamp: ultimoMessaggio.timestamp,
            }
          : null,
        nonLetti,
      };
    });

    // Ordina per timestamp ultimo messaggio (più recente prima)
    result.sort((a, b) => {
      const tA = a.ultimoMessaggio?.timestamp ?? a.createdAt;
      const tB = b.ultimoMessaggio?.timestamp ?? b.createdAt;
      return new Date(tB) - new Date(tA);
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/conversazioni/:id/messaggi
 * Storico messaggi paginato. Solo partecipanti (RF11, RF13).
 * requireParticipant middleware attacca req.conversazione.
 *
 * Query params:
 *   page  (default 1)
 *   limit (default 20)
 *   q     (opzionale) — ricerca testo: $regex su campo testo, $options: 'i'
 */
async function getMessaggi(req, res) {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const q     = req.query.q;

    let messaggi = req.conversazione.messaggi;

    // Ricerca testo: $regex su campo testo con $options: 'i'
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex   = new RegExp(escaped, 'i'); // equivalente a $regex con $options: 'i'
      messaggi = messaggi.filter((m) => regex.test(m.testo));
    }

    const total = messaggi.length;

    // Messaggi più recenti prima: invertiamo, paginiamo, ri-invertiamo
    const reversed = [...messaggi].reverse();
    const slice    = reversed.slice((page - 1) * limit, page * limit).reverse();

    return res.status(200).json({
      ok: true,
      data: {
        messaggi: slice,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /api/v1/conversazioni/:id/messaggi
 * Invia un messaggio testuale. Solo autenticato + partecipante (RF10, RF14).
 * requireParticipant attacca req.conversazione.
 *
 * Body: { testo: string }
 */
async function inviaMessaggio(req, res) {
  try {
    const { testo } = req.body;

    if (!testo || typeof testo !== 'string' || testo.trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'testo è obbligatorio' });
    }

    const nuovoMessaggio = {
      mittente:  req.user.id,
      testo:     testo.trim(),
      timestamp: new Date(),
      letto:     false,
    };

    req.conversazione.messaggi.push(nuovoMessaggio);
    await req.conversazione.save();

    const salvato = req.conversazione.messaggi[req.conversazione.messaggi.length - 1];

    return res.status(201).json({ ok: true, data: salvato });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /api/v1/conversazioni/me/non-letti
 * Count totale messaggi non letti su tutte le conversazioni dell'utente (RF12).
 * Usato per badge navbar.
 */
async function getNonLettiCount(req, res) {
  try {
    const conversazioni = await Conversazione.find({
      partecipanti: req.user.id,
    }).lean();

    const totale = conversazioni.reduce((acc, conv) => {
      const nonLetti = (conv.messaggi || []).filter(
        (m) => m.mittente.toString() !== req.user.id && !m.letto
      ).length;
      return acc + nonLetti;
    }, 0);

    return res.status(200).json({ ok: true, data: { nonLetti: totale } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = { getConversazioniMe, getMessaggi, inviaMessaggio, getNonLettiCount };
