const mongoose = require('mongoose');
const User = require('../models/userModel');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const { creaWallet } = require('../services/walletService');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function sanitizeUser(user) {
  if (!user) return null;
  const {
    idUtente,
    nome,
    cognome,
    email,
    malusCount,
    isSospeso,
    ruolo,
    telefono,
    citta,
    descrizione,
    createdAt,
  } = user;

  return {
    idUtente,
    nome,
    cognome,
    email,
    malusCount,
    isSospeso,
    ruolo,
    telefono,
    citta,
    descrizione,
    createdAt,
  };
}

async function register(req, res) {
  try {
    const { nome, cognome, email, password } = req.body;

    if (!nome || !cognome || !email || !password) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Formato email non valido' });
    }

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({
          error: `La password deve contenere almeno ${MIN_PASSWORD_LENGTH} caratteri`,
        });
    }

    const esistente = await User.findOne({ email: email.toLowerCase() });
    if (esistente) {
      return res.status(409).json({ error: 'Email già registrata' });
    }

    const passwordHash = await hashPassword(password);
    const idUtente = new mongoose.Types.ObjectId().toString();
    const user = await User.create({
      idUtente,
      nome,
      cognome,
      email: email.toLowerCase(),
      passwordHash,
      ruolo: 'user',
    });

    // crea wallet vuoto collegato all'utente (D2 §2.2.3: composizione 1→1)
    await creaWallet(user._id);

    const token = signToken({
      id: user._id,
      ruolo: user.ruolo,
      nome: user.nome,
    });
    return res.status(201).json({ token, user: sanitizeUser(user) });
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

    if (user.isSospeso) {
      return res.status(403).json({ error: 'Account sospeso' });
    }

    const valida = await comparePassword(password, user.passwordHash);
    if (!valida) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const token = signToken({
      id: user._id,
      ruolo: user.ruolo,
      nome: user.nome,
    });
    return res.status(200).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function logout(_req, res) {
  return res.status(200).json({ message: 'Logout effettuato' });
}

module.exports = { register, login, logout };
