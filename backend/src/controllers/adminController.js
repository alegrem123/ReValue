const adminService = require('../services/adminService');

function sendControllerError(res, err) {
  if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
  return res.status(500).json({ error: 'Errore interno del server' });
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
};
