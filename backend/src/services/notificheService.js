const Notifica = require('../models/notificaModel');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function normalizzaPaginazione(page = 1, limit = DEFAULT_LIMIT) {
  const pagina = Math.max(parseInt(page, 10) || 1, 1);
  const limiteRichiesto = Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1);
  const limite = Math.min(limiteRichiesto, MAX_LIMIT);

  return {
    page: pagina,
    limit: limite,
    skip: (pagina - 1) * limite,
  };
}

async function creaNotifica(idUtente, tipo, testo, link = null, options = {}) {
  const { session = null } = options;
  const notifica = new Notifica({
    utente: idUtente,
    tipo,
    testo,
    link,
  });

  return notifica.save({ session });
}

async function getNotifiche(idUtente, page = 1, options = {}) {
  const { limit = DEFAULT_LIMIT, letta = undefined } = options;
  const { page: pagina, limit: limite, skip } = normalizzaPaginazione(page, limit);
  const filtro = { utente: idUtente };

  if (typeof letta === 'boolean') {
    filtro.letta = letta;
  }

  const [notifiche, totale] = await Promise.all([
    Notifica.find(filtro).sort({ data: -1 }).skip(skip).limit(limite),
    Notifica.countDocuments(filtro),
  ]);

  return {
    notifiche,
    pagination: {
      page: pagina,
      limit: limite,
      total: totale,
      pages: Math.ceil(totale / limite),
    },
  };
}

async function contaNonLette(idUtente) {
  return Notifica.countDocuments({ utente: idUtente, letta: false });
}

async function marcaLetta(idUtente, idNotifica) {
  const notifica = await Notifica.findOneAndUpdate(
    { _id: idNotifica, utente: idUtente },
    { $set: { letta: true } },
    { new: true }
  );

  if (!notifica) {
    const err = new Error('Notifica non trovata');
    err.statusCode = 404;
    throw err;
  }

  return notifica;
}

async function marcaTutteLette(idUtente) {
  const result = await Notifica.updateMany(
    { utente: idUtente, letta: false },
    { $set: { letta: true } }
  );

  return result.modifiedCount || 0;
}

module.exports = {
  creaNotifica,
  getNotifiche,
  contaNonLette,
  marcaLetta,
  marcaTutteLette,
};
