const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { responseFormatter } = require('./src/middleware/responseFormatter');

const app = express();
const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || '10mb';

// Middleware
app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));
app.use(responseFormatter);

if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

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
const qrRoutes = require('./src/routes/qrRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const recensioniRoutes = require('./src/routes/recensioniRoutes');
const segnalazioniRoutes = require('./src/routes/segnalazioniRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', utentiRoutes);
app.use('/api/annunci', annunciRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/scambi', scambiRoutes);
app.use('/api/messaggi', messaggiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/prenotazioni', prenotazioniRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/conversazioni', chatRoutes);
app.use('/api/recensioni', recensioniRoutes);
app.use('/api/segnalazioni', segnalazioniRoutes);

app.use('/api', notFoundHandler);
app.use(errorHandler);

module.exports = app;
