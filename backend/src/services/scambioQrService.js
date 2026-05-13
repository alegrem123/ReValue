const TokenQR = require('../models/tokenQRModel');
const { addPunti } = require('./walletService');

const CREDITI_SCAMBIO = 50;

async function findTokenByCodice(codice) {
  return TokenQR.findOne({ codice }).populate({
    path: 'prenotazione',
    populate: { path: 'annuncio' },
  });
}

async function findActiveTokenByPrenotazione(prenotazioneId) {
  return TokenQR.findOne({ prenotazione: prenotazioneId, usato: false });
}

async function finalizzaScambio({ token, prenotazione }) {
  prenotazione.stato = 'COMPLETATA';
  await prenotazione.save();

  const annuncio = prenotazione.annuncio;
  annuncio.stato = 'RITIRATO';
  annuncio.isAttivo = false;
  await annuncio.save();

  token.usato = true;
  await token.save();

  await addPunti(
    prenotazione.donatore.toString(),
    CREDITI_SCAMBIO,
    'Scambio completato (Donatore)',
    prenotazione._id
  );
  await addPunti(
    prenotazione.acquirente.toString(),
    CREDITI_SCAMBIO,
    'Scambio completato (Acquirente)',
    prenotazione._id
  );

  return CREDITI_SCAMBIO;
}

module.exports = {
  CREDITI_SCAMBIO,
  findTokenByCodice,
  findActiveTokenByPrenotazione,
  finalizzaScambio,
};
