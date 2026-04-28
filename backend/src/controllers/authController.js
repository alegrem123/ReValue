const User = require('../models/userModel');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const { creaWallet } = require('../services/walletService');

async function register(req, res) {
  try {
    const { nome, cognome, email, password } = req.body;

    if (!nome || !cognome || !email || !password) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }

    const esistente = await User.findOne({ email: email.toLowerCase() });
    if (esistente) {
      return res.status(409).json({ error: 'Email già registrata' });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({ nome, cognome, email, passwordHash, ruolo: 'user' });

    // crea wallet vuoto collegato all'utente (D2 §2.2.3: composizione 1→1)
    await creaWallet(user._id);

    const token = signToken({ id: user._id, ruolo: user.ruolo });
    return res.status(201).json({ token });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email già registrata' });
    }
    return res.status(500).json({ error: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password obbligatorie' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    // OCL #3: utente sospeso non può accedere
    if (user.isSospeso) {
      return res.status(403).json({ error: 'Account sospeso' });
    }

    const valida = await comparePassword(password, user.passwordHash);
    if (!valida) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const token = signToken({ id: user._id, ruolo: user.ruolo });
    return res.status(200).json({ token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { register, login };
