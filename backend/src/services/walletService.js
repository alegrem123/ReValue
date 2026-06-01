const Wallet = require('../models/walletModel');

async function creaWallet(idUtente) {
  const wallet = new Wallet({ idUtente });
  return wallet.save();
}

// OCL #16: ammontare > 0
async function addPunti(idUtente, ammontare, motivo, riferimento = null, options = {}) {
  if (!ammontare || ammontare <= 0) throw new Error('ammontare deve essere > 0');
  const { session = null } = options;

  const transazione = { tipo: 'accredito', ammontare, motivo, ...(riferimento && { riferimento }) };

  const wallet = await Wallet.findOneAndUpdate(
    { idUtente },
    { $inc: { bilancio: ammontare }, $push: { transazioni: transazione } },
    { new: true, session }
  );

  if (!wallet) throw new Error('Wallet non trovato');
  return wallet;
}

// OCL #17: ammontare > 0, bilancio >= ammontare
async function sottraiPunti(idUtente, ammontare, motivo, riferimento = null, options = {}) {
  if (!ammontare || ammontare <= 0) throw new Error('ammontare deve essere > 0');
  const { session = null } = options;

  const transazione = { tipo: 'sottrazione', ammontare, motivo, ...(riferimento && { riferimento }) };

  // query con bilancio >= ammontare: atomic, previene saldo negativo senza findOne separato
  const wallet = await Wallet.findOneAndUpdate(
    { idUtente, bilancio: { $gte: ammontare } },
    { $inc: { bilancio: -ammontare }, $push: { transazioni: transazione } },
    { new: true, session }
  );

  if (!wallet) throw new Error('Saldo insufficiente o wallet non trovato');
  return wallet;
}

async function getSaldo(idUtente) {
  const wallet = await Wallet.findOne({ idUtente }, 'bilancio');
  if (!wallet) throw new Error('Wallet non trovato');
  return wallet.bilancio;
}

async function getStorico(idUtente) {
  const wallet = await Wallet.findOne({ idUtente }, 'transazioni');
  if (!wallet) throw new Error('Wallet non trovato');
  return wallet.transazioni;
}

module.exports = { creaWallet, addPunti, sottraiPunti, getSaldo, getStorico };
