/**
 * Service per la gestione delle notifiche in-app (RF12).
 *
 * Stub iniziale — contratto definito da PS, implementazione completa a carico di AG.
 * Ogni funzione è già asincrona per compatibilità con future persistenze (DB)
 * o integrazioni push.
 */

/**
 * Crea una notifica per l'utente destinatario.
 *
 * @param {Object} params
 * @param {string} params.destinatario  — ObjectId dell'utente destinatario
 * @param {string} params.tipo          — tipo di notifica (es. 'nuovo_messaggio',
 *                                        'prenotazione', 'scambio_completato')
 * @param {string} params.messaggio     — testo descrittivo della notifica
 * @param {Object} [params.riferimento] — riferimento opzionale all'entità collegata
 * @param {string} [params.riferimento.tipo]  — es. 'conversazione', 'annuncio'
 * @param {string} [params.riferimento.id]    — ObjectId dell'entità
 * @returns {Promise<void>}
 */
async function creaNotifica({ destinatario, tipo, messaggio, riferimento = null }) {
  // TODO (AG): persistere la notifica nel DB e, se disponibile, inviare push
  // Per ora log a console in sviluppo per verificare l'hook di integrazione
  if (process.env.NODE_ENV !== 'test') {
    console.log(
      `[notificheService] creaNotifica → dest=${destinatario}, tipo=${tipo}, msg="${messaggio}"`,
      riferimento ? `rif=${riferimento.tipo}:${riferimento.id}` : ''
    );
  }
}

module.exports = { creaNotifica };
