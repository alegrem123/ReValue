const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend statico da /frontend/
app.use(express.static(path.join(__dirname, '../frontend')));

const authRoutes = require('./src/routes/authRoutes');
const utentiRoutes = require('./src/routes/usersRoutes');
const annunciRoutes = require('./src/routes/annunciRoutes');
const walletRoutes = require('./src/routes/walletRoutes');
const scambiRoutes = require('./src/routes/scambiRoutes');
const messaggiRoutes = require('./src/routes/messaggiRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const prenotazioniRoutes = require('./src/routes/prenotazioniRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', utentiRoutes);
app.use('/api/annunci', annunciRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/scambi', scambiRoutes);
app.use('/api/messaggi', messaggiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/prenotazioni', prenotazioniRoutes);

module.exports = app;
