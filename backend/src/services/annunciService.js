const Annuncio = require('../models/annuncioModel');
const Prenotazione = require('../models/prenotazioneModel');

class AnnunciError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function normalizeDimensione(value) {
  if (value == null) return 1;
  const parsed = parseFloat(value);
  if (!Number.isNaN(parsed)) return parsed;

  const normalized = String(value).trim().toLowerCase();
  switch (normalized) {
    case 'piccolo':
    case 'small':
    case 's':
      return 1;
    case 'medio':
    case 'medium':
    case 'm':
      return 2;
    case 'grande':
    case 'large':
    case 'l':
      return 3;
    case 'molto grande':
    case 'extra large':
    case 'xl':
    case 'xlarge':
      return 4;
    default:
      return 1;
  }
}

function giorniRimanenti(dataScadenza) {
  const diff = new Date(dataScadenza).getTime() - Date.now();
  return Math.max(0, diff / (1000 * 60 * 60 * 24));
}

function calcolaValoreAnnuncio(annuncio) {
  return normalizeDimensione(annuncio.oggetto?.dimensioni) * giorniRimanenti(annuncio.dataScadenza);
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function buildCatalogFilter(query) {
  const { categoria, dimensione, materiale, scadenzaDopo, scadenzaPrima } = query;
  const filtro = { isAttivo: true, stato: 'DISPONIBILE' };

  if (categoria) filtro['oggetto.categoria'] = categoria;
  if (dimensione) filtro['oggetto.dimensioni'] = dimensione;
  if (materiale) filtro['oggetto.materiale'] = materiale;

  if (scadenzaDopo || scadenzaPrima) {
    filtro.dataScadenza = {};
    if (scadenzaDopo) filtro.dataScadenza.$gte = new Date(scadenzaDopo);
    if (scadenzaPrima) filtro.dataScadenza.$lte = new Date(scadenzaPrima);
  }

  return filtro;
}

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  return { page, limit, skip: (page - 1) * limit };
}

function resolveSort(ordinamento) {
  const sortKey = String(ordinamento || 'dataScadenza_asc').toLowerCase();
  if (sortKey === 'valore_asc' || sortKey === 'valore_desc') {
    return { sortKey, dbSort: null };
  }
  return {
    sortKey,
    dbSort: sortKey === 'dataScadenza_desc' ? { dataScadenza: -1 } : { dataScadenza: 1 },
  };
}

async function getBookedAnnuncioIdsForUser(userId, annuncioIds) {
  if (!userId || annuncioIds.length === 0) return new Set();

  const prenotazioni = await Prenotazione.find(
    {
      acquirente: userId,
      annuncio: { $in: annuncioIds },
      stato: { $in: ['ATTIVA', 'COMPLETATA'] },
    },
    'annuncio'
  );

  return new Set(prenotazioni.map((prenotazione) => prenotazione.annuncio.toString()));
}

function isDonatoreOfAnnuncio(annuncio, userId) {
  if (!userId || !annuncio?.donatore) return false;
  const donatoreId = annuncio.donatore._id ?? annuncio.donatore;
  return donatoreId.toString() === userId;
}

function removeExactCoordinates(annuncio) {
  delete annuncio.latitudine;
  delete annuncio.longitudine;
  return annuncio;
}

async function applyCoordinatePrivacy(annunci, user) {
  const bookedAnnuncioIds = user?.ruolo === 'admin'
    ? new Set()
    : await getBookedAnnuncioIdsForUser(user?.id, annunci.map((annuncio) => annuncio._id));

  return annunci.map((annuncio) => {
    const dati = typeof annuncio.toObject === 'function' ? annuncio.toObject() : { ...annuncio };
    const canSeeExactCoordinates = user && (
      user.ruolo === 'admin' ||
      isDonatoreOfAnnuncio(annuncio, user.id) ||
      bookedAnnuncioIds.has(annuncio._id.toString())
    );

    return canSeeExactCoordinates ? dati : removeExactCoordinates(dati);
  });
}

function hasDistanceFilter(query) {
  return Boolean(query.lat && query.lng && query.raggio);
}

async function getCatalogo(query, user) {
  const filtro = buildCatalogFilter(query);
  const { page, limit, skip } = parsePagination(query);
  const { sortKey, dbSort } = resolveSort(query.ordinamento);
  const needsInMemoryProcessing = hasDistanceFilter(query) || !dbSort;

  if (!needsInMemoryProcessing) {
    const [annunci, total] = await Promise.all([
      Annuncio.find(filtro, '-__v')
        .populate('donatore', 'nome cognome')
        .sort(dbSort)
        .skip(skip)
        .limit(limit),
      Annuncio.countDocuments(filtro),
    ]);

    return {
      data: await applyCoordinatePrivacy(annunci, user),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  let dbQuery = Annuncio.find(filtro, '-__v').populate('donatore', 'nome cognome');
  if (dbSort) dbQuery = dbQuery.sort(dbSort);
  let annunci = await dbQuery;

  if (hasDistanceFilter(query)) {
    const userLat = parseFloat(query.lat);
    const userLng = parseFloat(query.lng);
    const maxDist = parseFloat(query.raggio);
    annunci = annunci.filter((annuncio) => {
      if (annuncio.latitudine == null || annuncio.longitudine == null) return false;
      return haversineDistance(userLat, userLng, annuncio.latitudine, annuncio.longitudine) <= maxDist;
    });
  }

  if (sortKey === 'valore_asc' || sortKey === 'valore_desc') {
    annunci = annunci
      .map((annuncio) => ({ annuncio, valore: calcolaValoreAnnuncio(annuncio) }))
      .sort((a, b) => (sortKey === 'valore_asc' ? a.valore - b.valore : b.valore - a.valore))
      .map((item) => item.annuncio);
  }

  const total = annunci.length;
  const paginatedAnnunci = annunci.slice(skip, skip + limit);

  return {
    data: await applyCoordinatePrivacy(paginatedAnnunci, user),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

async function getAnnuncio(id, user) {
  const annuncio = await Annuncio.findById(id).populate('donatore', 'nome cognome');
  if (!annuncio || !annuncio.isAttivo) throw new AnnunciError(404, 'Annuncio non trovato');

  const dati = annuncio.toObject();
  const canSeeExactCoordinates = user && (
    user.ruolo === 'admin' ||
    isDonatoreOfAnnuncio(annuncio, user.id) ||
    await Prenotazione.exists({
      annuncio: annuncio._id,
      acquirente: user.id,
      stato: { $in: ['ATTIVA', 'COMPLETATA'] },
    })
  );

  return canSeeExactCoordinates ? dati : removeExactCoordinates(dati);
}

async function creaAnnuncio(body, user) {
  if (user?.ruolo === 'admin') {
    throw new AnnunciError(403, 'Gli amministratori non possono pubblicare annunci');
  }

  const { titolo, dataScadenza, latitudine, longitudine, oggetto } = body;
  if (!titolo || !dataScadenza || !oggetto) {
    throw new AnnunciError(400, 'titolo, dataScadenza e oggetto sono obbligatori');
  }
  if (new Date(dataScadenza) <= new Date()) {
    throw new AnnunciError(400, 'dataScadenza deve essere nel futuro (OCL #5)');
  }

  return Annuncio.create({
    donatore: user.id,
    titolo,
    dataScadenza,
    latitudine,
    longitudine,
    oggetto,
  });
}

async function modificaAnnuncio(id, body, user) {
  const annuncio = await Annuncio.findById(id);
  if (!annuncio || !annuncio.isAttivo) throw new AnnunciError(404, 'Annuncio non trovato');
  if (annuncio.donatore.toString() !== user.id) throw new AnnunciError(403, 'Non autorizzato');
  if (annuncio.stato !== 'DISPONIBILE') {
    throw new AnnunciError(409, `Annuncio non modificabile: stato ${annuncio.stato}`);
  }

  const { titolo, dataScadenza, latitudine, longitudine, oggetto } = body;
  if (dataScadenza && new Date(dataScadenza) <= new Date()) {
    throw new AnnunciError(400, 'dataScadenza deve essere nel futuro');
  }

  Object.assign(annuncio, {
    ...(titolo && { titolo }),
    ...(dataScadenza && { dataScadenza }),
    ...(latitudine !== undefined && { latitudine }),
    ...(longitudine !== undefined && { longitudine }),
    ...(oggetto && { oggetto }),
  });

  return annuncio.save();
}

async function cancellaAnnuncio(id, user) {
  const annuncio = await Annuncio.findById(id);
  if (!annuncio || !annuncio.isAttivo) throw new AnnunciError(404, 'Annuncio non trovato');
  if (annuncio.donatore.toString() !== user.id) throw new AnnunciError(403, 'Non autorizzato');
  if (annuncio.stato !== 'DISPONIBILE') {
    throw new AnnunciError(409, `Annuncio non cancellabile: stato ${annuncio.stato}`);
  }

  annuncio.isAttivo = false;
  await annuncio.save();
  return { message: 'Annuncio rimosso' };
}

async function cambiaStatoAnnuncio(id, stato, user) {
  if (!stato || !['DISPONIBILE', 'PRENOTATO', 'RITIRATO', 'SCADUTO'].includes(stato)) {
    throw new AnnunciError(400, 'Stato non valido');
  }

  const annuncio = await Annuncio.findById(id);
  if (!annuncio) throw new AnnunciError(404, 'Annuncio non trovato');
  if (annuncio.donatore.toString() !== user.id) throw new AnnunciError(403, 'Non autorizzato');

  const transizioniValide = {
    DISPONIBILE: ['PRENOTATO', 'SCADUTO'],
    PRENOTATO: ['RITIRATO'],
    RITIRATO: [],
    SCADUTO: [],
  };

  if (!transizioniValide[annuncio.stato].includes(stato)) {
    throw new AnnunciError(400, `Transizione non valida da ${annuncio.stato} a ${stato}`);
  }

  annuncio.stato = stato;
  return annuncio.save();
}

async function getMieiAnnunci(user) {
  return Annuncio.find({ donatore: user.id, isAttivo: true })
    .populate('donatore', 'nome cognome')
    .sort({ dataScadenza: -1 });
}

module.exports = {
  AnnunciError,
  calcolaValoreAnnuncio,
  getCatalogo,
  getAnnuncio,
  creaAnnuncio,
  modificaAnnuncio,
  cancellaAnnuncio,
  cambiaStatoAnnuncio,
  getMieiAnnunci,
};
