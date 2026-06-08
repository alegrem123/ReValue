const mongoose = require('mongoose');
const Annuncio = require('../models/annuncioModel');
const Prenotazione = require('../models/prenotazioneModel');
const TokenQR = require('../models/tokenQRModel');
const Conversazione = require('../models/conversazioneModel');
const Segnalazione = require('../models/segnalazioneModel');
const { applicaMalus } = require('./userService');
const { calcolaCrediti } = require('./scambioQrService');
const { sottraiPunti } = require('./walletService');

const MALUS_CREDITI_NOSHOW = 25;
const DISDETTA_TTL_MS = 3 * 24 * 60 * 60 * 1000;

function domainError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function creaPrenotazione({ annuncioId, userId, userRole }) {
  if (userRole === 'admin') {
    throw domainError(403, 'Gli amministratori non possono prenotare annunci');
  }

  if (!annuncioId) {
    throw domainError(400, 'annuncioId is required');
  }

  const annuncio = await Annuncio.findById(annuncioId);
  if (!annuncio || !annuncio.isAttivo) {
    throw domainError(404, 'Annuncio non trovato');
  }

  // OCL #4: il donatore non può prenotare il proprio annuncio
  if (annuncio.donatore.toString() === userId) {
    throw domainError(409, 'Non puoi prenotare il tuo stesso annuncio');
  }

  // OCL #6: prenotazione solo su annuncio DISPONIBILE e non scaduto
  if (annuncio.stato === 'PRENOTATO') {
    throw domainError(409, 'Oggetto già prenotato');
  }

  if (annuncio.stato !== 'DISPONIBILE' || annuncio.dataScadenza <= new Date()) {
    throw domainError(409, 'Oggetto non più disponibile');
  }

  const session = await mongoose.startSession();
  let prenotazione;
  let lockedAnnuncio;

  try {
    await session.withTransaction(async () => {
      // OCL #7/#9: optimistic lock su versione e una sola prenotazione attiva
      lockedAnnuncio = await Annuncio.findOneAndUpdate(
        { _id: annuncio._id, stato: 'DISPONIBILE', versione: annuncio.versione },
        { $set: { stato: 'PRENOTATO' }, $inc: { versione: 1 } },
        { new: true, session }
      );

      if (!lockedAnnuncio) {
        throw domainError(409, 'Oggetto appena prenotato da un altro utente');
      }

      const crediti = calcolaCrediti(annuncio.oggetto?.categoria, annuncio.dataScadenza);
      [prenotazione] = await Prenotazione.create(
        [{
          annuncio: annuncio._id,
          acquirente: userId,
          donatore: annuncio.donatore,
          creditiDonatore: crediti.donatore,
          creditiAcquirente: crediti.acquirente,
        }],
        { session }
      );

      const pairKey = [annuncio.donatore, userId].map(String).sort().join('_');
      await Conversazione.findOneAndUpdate(
        { pairKey },
        {
          $setOnInsert: {
            prenotazione: prenotazione._id,
            partecipanti: [annuncio.donatore, userId],
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

  return {
    prenotazione,
    indirizzo: {
      latitudine: lockedAnnuncio.latitudine,
      longitudine: lockedAnnuncio.longitudine,
    },
  };
}

async function annullaPrenotazione({ prenotazioneId, userId }) {
  const prenotazione = await Prenotazione.findById(prenotazioneId);
  if (!prenotazione || prenotazione.stato !== 'ATTIVA') {
    throw domainError(404, 'Prenotazione attiva non trovata');
  }

  if (prenotazione.acquirente.toString() !== userId) {
    throw domainError(403, 'Non autorizzato');
  }

  // OCL #10: annullamento acquirente solo entro 15 minuti
  const minuti = (Date.now() - prenotazione.dataPrenotazione.getTime()) / 60000;
  if (minuti > 15) {
    throw domainError(409, 'Finestra di annullamento (15 min) scaduta');
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // OCL #11: prenotazione ANNULLATA e annuncio nuovamente DISPONIBILE
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

  return prenotazione;
}

async function getMiePrenotazioni({ userId, stato }) {
  const filtro = { $or: [{ acquirente: userId }, { donatore: userId }] };
  if (stato && ['ATTIVA', 'ANNULLATA', 'COMPLETATA'].includes(stato)) {
    filtro.stato = stato;
  }

  return Prenotazione.find(filtro)
    .populate('annuncio', 'titolo oggetto stato')
    .populate('donatore', 'nome cognome')
    .populate('acquirente', 'nome cognome')
    .sort({ dataPrenotazione: -1 });
}

async function getPrenotazione({ prenotazioneId, userId }) {
  const prenotazione = await Prenotazione.findById(prenotazioneId)
    .populate('annuncio')
    .populate('donatore', 'nome cognome email')
    .populate('acquirente', 'nome cognome email');

  if (!prenotazione) {
    throw domainError(404, 'Prenotazione non trovata');
  }

  const isAcquirente = prenotazione.acquirente._id.toString() === userId;
  const isDonatore = prenotazione.donatore._id.toString() === userId;
  if (!isAcquirente && !isDonatore) {
    throw domainError(403, 'Non autorizzato');
  }

  return prenotazione;
}

async function segnalaMancatoRitiro({ prenotazioneId, userId }) {
  const prenotazione = await Prenotazione.findById(prenotazioneId);
  if (!prenotazione || prenotazione.stato !== 'ATTIVA') {
    throw domainError(404, 'Prenotazione attiva non trovata');
  }

  if (prenotazione.donatore.toString() !== userId) {
    throw domainError(403, 'Solo il donatore può segnalare il mancato ritiro');
  }

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
        segnalante: userId,
        segnalato: prenotazione.acquirente,
        annuncio: prenotazione.annuncio,
        tipo: 'altro',
        motivo: 'No-show: acquirente non si è presentato al ritiro',
      }], { session });

      // OCL #20: no-show applica malus reputazionale; al terzo malus sospende.
      await applicaMalus(prenotazione.acquirente, { session });
      await sottraiPunti(
        prenotazione.acquirente.toString(),
        MALUS_CREDITI_NOSHOW,
        'Malus no-show: mancato ritiro',
        prenotazione._id,
        { session }
      ).catch(() => { /* saldo insufficiente: resta il malus reputazionale */ });
    });
  } finally {
    await session.endSession();
  }

  return prenotazione;
}

async function disdiciPrenotazione({ prenotazioneId, userId }) {
  const prenotazione = await Prenotazione.findById(prenotazioneId).populate('annuncio');
  if (!prenotazione || prenotazione.stato !== 'ATTIVA') {
    throw domainError(404, 'Prenotazione attiva non trovata');
  }

  if (prenotazione.donatore.toString() !== userId) {
    throw domainError(403, 'Non autorizzato');
  }

  const msAllaScadenza = prenotazione.annuncio.dataScadenza.getTime() - Date.now();
  if (msAllaScadenza < 0 || msAllaScadenza > DISDETTA_TTL_MS) {
    throw domainError(409, 'Disdetta consentita solo entro 3 giorni dalla data di ritiro (RF20)');
  }

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

  return prenotazione;
}

module.exports = {
  creaPrenotazione,
  annullaPrenotazione,
  getMiePrenotazioni,
  getPrenotazione,
  segnalaMancatoRitiro,
  disdiciPrenotazione,
};
