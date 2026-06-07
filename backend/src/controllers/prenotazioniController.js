const prenotazioniService = require('../services/prenotazioniService');
const notificheService = require('../services/notificheService');

function handleError(res, err, fallbackContext = {}) {
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error(fallbackContext.message || 'prenotazioniController: errore interno', {
    ...fallbackContext,
    error: err,
  });
  return res.status(500).json({ error: 'Errore interno del server' });
}

async function creaPrenotazione(req, res) {
  try {
    const { prenotazione, indirizzo } = await prenotazioniService.creaPrenotazione({
      annuncioId: req.body?.annuncioId,
      userId: req.user.id,
      userRole: req.user?.ruolo,
    });

    notificheService.creaNotifica(
      prenotazione.donatore,
      'prenotazione',
      'Un utente ha prenotato il tuo annuncio',
      `/prenotazioni/${prenotazione._id}`
    ).catch((e) => console.error('[notifica] creaPrenotazione fallita', e));

    return res.status(201).json({
      prenotazione,
      creditiAssegnati: {
        donatore: prenotazione.creditiDonatore,
        acquirente: prenotazione.creditiAcquirente,
      },
      indirizzo,
    });
  } catch (err) {
    return handleError(res, err, {
      message: 'creaPrenotazione: errore interno',
      userId: req.user?.id,
      annuncioId: req.body?.annuncioId,
    });
  }
}

async function annullaPrenotazione(req, res) {
  try {
    const prenotazione = await prenotazioniService.annullaPrenotazione({
      prenotazioneId: req.params.id,
      userId: req.user.id,
    });

    notificheService.creaNotifica(
      prenotazione.donatore,
      'prenotazione',
      'Una prenotazione è stata annullata',
      `/prenotazioni/${prenotazione._id}`
    ).catch((e) => console.error('[notifica] annullaPrenotazione fallita', e));

    return res.status(200).json({ message: 'Prenotazione annullata' });
  } catch (err) {
    return handleError(res, err, {
      message: 'annullaPrenotazione: errore interno',
      userId: req.user?.id,
      prenotazioneId: req.params.id,
    });
  }
}

async function getMiePrenotazioni(req, res) {
  try {
    const prenotazioni = await prenotazioniService.getMiePrenotazioni({
      userId: req.user.id,
      stato: req.query?.stato,
    });
    return res.status(200).json(prenotazioni);
  } catch (err) {
    return handleError(res, err, {
      message: 'getMiePrenotazioni: errore interno',
      userId: req.user?.id,
      stato: req.query?.stato,
    });
  }
}

async function getPrenotazione(req, res) {
  try {
    const prenotazione = await prenotazioniService.getPrenotazione({
      prenotazioneId: req.params.id,
      userId: req.user.id,
    });
    return res.status(200).json(prenotazione);
  } catch (err) {
    return handleError(res, err, {
      message: 'getPrenotazione: errore interno',
      userId: req.user?.id,
      prenotazioneId: req.params.id,
    });
  }
}

async function segnalaMancatoRitiro(req, res) {
  try {
    await prenotazioniService.segnalaMancatoRitiro({
      prenotazioneId: req.params.id,
      userId: req.user.id,
    });

    return res.status(200).json({ message: 'Mancato ritiro segnalato con successo' });
  } catch (err) {
    return handleError(res, err, {
      message: 'segnalaMancatoRitiro: errore interno',
      userId: req.user?.id,
      prenotazioneId: req.params.id,
    });
  }
}

async function disdiciPrenotazione(req, res) {
  try {
    const prenotazione = await prenotazioniService.disdiciPrenotazione({
      prenotazioneId: req.params.id,
      userId: req.user.id,
    });

    notificheService.creaNotifica(
      prenotazione.acquirente,
      'prenotazione',
      'Il donatore ha disdetto il ritiro',
      `/prenotazioni/${prenotazione._id}`
    ).catch((e) => console.error('[notifica] disdiciPrenotazione fallita', e));

    return res.status(200).json({ message: 'Ritiro disdetto' });
  } catch (err) {
    return handleError(res, err, {
      message: 'disdiciPrenotazione: errore interno',
      userId: req.user?.id,
      prenotazioneId: req.params.id,
    });
  }
}

module.exports = { creaPrenotazione, annullaPrenotazione, getMiePrenotazioni, getPrenotazione, segnalaMancatoRitiro, disdiciPrenotazione };
