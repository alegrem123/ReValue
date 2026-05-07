const crypto = require('crypto');
const Prenotazione = require('../models/prenotazioneModel');
const TokenQR = require('../models/tokenQRModel');
const Annuncio = require('../models/annuncioModel');
const { addPunti } = require('../services/walletService');
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

/**
 * POST /api/qr/valida
 * Valida il QR Code certificando l'avvenuto scambio fisico (RF27).
 * OCL #14: token non scaduto, prenotazione ATTIVA; post: COMPLETATA.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function validaQR(req, res) {
  try {
    const { codice } = req.body;
    if (!codice) {
      return res.status(400).json({ error: 'codice is required' });
    }

    // Cerchiamo il token e facciamo populate di prenotazione e annuncio
    const token = await TokenQR.findOne({ codice }).populate({
      path: 'prenotazione',
      populate: { path: 'annuncio' }
    });

    if (!token) {
      return res.status(404).json({ error: 'Codice QR non trovato o non valido' });
    }

    if (token.usato) {
      return res.status(400).json({ error: 'Codice QR già utilizzato' });
    }

    // OCL #14: token non deve essere scaduto
    if (token.scadenza < new Date()) {
      return res.status(400).json({ error: 'Codice QR scaduto' });
    }

    const prenotazione = token.prenotazione;

    // OCL #14: la prenotazione deve essere ATTIVA
    if (prenotazione.stato !== 'ATTIVA') {
      return res.status(400).json({ error: 'Prenotazione non più attiva' });
    }

    // Verifica che l'utente che scansiona sia effettivamente l'acquirente
    if (prenotazione.acquirente.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Scansione non autorizzata. Solo l\'acquirente può validare lo scambio.' });
    }

    // Validazione completata: aggiorniamo gli stati
    
    // OCL #14 (post): stato prenotazione diventa COMPLETATA
    prenotazione.stato = 'COMPLETATA';
    await prenotazione.save();

    // Constraint 12: stato annuncio diventa RITIRATO
    const annuncio = prenotazione.annuncio;
    annuncio.stato = 'RITIRATO';
    await annuncio.save();

    token.usato = true;
    await token.save();

    // RF27, OCL #16: Accredito crediti a donatore e acquirente
    const VALORE_CREDITI = 50; // valore di base per lo scambio
    await addPunti(
      prenotazione.donatore.toString(),
      VALORE_CREDITI,
      'Scambio completato (Donatore)',
      prenotazione._id
    );
    await addPunti(
      prenotazione.acquirente.toString(),
      VALORE_CREDITI,
      'Scambio completato (Acquirente)',
      prenotazione._id
    );

    return res.status(200).json({
      message: 'Scambio validato con successo',
      prenotazione: prenotazione._id,
      creditiAssegnati: VALORE_CREDITI
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { generaQR, validaQR };
