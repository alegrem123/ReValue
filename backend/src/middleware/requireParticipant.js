const Conversazione = require('../models/conversazioneModel');

/**
 * Verifica che l'utente autenticato sia un partecipante della conversazione.
 * RF13: impedisce l'invio/lettura di messaggi a utenti non coinvolti nello scambio.
 *
 * Richiede: authenticate prima in catena (req.user.id disponibile).
 * Param:    :id — ObjectId della conversazione.
 * Attacca:  req.conversazione per evitare doppia query nei controller.
 */
async function requireParticipant(req, res, next) {
  try {
    const conversazione = await Conversazione.findById(req.params.id);

    if (!conversazione) {
      return res.status(404).json({ error: 'Conversazione non trovata' });
    }

    const isPartecipante = conversazione.partecipanti.some(
      (p) => p.toString() === req.user.id
    );

    if (!isPartecipante) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    req.conversazione = conversazione;
    next();
  } catch (err) {
    console.error('requireParticipant: errore durante la verifica del partecipante', {
      conversazioneId: req.params.id,
      userId: req.user?.id,
      error: err,
    });
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

module.exports = { requireParticipant };
