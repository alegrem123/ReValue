require('dotenv').config(); // must be first — loads .env before any other module reads process.env

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
