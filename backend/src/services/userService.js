const User = require('../models/userModel');

// OCL #20 — malusCount >= 5 → auto-sospensione (operazione atomica)
async function applicaMalus(idUtente, { session } = {}) {
  const opts = { new: true, ...(session ? { session } : {}) };
  const user = await User.findByIdAndUpdate(
    idUtente,
    [
      {
        $set: {
          malusCount: { $add: ['$malusCount', 1] },
          isSospeso: {
            $or: [
              '$isSospeso',
              { $gte: [{ $add: ['$malusCount', 1] }, 5] },
            ],
          },
        },
      },
    ],
    opts
  );

  if (!user) throw new Error('Utente non trovato');
  return user;
}

module.exports = { applicaMalus };
