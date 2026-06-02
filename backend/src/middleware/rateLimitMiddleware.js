const { rateLimit } = require('express-rate-limit');

function testKeyGenerator(req) {
  const email = req.body && typeof req.body.email === 'string' ? req.body.email : 'anon';
  return `${req.method}:${req.originalUrl}:${email.toLowerCase()}`;
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: process.env.NODE_ENV === 'test' ? testKeyGenerator : undefined,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Troppi tentativi di autenticazione. Riprova più tardi.',
    });
  },
});

module.exports = { authLimiter, testKeyGenerator };
