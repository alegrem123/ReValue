const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { authLimiter } = require('./src/middleware/rateLimitMiddleware');

const app = express();
app.set('trust proxy', 1);
const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || '10mb';
const corsOrigin =
  process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL || '').split(',').map((origin) => origin.trim()).filter(Boolean)
    : true;
const swaggerDocument = yaml.load(fs.readFileSync(path.join(__dirname, '../oas3.yaml'), 'utf8'));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Security middleware (RNF4/RNF10) — skip in test to avoid interfering with supertest
if (process.env.NODE_ENV !== 'test') {
  app.use(helmet());
}

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

// mongoSanitize dopo i body parser — altrimenti il body JSON non è ancora parsato (RNF4)
// Express 5: req.query è un getter read-only, il middleware non può scriverci.
// Sanitizziamo body e params inline, skippiamo query (Express 5 la parsa già safe).
if (process.env.NODE_ENV !== 'test') {
  app.use((req, _res, next) => {
    mongoSanitize.sanitize(req.body);
    mongoSanitize.sanitize(req.params);
    next();
  });
}

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
const recensioniRoutes = require('./src/routes/recensioniRoutes');
const notificheRoutes = require('./src/routes/notificheRoutes');
const supportoRoutes = require('./src/routes/supportoRoutes');

app.use('/api/v1/auth', authLimiter, authRoutes);
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
app.use('/api/v1/recensioni', recensioniRoutes);
app.use('/api/v1/notifiche', notificheRoutes);
app.use('/api/v1/supporto', supportoRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
