const User = require('../models/userModel');
const { applicaMalus } = require('../services/userService');
const Annuncio = require('../models/annuncioModel');
const Prenotazione = require('../models/prenotazioneModel');
const Segnalazione = require('../models/segnalazioneModel');
const Wallet = require('../models/walletModel');

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
      Segnalazione.countDocuments(),
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
    return res.status(500).json({ error: err.message });
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
    return res.status(500).json({ error: err.message });
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

    await applicaMalus(utente._id).catch((err) => console.error('applicaMalus failed:', err));

    return res.status(200).json({ message: `Utente ${utente.email} bannato` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
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

    await applicaMalus(utente._id, 'sospensione amministrativa').catch(() => {});

    return res.status(200).json({ message: `Utente ${utente.email} sospeso` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
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
    return res.status(500).json({ error: err.message });
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

    return res.status(200).json({ message: 'Annuncio rimosso' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getStatistiche,
  getSegnalazioni,
  bannaUtente,
  sospendiUtente,
  riabilitaUtente,
  forzaStatoAnnuncio,
  rimuoviAnnuncio,
};
