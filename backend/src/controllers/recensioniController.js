const Prenotazione = require('../models/prenotazioneModel');
const Recensione = require('../models/recensioneModel');

async function lasciaRecensione(req, res) {
  try {
    const { prenotazioneId, positiva, testo = '' } = req.body;

    if (!prenotazioneId || typeof positiva !== 'boolean') {
      return res.status(400).json({ error: 'prenotazioneId e positiva sono obbligatori' });
    }

    const prenotazione = await Prenotazione.findById(prenotazioneId);
    if (!prenotazione) {
      return res.status(404).json({ error: 'Prenotazione non trovata' });
    }

    if (prenotazione.stato !== 'COMPLETATA') {
      return res.status(409).json({ error: 'Puoi recensire solo uno scambio completato' });
    }

    const userId = req.user.id;
    const isAcquirente = prenotazione.acquirente.toString() === userId;
    const isDonatore = prenotazione.donatore.toString() === userId;
    if (!isAcquirente && !isDonatore) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    const recensito = isAcquirente ? prenotazione.donatore : prenotazione.acquirente;
    const recensione = await Recensione.create({
      recensore: userId,
      recensito,
      prenotazione: prenotazione._id,
      positiva,
      testo,
    });

    return res.status(201).json(recensione);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Hai già recensito questa prenotazione' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { lasciaRecensione };
