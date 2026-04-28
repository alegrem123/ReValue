const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI non definita nel file .env');
}

mongoose.connection.on('error', (err) => {
  console.error('Errore connessione MongoDB:', err);
});

mongoose.connection.once('open', () => {
  console.log('Connesso a MongoDB Atlas');
});

async function connectDB() {
  await mongoose.connect(MONGODB_URI);
}

module.exports = { connectDB };
