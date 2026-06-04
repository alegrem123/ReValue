const mongoose = require('mongoose');
const User = require('../models/userModel');
const Recensione = require('../models/recensioneModel');

function sanitizePublicProfile(user) {
  if (!user) return null;
  const {
    idUtente,
    nome,
    cognome,
    citta,
    descrizione,
    createdAt,
  } = user;

  return {
    idUtente,
    nome,
    cognome,
    citta,
    descrizione,
    createdAt,
  };
}

function sanitizePrivateProfile(user) {
  if (!user) return null;
  return {
    idUtente: user.idUtente,
    nome: user.nome,
    cognome: user.cognome,
    email: user.email,
    ruolo: user.ruolo,
    malusCount: user.malusCount,
    isSospeso: user.isSospeso,
    telefono: user.telefono,
    citta: user.citta,
    descrizione: user.descrizione,
    saldo: user.saldo,
    createdAt: user.createdAt,
  };
}

function buildUpdatePayload(body) {
  const allowedFields = ['nome', 'cognome', 'telefono', 'citta', 'descrizione'];
  return allowedFields.reduce((acc, field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      acc[field] =
        typeof body[field] === 'string' ? body[field].trim() : body[field];
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
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    return res.status(200).json({ user: sanitizePrivateProfile(user) });
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
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

    const [conteggi, recentReviews] = await Promise.all([
      Recensione.aggregate([
        { $match: { recensito: user._id } },
        {
          $group: {
            _id: null,
            positive: { $sum: { $cond: ['$positiva', 1, 0] } },
            negative: { $sum: { $cond: ['$positiva', 0, 1] } },
          },
        },
      ]),
      Recensione.find({ recensito: user._id })
        .sort({ data: -1 })
        .limit(5)
        .populate('recensore', 'nome cognome'),
    ]);
    const { positive = 0, negative = 0 } = conteggi[0] || {};

    return res.status(200).json({
      user: sanitizePublicProfile(user),
      recensioni: {
        positive,
        negative,
        totale: positive + negative,
        recenti: recentReviews.map((review) => ({
          id: review._id,
          positiva: review.positiva,
          testo: review.testo,
          data: review.data,
          recensore: review.recensore
            ? {
                nome: review.recensore.nome,
                cognome: review.recensore.cognome,
              }
            : null,
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

async function updatePushToken(req, res) {
  try {
    const { expoPushToken } = req.body || {};
    if (
      typeof expoPushToken !== 'string' ||
      !/^ExponentPushToken\[[A-Za-z0-9_-]+\]$|^ExpoPushToken\[[A-Za-z0-9_-]+\]$/.test(expoPushToken.trim())
    ) {
      return res.status(400).json({ error: 'expoPushToken non valido' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { expoPushToken: expoPushToken.trim() },
      { new: true, runValidators: true }
    );

    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    return res.status(200).json({ user: sanitizePublicProfile(user) });
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

module.exports = {
  updateProfile,
  updatePushToken,
  getPublicProfile,
  getMe,
};
