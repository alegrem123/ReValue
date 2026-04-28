const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authRoutes = require('./src/routes/authRoutes');

app.use('/api/auth', authRoutes);

app.get('/', (_req, res) => {
  res.json({ message: 'Server running' });
});

module.exports = app;
