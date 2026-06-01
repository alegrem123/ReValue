const Annuncio = require('../models/annuncioModel');
const Prenotazione = require('../models/prenotazioneModel');

/**
 * Estrae un valore numerico da dimensione testuale.
 * Supporta dimensioni enumerative: piccolo, medio, grande, molto grande.
 * Se numerico, usa il valore diretto; altrimenti usa la scala enumerativa.
 */
function normalizeDimensione(value) {
  if (value == null) return 1;
  const parsed = parseFloat(value);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

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
      return 1; // default a piccolo se non riconosciuto
  }
}

/**
 * Calcola i giorni rimanenti fino a dataScadenza.
 */
function giorniRimanenti(dataScadenza) {
  const now = Date.now();
  const target = new Date(dataScadenza).getTime();
  const diff = target - now;
  return Math.max(0, diff / (1000 * 60 * 60 * 24));
}

/**
 * Calcola il valore dell'annuncio per l'asta inversa.
 * formula: dimensione * giorni-rimanenti
 */
function calcolaValoreAnnuncio(annuncio) {
  const dimensione = normalizeDimensione(annuncio.oggetto?.dimensioni);
  return dimensione * giorniRimanenti(annuncio.dataScadenza);
}

async function getBookedAnnuncioIdsForUser(userId, annuncioIds) {
  if (!userId || annuncioIds.length === 0) {
    return new Set();
  }

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
  if (!userId || !annuncio?.donatore) {
    return false;
  }

  const donatoreId = annuncio.donatore._id ?? annuncio.donatore;
  return donatoreId.toString() === userId;
}

function removeExactCoordinates(annuncio) {
  delete annuncio.latitudine;
  delete annuncio.longitudine;
  return annuncio;
}

/**
 * Calcola distanza haversine in km tra due punti geografici.
 * @param {number} lat1 - Latitudine punto 1
 * @param {number} lng1 - Longitudine punto 1
 * @param {number} lat2 - Latitudine punto 2
 * @param {number} lng2 - Longitudine punto 2
 * @returns {number} Distanza in km
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Raggio terrestre in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * GET /api/v1/annunci
 * Catalogo pubblico — accessibile senza autenticazione (RF4, UC8).
 * Nasconde lat/lng esatte agli utenti non autenticati (RF4: privacy indirizzo).
 * Supporta filtraggio per categoria, materiale, dataScadenza (RF22).
 * Ordina per dataScadenza ASC per default (RNF1).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getCatalogo(req, res) {
  try {
    const { categoria, dimensione, materiale, scadenzaDopo, scadenzaPrima, lat, lng, raggio, ordinamento, page = 1, limit = 10 } = req.query;

    const filtro = { isAttivo: true, stato: 'DISPONIBILE' };

    if (categoria) filtro['oggetto.categoria'] = categoria;
    if (dimensione) filtro['oggetto.dimensioni'] = dimensione;
    if (materiale) filtro['oggetto.materiale'] = materiale;

    // filtro intervallo scadenza (RF22: data di scadenza)
    if (scadenzaDopo || scadenzaPrima) {
      filtro.dataScadenza = {};
      if (scadenzaDopo) filtro.dataScadenza.$gte = new Date(scadenzaDopo);
      if (scadenzaPrima) filtro.dataScadenza.$lte = new Date(scadenzaPrima);
    }

    // filtro distanza con haversine (calcolo manuale dopo query)

    const sortKey = String(ordinamento || 'dataScadenza_asc').toLowerCase();
    const dbSort = sortKey === 'valore_asc' || sortKey === 'valore_desc'
      ? null
      : sortKey === 'dataScadenza_desc'
        ? { dataScadenza: -1 }
        : { dataScadenza: 1 };

    // Paginazione
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10)); // max 100 items per page
    const skip = (pageNum - 1) * limitNum;

    // Recupera tutti gli annunci filtrati (senza paginazione per applicare filtro distanza)
    let query = Annuncio.find(filtro, '-__v').populate('donatore', 'nome cognome');
    if (dbSort) {
      query = query.sort(dbSort);
    }
    let annunci = await query;

    // Applica filtro distanza se richiesto
    if (lat && lng && raggio) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const maxDist = parseFloat(raggio);
      annunci = annunci.filter(annuncio => {
        if (annuncio.latitudine == null || annuncio.longitudine == null) return false;
        const dist = haversineDistance(userLat, userLng, annuncio.latitudine, annuncio.longitudine);
        return dist <= maxDist;
      });
    }

    // Ordina per valore se richiesto
    if (sortKey === 'valore_asc' || sortKey === 'valore_desc') {
      annunci = annunci
        .map((annuncio) => ({ annuncio, valore: calcolaValoreAnnuncio(annuncio) }))
        .sort((a, b) => (sortKey === 'valore_asc' ? a.valore - b.valore : b.valore - a.valore))
        .map((item) => item.annuncio);
    }

    // Calcola total dopo filtro distanza
    const total = annunci.length;

    // Applica paginazione manuale
    const paginatedAnnunci = annunci.slice(skip, skip + limitNum);
    const bookedAnnuncioIds = req.user?.ruolo === 'admin'
      ? new Set()
      : await getBookedAnnuncioIdsForUser(
          req.user?.id,
          paginatedAnnunci.map((annuncio) => annuncio._id)
        );
    const visibleAnnunci = paginatedAnnunci.map((annuncio) => {
      const dati = annuncio.toObject();
      const canSeeExactCoordinates = req.user && (
        req.user.ruolo === 'admin' ||
        isDonatoreOfAnnuncio(annuncio, req.user.id) ||
        bookedAnnuncioIds.has(annuncio._id.toString())
      );

      return canSeeExactCoordinates ? dati : removeExactCoordinates(dati);
    });

    return res.status(200).json({
      data: visibleAnnunci,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * GET /api/v1/annunci/:id
 * Dettaglio singolo annuncio.
 * Indirizzo visibile solo se autenticato.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getAnnuncio(req, res) {
  try {
    const annuncio = await Annuncio.findById(req.params.id)
      .populate('donatore', 'nome cognome');

    if (!annuncio || !annuncio.isAttivo) {
      return res.status(404).json({ error: 'Annuncio non trovato' });
    }

    const dati = annuncio.toObject();

    const canSeeExactCoordinates = req.user && (
      req.user.ruolo === 'admin' ||
      isDonatoreOfAnnuncio(annuncio, req.user.id) ||
      (
        await Prenotazione.exists({
          annuncio: annuncio._id,
          acquirente: req.user.id,
          stato: { $in: ['ATTIVA', 'COMPLETATA'] },
        })
      )
    );

    if (!canSeeExactCoordinates) {
      removeExactCoordinates(dati);
    }

    return res.status(200).json(dati);
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * POST /api/v1/annunci
 * Crea nuovo annuncio (RF15, RF16). Richiede autenticazione.
 * OCL #5: dataScadenza deve essere nel futuro.
 * OCL #3: utente non sospeso (garantito da authMiddleware + login check).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function creaAnnuncio(req, res) {
  try {
    if (req.user?.ruolo === 'admin') {
      return res.status(403).json({ error: 'Gli amministratori non possono pubblicare annunci' });
    }

    const { titolo, dataScadenza, latitudine, longitudine, oggetto } = req.body;

    if (!titolo || !dataScadenza || !oggetto) {
      return res.status(400).json({ error: 'titolo, dataScadenza e oggetto sono obbligatori' });
    }

    // OCL #5: dataScadenza deve essere nel futuro
    if (new Date(dataScadenza) <= new Date()) {
      return res.status(400).json({ error: 'dataScadenza deve essere nel futuro (OCL #5)' });
    }

    const annuncio = await Annuncio.create({
      donatore: req.user.id,
      titolo,
      dataScadenza,
      latitudine,
      longitudine,
      oggetto,
    });

    return res.status(201).json(annuncio);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * PUT /api/v1/annunci/:id
 * Modifica annuncio (RF18). Solo il donatore, solo se stato === DISPONIBILE (OCL #7).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function modificaAnnuncio(req, res) {
  try {
    const annuncio = await Annuncio.findById(req.params.id);

    if (!annuncio || !annuncio.isAttivo) {
      return res.status(404).json({ error: 'Annuncio non trovato' });
    }

    // solo il donatore può modificare
    if (annuncio.donatore.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    // OCL #7: modificabile solo se DISPONIBILE
    if (annuncio.stato !== 'DISPONIBILE') {
      return res.status(409).json({ error: 'Annuncio non modificabile: stato ' + annuncio.stato });
    }

    const { titolo, dataScadenza, latitudine, longitudine, oggetto } = req.body;

    if (dataScadenza && new Date(dataScadenza) <= new Date()) {
      return res.status(400).json({ error: 'dataScadenza deve essere nel futuro' });
    }

    Object.assign(annuncio, {
      ...(titolo && { titolo }),
      ...(dataScadenza && { dataScadenza }),
      ...(latitudine !== undefined && { latitudine }),
      ...(longitudine !== undefined && { longitudine }),
      ...(oggetto && { oggetto }),
    });

    await annuncio.save();
    return res.status(200).json(annuncio);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * DELETE /api/v1/annunci/:id
 * Soft-delete annuncio (RF18). Solo il donatore, solo se stato === DISPONIBILE (OCL #8).
 * Imposta isAttivo = false senza rimuovere il documento dal DB (D2 §2.3.1).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function cancellaAnnuncio(req, res) {
  try {
    const annuncio = await Annuncio.findById(req.params.id);

    if (!annuncio || !annuncio.isAttivo) {
      return res.status(404).json({ error: 'Annuncio non trovato' });
    }

    if (annuncio.donatore.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    // OCL #8: cancellabile solo se DISPONIBILE
    if (annuncio.stato !== 'DISPONIBILE') {
      return res.status(409).json({ error: 'Annuncio non cancellabile: stato ' + annuncio.stato });
    }

    annuncio.isAttivo = false;
    await annuncio.save();

    return res.status(200).json({ message: 'Annuncio rimosso' });
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}


/**
 * PATCH /api/v1/annunci/:id/stato
 * Cambia stato annuncio: DISPONIBILE→PRENOTATO→RITIRATO/SCADUTO.
 * Solo il donatore può cambiare stato (OCL #2).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function cambiaStatoAnnuncio(req, res) {
  try {
    const { stato } = req.body;

    if (!stato || !['DISPONIBILE', 'PRENOTATO', 'RITIRATO', 'SCADUTO'].includes(stato)) {
      return res.status(400).json({ error: 'Stato non valido' });
    }

    const annuncio = await Annuncio.findById(req.params.id);

    if (!annuncio) {
      return res.status(404).json({ error: 'Annuncio non trovato' });
    }

    // OCL #2: solo il donatore può cambiare stato
    if (annuncio.donatore.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    // OCL #3: macchina a stati — no back-transition; annullamento via DELETE /prenotazioni/:id
    const transizioniValide = {
      'DISPONIBILE': ['PRENOTATO', 'SCADUTO'],
      'PRENOTATO':   ['RITIRATO'],
      'RITIRATO':    [],
      'SCADUTO':     [],
    };

    if (!transizioniValide[annuncio.stato].includes(stato)) {
      return res.status(400).json({ error: `Transizione non valida da ${annuncio.stato} a ${stato}` });
    }

    annuncio.stato = stato;
    await annuncio.save();

    return res.status(200).json(annuncio);
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * GET /api/v1/annunci/me
 * Annunci dell'utente loggato, anche scaduti/ritirati.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getMieiAnnunci(req, res) {
  try {
    const annunci = await Annuncio.find({ donatore: req.user.id, isAttivo: true })
      .populate('donatore', 'nome cognome')
      .sort({ dataScadenza: -1 }); // più recenti prima

    return res.status(200).json(annunci);
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

module.exports = {
  getCatalogo,
  getAnnuncio,
  creaAnnuncio,
  modificaAnnuncio,
  cancellaAnnuncio,
  cambiaStatoAnnuncio,
  getMieiAnnunci,
};
