const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const Coupon = require('../models/couponModel');
const Riscatto = require('../models/riscattoModel');
const walletService = require('../services/walletService');

/**
 * GET /api/v1/premi
 * Lista paginata coupon attivi. Filtro ?costoMax=N, ordine costoCrediti ASC.
 * UC7
 */
async function getPremi(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = { attivo: true };
    if (req.query.costoMax) {
      const costoMax = parseInt(req.query.costoMax);
      if (!isNaN(costoMax)) filter.costoCrediti = { $lte: costoMax };
    }

    const [coupon, totale] = await Promise.all([
      Coupon.find(filter).sort({ costoCrediti: 1 }).skip(skip).limit(limit),
      Coupon.countDocuments(filter),
    ]);

    return res.status(200).json({ coupon, totale, page, limit });
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * POST /api/v1/premi/:id/riscatta
 * Riscatta coupon: verifica saldo (OCL #17), decrementa stock finito, crea Riscatto con UUID.
 * UC7, OCL #17
 */
async function riscattaCoupon(req, res) {
  // Pre-check: existence and availability (outside transaction for clear error codes)
  const existing = await Coupon.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Coupon non trovato' });
  if (!existing.attivo) return res.status(409).json({ error: 'Coupon non disponibile' });

  const session = await mongoose.startSession();
  try {
    let riscatto;
    await session.withTransaction(async () => {
      const coupon = await Coupon.findOneAndUpdate(
        {
          _id: req.params.id,
          attivo: true,
          stock: { $gte: 0 },
        },
        [
          {
            $set: {
              stock: {
                $cond: [
                  { $gt: ['$stock', 0] },
                  { $subtract: ['$stock', 1] },
                  '$stock',
                ],
              },
            },
          },
        ],
        { new: true, session }
      );

      if (!coupon) {
        const err = new Error('Stock esaurito');
        err.statusCode = 409;
        throw err;
      }

      try {
        await walletService.sottraiPunti(
          req.user.id,
          coupon.costoCrediti,
          `Riscatto coupon: ${coupon.titolo}`,
          coupon._id,
          { session }
        );
      } catch (walletErr) {
        const err = new Error('Saldo insufficiente (OCL #17)');
        err.statusCode = 409;
        throw err;
      }

      [riscatto] = await Riscatto.create(
        [{ utente: req.user.id, coupon: coupon._id, codiceUnivoco: randomUUID() }],
        { session }
      );
    });

    return res.status(201).json({ riscatto, codiceUnivoco: riscatto.codiceUnivoco });
  } catch (err) {
    const status = err.statusCode || 500;
    const message = status < 500 ? err.message : 'Errore interno del server';
    return res.status(status).json({ error: message });
  } finally {
    await session.endSession();
  }
}

/**
 * GET /api/v1/premi/miei
 * Lista riscatti dell'utente autenticato, populate coupon.
 * UC7
 */
async function getMieiRiscatti(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [riscatti, totale] = await Promise.all([
      Riscatto.find({ utente: req.user.id })
        .populate('coupon')
        .sort({ dataRiscatto: -1 })
        .skip(skip)
        .limit(limit),
      Riscatto.countDocuments({ utente: req.user.id }),
    ]);

    return res.status(200).json({ riscatti, totale, page, limit });
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * PATCH /api/v1/premi/riscatti/:id/usato
 * Marca riscatto come usato. Solo owner del riscatto.
 * UC7
 */
async function marcaUsato(req, res) {
  try {
    const riscatto = await Riscatto.findById(req.params.id);
    if (!riscatto) return res.status(404).json({ error: 'Riscatto non trovato' });
    if (riscatto.utente.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }
    if (riscatto.usato) {
      return res.status(409).json({ error: 'Riscatto già segnato come usato' });
    }

    riscatto.usato = true;
    await riscatto.save();

    return res.status(200).json({ riscatto });
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

module.exports = { getPremi, riscattaCoupon, getMieiRiscatti, marcaUsato };
