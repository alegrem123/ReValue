const { randomUUID } = require('crypto');
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
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/v1/premi/:id/riscatta
 * Riscatta coupon: verifica saldo (OCL #17), decrementa stock, crea Riscatto con UUID.
 * UC7, OCL #17
 */
async function riscattaCoupon(req, res) {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ error: 'Coupon non trovato' });
    if (!coupon.attivo) return res.status(409).json({ error: 'Coupon non disponibile' });

    // OCL #17 — verifica saldo prima di procedere
    const saldo = await walletService.getSaldo(req.user.id);
    if (saldo < coupon.costoCrediti) {
      return res.status(409).json({ error: 'Saldo insufficiente (OCL #17)' });
    }

    // Decrementa stock atomicamente se limitato (stock > 0)
    if (coupon.stock > 0) {
      const updated = await Coupon.findOneAndUpdate(
        { _id: coupon._id, stock: { $gt: 0 } },
        { $inc: { stock: -1 } },
        { new: true }
      );
      if (!updated) {
        return res.status(409).json({ error: 'Stock esaurito' });
      }
    }

    try {
      await walletService.sottraiPunti(
        req.user.id,
        coupon.costoCrediti,
        `Riscatto coupon: ${coupon.titolo}`,
        coupon._id
      );
    } catch (walletErr) {
      // Rollback stock se sottrazione fallisce
      if (coupon.stock > 0) {
        await Coupon.findByIdAndUpdate(coupon._id, { $inc: { stock: 1 } });
      }
      return res.status(409).json({ error: walletErr.message });
    }

    const riscatto = await Riscatto.create({
      utente: req.user.id,
      coupon: coupon._id,
      codiceUnivoco: randomUUID(),
    });

    return res.status(201).json({ riscatto, codiceUnivoco: riscatto.codiceUnivoco });
  } catch (err) {
    return res.status(500).json({ error: err.message });
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
    return res.status(500).json({ error: err.message });
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
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getPremi, riscattaCoupon, getMieiRiscatti, marcaUsato };
