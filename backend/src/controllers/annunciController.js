const annunciService = require('../services/annunciService');

async function getCatalogo(req, res, next) {
  try {
    const result = await annunciService.getCatalogo(req.query, req.user);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getAnnuncio(req, res, next) {
  try {
    const annuncio = await annunciService.getAnnuncio(req.params.id, req.user);
    return res.status(200).json(annuncio);
  } catch (err) {
    return next(err);
  }
}

async function creaAnnuncio(req, res, next) {
  try {
    const annuncio = await annunciService.creaAnnuncio(req.body, req.user);
    return res.status(201).json(annuncio);
  } catch (err) {
    return next(err);
  }
}

async function modificaAnnuncio(req, res, next) {
  try {
    const annuncio = await annunciService.modificaAnnuncio(req.params.id, req.body, req.user);
    return res.status(200).json(annuncio);
  } catch (err) {
    return next(err);
  }
}

async function cancellaAnnuncio(req, res, next) {
  try {
    const result = await annunciService.cancellaAnnuncio(req.params.id, req.user);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function cambiaStatoAnnuncio(req, res, next) {
  try {
    const annuncio = await annunciService.cambiaStatoAnnuncio(req.params.id, req.body?.stato, req.user);
    return res.status(200).json(annuncio);
  } catch (err) {
    return next(err);
  }
}

async function getMieiAnnunci(req, res, next) {
  try {
    const annunci = await annunciService.getMieiAnnunci(req.user);
    return res.status(200).json(annunci);
  } catch (err) {
    return next(err);
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
