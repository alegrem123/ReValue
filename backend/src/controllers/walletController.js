const { getSaldo, getStorico } = require('../services/walletService');

/**
 * GET /api/wallet/saldo
 * Restituisce il saldo aggiornato del wallet dell'utente autenticato (RF5, UC10).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function saldo(req, res) {
  try {
    const bilancio = await getSaldo(req.user.id);
    return res.status(200).json({ bilancio });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/wallet/storico
 * Restituisce lo storico delle transazioni dell'utente autenticato (RF6, UC11).
 * Ordinate per data decrescente (più recenti prima).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function storico(req, res) {
  try {
    const transazioni = await getStorico(req.user.id);
    const ordinate = [...transazioni].sort((a, b) => b.data - a.data);
    return res.status(200).json(ordinate);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { saldo, storico };
