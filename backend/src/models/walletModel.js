const { ObjectId } = require('mongojs');

/**
 * walletModel.js
 * Espone la collection 'wallets' e le funzioni per gestire wallet e transazioni.
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

/** Genera un nuovo ObjectId per i sub-documenti transazione. */
function newObjectId() {
  return new ObjectId();
}

/**
 * Restituisce la collection 'wallets' dall'istanza mongojs.
 * @param {Object} db - istanza mongojs
 * @returns {Object} collection mongojs
 */
function getCollection(db) {
  return db.collection('wallets');
}

/**
 * Crea gli indici sulla collection wallets.
 * - unique su idUtente: garantisce un wallet per utente
 * - su transazioni.data: ottimizza le query sullo storico
 *
 * mongojs è callback-based: ogni createIndex viene wrappato in una Promise
 * prima di passarlo a Promise.all, altrimenti gli indici non verrebbero creati.
 *
 * @param {Object} db - istanza mongojs
 * @returns {Promise<Array>}
 */
async function ensureIndexes(db) {
  const wallets = getCollection(db);
  const toPromise = (fn) => new Promise((res, rej) => fn((err, r) => err ? rej(err) : res(r)));
  return Promise.all([
    toPromise(cb => wallets.createIndex({ idUtente: 1 }, { unique: true }, cb)),
    toPromise(cb => wallets.createIndex({ 'transazioni.data': 1 }, {}, cb)),
  ]);
}

/**
 * Costruisce un documento wallet vuoto pronto per l'insert.
 * bilancio parte da 0 e non può mai diventare negativo (OCL #15).
 * @param {string|ObjectId} idUtente
 * @returns {Object}
 */
function buildWalletDoc(idUtente) {
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
 * @param {number} ammontare - deve essere > 0
 * @param {string} motivo
 * @param {string|ObjectId|null} riferimento - opzionale
 * @returns {Object}
 * @throws {Error} se tipo non valido o ammontare <= 0
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
    motivo: String(motivo ?? ''),
    data: new Date(),
  };
  if (riferimento) {
    doc.riferimento = typeof riferimento === 'string' ? new ObjectId(riferimento) : riferimento;
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
