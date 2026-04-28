const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route di test
app.get('/', (req, res) => {
  res.json({ message: 'Server running' });
});

module.exports = app;
