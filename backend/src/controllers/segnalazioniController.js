const Annuncio = require('../models/annuncioModel');
const Segnalazione = require('../models/segnalazioneModel');
const User = require('../models/userModel');

async function creaSegnalazione(req, res) {
  try {
    const { segnalatoId, annuncioId = null, tipo = 'altro', motivo } = req.body;

    if (!motivo || typeof motivo !== 'string' || motivo.trim().length === 0) {
      return res.status(400).json({ error: 'motivo è obbligatorio' });
    }

    let segnalato = segnalatoId || null;
    let annuncio = null;

    if (annuncioId) {
      annuncio = await Annuncio.findById(annuncioId);
      if (!annuncio) {
        return res.status(404).json({ error: 'Annuncio non trovato' });
      }
      segnalato = segnalato || annuncio.donatore.toString();
    }

    if (!segnalato) {
      return res.status(400).json({ error: 'segnalatoId o annuncioId obbligatorio' });
    }

    if (segnalato.toString() === req.user.id) {
      return res.status(409).json({ error: 'Non puoi segnalare te stesso' });
    }

    const utenteSegnalato = await User.findById(segnalato);
    if (!utenteSegnalato) {
      return res.status(404).json({ error: 'Utente segnalato non trovato' });
    }

    const segnalazione = await Segnalazione.create({
      segnalante: req.user.id,
      segnalato,
      annuncio: annuncio?._id ?? null,
      tipo,
      motivo: motivo.trim(),
    });

    return res.status(201).json(segnalazione);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { creaSegnalazione };
