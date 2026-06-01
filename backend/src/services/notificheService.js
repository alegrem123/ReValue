const Notifica = require('../models/notificaModel');
const User = require('../models/userModel');

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

function normalizzaTipo(tipo) {
  if (tipo === 'nuovo_messaggio') return 'messaggio';
  return tipo;
}

function linkDaRiferimento(riferimento) {
  if (!riferimento?.tipo || !riferimento?.id) return null;
  if (riferimento.tipo === 'conversazione') return `/chat/${riferimento.id}`;
  return `/${riferimento.tipo}/${riferimento.id}`;
}

function normalizzaPayload(idUtenteOrPayload, tipo, testo, link, options) {
  if (
    idUtenteOrPayload &&
    typeof idUtenteOrPayload === 'object' &&
    !idUtenteOrPayload._bsontype
  ) {
    const {
      destinatario,
      tipo: tipoPayload,
      messaggio,
      riferimento = null,
      link: linkPayload = null,
      options: optionsPayload = {},
    } = idUtenteOrPayload;

    return {
      idUtente: destinatario,
      tipo: normalizzaTipo(tipoPayload),
      testo: messaggio,
      link: linkPayload || linkDaRiferimento(riferimento),
      options: optionsPayload,
    };
  }

  return {
    idUtente: idUtenteOrPayload,
    tipo: normalizzaTipo(tipo),
    testo,
    link,
    options,
  };
}

async function creaNotifica(idUtenteOrPayload, tipo, testo, link = null, options = {}) {
  const payload = normalizzaPayload(idUtenteOrPayload, tipo, testo, link, options);
  const { session = null } = payload.options || {};

  const notifica = new Notifica({
    utente: payload.idUtente,
    tipo: payload.tipo,
    testo: payload.testo,
    link: payload.link,
  });

  const saved = await notifica.save({ session });
  sendExpoPushIfConfigured(payload.idUtente, payload.testo).catch(() => {});
  return saved;
}

async function sendExpoPushIfConfigured(idUtente, testo) {
  if (!global.fetch) return;
  const user = await User.findById(idUtente).select('expoPushToken').lean();
  if (!user?.expoPushToken) return;

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: user.expoPushToken,
      sound: 'default',
      title: 'RE-VALUE',
      body: testo,
    }),
  });
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
  sendExpoPushIfConfigured,
};
