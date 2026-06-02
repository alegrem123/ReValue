const mongoose = require('mongoose');
const User = require('../models/userModel');
const { applicaMalus } = require('./userService');
const notificheService = require('./notificheService');
const Annuncio = require('../models/annuncioModel');
const Prenotazione = require('../models/prenotazioneModel');
const Segnalazione = require('../models/segnalazioneModel');
const Wallet = require('../models/walletModel');
const TokenQR = require('../models/tokenQRModel');

class AdminError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function getStatistiche() {
  const inizioMese = new Date();
  inizioMese.setDate(1);
  inizioMese.setHours(0, 0, 0, 0);

  const [scambiMensili, totaleUtenti, segnalazioniPendenti, wallets, creditiErogati, storicoMensile] = await Promise.all([
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
    Prenotazione.aggregate([
      { $match: { stato: 'COMPLETATA', dataCompletamento: { $ne: null } } },
      {
        $group: {
          _id: {
            anno: { $year: '$dataCompletamento' },
            mese: { $month: '$dataCompletamento' },
          },
          totale: { $sum: 1 },
        },
      },
      { $sort: { '_id.anno': 1, '_id.mese': 1 } },
      { $limit: 12 },
    ]),
  ]);

  const liquiditaAttuale = wallets[0]?.liquiditaAttuale ?? 0;
  const creditiErogatiTotali = creditiErogati[0]?.creditiErogatiTotali ?? 0;
  const creditiErogatiMese = creditiErogati[0]?.creditiErogatiMese ?? 0;

  return {
    scambiMensili,
    totaleUtenti,
    segnalazioniPendenti,
    liquiditaAttuale,
    creditiErogatiTotali,
    creditiErogatiMese,
    totaleCrediti: liquiditaAttuale,
    storicoMensile: storicoMensile.map((item) => ({
      anno: item._id.anno,
      mese: item._id.mese,
      totale: item.totale,
    })),
  };
}

function parsePagination(query, defaultLimit = 20) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

async function listUsers(queryParams) {
  const { search = '' } = queryParams;
  const { page, limit, skip } = parsePagination(queryParams);
  const query = { ruolo: 'user' };
  const normalizedSearch = String(search).trim();

  if (normalizedSearch) {
    const pattern = new RegExp(normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ email: pattern }, { nome: pattern }, { cognome: pattern }];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select('idUtente nome cognome email malusCount isSospeso bannato ruolo createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  return {
    users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}

async function listAnnunci(queryParams) {
  const { stato } = queryParams;
  const { page, limit, skip } = parsePagination(queryParams);
  const query = {};

  if (stato && ['DISPONIBILE', 'PRENOTATO', 'RITIRATO', 'SCADUTO'].includes(stato)) {
    query.stato = stato;
  }

  const [annunci, total] = await Promise.all([
    Annuncio.find(query)
      .populate('donatore', 'nome cognome email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Annuncio.countDocuments(query),
  ]);

  return {
    annunci,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}

async function getSegnalazioni() {
  return Segnalazione.find()
    .sort({ data: -1 })
    .populate('segnalante', 'nome cognome email')
    .populate('segnalato', 'nome cognome email')
    .populate('annuncio', 'titolo stato');
}

async function applicaMalusSegnalazione(id) {
  const session = await mongoose.startSession();
  let utente, segnalazione;

  try {
    await session.withTransaction(async () => {
      const existing = await Segnalazione.findById(id).session(session);
      if (!existing) throw new AdminError(404, 'Segnalazione non trovata');
      if (existing.stato === 'RISOLTA') throw new AdminError(409, 'Segnalazione già risolta');

      existing.stato = 'RISOLTA';
      segnalazione = await existing.save({ session });
      if (!segnalazione) throw new AdminError(409, 'Segnalazione non trovata o già risolta');

      utente = await applicaMalus(segnalazione.segnalato, { session });
    });
  } finally {
    await session.endSession();
  }

  notificheService.creaNotifica(
    utente._id,
    'segnalazione',
    `Ti è stato applicato un malus. Malus attuali: ${utente.malusCount}`,
    '/profile.html'
  ).catch(() => {});

  return {
    message: `Malus applicato a ${utente.email}`,
    segnalazione,
    utente,
  };
}

async function bannaUtente(id) {
  const session = await mongoose.startSession();
  let utente;

  try {
    await session.withTransaction(async () => {
      utente = await User.findById(id).session(session);
      if (!utente) throw new AdminError(404, 'Utente non trovato');
      if (utente.ruolo === 'admin') throw new AdminError(403, 'Non puoi bannare un amministratore');

      utente.isSospeso = true;
      utente.bannato = true;
      await utente.save({ session });
      await applicaMalus(utente._id, { session });
    });
  } finally {
    await session.endSession();
  }

  return { message: `Utente ${utente.email} bannato` };
}

async function sospendiUtente(id) {
  const session = await mongoose.startSession();
  let utente;

  try {
    await session.withTransaction(async () => {
      utente = await User.findById(id).session(session);
      if (!utente) throw new AdminError(404, 'Utente non trovato');
      if (utente.ruolo === 'admin') throw new AdminError(403, 'Non puoi sospendere un amministratore');

      utente.isSospeso = true;
      await utente.save({ session });
      await applicaMalus(utente._id, { session });
    });
  } finally {
    await session.endSession();
  }

  return { message: `Utente ${utente.email} sospeso` };
}

async function riabilitaUtente(id) {
  const utente = await User.findById(id);
  if (!utente) throw new AdminError(404, 'Utente non trovato');
  if (utente.bannato) throw new AdminError(403, 'Account bannato non riabilitabile');
  if (!utente.isSospeso) throw new AdminError(400, 'Account non sospeso');

  utente.isSospeso = false;
  await utente.save();

  return { message: `Utente ${utente.email} riabilitato` };
}

async function forzaStatoAnnuncio(id, statoRichiesto) {
  if (statoRichiesto && statoRichiesto !== 'DISPONIBILE') {
    throw new AdminError(400, 'RF31 consente di forzare solo lo stato DISPONIBILE');
  }

  const annuncio = await Annuncio.findById(id);
  if (!annuncio) throw new AdminError(404, 'Annuncio non trovato');
  if (annuncio.stato === 'DISPONIBILE') {
    return { message: 'Annuncio già in stato DISPONIBILE', annuncio };
  }

  const session = await mongoose.startSession();
  let updated;

  try {
    await session.withTransaction(async () => {
      const prenotazioniAttive = await Prenotazione.find(
        { annuncio: id, stato: 'ATTIVA' },
        '_id',
        { session }
      );
      const ids = prenotazioniAttive.map((prenotazione) => prenotazione._id);

      if (ids.length > 0) {
        await Prenotazione.updateMany(
          { _id: { $in: ids } },
          { $set: { stato: 'ANNULLATA' } },
          { session }
        );
        await TokenQR.deleteMany({ prenotazione: { $in: ids } }).session(session);
      }

      updated = await Annuncio.findByIdAndUpdate(
        id,
        { $set: { stato: 'DISPONIBILE' }, $inc: { versione: 1 } },
        { new: true, session }
      );
    });
  } finally {
    await session.endSession();
  }

  return { message: 'Annuncio forzato a DISPONIBILE', annuncio: updated };
}

async function rimuoviAnnuncio(id) {
  const annuncio = await Annuncio.findByIdAndUpdate(
    id,
    { $set: { isAttivo: false } },
    { new: true }
  );

  if (!annuncio) throw new AdminError(404, 'Annuncio non trovato');
}

module.exports = {
  AdminError,
  getStatistiche,
  listUsers,
  listAnnunci,
  getSegnalazioni,
  applicaMalusSegnalazione,
  bannaUtente,
  sospendiUtente,
  riabilitaUtente,
  forzaStatoAnnuncio,
  rimuoviAnnuncio,
};
