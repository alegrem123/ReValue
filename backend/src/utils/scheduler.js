const Annuncio = require('../models/annuncioModel');
const Prenotazione = require('../models/prenotazioneModel');

const HOUR_MS = 60 * 60 * 1000;
const STARTUP_RETRY_MS = 5000;
const STARTUP_ATTEMPTS = 3;

async function expireAnnunciScaduti() {
  try {
    const now = new Date();

    const annunciPrenotati = await Annuncio.find(
      { isAttivo: true, stato: 'PRENOTATO', dataScadenza: { $lt: now } },
      { _id: 1 }
    ).lean();
    const idsPrenotati = annunciPrenotati.map((a) => a._id);

    const result = await Annuncio.updateMany(
      {
        isAttivo: true,
        stato: { $in: ['DISPONIBILE', 'PRENOTATO'] },
        dataScadenza: { $lt: now },
      },
      { $set: { stato: 'SCADUTO', isAttivo: false } }
    );

    if (idsPrenotati.length > 0) {
      await Prenotazione.updateMany(
        { annuncio: { $in: idsPrenotati }, stato: 'ATTIVA' },
        { $set: { stato: 'ANNULLATA' } }
      );
    }

    if (result.modifiedCount > 0) {
      if (process.env.NODE_ENV !== 'production') console.log(`Scheduler: ${result.modifiedCount} annunci scaduti aggiornati a SCADUTO`);
    }
  } catch (error) {
    console.error('Scheduler: errore durante l aggiornamento degli annunci scaduti:', error);
  }
}

function runStartupExpiryAttempts(attempt = 1) {
  expireAnnunciScaduti();

  if (attempt < STARTUP_ATTEMPTS) {
    setTimeout(() => runStartupExpiryAttempts(attempt + 1), STARTUP_RETRY_MS);
  }
}

function startExpiryScheduler() {
  // Esegue più tentativi al lancio per coprire cold start/connessione DB.
  runStartupExpiryAttempts();
  // Poi ripete ogni ora
  setInterval(expireAnnunciScaduti, HOUR_MS);
}

module.exports = {
  startExpiryScheduler,
  expireAnnunciScaduti,
};
