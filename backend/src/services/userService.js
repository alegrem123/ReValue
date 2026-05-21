const User = require('../models/userModel');

// OCL #20 — malusCount >= 5 → auto-sospensione (operazione atomica)
async function applicaMalus(idUtente, _motivo) {
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
    { new: true }
  );

  if (!user) throw new Error('Utente non trovato');
  return user;
}

module.exports = { applicaMalus };
