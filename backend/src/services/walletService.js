/**
 * walletService.js
 * Logica di business per il modulo Wallet.
 */

const db = require('../db');
const { getCollection, buildWalletDoc, buildTransazioneDoc } = require('../models/walletModel');
const { ObjectId } = require('mongojs');

/**
 * Crea un wallet vuoto per un nuovo utente.
 * Viene chiamata da authController dopo la registrazione.
 * @param {string|ObjectId} idUtente
 * @returns {Promise<Object>} il documento wallet inserito
 */
async function creaWallet(idUtente) {
  const wallets = getCollection(db);
  const doc = buildWalletDoc(idUtente);

  return new Promise((resolve, reject) => {
    wallets.insert(doc, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

/**
 * Aggiunge punti al wallet di un utente.
 * OCL #16: ammontare deve essere > 0
 * @param {string|ObjectId} idUtente
 * @param {Number} ammontare  - deve essere > 0
 * @param {String} motivo     - descrizione dell'accredito
 * @param {ObjectId} riferimento - opzionale, FK a prenotazione/riscatto
 * @returns {Promise<Object>} wallet aggiornato
 */
async function addPunti(idUtente, ammontare, motivo, riferimento = null) {
  // OCL #16: ammontare > 0
  if (!ammontare || ammontare <= 0) {
    throw new Error('ammontare deve essere > 0');
  }

  const wallets = getCollection(db);
  const idUtenteObj = typeof idUtente === 'string' ? new ObjectId(idUtente) : idUtente;
  const transazione = buildTransazioneDoc('accredito', ammontare, motivo, riferimento);

  return new Promise((resolve, reject) => {
    wallets.findAndModify(
      {
        query: { idUtente: idUtenteObj },
        update: {
          $inc: { bilancio: ammontare },
          $push: { transazioni: transazione },
        },
        new: true,
      },
      (err, result) => {
        if (err) return reject(err);
        if (!result) return reject(new Error('Wallet non trovato'));
        resolve(result);
      }
    );
  });
}

/**
 * Sottrae punti dal wallet di un utente.
 * OCL: ammontare > 0 e bilancio >= ammontare (mai negativo)
 * @param {string|ObjectId} idUtente
 * @param {Number} ammontare  - deve essere > 0
 * @param {String} motivo     - descrizione della sottrazione
 * @param {ObjectId} riferimento - opzionale, FK a riscatto/segnalazione
 * @returns {Promise<Object>} wallet aggiornato
 */
async function sottraiPunti(idUtente, ammontare, motivo, riferimento = null) {
  // OCL: ammontare > 0
  if (!ammontare || ammontare <= 0) {
    throw new Error('ammontare deve essere > 0');
  }

  const wallets = getCollection(db);
  const idUtenteObj = typeof idUtente === 'string' ? new ObjectId(idUtente) : idUtente;

  // OCL: controlla saldo sufficiente prima di sottrarre
  const wallet = await new Promise((resolve, reject) => {
    wallets.findOne({ idUtente: idUtenteObj }, (err, result) => {
      if (err) return reject(err);
      if (!result) return reject(new Error('Wallet non trovato'));
      resolve(result);
    });
  });

  // OCL: bilancio non può andare sotto zero
  if (wallet.bilancio < ammontare) {
    throw new Error('Saldo insufficiente');
  }

  const transazione = buildTransazioneDoc('sottrazione', ammontare, motivo, riferimento);

  return new Promise((resolve, reject) => {
    wallets.findAndModify(
      {
        // doppia sicurezza: la query fallisce se nel frattempo il saldo è cambiato
        query: { idUtente: idUtenteObj, bilancio: { $gte: ammontare } },
        update: {
          $inc: { bilancio: -ammontare },
          $push: { transazioni: transazione },
        },
        new: true,
      },
      (err, result) => {
        if (err) return reject(err);
        if (!result) return reject(new Error('Saldo insufficiente'));
        resolve(result);
      }
    );
  });
}

module.exports = {
  creaWallet,
  addPunti,
  sottraiPunti,
};
