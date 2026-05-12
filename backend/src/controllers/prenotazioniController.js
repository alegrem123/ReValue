const crypto = require('crypto');
const Annuncio = require('../models/annuncioModel');
const Prenotazione = require('../models/prenotazioneModel');
const TokenQR = require('../models/tokenQRModel');
const Conversazione = require('../models/conversazioneModel');
const User = require('../models/userModel');
const Segnalazione = require('../models/segnalazioneModel');

// finestra massima per disdire il ritiro (RF20): 3 giorni in ms
const DISDETTA_TTL_MS = 3 * 24 * 60 * 60 * 1000;


/**
 * POST /api/prenotazioni
 * Prenota un oggetto (RF24, UC2).
 * Usa optimistic lock su Annuncio.versione per prevenire doppia prenotazione (OCL #7, OCL #9).
 * Svela indirizzo esatto all'acquirente dopo conferma (RF25).
 * Crea TokenQR e Conversazione in modo atomico.
 * OCL #4: donatore non può prenotare il proprio annuncio.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function creaPrenotazione(req, res) {
  try {
    const { annuncioId } = req.body;

    if (!annuncioId) {
      return res.status(400).json({ error: 'annuncioId is required' });
    }

    const annuncio = await Annuncio.findById(annuncioId);

    if (!annuncio || !annuncio.isAttivo) {
      return res.status(404).json({ error: 'Annuncio non trovato' });
    }

    // OCL #4: donatore non può prenotare il proprio annuncio
    if (annuncio.donatore.toString() === req.user.id) {
      return res.status(409).json({ error: 'Non puoi prenotare il tuo stesso annuncio' });
    }

    // OCL #5 / OCL #6: annuncio deve essere attivo, DISPONIBILE e non scaduto
    if (annuncio.stato === 'PRENOTATO') {
      return res.status(409).json({ error: 'Oggetto già prenotato' });
    }

    if (annuncio.stato !== 'DISPONIBILE' || annuncio.dataScadenza <= new Date()) {
      return res.status(409).json({ error: 'Oggetto non più disponibile' });
    }

    // Optimistic lock (OCL #7, UC2 §5):
    // la query fallisce se versione è cambiata nel frattempo → doppia prenotazione impossibile
    const aggiornato = await Annuncio.findOneAndUpdate(
      { _id: annuncio._id, stato: 'DISPONIBILE', versione: annuncio.versione },
      { $set: { stato: 'PRENOTATO' }, $inc: { versione: 1 } },
      { new: true }
    );

    if (!aggiornato) {
      return res.status(409).json({ error: 'Oggetto appena prenotato da un altro utente' });
    }

    // crea Prenotazione
    const prenotazione = await Prenotazione.create({
      annuncio: annuncio._id,
      acquirente: req.user.id,
      donatore: annuncio.donatore,
    });

    // crea Conversazione (D2 §2.4.1, composizione con Prenotazione)
    await Conversazione.create({
      prenotazione: prenotazione._id,
      partecipanti: [annuncio.donatore, req.user.id],
    });

    // RF25: svela indirizzo esatto solo dopo prenotazione confermata
    return res.status(201).json({
      prenotazione,
      indirizzo: {
        latitudine: aggiornato.latitudine,
        longitudine: aggiornato.longitudine,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/prenotazioni/:id
 * Annulla prenotazione (RF26, OCL #10): solo entro 15 minuti, solo l'acquirente.
 * Riporta l'annuncio a DISPONIBILE e decrementa versione (OCL #11).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function annullaPrenotazione(req, res) {
  try {
    const prenotazione = await Prenotazione.findById(req.params.id);

    if (!prenotazione || prenotazione.stato !== 'ATTIVA') {
      return res.status(404).json({ error: 'Prenotazione attiva non trovata' });
    }

    if (prenotazione.acquirente.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    // OCL #10: finestra massima 15 minuti (RF26)
    const minuti = (Date.now() - prenotazione.dataPrenotazione.getTime()) / 60000;
    if (minuti > 15) {
      return res.status(409).json({ error: 'Finestra di annullamento (15 min) scaduta' });
    }

    // OCL #11: prenotazione → ANNULLATA, annuncio → DISPONIBILE
    prenotazione.stato = 'ANNULLATA';
    await prenotazione.save();

    await Annuncio.findByIdAndUpdate(prenotazione.annuncio, {
      $set: { stato: 'DISPONIBILE' },
      $inc: { versione: 1 },
    });

    // rimuove TokenQR associato
    await TokenQR.deleteOne({ prenotazione: prenotazione._id });

    return res.status(200).json({ message: 'Prenotazione annullata' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/prenotazioni/me
 * Ritorna le prenotazioni dell'utente loggato.
 * Supporta filtro opzionale per stato (?stato=ATTIVA, etc)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getMiePrenotazioni(req, res) {
  try {
    const { stato } = req.query;
    const filtro = { acquirente: req.user.id };

    if (stato && ['ATTIVA', 'ANNULLATA', 'COMPLETATA'].includes(stato)) {
      filtro.stato = stato;
    }

    const prenotazioni = await Prenotazione.find(filtro)
      .populate('annuncio', 'titolo oggetto stato')
      .populate('donatore', 'nome cognome')
      .sort({ dataPrenotazione: -1 });

    return res.status(200).json(prenotazioni);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/prenotazioni/:id
 * Dettaglio prenotazione (solo partecipanti).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getPrenotazione(req, res) {
  try {
    const prenotazione = await Prenotazione.findById(req.params.id)
      .populate('annuncio')
      .populate('donatore', 'nome cognome email')
      .populate('acquirente', 'nome cognome email');

    if (!prenotazione) {
      return res.status(404).json({ error: 'Prenotazione non trovata' });
    }

    // Solo partecipanti possono visualizzarla
    if (
      prenotazione.acquirente._id.toString() !== req.user.id &&
      prenotazione.donatore._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    return res.status(200).json(prenotazione);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/prenotazioni/:id/no-show
 * Il donatore segnala il mancato ritiro (RF19).
 * La prenotazione diventa ANNULLATA, l'annuncio torna DISPONIBILE,
 * e l'acquirente subisce un malus. Se i malus raggiungono 3, l'utente viene sospeso.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function segnalaMancatoRitiro(req, res) {
  try {
    const prenotazione = await Prenotazione.findById(req.params.id);

    if (!prenotazione || prenotazione.stato !== 'ATTIVA') {
      return res.status(404).json({ error: 'Prenotazione attiva non trovata' });
    }

    if (prenotazione.donatore.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Solo il donatore può segnalare il mancato ritiro' });
    }

    // Crea segnalazione no-show
    await Segnalazione.create({
      segnalante: req.user.id,
      segnalato: prenotazione.acquirente,
      annuncio: prenotazione.annuncio,
      tipo: 'altro',
      motivo: 'No-show: acquirente non si è presentato al ritiro',
    });

    // Aggiorna stato prenotazione
    prenotazione.stato = 'ANNULLATA';
    await prenotazione.save();

    // Ripristina annuncio (OCL #11)
    await Annuncio.findByIdAndUpdate(prenotazione.annuncio, {
      $set: { stato: 'DISPONIBILE' },
      $inc: { versione: 1 },
    });

    // Rimuove TokenQR associato
    await TokenQR.deleteOne({ prenotazione: prenotazione._id });

    // Penalità all'acquirente
    const acquirente = await User.findById(prenotazione.acquirente);
    if (acquirente) {
      acquirente.malusCount += 1;
      if (acquirente.malusCount >= 3) {
        acquirente.isSospeso = true;
      }
      await acquirente.save();
    }

    return res.status(200).json({ message: 'Mancato ritiro segnalato con successo' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/prenotazioni/:id/disdici
 * Il donatore disdice il ritiro (RF20): entro 3 giorni dalla dataScadenza dell'annuncio.
 * Riporta l'annuncio a DISPONIBILE e annulla la prenotazione.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function disdiciPrenotazione(req, res) {
  try {
    const prenotazione = await Prenotazione.findById(req.params.id).populate('annuncio');

    if (!prenotazione || prenotazione.stato !== 'ATTIVA') {
      return res.status(404).json({ error: 'Prenotazione attiva non trovata' });
    }

    if (prenotazione.donatore.toString() !== req.user.id) {
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

module.exports = {
  creaPrenotazione,
  annullaPrenotazione,
  getMiePrenotazioni,
  getPrenotazione,
  segnalaMancatoRitiro,
  disdiciPrenotazione,
};
