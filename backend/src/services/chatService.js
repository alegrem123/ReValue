const Conversazione = require('../models/conversazioneModel');

/**
 * Crea una nuova conversazione legata a una prenotazione.
 * Chiamata da PS (prenotazioniController) al momento della prenotazione.
 *
 * @param {ObjectId} idPrenotazione
 * @param {[ObjectId, ObjectId]} partecipanti  — [idDonatore, idAcquirente]
 * @returns {Promise<Conversazione>}
 */
async function creaConversazione(idPrenotazione, partecipanti) {
  const conversazione = await Conversazione.create({
    prenotazione: idPrenotazione,
    partecipanti,
  });
  return conversazione;
}

/**
 * Recupera la conversazione di una prenotazione.
 *
 * @param {ObjectId} idPrenotazione
 * @returns {Promise<Conversazione|null>}
 */
async function getConversazioneByPrenotazione(idPrenotazione) {
  return Conversazione.findOne({ prenotazione: idPrenotazione });
}

module.exports = { creaConversazione, getConversazioneByPrenotazione };
