const User = require('../models/userModel');

// OCL #20 — malusCount >= 5 → auto-sospensione
async function applicaMalus(idUtente, motivo) {
  const user = await User.findByIdAndUpdate(
    idUtente,
    { $inc: { malusCount: 1 } },
    { new: true }
  );

  if (!user) throw new Error('Utente non trovato');

  if (user.malusCount >= 5 && !user.isSospeso) {
    user.isSospeso = true;
    await user.save();
  }

  return user;
}

module.exports = { applicaMalus };
