const mongoose = require('mongoose');
const Recensione = require('../models/recensioneModel');
const Prenotazione = require('../models/prenotazioneModel');
const notificheService = require('../services/notificheService');

/**
 * POST /api/v1/recensioni
 * Crea una recensione dopo uno scambio completato (RF21, RF28).
 * OCL #21: solo su prenotazione COMPLETATA, una sola per utente per prenotazione.
 * Il recensore deve essere un partecipante (donatore o acquirente).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function createRecensione(req, res, next) {
  try {
    const { prenotazioneId, positiva, testo } = req.body;

    if (!prenotazioneId || typeof positiva !== 'boolean') {
      return res
        .status(400)
        .json({ error: 'prenotazioneId e positiva (boolean) sono obbligatori' });
    }

    const prenotazione = await Prenotazione.findById(prenotazioneId);

    if (!prenotazione) {
      return res.status(404).json({ error: 'Prenotazione non trovata' });
    }

    // OCL #21: la recensione è consentita solo su prenotazione COMPLETATA
    if (prenotazione.stato !== 'COMPLETATA') {
      return res
        .status(409)
        .json({ error: 'Puoi recensire solo uno scambio completato' });
    }

    const userId = req.user.id;
    const isDonatore = prenotazione.donatore.toString() === userId;
    const isAcquirente = prenotazione.acquirente.toString() === userId;

    // Solo i partecipanti possono lasciare una recensione
    if (!isDonatore && !isAcquirente) {
      return res
        .status(403)
        .json({ error: 'Solo i partecipanti dello scambio possono recensire' });
    }

    // Il recensito è l'altro partecipante
    const recensitoId = isDonatore
      ? prenotazione.acquirente
      : prenotazione.donatore;

    const recensione = await Recensione.create({
      recensore: userId,
      recensito: recensitoId,
      prenotazione: prenotazioneId,
      positiva,
      testo: testo || '',
    });

    notificheService.creaNotifica(
      recensitoId,
      'sistema',
      positiva ? 'Hai ricevuto una nuova recensione positiva.' : 'Hai ricevuto una nuova recensione negativa.',
      `/users/${recensitoId}/recensioni`
    ).catch((e) => console.error('[notifica] createRecensione fallita', e));

    return res.status(201).json(recensione);
  } catch (err) {
    // OCL #21: l'index unique (recensore, prenotazione) impedisce duplicati
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ error: 'Hai già lasciato una recensione per questo scambio' });
    }
    return next(err);
  }
}

/**
 * GET /api/v1/users/:id/recensioni
 * Recensioni ricevute da un utente (profilo pubblico, RF8).
 * Paginata, con contatori positiva/negativa aggregati.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getRecensioniUtente(req, res, next) {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const recensitoId = new mongoose.Types.ObjectId(id);

    const [recensioni, conteggi] = await Promise.all([
      Recensione.find({ recensito: id })
        .populate('recensore', 'nome cognome')
        .sort({ data: -1 })
        .skip(skip)
        .limit(limit),
      Recensione.aggregate([
        { $match: { recensito: recensitoId } },
        {
          $group: {
            _id: null,
            totale: { $sum: 1 },
            positive: { $sum: { $cond: ['$positiva', 1, 0] } },
            negative: { $sum: { $cond: ['$positiva', 0, 1] } },
          },
        },
      ]),
    ]);
    const { totale = 0, positive = 0, negative = 0 } = conteggi[0] || {};

    return res.status(200).json({
      data: recensioni,
      pagination: {
        page,
        limit,
        totale,
        pagine: Math.ceil(totale / limit),
      },
      riepilogo: { positive, negative },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/recensioni/me/ricevute
 * Recensioni ricevute dall'utente autenticato.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getRecensioniRicevute(req, res, next) {
  try {
    const recensioni = await Recensione.find({ recensito: req.user.id })
      .populate('recensore', 'nome cognome')
      .sort({ data: -1 });

    return res.status(200).json(recensioni);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/recensioni/me/scritte
 * Recensioni scritte dall'utente autenticato.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getRecensioniScritte(req, res, next) {
  try {
    const recensioni = await Recensione.find({ recensore: req.user.id })
      .populate('recensito', 'nome cognome')
      .sort({ data: -1 });

    return res.status(200).json(recensioni);
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/v1/recensioni/:id
 * Elimina una recensione (solo autore, entro 24h dalla creazione).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function deleteRecensione(req, res, next) {
  try {
    const recensione = await Recensione.findById(req.params.id);

    if (!recensione) {
      return res.status(404).json({ error: 'Recensione non trovata' });
    }

    // Solo l'autore può eliminare la propria recensione
    if (recensione.recensore.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    // Eliminazione consentita solo entro 24h dalla creazione
    const oreTrascorse = (Date.now() - recensione.data.getTime()) / (1000 * 60 * 60);
    if (oreTrascorse > 24) {
      return res
        .status(409)
        .json({ error: 'Eliminazione consentita solo entro 24 ore dalla creazione' });
    }

    await Recensione.findByIdAndDelete(recensione._id);

    return res.status(200).json({ message: 'Recensione eliminata' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createRecensione,
  getRecensioniUtente,
  getRecensioniRicevute,
  getRecensioniScritte,
  deleteRecensione,
};
