const mongoose = require('mongoose');
const User = require('../models/userModel');
const { hashPassword, comparePassword, isLegacySha256Hash } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const { creaWallet, addPunti } = require('./walletService');

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

function createAuthError(statusCode, message, code = 'AUTH_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function buildAuthResponse(user) {
  const token = signToken({
    id: user._id,
    ruolo: user.ruolo,
    nome: user.nome,
  });

  return { token, user: sanitizeUser(user) };
}

async function registerUser({ nome, cognome, email, password }) {
  if (!nome || !cognome || !email || !password) {
    throw createAuthError(400, 'Campi obbligatori mancanti', 'REQUIRED_FIELDS');
  }

  // OCL #1: email deve rispettare il formato previsto dal dominio applicativo.
  if (!emailRegex.test(email)) {
    throw createAuthError(400, 'Formato email non valido', 'INVALID_EMAIL');
  }

  // OCL #2: password lunga almeno 8 caratteri prima dell'hashing SHA-256.
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw createAuthError(
      400,
      `La password deve contenere almeno ${MIN_PASSWORD_LENGTH} caratteri`,
      'INVALID_PASSWORD'
    );
  }

  const normalizedEmail = email.toLowerCase();
  const esistente = await User.findOne({ email: normalizedEmail });
  if (esistente) {
    throw createAuthError(409, 'Email già registrata', 'EMAIL_ALREADY_EXISTS');
  }

  const passwordHash = await hashPassword(password);
  const idUtente = new mongoose.Types.ObjectId().toString();
  const user = await User.create({
    idUtente,
    nome,
    cognome,
    email: normalizedEmail,
    passwordHash,
    ruolo: 'user',
  });

  await creaWallet(user._id);
  await addPunti(user._id.toString(), 10, 'Bonus benvenuto');

  return buildAuthResponse(user);
}

async function loginUser({ email, password }) {
  if (!email || !password) {
    throw createAuthError(400, 'Email e password obbligatorie', 'REQUIRED_CREDENTIALS');
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw createAuthError(401, 'Credenziali non valide', 'INVALID_CREDENTIALS');
  }

  if (user.bannato) {
    throw createAuthError(403, 'Account bannato', 'ACCOUNT_BANNED');
  }

  if (user.isSospeso) {
    throw createAuthError(403, 'Account sospeso', 'ACCOUNT_SUSPENDED');
  }

  const valida = await comparePassword(password, user.passwordHash);
  if (!valida) {
    throw createAuthError(401, 'Credenziali non valide', 'INVALID_CREDENTIALS');
  }

  if (isLegacySha256Hash(user.passwordHash)) {
    user.passwordHash = await hashPassword(password);
    await user.save();
  }

  return buildAuthResponse(user);
}

module.exports = {
  loginUser,
  registerUser,
  sanitizeUser,
};
