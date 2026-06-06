const crypto = require('crypto');
const mongoose = require('mongoose');
const Annuncio = require('../models/annuncioModel');
const Prenotazione = require('../models/prenotazioneModel');
const TokenQR = require('../models/tokenQRModel');
const Conversazione = require('../models/conversazioneModel');
const User = require('../models/userModel');
const Segnalazione = require('../models/segnalazioneModel');
const { applicaMalus } = require('../services/userService');
const { calcolaCrediti } = require('../services/scambioQrService');
const { sottraiPunti } = require('../services/walletService');

const MALUS_CREDITI_NOSHOW = 25;

const DISDETTA_TTL_MS = 3 * 24 * 60 * 60 * 1000;

async function creaPrenotazione(req, res) {
  try {
    if (req.user?.ruolo === 'admin') {
      return res.status(403).json({ error: 'Gli amministratori non possono prenotare annunci' });
    }

    const { annuncioId } = req.body;
    if (!annuncioId) return res.status(400).json({ error: 'annuncioId is required' });

    const annuncio = await Annuncio.findById(annuncioId);
    if (!annuncio || !annuncio.isAttivo) return res.status(404).json({ error: 'Annuncio non trovato' });
    // OCL #4: il donatore non può prenotare il proprio annuncio
    if (annuncio.donatore.toString() === req.user.id) return res.status(409).json({ error: 'Non puoi prenotare il tuo stesso annuncio' });
    // OCL #6: prenotazione solo su annuncio DISPONIBILE e non scaduto
    if (annuncio.stato === 'PRENOTATO') return res.status(409).json({ error: 'Oggetto già prenotato' });
    if (annuncio.stato !== 'DISPONIBILE' || annuncio.dataScadenza <= new Date()) return res.status(409).json({ error: 'Oggetto non più disponibile' });

    const session = await mongoose.startSession();
    let prenotazione, lockedAnnuncio;
    try {
      await session.withTransaction(async () => {
        // OCL #9/#10: una sola prenotazione attiva — optimistic lock su versione
        lockedAnnuncio = await Annuncio.findOneAndUpdate(
          { _id: annuncio._id, stato: 'DISPONIBILE', versione: annuncio.versione },
          { $set: { stato: 'PRENOTATO' }, $inc: { versione: 1 } },
          { new: true, session }
        );
        if (!lockedAnnuncio) {
          const err = new Error('Oggetto appena prenotato da un altro utente');
          err.statusCode = 409;
          throw err;
        }
        const crediti = calcolaCrediti(annuncio.oggetto?.categoria, annuncio.dataScadenza);
        [prenotazione] = await Prenotazione.create(
          [{ annuncio: annuncio._id, acquirente: req.user.id, donatore: annuncio.donatore, creditiDonatore: crediti.donatore, creditiAcquirente: crediti.acquirente }],
          { session }
        );
        const pairKey = [annuncio.donatore, req.user.id].map(String).sort().join('_');
        await Conversazione.findOneAndUpdate(
          { pairKey },
          {
            $setOnInsert: {
              prenotazione: prenotazione._id,
              partecipanti: [annuncio.donatore, req.user.id],
              pairKey,
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
            session,
          }
        );
      });
    } finally {
      await session.endSession();
    }

    const notificheService = require('../services/notificheService');
    notificheService.creaNotifica(
      annuncio.donatore,
      'prenotazione',
      'Un utente ha prenotato il tuo annuncio',
      `/prenotazioni/${prenotazione._id}`
    ).catch((e) => console.error('[notifica] creaPrenotazione fallita', e));

    return res.status(201).json({
      prenotazione,
      indirizzo: { latitudine: lockedAnnuncio.latitudine, longitudine: lockedAnnuncio.longitudine },
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error('creaPrenotazione: errore interno', {
      userId: req.user?.id,
      annuncioId: req.body?.annuncioId,
      error: err,
    });
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

async function annullaPrenotazione(req, res) {
  try {
    const prenotazione = await Prenotazione.findById(req.params.id);
    if (!prenotazione || prenotazione.stato !== 'ATTIVA') return res.status(404).json({ error: 'Prenotazione attiva non trovata' });
    if (prenotazione.acquirente.toString() !== req.user.id) return res.status(403).json({ error: 'Non autorizzato' });
    const minuti = (Date.now() - prenotazione.dataPrenotazione.getTime()) / 60000;
    if (minuti > 15) return res.status(409).json({ error: 'Finestra di annullamento (15 min) scaduta' });

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        prenotazione.stato = 'ANNULLATA';
        await prenotazione.save({ session });
        await Annuncio.findByIdAndUpdate(
          prenotazione.annuncio,
          { $set: { stato: 'DISPONIBILE' }, $inc: { versione: 1 } },
          { session }
        );
        await TokenQR.deleteOne({ prenotazione: prenotazione._id }).session(session);
      });
    } finally {
      await session.endSession();
    }

    const notificheService = require('../services/notificheService');
    notificheService.creaNotifica(
      prenotazione.donatore,
      'prenotazione',
      'Una prenotazione è stata annullata',
      `/prenotazioni/${prenotazione._id}`
    ).catch((e) => console.error('[notifica] annullaPrenotazione fallita', e));

    return res.status(200).json({ message: 'Prenotazione annullata' });
  } catch (err) {
    console.error('annullaPrenotazione: errore interno', {
      userId: req.user?.id,
      prenotazioneId: req.params.id,
      error: err,
    });
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

async function getMiePrenotazioni(req, res) {
  try {
    const { stato } = req.query;
    const filtro = { $or: [{ acquirente: req.user.id }, { donatore: req.user.id }] };
    if (stato && ['ATTIVA', 'ANNULLATA', 'COMPLETATA'].includes(stato)) filtro.stato = stato;
    const prenotazioni = await Prenotazione.find(filtro)
      .populate('annuncio', 'titolo oggetto stato')
      .populate('donatore', 'nome cognome')
      .populate('acquirente', 'nome cognome')
      .sort({ dataPrenotazione: -1 });
    return res.status(200).json(prenotazioni);
  } catch (err) {
    console.error('getMiePrenotazioni: errore interno', {
      userId: req.user?.id,
      stato: req.query?.stato,
      error: err,
    });
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

async function getPrenotazione(req, res) {
  try {
    const prenotazione = await Prenotazione.findById(req.params.id)
      .populate('annuncio').populate('donatore', 'nome cognome email').populate('acquirente', 'nome cognome email');
    if (!prenotazione) return res.status(404).json({ error: 'Prenotazione non trovata' });
    if (prenotazione.acquirente._id.toString() !== req.user.id && prenotazione.donatore._id.toString() !== req.user.id)
      return res.status(403).json({ error: 'Non autorizzato' });
    return res.status(200).json(prenotazione);
  } catch (err) {
    console.error('getPrenotazione: errore interno', {
      userId: req.user?.id,
      prenotazioneId: req.params.id,
      error: err,
    });
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

async function segnalaMancatoRitiro(req, res) {
  try {
    const prenotazione = await Prenotazione.findById(req.params.id);
    if (!prenotazione || prenotazione.stato !== 'ATTIVA') return res.status(404).json({ error: 'Prenotazione attiva non trovata' });
    if (prenotazione.donatore.toString() !== req.user.id) return res.status(403).json({ error: 'Solo il donatore può segnalare il mancato ritiro' });

    // OCL #20: no-show crea segnalazione e applica malus — tutto atomico
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        prenotazione.stato = 'ANNULLATA';
        await prenotazione.save({ session });
        await Annuncio.findByIdAndUpdate(
          prenotazione.annuncio,
          { $set: { stato: 'DISPONIBILE' }, $inc: { versione: 1 } },
          { session }
        );
        await TokenQR.deleteOne({ prenotazione: prenotazione._id }).session(session);
        await Segnalazione.create([{
          segnalante: req.user.id, segnalato: prenotazione.acquirente,
          annuncio: prenotazione.annuncio, tipo: 'altro',
          motivo: 'No-show: acquirente non si è presentato al ritiro',
        }], { session });
        await applicaMalus(prenotazione.acquirente, { session });
        await sottraiPunti(
          prenotazione.acquirente.toString(),
          MALUS_CREDITI_NOSHOW,
          'Malus no-show: mancato ritiro',
          prenotazione._id,
          { session }
        ).catch(() => { /* ignora se saldo insufficiente — malus reputazionale già applicato */ });
      });
    } finally {
      await session.endSession();
    }

    return res.status(200).json({ message: 'Mancato ritiro segnalato con successo' });
  } catch (err) {
    console.error('segnalaMancatoRitiro: errore interno', {
      userId: req.user?.id,
      prenotazioneId: req.params.id,
      error: err,
    });
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

async function disdiciPrenotazione(req, res) {
  try {
    const prenotazione = await Prenotazione.findById(req.params.id).populate('annuncio');
    if (!prenotazione || prenotazione.stato !== 'ATTIVA') return res.status(404).json({ error: 'Prenotazione attiva non trovata' });
    if (prenotazione.donatore.toString() !== req.user.id) return res.status(403).json({ error: 'Non autorizzato' });
    const msAllaScadenza = prenotazione.annuncio.dataScadenza.getTime() - Date.now();
    if (msAllaScadenza < 0 || msAllaScadenza > DISDETTA_TTL_MS) return res.status(409).json({ error: 'Disdetta consentita solo entro 3 giorni dalla data di ritiro (RF20)' });

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        prenotazione.stato = 'ANNULLATA';
        await prenotazione.save({ session });
        await Annuncio.findByIdAndUpdate(
          prenotazione.annuncio._id,
          { $set: { stato: 'DISPONIBILE' }, $inc: { versione: 1 } },
          { session }
        );
        await TokenQR.deleteOne({ prenotazione: prenotazione._id }).session(session);
      });
    } finally {
      await session.endSession();
    }

    const notificheService = require('../services/notificheService');
    notificheService.creaNotifica(
      prenotazione.acquirente,
      'prenotazione',
      'Il donatore ha disdetto il ritiro',
      `/prenotazioni/${prenotazione._id}`
    ).catch((e) => console.error('[notifica] disdiciPrenotazione fallita', e));

    return res.status(200).json({ message: 'Ritiro disdetto' });
  } catch (err) {
    console.error('disdiciPrenotazione: errore interno', {
      userId: req.user?.id,
      prenotazioneId: req.params.id,
      error: err,
    });
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

module.exports = { creaPrenotazione, annullaPrenotazione, getMiePrenotazioni, getPrenotazione, segnalaMancatoRitiro, disdiciPrenotazione };
