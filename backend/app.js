const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

const app = express();
const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || '10mb';
const corsOrigin =
  process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL || '').split(',').map((origin) => origin.trim()).filter(Boolean)
    : true;

// Middleware
app.use(
  cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));

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
const premiRoutes = require('./src/routes/premiRoutes');
const segnalazioniRoutes = require('./src/routes/segnalazioniRoutes');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', utentiRoutes);
app.use('/api/v1/annunci', annunciRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/scambi', scambiRoutes);
app.use('/api/v1/messaggi', messaggiRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/prenotazioni', prenotazioniRoutes);
app.use('/api/v1/qr', qrRoutes);
app.use('/api/v1/conversazioni', chatRoutes);
app.use('/api/v1/premi', premiRoutes);
app.use('/api/v1/segnalazioni', segnalazioniRoutes);

app.use('/api/v1', notFoundHandler);
app.use(errorHandler);

module.exports = app;
