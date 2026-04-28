require('dotenv').config(); // must be first — loads .env before any other module reads process.env

const app = require('./app');
const { connectDB } = require('./src/db');

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Connessione DB fallita:', err);
    process.exit(1);
  });
