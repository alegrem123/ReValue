/**
 * walletService.js
 * Logica di business per il modulo Wallet.
 */

const db = require('../db');
const { getCollection, buildWalletDoc } = require('../models/walletModel');

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

module.exports = {
  creaWallet,
};
