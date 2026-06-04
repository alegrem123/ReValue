const mongoose = require('mongoose');

let mongoServer;
const isPlaceholderUri = (uri) =>
  !uri || uri.includes('<') || uri.includes('your-cluster-host');

mongoose.connection.on('error', (err) => {
  console.error('Errore connessione MongoDB:', err);
});

mongoose.connection.once('open', () => {
  if (process.env.NODE_ENV !== 'production') console.log('Connesso a MongoDB');
});

async function connectDB() {
  let uri = process.env.MONGODB_URI;

  if (isPlaceholderUri(uri) && process.env.NODE_ENV !== 'production') {
    const { MongoMemoryServer } = require('mongodb-memory-server');
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

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 10000,
    bufferCommands: false,
  });
}

async function stopDB() {
  if (mongoServer) {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

module.exports = { connectDB, stopDB };
