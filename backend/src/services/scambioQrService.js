const mongoose = require('mongoose');
const TokenQR = require('../models/tokenQRModel');
const { addPunti } = require('./walletService');

const TIER_A = { donMin: 20, donMax: 200, acqMin: 10, acqMax: 100 };
const TIER_B = { donMin: 15, donMax: 150, acqMin:  6, acqMax:  60 };
const TIER_C = { donMin:  8, donMax:  80, acqMin:  3, acqMax:  30 };

const CATEGORIA_TIER = {
  'Elettronica':          TIER_A,
  'Elettrodomestici':     TIER_A,
  'Arredo e mobili':      TIER_A,
  'Biciclette e mobilita': TIER_A,
  'Ricambi auto e moto':  TIER_A,
  'Utensili e attrezzi':  TIER_A,
  'Cucina e casalinghi':  TIER_B,
  'Sport e tempo libero': TIER_B,
  'Musica e strumenti':   TIER_B,
  'Ferramenta':           TIER_B,
  'Giardino e outdoor':   TIER_B,
  'Edilizia leggera':     TIER_B,
  'Bagno e sanitari':     TIER_B,
  'Illuminazione':        TIER_B,
  'Libri e manuali':      TIER_C,
  'Cancelleria':          TIER_C,
  'Decorazioni':          TIER_C,
  'Giocattoli':           TIER_C,
  'Infanzia':             TIER_C,
  'Materiale scolastico': TIER_C,
  'Tessili e biancheria': TIER_C,
  'Vasi e contenitori':   TIER_C,
  'Altro':                TIER_C,
};

const MAX_FINESTRA_MS = 14 * 24 * 60 * 60 * 1000; // 14 giorni

function calcolaCrediti(categoria, dataScadenza) {
  const tier = CATEGORIA_TIER[categoria] || TIER_C;
  const remaining = Math.max(0, new Date(dataScadenza).getTime() - Date.now());
  const ratio = 1 - Math.min(1, remaining / MAX_FINESTRA_MS);
  return {
    donatore:   Math.round(tier.donMin + (tier.donMax - tier.donMin) * ratio),
    acquirente: Math.round(tier.acqMin + (tier.acqMax - tier.acqMin) * ratio),
  };
}

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

  const creditiDon = prenotazione.creditiDonatore   ?? TIER_C.donMin;
  const creditiAcq = prenotazione.creditiAcquirente ?? TIER_C.acqMin;

  await addPunti(
    prenotazione.donatore.toString(),
    creditiDon,
    'Scambio completato (Donatore)',
    prenotazione._id,
    { session }
  );
  await addPunti(
    prenotazione.acquirente.toString(),
    creditiAcq,
    'Scambio completato (Acquirente)',
    prenotazione._id,
    { session }
  );

  return { donatore: creditiDon, acquirente: creditiAcq };
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
  calcolaCrediti,
  findTokenByCodice,
  findActiveTokenByPrenotazione,
  finalizzaScambio,
  finalizzaScambioAtomico,
};
