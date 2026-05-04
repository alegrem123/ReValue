const crypto = require('crypto');
const Prenotazione = require('../models/prenotazioneModel');
const TokenQR = require('../models/tokenQRModel');

const QR_TTL_MS = 24 * 60 * 60 * 1000; // 24 ore

function generaCodiceQR() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * POST /api/qr/genera
 * Genera il QR associato alla prenotazione (RF17).
 * Solo il donatore della prenotazione può generarlo.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function generaQR(req, res) {
  try {
    const { prenotazioneId } = req.body;
    if (!prenotazioneId) {
      return res.status(400).json({ error: 'prenotazioneId is required' });
    }

    const prenotazione = await Prenotazione.findById(prenotazioneId).populate('annuncio');
    if (!prenotazione || prenotazione.stato !== 'ATTIVA') {
      return res.status(404).json({ error: 'Prenotazione attiva non trovata' });
    }

    // Solo il donatore può generare il QR per questa prenotazione
    if (prenotazione.annuncio.donatore.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Solo il donatore può generare il QR per questa prenotazione' });
    }

    // OCL #13: Genera un nuovo TokenQR. Rimuoviamo gli eventuali precedenti.
    await TokenQR.deleteMany({ prenotazione: prenotazione._id });

    const scadenzaQR = new Date(Date.now() + QR_TTL_MS);
    const token = await TokenQR.create({
      prenotazione: prenotazione._id,
      codice: generaCodiceQR(),
      scadenza: scadenzaQR,
    });

    return res.status(201).json({
      codice: token.codice,
      scadenza: token.scadenza,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { generaQR };
