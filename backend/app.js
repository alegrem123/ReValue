const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { responseFormatter } = require('./src/middleware/responseFormatter');

const app = express();
const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || '10mb';

function buildCorsOrigin() {
  if (process.env.NODE_ENV !== 'production') return true;

  const allowedOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin non consentita da CORS'));
  };
}

// Middleware
app.use(
  cors({
    origin: buildCorsOrigin(),
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

const apiV1 = express.Router();

apiV1.use('/auth', authRoutes);
apiV1.use('/users', utentiRoutes);
apiV1.use('/annunci', annunciRoutes);
apiV1.use('/wallet', walletRoutes);
apiV1.use('/scambi', scambiRoutes);
apiV1.use('/messaggi', messaggiRoutes);
apiV1.use('/admin', adminRoutes);
apiV1.use('/prenotazioni', prenotazioniRoutes);
apiV1.use('/qr', qrRoutes);
apiV1.use('/conversazioni', chatRoutes);
apiV1.use('/recensioni', recensioniRoutes);
apiV1.use('/segnalazioni', segnalazioniRoutes);

app.use('/api/v1', apiV1);

app.use('/api', notFoundHandler);
app.use(errorHandler);

module.exports = app;
