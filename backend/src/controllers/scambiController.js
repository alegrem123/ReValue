const Prenotazione = require('../models/prenotazioneModel');
const Annuncio = require('../models/annuncioModel');
const TokenQR = require('../models/tokenQRModel');
const Segnalazione = require('../models/segnalazioneModel');
const User = require('../models/userModel');
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

/**
 * POST /api/scambi/:prenotazioneId/noshow
 * Il donatore segnala il mancato ritiro dell'acquirente (RF19).
 * Crea una Segnalazione e incrementa malusCount dell'acquirente.
 * Riporta l'annuncio a DISPONIBILE.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function segnalaNoShow(req, res) {
  try {
    const prenotazione = await Prenotazione.findById(req.params.prenotazioneId)
      .populate('annuncio');

    if (!prenotazione || prenotazione.stato !== 'ATTIVA') {
      return res.status(404).json({ error: 'Prenotazione attiva non trovata' });
    }

    // solo il donatore può segnalare no-show
    if (prenotazione.annuncio.donatore.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    // OCL #19: segnalante !== segnalato (garantito strutturalmente: donatore != acquirente)

    // crea segnalazione no-show
    await Segnalazione.create({
      segnalante: req.user.id,
      segnalato: prenotazione.acquirente,
      annuncio: prenotazione.annuncio._id,
      tipo: 'altro',
      motivo: 'No-show: acquirente non si è presentato al ritiro',
    });

    // incrementa malus all'acquirente (D2 §2.3.5 applicaMalus)
    await User.findByIdAndUpdate(prenotazione.acquirente, { $inc: { malusCount: 1 } });

    // annulla prenotazione e riporta annuncio a DISPONIBILE
    prenotazione.stato = 'ANNULLATA';
    await prenotazione.save();

    await Annuncio.findByIdAndUpdate(prenotazione.annuncio._id, {
      $set: { stato: 'DISPONIBILE' },
      $inc: { versione: 1 },
    });

    await TokenQR.deleteOne({ prenotazione: prenotazione._id });

    return res.status(200).json({ message: 'No-show registrato' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/scambi/:prenotazioneId/disdici
 * Il donatore disdice il ritiro (RF20): entro 3 giorni dalla dataScadenza dell'annuncio.
 * Riporta l'annuncio a DISPONIBILE e annulla la prenotazione.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function disdiciRitiro(req, res) {
  try {
    const prenotazione = await Prenotazione.findById(req.params.prenotazioneId)
      .populate('annuncio');

    if (!prenotazione || prenotazione.stato !== 'ATTIVA') {
      return res.status(404).json({ error: 'Prenotazione attiva non trovata' });
    }

    // solo il donatore può disdire
    if (prenotazione.annuncio.donatore.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    // RF20: disdetta consentita solo entro 3 giorni dalla dataScadenza
    const msAllaScadenza = prenotazione.annuncio.dataScadenza.getTime() - Date.now();
    if (msAllaScadenza < 0 || msAllaScadenza > DISDETTA_TTL_MS) {
      return res.status(409).json({
        error: 'Disdetta consentita solo entro 3 giorni dalla data di ritiro (RF20)',
      });
    }

    prenotazione.stato = 'ANNULLATA';
    await prenotazione.save();

    await Annuncio.findByIdAndUpdate(prenotazione.annuncio._id, {
      $set: { stato: 'DISPONIBILE' },
      $inc: { versione: 1 },
    });

    await TokenQR.deleteOne({ prenotazione: prenotazione._id });

    return res.status(200).json({ message: 'Ritiro disdetto' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getQR, validaScambio, segnalaNoShow, disdiciRitiro };
