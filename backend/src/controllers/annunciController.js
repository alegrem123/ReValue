const crypto = require('crypto');
const Annuncio = require('../models/annuncioModel');
const Prenotazione = require('../models/prenotazioneModel');
const TokenQR = require('../models/tokenQRModel');
const Conversazione = require('../models/conversazioneModel');

// QR token valido 48 ore dalla prenotazione
const QR_TTL_MS = 48 * 60 * 60 * 1000;

/**
 * Genera un codice QR crittograficamente sicuro.
 * @returns {string} stringa esadecimale da 64 caratteri
 */
function generaCodiceQR() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * GET /api/annunci
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
    const { categoria, materiale, scadenzaDopo, scadenzaPrima, ordinamento } = req.query;

    const filtro = { isAttivo: true, stato: 'DISPONIBILE' };

    if (categoria) filtro['oggetto.categoria'] = categoria;
    if (materiale) filtro['oggetto.materiale'] = materiale;

    // filtro intervallo scadenza (RF22: data di scadenza)
    if (scadenzaDopo || scadenzaPrima) {
      filtro.dataScadenza = {};
      if (scadenzaDopo) filtro.dataScadenza.$gte = new Date(scadenzaDopo);
      if (scadenzaPrima) filtro.dataScadenza.$lte = new Date(scadenzaPrima);
    }

    // RNF1: ordinamento nativo DBMS su dataScadenza
    const sort = ordinamento === 'DESC' ? { dataScadenza: -1 } : { dataScadenza: 1 };

    // RF4: omette lat/lng per utenti non autenticati
    const autenticato = !!req.user;
    const projection = autenticato
      ? '-__v'
      : '-latitudine -longitudine -__v';

    const annunci = await Annuncio.find(filtro, projection)
      .sort(sort)
      .populate('donatore', 'nome cognome');

    return res.status(200).json(annunci);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/annunci/:id
 * Dettaglio singolo annuncio.
 * Svela indirizzo esatto solo se l'utente ha una prenotazione ATTIVA sull'annuncio (RF25).
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

    // RF25: svela indirizzo esatto solo all'acquirente con prenotazione attiva
    const userId = req.user?.id;
    if (userId) {
      const prenotazione = await Prenotazione.findOne({
        annuncio: annuncio._id,
        acquirente: userId,
        stato: 'ATTIVA',
      });
      if (!prenotazione) {
        delete dati.latitudine;
        delete dati.longitudine;
      }
    } else {
      delete dati.latitudine;
      delete dati.longitudine;
    }

    return res.status(200).json(dati);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/annunci
 * Crea nuovo annuncio (RF15, RF16). Richiede autenticazione.
 * OCL #5: dataScadenza deve essere nel futuro.
 * OCL #3: utente non sospeso (garantito da authMiddleware + login check).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function creaAnnuncio(req, res) {
  try {
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
    return res.status(500).json({ error: err.message });
  }
}

/**
 * PUT /api/annunci/:id
 * Modifica annuncio (RF18). Solo il donatore, solo se stato === DISPONIBILE (OCL #8).
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

    // OCL #8: modificabile solo se DISPONIBILE
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
    return res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/annunci/:id
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
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/annunci/:id/prenota
 * Prenota un oggetto (RF24, UC2).
 * Usa optimistic lock su Annuncio.versione per prevenire doppia prenotazione (OCL #7, OCL #9).
 * Svela indirizzo esatto all'acquirente dopo conferma (RF25).
 * Crea TokenQR e Conversazione in modo atomico.
 * OCL #4: donatore non può prenotare il proprio annuncio.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function prenotaAnnuncio(req, res) {
  try {
    const annuncio = await Annuncio.findById(req.params.id);

    if (!annuncio || !annuncio.isAttivo) {
      return res.status(404).json({ error: 'Annuncio non trovato' });
    }

    // OCL #4: donatore non può prenotare il proprio annuncio
    if (annuncio.donatore.toString() === req.user.id) {
      return res.status(409).json({ error: 'Non puoi prenotare il tuo stesso annuncio' });
    }

    // OCL #5 / OCL #6: annuncio deve essere attivo, DISPONIBILE e non scaduto
    if (annuncio.stato !== 'DISPONIBILE' || annuncio.dataScadenza <= new Date()) {
      return res.status(409).json({ error: 'Oggetto non più disponibile' });
    }

    // Optimistic lock (OCL #7, UC2 §5):
    // la query fallisce se versione è cambiata nel frattempo → doppia prenotazione impossibile
    const aggiornato = await Annuncio.findOneAndUpdate(
      { _id: annuncio._id, stato: 'DISPONIBILE', versione: annuncio.versione },
      { $set: { stato: 'PRENOTATO' }, $inc: { versione: 1 } },
      { new: true }
    );

    if (!aggiornato) {
      return res.status(409).json({ error: 'Oggetto appena prenotato da un altro utente' });
    }

    // crea Prenotazione
    const prenotazione = await Prenotazione.create({
      annuncio: annuncio._id,
      acquirente: req.user.id,
    });

    // genera TokenQR (D2 §2.3.3 generaQR(), RF17)
    const scadenzaQR = new Date(Date.now() + QR_TTL_MS);
    await TokenQR.create({
      prenotazione: prenotazione._id,
      codice: generaCodiceQR(),
      scadenza: scadenzaQR,
    });

    // crea Conversazione (D2 §2.4.1, composizione con Prenotazione)
    await Conversazione.create({
      prenotazione: prenotazione._id,
      partecipanti: [annuncio.donatore, req.user.id],
    });

    // RF25: svela indirizzo esatto solo dopo prenotazione confermata
    return res.status(201).json({
      prenotazione,
      indirizzo: {
        latitudine: aggiornato.latitudine,
        longitudine: aggiornato.longitudine,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/annunci/:id/prenotazione
 * Annulla prenotazione (RF26, OCL #10): solo entro 15 minuti, solo l'acquirente.
 * Riporta l'annuncio a DISPONIBILE e decrementa versione (OCL #11).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function annullaPrenotazione(req, res) {
  try {
    const prenotazione = await Prenotazione.findOne({
      annuncio: req.params.id,
      acquirente: req.user.id,
      stato: 'ATTIVA',
    });

    if (!prenotazione) {
      return res.status(404).json({ error: 'Prenotazione attiva non trovata' });
    }

    // OCL #10: finestra massima 15 minuti (RF26)
    const minuti = (Date.now() - prenotazione.dataPrenotazione.getTime()) / 60000;
    if (minuti > 15) {
      return res.status(409).json({ error: 'Finestra di annullamento (15 min) scaduta' });
    }

    // OCL #11: prenotazione → ANNULLATA, annuncio → DISPONIBILE
    prenotazione.stato = 'ANNULLATA';
    await prenotazione.save();

    await Annuncio.findByIdAndUpdate(req.params.id, {
      $set: { stato: 'DISPONIBILE' },
      $inc: { versione: 1 },
    });

    // rimuove TokenQR associato
    await TokenQR.deleteOne({ prenotazione: prenotazione._id });

    return res.status(200).json({ message: 'Prenotazione annullata' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getCatalogo,
  getAnnuncio,
  creaAnnuncio,
  modificaAnnuncio,
  cancellaAnnuncio,
  prenotaAnnuncio,
  annullaPrenotazione,
};
