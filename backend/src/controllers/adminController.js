const mongoose = require('mongoose');
const User = require('../models/userModel');
const { applicaMalus } = require('../services/userService');
const Annuncio = require('../models/annuncioModel');
const Prenotazione = require('../models/prenotazioneModel');
const Segnalazione = require('../models/segnalazioneModel');
const Wallet = require('../models/walletModel');
const TokenQR = require('../models/tokenQRModel');

/**
 * GET /api/v1/admin/statistiche
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

    const [scambiMensili, totaleUtenti, segnalazioniPendenti, wallets, creditiErogati] = await Promise.all([
      Prenotazione.countDocuments({ stato: 'COMPLETATA', dataCompletamento: { $gte: inizioMese } }),
      User.countDocuments({ ruolo: 'user' }),
      Segnalazione.countDocuments({ stato: 'IN_ATTESA' }),
      Wallet.aggregate([{ $group: { _id: null, liquiditaAttuale: { $sum: '$bilancio' } } }]),
      Wallet.aggregate([
        { $unwind: '$transazioni' },
        {
          $match: {
            'transazioni.tipo': 'accredito',
            'transazioni.motivo': { $regex: /^Scambio completato/ },
          },
        },
        {
          $group: {
            _id: null,
            creditiErogatiTotali: { $sum: '$transazioni.ammontare' },
            creditiErogatiMese: {
              $sum: {
                $cond: [{ $gte: ['$transazioni.data', inizioMese] }, '$transazioni.ammontare', 0],
              },
            },
          },
        },
      ]),
    ]);

    const liquiditaAttuale = wallets[0]?.liquiditaAttuale ?? 0;
    const creditiErogatiTotali = creditiErogati[0]?.creditiErogatiTotali ?? 0;
    const creditiErogatiMese = creditiErogati[0]?.creditiErogatiMese ?? 0;

    return res.status(200).json({
      scambiMensili,
      totaleUtenti,
      segnalazioniPendenti,
      liquiditaAttuale,
      creditiErogatiTotali,
      creditiErogatiMese,
      totaleCrediti: liquiditaAttuale,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * GET /api/v1/admin/segnalazioni
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
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * GET /api/v1/admin/utenti
 * Lista utenti per dashboard amministrativa (RF29, UC13).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getUtenti(req, res) {
  try {
    const { q = '', page = 1, limit = 25 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 25));
    const filtro = {};

    if (q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      filtro.$or = [
        { nome: regex },
        { cognome: regex },
        { email: regex },
        { idUtente: regex },
      ];
    }

    const [utenti, totale] = await Promise.all([
      User.find(filtro)
        .select('idUtente nome cognome email ruolo isSospeso bannato malusCount createdAt')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filtro),
    ]);

    return res.status(200).json({
      utenti,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totale,
        pages: Math.ceil(totale / limitNum),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * GET /api/v1/admin/annunci
 * Lista annunci per moderazione amministrativa (RF31, UC13).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getAnnunciAdmin(req, res) {
  try {
    const { q = '', stato, page = 1, limit = 25 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 25));
    const filtro = {};

    if (stato) filtro.stato = stato;
    if (q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      filtro.$or = [
        { titolo: regex },
        { 'oggetto.categoria': regex },
        { 'oggetto.descrizione': regex },
      ];
    }

    const [annunci, totale] = await Promise.all([
      Annuncio.find(filtro)
        .populate('donatore', 'nome cognome email')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Annuncio.countDocuments(filtro),
    ]);

    return res.status(200).json({
      annunci,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totale,
        pages: Math.ceil(totale / limitNum),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * POST /api/v1/admin/segnalazioni/:id/malus
 * Applica malus al segnalato e marca la segnalazione come risolta (OCL #20).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function applicaMalusSegnalazione(req, res) {
  try {
    const segnalazione = await Segnalazione.findById(req.params.id);
    if (!segnalazione) {
      return res.status(404).json({ error: 'Segnalazione non trovata' });
    }

    const utente = await applicaMalus(segnalazione.segnalato);
    segnalazione.stato = 'RISOLTA';
    await segnalazione.save();

    return res.status(200).json({
      message: 'Malus applicato e segnalazione risolta',
      segnalazione,
      utente,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * POST /api/v1/admin/utenti/:id/ban
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

    await applicaMalus(utente._id);

    return res.status(200).json({ message: `Utente ${utente.email} bannato` });
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * POST /api/v1/admin/utenti/:id/sospendi
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

    await applicaMalus(utente._id, 'sospensione amministrativa');

    return res.status(200).json({ message: `Utente ${utente.email} sospeso` });
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * POST /api/v1/admin/utenti/:id/riabilita
 * Riabilita un account sospeso, ma non un account bannato.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function riabilitaUtente(req, res) {
  try {
    const utente = await User.findById(req.params.id);
    if (!utente) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    if (utente.bannato) {
      return res.status(403).json({ error: 'Account bannato non riabilitabile' });
    }

    if (!utente.isSospeso) {
      return res.status(400).json({ error: 'Account non sospeso' });
    }

    utente.isSospeso = false;
    await utente.save();

    return res.status(200).json({ message: `Utente ${utente.email} riabilitato` });
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * PATCH /api/v1/admin/annunci/:id/forza
 * Forza lo stato di un annuncio bloccato riportandolo a DISPONIBILE (RF31, D2 §2.2.2).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function forzaStatoAnnuncio(req, res) {
  try {
    const statoTarget = req.body?.stato || 'DISPONIBILE';
    if (!['DISPONIBILE', 'PRENOTATO', 'CEDUTO', 'SCADUTO'].includes(statoTarget)) {
      return res.status(400).json({ error: 'Stato non valido' });
    }

    const annuncio = await Annuncio.findById(req.params.id);
    if (!annuncio) return res.status(404).json({ error: 'Annuncio non trovato' });

    // Idempotency guard: skip transaction if already in target state
    if (annuncio.stato === statoTarget && annuncio.isAttivo) {
      return res.status(200).json({ message: `Annuncio già in stato ${statoTarget}`, annuncio });
    }

    const session = await mongoose.startSession();
    let updated;
    try {
      await session.withTransaction(async () => {
        // If admin resets to available, cancel active bookings and QR tokens.
        if (statoTarget === 'DISPONIBILE') {
          const prenotazioniAttive = await Prenotazione.find(
            { annuncio: req.params.id, stato: 'ATTIVA' },
            '_id',
            { session }
          );
          const ids = prenotazioniAttive.map((p) => p._id);
          if (ids.length > 0) {
            await Prenotazione.updateMany(
              { _id: { $in: ids } },
              { $set: { stato: 'ANNULLATA' } },
              { session }
            );
            await TokenQR.deleteMany({ prenotazione: { $in: ids } }).session(session);
          }
        }
        updated = await Annuncio.findByIdAndUpdate(
          req.params.id,
          { $set: { stato: statoTarget, isAttivo: true }, $inc: { versione: 1 } },
          { new: true, session }
        );
      });
    } finally {
      await session.endSession();
    }

    return res.status(200).json({ message: `Annuncio aggiornato a ${statoTarget}`, annuncio: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * DELETE /api/v1/admin/annunci/:id
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

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

module.exports = {
  getStatistiche,
  getSegnalazioni,
  getUtenti,
  getAnnunciAdmin,
  applicaMalusSegnalazione,
  bannaUtente,
  sospendiUtente,
  riabilitaUtente,
  forzaStatoAnnuncio,
  rimuoviAnnuncio,
};
