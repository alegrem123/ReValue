const adminService = require('../services/adminService');

function sendControllerError(res, err) {
  const status = err.statusCode || 500;
  const message = status === 500 ? 'Errore interno del server' : err.message;
  if (status === 500) console.error('[adminController]', err);
  return res.status(status).json({
    ok: false,
    error: status === 500 ? 'INTERNAL_ERROR' : message,
    message,
  });
}

async function getStatistiche(req, res) {
  try {
    return res.status(200).json(await adminService.getStatistiche());
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function listUsers(req, res) {
  try {
    return res.status(200).json(await adminService.listUsers(req.query));
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function listAnnunci(req, res) {
  try {
    return res.status(200).json(await adminService.listAnnunci(req.query));
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function getSegnalazioni(req, res) {
  try {
    return res.status(200).json(await adminService.getSegnalazioni());
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function applicaMalusSegnalazione(req, res) {
  try {
    return res.status(200).json(await adminService.applicaMalusSegnalazione(req.params.id));
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function bannaUtente(req, res) {
  try {
    return res.status(200).json(await adminService.bannaUtente(req.params.id));
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function sospendiUtente(req, res) {
  try {
    return res.status(200).json(await adminService.sospendiUtente(req.params.id));
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function riabilitaUtente(req, res) {
  try {
    return res.status(200).json(await adminService.riabilitaUtente(req.params.id));
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function forzaStatoAnnuncio(req, res) {
  try {
    return res.status(200).json(await adminService.forzaStatoAnnuncio(req.params.id, req.body?.stato));
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function rimuoviAnnuncio(req, res) {
  try {
    await adminService.rimuoviAnnuncio(req.params.id);
    return res.status(204).send();
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function listCoupon(req, res) {
  try {
    return res.status(200).json(await adminService.listCoupon(req.query));
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function creaCoupon(req, res) {
  try {
    return res.status(201).json(await adminService.creaCoupon(req.body));
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function aggiornaCoupon(req, res) {
  try {
    return res.status(200).json(await adminService.aggiornaCoupon(req.params.id, req.body));
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function disattivaCoupon(req, res) {
  try {
    return res.status(200).json(await adminService.disattivaCoupon(req.params.id));
  } catch (err) {
    return sendControllerError(res, err);
  }
}

module.exports = {
  getStatistiche,
  listUsers,
  listAnnunci,
  getSegnalazioni,
  applicaMalusSegnalazione,
  bannaUtente,
  sospendiUtente,
  riabilitaUtente,
  forzaStatoAnnuncio,
  rimuoviAnnuncio,
  listCoupon,
  creaCoupon,
  aggiornaCoupon,
  disattivaCoupon,
};
