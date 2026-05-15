const crypto = require('crypto');
const Prenotazione = require('../models/prenotazioneModel');
const TokenQR = require('../models/tokenQRModel');
const {
  findTokenByCodice,
  finalizzaScambioAtomico,
} = require('../services/scambioQrService');
const QR_TTL_MS = 24 * 60 * 60 * 1000; // 24 ore

/** Codice di errore MongoDB per violazione di indice unique. */
const MONGO_DUPLICATE_KEY = 11000;

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

    // BUG FIX #1: distinguiamo prenotazione inesistente da stati non generabili.
    if (!prenotazione) {
      return res.status(404).json({ error: 'Prenotazione non trovata' });
    }
    if (prenotazione.stato === 'COMPLETATA') {
      return res.status(409).json({ error: 'Scambio già completato: impossibile rigenerare il QR' });
    }
    if (prenotazione.stato === 'ANNULLATA') {
      return res.status(409).json({ error: 'Prenotazione annullata: impossibile generare il QR' });
    }
    // stato === 'ATTIVA' da qui in poi

    // Solo il donatore può generare il QR per questa prenotazione
    if (prenotazione.annuncio.donatore.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Solo il donatore può generare il QR per questa prenotazione' });
    }

    // OCL #13: Genera un nuovo TokenQR. Rimuoviamo gli eventuali precedenti
    // PRIMA del create, così il nuovo insert non incappa nel vincolo unique.
    await TokenQR.deleteMany({ prenotazione: prenotazione._id });

    const scadenzaQR = new Date(Date.now() + QR_TTL_MS);
    let token;
    try {
      token = await TokenQR.create({
        prenotazione: prenotazione._id,
        codice: generaCodiceQR(),
        scadenza: scadenzaQR,
      });
    } catch (createErr) {
      // BUG FIX #2: race-condition – un altro processo ha appena inserito un token
      // (violazione unique su prenotazione) → 409 invece di 500.
      if (createErr.code === MONGO_DUPLICATE_KEY) {
        return res.status(409).json({ error: 'QR in fase di generazione da un altro processo, riprovare' });
      }
      throw createErr;
    }

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
    const token = await findTokenByCodice(codice);

    // BUG FIX #3: Il TTL index di MongoDB rimuove automaticamente i token scaduti.
    // Se findOne ritorna null NON possiamo sapere se il codice non è mai esistito
    // oppure se è stato rimosso per scadenza. Per dare un messaggio preciso al
    // client, tentiamo un lookup "tombstone" cercando nella cronologia della
    // prenotazione associata un token già usato con lo stesso codice.  Se non
    // troviamo nulla, il codice è semplicemente sconosciuto.
    if (!token) {
      // Il documento potrebbe essere stato cancellato dal TTL; non possiamo
      // distinguerlo con certezza senza audit log, ma restituiamo un messaggio
      // che copre entrambi i casi in modo chiaro per il client.
      return res.status(404).json({
        error: 'Codice QR non valido, già scaduto o non esistente',
      });
    }

    if (token.usato) {
      return res.status(400).json({ error: 'Codice QR già utilizzato' });
    }

    // OCL #14: token non deve essere scaduto (difesa in profondità; il TTL
    // potrebbe non aver ancora eliminato il documento se la scadenza è appena
    // passata e il job di pulizia non è ancora girato).
    if (token.scadenza < new Date()) {
      return res.status(400).json({ error: 'Codice QR scaduto' });
    }

    const prenotazione = token.prenotazione;

    // BUG FIX #4: messaggi distinti per ogni stato non-ATTIVA.
    if (prenotazione.stato === 'ANNULLATA') {
      return res.status(409).json({
        error: 'Prenotazione annullata: lo scambio non può essere validato',
      });
    }
    if (prenotazione.stato === 'COMPLETATA') {
      return res.status(409).json({
        error: 'Scambio già completato: questo QR è stato utilizzato',
      });
    }
    // stato === 'ATTIVA' da qui in poi (OCL #14)

    // Verifica che l'utente che scansiona sia effettivamente l'acquirente
    if (prenotazione.acquirente.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Scansione non autorizzata. Solo l\'acquirente può validare lo scambio.' });
    }

    const creditiAssegnati = await finalizzaScambioAtomico({ tokenId: token._id });

    return res.status(200).json({
      message: 'Scambio validato con successo',
      prenotazione: prenotazione._id,
      creditiAssegnati
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { generaQR, validaQR };
