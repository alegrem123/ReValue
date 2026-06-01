const Conversazione = require('../models/conversazioneModel');

/**
 * GET /api/v1/messaggi/:prenotazioneId
 * Restituisce lo storico messaggi della conversazione legata alla prenotazione (RF11, UC6).
 * Solo i partecipanti alla prenotazione possono leggere (RF13).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getStorico(req, res) {
  try {
    const conversazione = await Conversazione.findOne({
      prenotazione: req.params.prenotazioneId,
    }).populate('messaggi.mittente', 'nome cognome');

    if (!conversazione) {
      return res.status(404).json({ error: 'Conversazione non trovata' });
    }

    // RF13: solo partecipanti possono leggere
    const isPartecipante = conversazione.partecipanti.some(
      (p) => p.toString() === req.user.id
    );
    if (!isPartecipante) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    return res.status(200).json(conversazione.messaggi);
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * POST /api/v1/messaggi/:prenotazioneId
 * Invia un messaggio nella conversazione (RF10, RF14, UC6).
 * Solo i partecipanti possono inviare messaggi (RF13, RF14).
 * RNF9: messaggio persistito nel DB (embedded in Conversazione).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function invia(req, res) {
  try {
    const { testo } = req.body;

    if (!testo || testo.trim().length === 0) {
      return res.status(400).json({ error: 'testo obbligatorio' });
    }

    const conversazione = await Conversazione.findOne({
      prenotazione: req.params.prenotazioneId,
    });

    if (!conversazione) {
      return res.status(404).json({ error: 'Conversazione non trovata' });
    }

    // RF13/RF14: solo partecipanti autenticati possono inviare
    const isPartecipante = conversazione.partecipanti.some(
      (p) => p.toString() === req.user.id
    );
    if (!isPartecipante) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    const messaggio = {
      mittente: req.user.id,
      testo: testo.trim(),
      timestamp: new Date(),
    };

    // RNF9: persistenza garantita dall'embedding in Conversazione
    conversazione.messaggi.push(messaggio);
    await conversazione.save();

    const ultimo = conversazione.messaggi[conversazione.messaggi.length - 1];
    return res.status(201).json(ultimo);
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * PATCH /api/v1/messaggi/:id/letto
 * Marca un messaggio come letto. Solo partecipante della conversazione.
 * `:id` è l'ObjectId del subdocument messaggio.
 */
async function marcaLetto(req, res) {
  try {
    const conversazione = await Conversazione.findOne({
      'messaggi._id': req.params.id,
    });

    if (!conversazione) {
      return res.status(404).json({ ok: false, error: 'Messaggio non trovato' });
    }

    const isPartecipante = conversazione.partecipanti.some(
      (p) => p.toString() === req.user.id
    );
    if (!isPartecipante) {
      return res.status(403).json({ ok: false, error: 'Non autorizzato' });
    }

    const messaggio = conversazione.messaggi.id(req.params.id);
    messaggio.letto = true;
    await conversazione.save();

    return res.status(200).json({ ok: true, data: messaggio });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Errore interno del server' });
  }
}

module.exports = { getStorico, invia, marcaLetto };
