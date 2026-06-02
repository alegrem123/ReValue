const { loginUser, registerUser } = require('../services/authService');
const emailService = require('../services/emailService');

async function register(req, res) {
  try {
    const result = await registerUser(req.body);
    emailService.sendWelcome(result.user).catch(() => {});
    return res.status(201).json(result);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email già registrata' });
    }
    const status = err.statusCode || 500;
    return res.status(status).json({ error: status < 500 ? err.message : 'Errore interno del server' });
  }
}

async function login(req, res) {
  try {
    const result = await loginUser(req.body);
    return res.status(200).json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: status < 500 ? err.message : 'Errore interno del server' });
  }
}

async function logout(_req, res) {
  return res.status(200).json({ message: 'Logout effettuato' });
}

module.exports = { register, login, logout };
