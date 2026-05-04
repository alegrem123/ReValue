const mongoose = require('mongoose');
const User = require('../models/userModel');

function sanitizePublicProfile(user) {
  if (!user) return null;
  const {
    idUtente,
    nome,
    cognome,
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
    malusCount,
    isSospeso,
    ruolo,
    telefono,
    citta,
    descrizione,
    createdAt,
  };
}

function buildUpdatePayload(body) {
  const allowedFields = ['nome', 'cognome', 'telefono', 'citta', 'descrizione'];
  return allowedFields.reduce((acc, field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      acc[field] = typeof body[field] === 'string' ? body[field].trim() : body[field];
    }
    return acc;
  }, {});
}

async function updateProfile(req, res) {
  try {
    const updates = buildUpdatePayload(req.body);
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nessun campo aggiornato' });
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    return res.status(200).json({ user: sanitizePublicProfile(user) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getPublicProfile(req, res) {
  try {
    const { id } = req.params;
    let user = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      user = await User.findById(id);
    }

    if (!user) {
      user = await User.findOne({ idUtente: id });
    }

    if (!user) {
      return res.status(404).json({ error: 'Profilo utente non trovato' });
    }

    return res.status(200).json({ user: sanitizePublicProfile(user) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  updateProfile,
  getPublicProfile,
};
