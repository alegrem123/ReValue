const mongoose = require('mongoose');
const TokenQR = require('../models/tokenQRModel');
const { addPunti } = require('./walletService');

const CREDITI_SCAMBIO = 50;

function createScambioError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function findTokenByCodice(codice) {
  return TokenQR.findOne({ codice }).populate({
    path: 'prenotazione',
    populate: { path: 'annuncio' },
  });
}

async function findActiveTokenByPrenotazione(prenotazioneId) {
  return TokenQR.findOne({ prenotazione: prenotazioneId, usato: false });
}

async function finalizzaScambio({ token, prenotazione, session = null }) {
  const dataCompletamento = new Date();
  prenotazione.stato = 'COMPLETATA';
  prenotazione.dataCompletamento = dataCompletamento;
  await prenotazione.save({ session });

  const annuncio = prenotazione.annuncio;
  annuncio.stato = 'RITIRATO';
  annuncio.isAttivo = false;
  await annuncio.save({ session });

  token.usato = true;
  await token.save({ session });

  await addPunti(
    prenotazione.donatore.toString(),
    CREDITI_SCAMBIO,
    'Scambio completato (Donatore)',
    prenotazione._id,
    { session }
  );
  await addPunti(
    prenotazione.acquirente.toString(),
    CREDITI_SCAMBIO,
    'Scambio completato (Acquirente)',
    prenotazione._id,
    { session }
  );

  return CREDITI_SCAMBIO;
}

async function finalizzaScambioAtomico({ tokenId }) {
  const session = await mongoose.startSession();
  let creditiAssegnati = 0;

  try {
    await session.withTransaction(async () => {
      const token = await TokenQR.findById(tokenId).session(session).populate({
        path: 'prenotazione',
        populate: { path: 'annuncio' },
      });

      if (!token) {
        throw createScambioError(404, 'Codice QR non valido, già scaduto o non esistente');
      }
      if (token.usato) {
        throw createScambioError(409, 'Codice QR già utilizzato');
      }
      if (token.scadenza < new Date()) {
        throw createScambioError(410, 'Codice QR scaduto');
      }

      const prenotazione = token.prenotazione;
      if (!prenotazione) {
        throw createScambioError(404, 'Prenotazione non trovata');
      }
      if (prenotazione.stato === 'ANNULLATA') {
        throw createScambioError(409, 'Prenotazione annullata: lo scambio non può essere validato');
      }
      if (prenotazione.stato === 'COMPLETATA') {
        throw createScambioError(409, 'Scambio già completato: questo QR è stato utilizzato');
      }
      if (prenotazione.stato !== 'ATTIVA') {
        throw createScambioError(409, 'Prenotazione non più attiva');
      }

      creditiAssegnati = await finalizzaScambio({ token, prenotazione, session });
    });

    return creditiAssegnati;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  CREDITI_SCAMBIO,
  findTokenByCodice,
  findActiveTokenByPrenotazione,
  finalizzaScambio,
  finalizzaScambioAtomico,
};
