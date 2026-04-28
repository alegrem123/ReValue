/**
 * db.js
 * Gestisce la connessione a MongoDB tramite mongojs.
 * Esporta una singola istanza condivisa del DB tramite helper getDb().
 */

const mongojs = require('mongojs');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI non definita nel file .env');
}

const db = mongojs(MONGODB_URI);

db.on('error', (err) => {
  console.error('Errore connessione MongoDB:', err);
});

db.on('connect', () => {
  console.log('Connesso a MongoDB Atlas');
});

/**
 * Restituisce l'istanza condivisa del database MongoDB.
 * @returns {Object} Istanza del database mongojs connessa.
 */
function getDb() {
  return db;
}

module.exports = { getDb };

