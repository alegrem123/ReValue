const Annuncio = require('../models/annuncioModel');

const HOUR_MS = 60 * 60 * 1000;

/**
 * Aggiorna gli annunci scaduti e li marca come SCADUTO.
 * Viene eseguito sia all'avvio che periodicamente ogni ora.
 */
async function expireAnnunciScaduti() {
  try {
    const now = new Date();
    const result = await Annuncio.updateMany(
      {
        isAttivo: true,
        stato: { $in: ['DISPONIBILE', 'PRENOTATO'] },
        dataScadenza: { $lt: now },
      },
      { $set: { stato: 'SCADUTO' } }
    );

    if (result.modifiedCount > 0) {
      if (process.env.NODE_ENV !== 'production') console.error(`Scheduler: ${result.modifiedCount} annunci scaduti aggiornati a SCADUTO`);
    }
  } catch (error) {
    console.error('Scheduler: errore durante l aggiornamento degli annunci scaduti:', error);
  }
}

function startExpiryScheduler() {
  // Esegue subito al lancio
  expireAnnunciScaduti();
  // Poi ripete ogni ora
  setInterval(expireAnnunciScaduti, HOUR_MS);
}

module.exports = {
  startExpiryScheduler,
  expireAnnunciScaduti,
};
