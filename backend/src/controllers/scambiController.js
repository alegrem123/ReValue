const Prenotazione = require('../models/prenotazioneModel');
const Annuncio = require('../models/annuncioModel');
const TokenQR = require('../models/tokenQRModel');
const { addPunti } = require('../services/walletService');

// crediti assegnati a donatore e acquirente per ogni scambio completato
const CREDITI_SCAMBIO = 10;

// finestra massima per disdire il ritiro (RF20): 3 giorni in ms
const DISDETTA_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * GET /api/scambi/:prenotazioneId/qr
 * Il donatore visualizza il codice QR da mostrare all'acquirente (UC3 step 1).
 * Solo il donatore dell'annuncio può accedere al codice.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getQR(req, res) {
  try {
    const prenotazione = await Prenotazione.findById(req.params.prenotazioneId)
      .populate('annuncio');

    if (!prenotazione || prenotazione.stato !== 'ATTIVA') {
      return res.status(404).json({ error: 'Prenotazione attiva non trovata' });
    }

    // solo il donatore dell'annuncio può vedere il QR
    if (prenotazione.annuncio.donatore.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    const tokenQR = await TokenQR.findOne({ prenotazione: prenotazione._id, usato: false });
    if (!tokenQR) {
      return res.status(404).json({ error: 'Token QR non trovato o già usato' });
    }

    // OCL #14: token non scaduto
    if (tokenQR.scadenza <= new Date()) {
      return res.status(410).json({ error: 'Token QR scaduto' });
    }

    return res.status(200).json({ codice: tokenQR.codice, scadenza: tokenQR.scadenza });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/scambi/:prenotazioneId/valida
 * L'acquirente scansiona il QR e certifica l'avvenuto scambio fisico (UC3, RF27).
 * Se la validazione ha successo:
 *   - TokenQR.usato = true (OCL #14: non riusabile)
 *   - Prenotazione.stato = COMPLETATA (OCL #12)
 *   - Annuncio.stato = RITIRATO (OCL #12)
 *   - crediti accreditati a donatore e acquirente (RNF5 anti-frode)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function validaScambio(req, res) {
  try {
    const { codice } = req.body;

    // OCL #14: codice non vuoto
    if (!codice) {
      return res.status(400).json({ error: 'codice QR obbligatorio' });
    }

    const prenotazione = await Prenotazione.findById(req.params.prenotazioneId)
      .populate('annuncio');

    if (!prenotazione || prenotazione.stato !== 'ATTIVA') {
      return res.status(404).json({ error: 'Prenotazione attiva non trovata' });
    }

    // solo l'acquirente può validare
    if (prenotazione.acquirente.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    const tokenQR = await TokenQR.findOne({ prenotazione: prenotazione._id });
    if (!tokenQR || tokenQR.usato) {
      return res.status(409).json({ error: 'Token QR non valido o già usato' });
    }

    // OCL #14: token non scaduto
    if (tokenQR.scadenza <= new Date()) {
      return res.status(410).json({ error: 'Token QR scaduto' });
    }

    // OCL #14: verifica corrispondenza crittografica (RNF5)
    if (tokenQR.codice !== codice) {
      return res.status(401).json({ error: 'Scansione non autorizzata' });
    }

    // marca token come usato
    tokenQR.usato = true;
    await tokenQR.save();

    // OCL #12: Prenotazione → COMPLETATA
    prenotazione.stato = 'COMPLETATA';
    await prenotazione.save();

    // OCL #12: Annuncio → RITIRATO
    await Annuncio.findByIdAndUpdate(prenotazione.annuncio._id, {
      $set: { stato: 'RITIRATO', isAttivo: false },
    });

    // accredita crediti a entrambi i partecipanti (D2 §1.2.2, RNF5)
    const donatoreId = prenotazione.annuncio.donatore;
    const acquirenteId = prenotazione.acquirente;

    await Promise.all([
      addPunti(donatoreId, CREDITI_SCAMBIO, 'Scambio completato', prenotazione._id),
      addPunti(acquirenteId, CREDITI_SCAMBIO, 'Scambio completato', prenotazione._id),
    ]);

    return res.status(200).json({ message: 'Scambio confermato', crediti: CREDITI_SCAMBIO });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getQR, validaScambio };
