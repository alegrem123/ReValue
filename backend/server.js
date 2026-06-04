const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') }); // must be first — loads .env from backend folder

const app = require('./app');
const { connectDB } = require('./src/db');
const { startExpiryScheduler } = require('./src/utils/scheduler');

const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET non configurato');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('FATAL: MONGODB_URI non configurato');
  process.exit(1);
}

connectDB()
  .then(() => {
    startExpiryScheduler();
    app.listen(PORT, () => {
      if (process.env.NODE_ENV !== 'production') console.error(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Connessione DB fallita:', err);
    process.exit(1);
  });
