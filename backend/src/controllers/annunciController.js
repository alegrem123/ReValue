const annunciService = require('../services/annunciService');

function sendControllerError(res, err) {
  if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
  if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
  return res.status(500).json({ error: 'Errore interno del server' });
}

async function getCatalogo(req, res) {
  try {
    const result = await annunciService.getCatalogo(req.query, req.user);
    return res.status(200).json(result);
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function getAnnuncio(req, res) {
  try {
    const annuncio = await annunciService.getAnnuncio(req.params.id, req.user);
    return res.status(200).json(annuncio);
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function creaAnnuncio(req, res) {
  try {
    const annuncio = await annunciService.creaAnnuncio(req.body, req.user);
    return res.status(201).json(annuncio);
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function modificaAnnuncio(req, res) {
  try {
    const annuncio = await annunciService.modificaAnnuncio(req.params.id, req.body, req.user);
    return res.status(200).json(annuncio);
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function cancellaAnnuncio(req, res) {
  try {
    const result = await annunciService.cancellaAnnuncio(req.params.id, req.user);
    return res.status(200).json(result);
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function cambiaStatoAnnuncio(req, res) {
  try {
    const annuncio = await annunciService.cambiaStatoAnnuncio(req.params.id, req.body?.stato, req.user);
    return res.status(200).json(annuncio);
  } catch (err) {
    return sendControllerError(res, err);
  }
}

async function getMieiAnnunci(req, res) {
  try {
    const annunci = await annunciService.getMieiAnnunci(req.user);
    return res.status(200).json(annunci);
  } catch (err) {
    return sendControllerError(res, err);
  }
}

module.exports = {
  getCatalogo,
  getAnnuncio,
  creaAnnuncio,
  modificaAnnuncio,
  cancellaAnnuncio,
  cambiaStatoAnnuncio,
  getMieiAnnunci,
};
