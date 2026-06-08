const mongoose = require('mongoose');
const User = require('../models/userModel');
const { applicaMalus } = require('./userService');
const notificheService = require('./notificheService');
const Annuncio = require('../models/annuncioModel');
const Prenotazione = require('../models/prenotazioneModel');
const Segnalazione = require('../models/segnalazioneModel');
const Wallet = require('../models/walletModel');
const TokenQR = require('../models/tokenQRModel');
const Coupon = require('../models/couponModel');

class AdminError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function isTransactionUnsupportedError(err) {
  const message = String(err?.message || '');
  return (
    err?.code === 20 ||
    /Transaction numbers are only allowed/i.test(message) ||
    /transactions? are not supported/i.test(message) ||
    /replica set member or mongos/i.test(message)
  );
}

async function runWithOptionalTransaction(operation) {
  const session = await mongoose.startSession();
  let result;

  try {
    try {
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result;
    } catch (err) {
      if (!isTransactionUnsupportedError(err)) throw err;
      return operation(null);
    }
  } finally {
    await session.endSession();
  }
}

function maybeSession(query, session) {
  return session ? query.session(session) : query;
}

function sessionOptions(session) {
  return session ? { session } : {};
}

async function getStatistiche() {
  const inizioMese = new Date();
  inizioMese.setDate(1);
  inizioMese.setHours(0, 0, 0, 0);

  const [
    scambiMensili,
    totaleUtenti,
    segnalazioniPendenti,
    wallets,
    creditiErogati,
    storicoMensile,
    utentiAttivi,
    utentiSospesi,
  ] = await Promise.all([
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
    User.countDocuments({ ruolo: 'user', bannato: false, isSospeso: false }),
    User.countDocuments({ ruolo: 'user', isSospeso: true, bannato: false }),
  ]);

  const liquiditaAttuale = wallets[0]?.liquiditaAttuale ?? 0;
  const creditiErogatiTotali = creditiErogati[0]?.creditiErogatiTotali ?? 0;
  const creditiErogatiMese = creditiErogati[0]?.creditiErogatiMese ?? 0;
  const utentiBannati = totaleUtenti - utentiAttivi - utentiSospesi;

  return {
    scambiMensili,
    totaleUtenti,
    segnalazioniPendenti,
    liquiditaAttuale,
    creditiErogatiTotali,
    creditiErogatiMese,
    totaleCrediti: liquiditaAttuale,
    utentiAttivi,
    utentiSospesi,
    utentiBannati,
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
  const { search, stato } = queryParams;
  const { page, limit, skip } = parsePagination(queryParams);
  const query = { ruolo: 'user' };

  const statoFiltri = {
    attivo:  { bannato: false, isSospeso: false },
    sospeso: { isSospeso: true, bannato: false },
    bannato: { bannato: true },
  };
  if (statoFiltri[stato]) Object.assign(query, statoFiltri[stato]);

  const normalizedSearch = String(search ?? '').trim();
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
  let utente, segnalazione;

  await runWithOptionalTransaction(async (session) => {
    const existing = await maybeSession(Segnalazione.findById(id), session);
    if (!existing) throw new AdminError(404, 'Segnalazione non trovata');
    if (existing.stato === 'RISOLTA') throw new AdminError(409, 'Segnalazione già risolta');

    existing.stato = 'RISOLTA';
    segnalazione = await existing.save(sessionOptions(session));
    if (!segnalazione) throw new AdminError(409, 'Segnalazione non trovata o già risolta');

    utente = await applicaMalus(segnalazione.segnalato, sessionOptions(session));
  });

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
  let utente;

  await runWithOptionalTransaction(async (session) => {
    utente = await maybeSession(User.findById(id), session);
    if (!utente) throw new AdminError(404, 'Utente non trovato');
    if (utente.ruolo === 'admin') throw new AdminError(403, 'Non puoi bannare un amministratore');

    utente.isSospeso = true;
    utente.bannato = true;
    await utente.save(sessionOptions(session));
    await applicaMalus(utente._id, sessionOptions(session));
  });

  return { message: `Utente ${utente.email} bannato` };
}

async function sospendiUtente(id) {
  let utente;

  await runWithOptionalTransaction(async (session) => {
    utente = await maybeSession(User.findById(id), session);
    if (!utente) throw new AdminError(404, 'Utente non trovato');
    if (utente.ruolo === 'admin') throw new AdminError(403, 'Non puoi sospendere un amministratore');

    utente.isSospeso = true;
    await utente.save(sessionOptions(session));
    await applicaMalus(utente._id, sessionOptions(session));
  });

  return { message: `Utente ${utente.email} sospeso` };
}

async function riabilitaUtente(id) {
  const utente = await User.findById(id);
  if (!utente) throw new AdminError(404, 'Utente non trovato');
  if (!utente.isSospeso && !utente.bannato) throw new AdminError(400, 'Account già attivo');

  utente.isSospeso = false;
  utente.bannato = false;
  await utente.save();

  return { message: `Utente ${utente.email} riabilitato` };
}

async function forzaStatoAnnuncio(id, statoRichiesto) {
  const statoFinale = statoRichiesto || 'DISPONIBILE';
  const statiForzabili = ['DISPONIBILE', 'SCADUTO', 'RITIRATO'];

  if (!statiForzabili.includes(statoFinale)) {
    throw new AdminError(400, 'Stato annuncio non valido');
  }

  const annuncio = await Annuncio.findById(id);
  if (!annuncio) throw new AdminError(404, 'Annuncio non trovato');
  if (annuncio.stato === statoFinale) {
    return { message: `Annuncio già in stato ${statoFinale}`, annuncio };
  }

  let updated;

  await runWithOptionalTransaction(async (session) => {
    const prenotazioniAttive = await Prenotazione.find(
      { annuncio: id, stato: 'ATTIVA' },
      '_id',
      sessionOptions(session)
    );
    const ids = prenotazioniAttive.map((prenotazione) => prenotazione._id);

    if (ids.length > 0) {
      await Prenotazione.updateMany(
        { _id: { $in: ids } },
        { $set: { stato: 'ANNULLATA' } },
        sessionOptions(session)
      );
      await maybeSession(TokenQR.deleteMany({ prenotazione: { $in: ids } }), session);
    }

    updated = await Annuncio.findByIdAndUpdate(
      id,
      {
        $set: { stato: statoFinale, isAttivo: statoFinale === 'DISPONIBILE' },
        $inc: { versione: 1 },
      },
      { new: true, ...sessionOptions(session) }
    );
  });

  return { message: `Annuncio forzato a ${statoFinale}`, annuncio: updated };
}

async function rimuoviAnnuncio(id) {
  const annuncio = await Annuncio.findByIdAndUpdate(
    id,
    { $set: { isAttivo: false } },
    { new: true }
  );

  if (!annuncio) throw new AdminError(404, 'Annuncio non trovato');
}

function buildCouponPayload(body) {
  const titolo = String(body?.titolo || '').trim();
  const descrizione = String(body?.descrizione || '').trim();
  const partner = String(body?.partner || '').trim();
  const costoCrediti = Number.parseInt(body?.costoCrediti, 10);
  const stock = Number.parseInt(body?.stock, 10);
  const immagine = body?.immagine ? String(body.immagine).trim() : null;
  const attivo = typeof body?.attivo === 'boolean' ? body.attivo : true;

  if (!titolo || !descrizione || !partner) {
    throw new AdminError(400, 'Titolo, descrizione e partner sono obbligatori');
  }
  if (!Number.isInteger(costoCrediti) || costoCrediti < 1) {
    throw new AdminError(400, 'Il costo in crediti deve essere almeno 1');
  }
  if (!Number.isInteger(stock) || stock < 0) {
    throw new AdminError(400, 'Lo stock deve essere un numero maggiore o uguale a 0');
  }

  return { titolo, descrizione, partner, costoCrediti, stock, attivo, immagine };
}

async function listCoupon(queryParams) {
  const { search = '', attivo = '' } = queryParams;
  const { page, limit, skip } = parsePagination(queryParams);
  const query = {};
  const normalizedSearch = String(search).trim();

  if (attivo === 'true') query.attivo = true;
  if (attivo === 'false') query.attivo = false;

  if (normalizedSearch) {
    const pattern = new RegExp(normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ titolo: pattern }, { partner: pattern }, { descrizione: pattern }];
  }

  const [coupon, total] = await Promise.all([
    Coupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Coupon.countDocuments(query),
  ]);

  return {
    coupon,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}

async function creaCoupon(body) {
  const coupon = await Coupon.create(buildCouponPayload(body));
  return { message: `Coupon "${coupon.titolo}" creato`, coupon };
}

async function aggiornaCoupon(id, body) {
  const payload = buildCouponPayload(body);
  const coupon = await Coupon.findByIdAndUpdate(id, { $set: payload }, { new: true });
  if (!coupon) throw new AdminError(404, 'Coupon non trovato');
  return { message: `Coupon "${coupon.titolo}" aggiornato`, coupon };
}

async function disattivaCoupon(id) {
  const coupon = await Coupon.findByIdAndUpdate(id, { $set: { attivo: false } }, { new: true });
  if (!coupon) throw new AdminError(404, 'Coupon non trovato');
  return { message: `Coupon "${coupon.titolo}" disattivato`, coupon };
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
  listCoupon,
  creaCoupon,
  aggiornaCoupon,
  disattivaCoupon,
};
