const { ObjectId } = require('mongojs');

/**
 * walletModel.js
 * Espone la collection 'wallets' e la funzione ensureIndexes.
 *
 * Schema wallet:
 *   - idUtente   : ObjectId (unique, FK users)
 *   - bilancio   : Number, default 0, mai negativo (OCL #15)
 *   - transazioni: Array di sub-documenti embedded
 *   - createdAt  : Date
 *
 * Schema transazione (embedded):
 *   - _id        : ObjectId
 *   - tipo       : 'accredito' | 'sottrazione'
 *   - ammontare  : Number > 0
 *   - motivo     : String
 *   - riferimento: ObjectId (opzionale, FK prenotazione/riscatto)
 *   - data       : Date
 */

/**
 * Crea un ObjectId per le transazioni embedded.
 */
function newObjectId() {
  return new ObjectId();
}

/**
 * Restituisce la collection 'wallets' dal db mongojs passato.
 * @param {Object} db - istanza mongojs
 */
function getCollection(db) {
  return db.collection('wallets');
}

/**
 * Crea gli indici necessari sulla collection wallets.
 * - unique su idUtente
 * - su transazioni.data (per ordinare lo storico)
 * @param {Object} db - istanza mongojs
 */
async function ensureIndexes(db) {
  const wallets = getCollection(db);
  return Promise.all([
    wallets.createIndex({ idUtente: 1 }, { unique: true }),
    wallets.createIndex({ 'transazioni.data': 1 }),
  ]);
}

/**
 * Costruisce un documento wallet vuoto pronto per l'insert.
 * @param {ObjectId} idUtente
 */
function buildWalletDoc(idUtente) {
  // OCL: bilancio inizia a 0, non può mai diventare negativo
  return {
    idUtente: typeof idUtente === 'string' ? new ObjectId(idUtente) : idUtente,
    bilancio: 0,
    transazioni: [],
    createdAt: new Date(),
  };
}

/**
 * Costruisce un sub-documento transazione embedded.
 * @param {'accredito'|'sottrazione'} tipo
 * @param {Number} ammontare  - deve essere > 0
 * @param {String} motivo
 * @param {ObjectId|null} riferimento - opzionale
 */
function buildTransazioneDoc(tipo, ammontare, motivo, riferimento = null) {
  if (!['accredito', 'sottrazione'].includes(tipo)) {
    throw new Error(`Tipo transazione non valido: ${tipo}`);
  }
  if (ammontare <= 0) {
    throw new Error('ammontare deve essere > 0');
  }

  const doc = {
    _id: newObjectId(),
    tipo,
    ammontare,
    motivo: motivo || '',
    data: new Date(),
  };

  if (riferimento) {
    doc.riferimento =
      typeof riferimento === 'string' ? new ObjectId(riferimento) : riferimento;
  }

  return doc;
}

module.exports = {
  getCollection,
  ensureIndexes,
  buildWalletDoc,
  buildTransazioneDoc,
  newObjectId,
};
