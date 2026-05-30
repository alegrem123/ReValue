const User = require('../models/userModel');
const Annuncio = require('../models/annuncioModel');
const Prenotazione = require('../models/prenotazioneModel');
const Segnalazione = require('../models/segnalazioneModel');
const Wallet = require('../models/walletModel');

/**
 * GET /api/admin/statistiche
 * Dashboard con scambi mensili e totale crediti erogati (RF30, UC14).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getStatistiche(req, res) {
  try {
    const inizioMese = new Date();
    inizioMese.setDate(1);
    inizioMese.setHours(0, 0, 0, 0);

    const [scambiMensili, totaleUtenti, segnalazioniPendenti, wallets, storicoMensile] = await Promise.all([
      Prenotazione.countDocuments({ stato: 'COMPLETATA', dataPrenotazione: { $gte: inizioMese } }),
      User.countDocuments({ ruolo: 'user' }),
      Segnalazione.countDocuments(),
      Wallet.aggregate([{ $group: { _id: null, totaleCrediti: { $sum: '$bilancio' } } }]),
      Prenotazione.aggregate([
        { $match: { stato: 'COMPLETATA' } },
        {
          $group: {
            _id: {
              anno: { $year: '$dataPrenotazione' },
              mese: { $month: '$dataPrenotazione' },
            },
            totale: { $sum: 1 },
          },
        },
        { $sort: { '_id.anno': 1, '_id.mese': 1 } },
        { $limit: 12 },
      ]),
    ]);

    const totaleCrediti = wallets[0]?.totaleCrediti ?? 0;

    return res.status(200).json({
      scambiMensili,
      totaleUtenti,
      segnalazioniPendenti,
      totaleCrediti,
      storicoMensile: storicoMensile.map((item) => ({
        anno: item._id.anno,
        mese: item._id.mese,
        totale: item.totale,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/admin/users
 * Lista utenti paginata con search per nome/email (RF29).
 */
async function listUsers(req, res) {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = { ruolo: 'user' };
    const normalizedSearch = String(search).trim();
    if (normalizedSearch) {
      const pattern = new RegExp(normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { email: pattern },
        { nome: pattern },
        { cognome: pattern },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('idUtente nome cognome email malusCount isSospeso bannato ruolo createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query),
    ]);

    return res.status(200).json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/admin/segnalazioni
 * Lista tutte le segnalazioni ricevute (UC13).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getSegnalazioni(req, res) {
  try {
    const segnalazioni = await Segnalazione.find()
      .sort({ data: -1 })
      .populate('segnalante', 'nome cognome email')
      .populate('segnalato', 'nome cognome email')
      .populate('annuncio', 'titolo stato');

    return res.status(200).json(segnalazioni);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/admin/utenti/:id/ban
 * Banna permanentemente un account fraudolento (RF29, D2 §2.2.2).
 * L'utente bannato non può più accedere (isSospeso = true + ruolo marcato).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function bannaUtente(req, res) {
  try {
    const utente = await User.findById(req.params.id);
    if (!utente) return res.status(404).json({ error: 'Utente non trovato' });

    // admin non può bannare altri admin
    if (utente.ruolo === 'admin') {
      return res.status(403).json({ error: 'Non puoi bannare un amministratore' });
    }

    utente.isSospeso = true;
    utente.bannato = true;
    await utente.save();

    return res.status(200).json({ message: `Utente ${utente.email} bannato` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/admin/utenti/:id/sospendi
 * Sospende temporaneamente un account (RF29, D2 §2.2.2).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function sospendiUtente(req, res) {
  try {
    const utente = await User.findById(req.params.id);
    if (!utente) return res.status(404).json({ error: 'Utente non trovato' });

    if (utente.ruolo === 'admin') {
      return res.status(403).json({ error: 'Non puoi sospendere un amministratore' });
    }

    utente.isSospeso = true;
    await utente.save();

    return res.status(200).json({ message: `Utente ${utente.email} sospeso` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/admin/utenti/:id/riabilita
 * Riabilita un account sospeso o bannato.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function riabilitaUtente(req, res) {
  try {
    const utente = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { isSospeso: false } }, // non resetta bannato — ban è permanente
      { new: true }
    );
    if (!utente) return res.status(404).json({ error: 'Utente non trovato' });

    return res.status(200).json({ message: `Utente ${utente.email} riabilitato` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * PATCH /api/admin/annunci/:id/forza
 * Forza lo stato di un annuncio bloccato riportandolo a DISPONIBILE (RF31, D2 §2.2.2).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function forzaStatoAnnuncio(req, res) {
  try {
    const annuncio = await Annuncio.findByIdAndUpdate(
      req.params.id,
      { $set: { stato: 'DISPONIBILE', isAttivo: true }, $inc: { versione: 1 } },
      { new: true }
    );

    if (!annuncio) return res.status(404).json({ error: 'Annuncio non trovato' });

    return res.status(200).json({ message: 'Annuncio ripristinato a DISPONIBILE', annuncio });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/admin/annunci/:id
 * Rimuove (soft-delete) un annuncio non conforme (UC13).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function rimuoviAnnuncio(req, res) {
  try {
    const annuncio = await Annuncio.findByIdAndUpdate(
      req.params.id,
      { $set: { isAttivo: false } },
      { new: true }
    );

    if (!annuncio) return res.status(404).json({ error: 'Annuncio non trovato' });

    return res.status(200).json({ message: 'Annuncio rimosso' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getStatistiche,
  listUsers,
  getSegnalazioni,
  bannaUtente,
  sospendiUtente,
  riabilitaUtente,
  forzaStatoAnnuncio,
  rimuoviAnnuncio,
};
