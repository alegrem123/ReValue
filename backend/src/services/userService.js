const User = require('../models/userModel');

// OCL #20 — malusCount >= 3 → auto-sospensione (operazione atomica)
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
              { $gte: [{ $add: ['$malusCount', 1] }, 3] },
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
