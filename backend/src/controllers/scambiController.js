const Prenotazione = require('../models/prenotazioneModel');
const {
  findActiveTokenByPrenotazione,
  findTokenByCodice,
  finalizzaScambioAtomico,
} = require('../services/scambioQrService');

/**
 * GET /api/v1/scambi/:prenotazioneId/qr
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

    const tokenQR = await findActiveTokenByPrenotazione(prenotazione._id);
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
 * POST /api/v1/scambi/:prenotazioneId/valida
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

    const tokenQR = await findTokenByCodice(codice);
    if (!tokenQR) {
      return res.status(404).json({ error: 'Codice QR non valido, già scaduto o non esistente' });
    }

    const prenotazione = tokenQR.prenotazione;

    if (!prenotazione || prenotazione._id.toString() !== req.params.prenotazioneId) {
      return res.status(409).json({ error: 'Il codice QR non appartiene alla prenotazione indicata' });
    }

    if (prenotazione.stato !== 'ATTIVA') {
      return res.status(404).json({ error: 'Prenotazione attiva non trovata' });
    }

    // solo l'acquirente può validare
    if (prenotazione.acquirente.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    if (tokenQR.usato) {
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

    const crediti = await finalizzaScambioAtomico({ tokenId: tokenQR._id });

    return res.status(200).json({ message: 'Scambio confermato', crediti });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getQR, validaScambio };
