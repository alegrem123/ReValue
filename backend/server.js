const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') }); // must be first — loads .env from backend folder

const app = require('./app');
const { connectDB } = require('./src/db');
const { startExpiryScheduler } = require('./src/utils/scheduler');

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    startExpiryScheduler();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Connessione DB fallita:', err);
    process.exit(1);
  });
