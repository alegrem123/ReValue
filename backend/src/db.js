const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
const MONGODB_URI = process.env.MONGODB_URI;
const isPlaceholderUri = (uri) =>
  !uri || uri.includes('<') || uri.includes('your-cluster-host');

mongoose.connection.on('error', (err) => {
  console.error('Errore connessione MongoDB:', err);
});

mongoose.connection.once('open', () => {
  console.log('Connesso a MongoDB');
});

async function connectDB() {
  let uri = MONGODB_URI;

  if (isPlaceholderUri(uri) && process.env.NODE_ENV !== 'production') {
    console.warn(
      'MONGODB_URI non valida o placeholder rilevato, avvio MongoDB in memoria per lo sviluppo.'
    );
    mongoServer = await MongoMemoryServer.create();
    uri = mongoServer.getUri();
  }

  if (!uri) {
    throw new Error(
      'MONGODB_URI non definita nel file .env e nessun fallback disponibile.'
    );
  }

  await mongoose.connect(uri);
}

async function stopDB() {
  if (mongoServer) {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

module.exports = { connectDB, stopDB };
