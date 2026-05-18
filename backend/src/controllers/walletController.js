const { getSaldo, getStorico } = require('../services/walletService');

/**
 * Applica filtri e paginazione all'array di transazioni.
 *
 * @param {Array}  transazioni - Array raw dal DB
 * @param {object} query       - Query params: tipo, from, to, page, limit
 * @returns {{ data: Array, totale: number, pagina: number, totalePagine: number }}
 */
function filtraEPagina(transazioni, query) {
  const { tipo, from, to, page = 1, limit = 20 } = query;

  let risultati = [...transazioni].sort((a, b) => b.data - a.data);

  // filtro tipo: 'accredito' | 'sottrazione'
  if (tipo) {
    risultati = risultati.filter((t) => t.tipo === tipo);
  }

  // filtro intervallo data
  if (from) {
    const dal = new Date(from);
    risultati = risultati.filter((t) => t.data >= dal);
  }
  if (to) {
    const al = new Date(to);
    risultati = risultati.filter((t) => t.data <= al);
  }

  const totale = risultati.length;
  const pagina = Math.max(1, parseInt(page, 10));
  const perPagina = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const totalePagine = Math.ceil(totale / perPagina) || 1;
  const offset = (pagina - 1) * perPagina;

  return {
    data: risultati.slice(offset, offset + perPagina),
    totale,
    pagina,
    totalePagine,
  };
}

/**
 * GET /api/v1/wallet/me
 * Restituisce saldo aggiornato + storico transazioni in un'unica risposta (RF5, RF6, UC10, UC11).
 * Supporta gli stessi filtri e paginazione di /storico.
 *
 * Query params:
 *   - tipo   {string}  'accredito' | 'sottrazione'
 *   - from   {string}  ISO date — filtra transazioni a partire da questa data
 *   - to     {string}  ISO date — filtra transazioni fino a questa data
 *   - page   {number}  pagina (default 1)
 *   - limit  {number}  risultati per pagina (default 20, max 100)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function me(req, res) {
  try {
    const [bilancio, transazioni] = await Promise.all([
      getSaldo(req.user.id),
      getStorico(req.user.id),
    ]);

    const storico = filtraEPagina(transazioni, req.query);

    return res.status(200).json({
      bilancio,
      storico,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/wallet/saldo
 * Restituisce solo il saldo aggiornato del wallet (RF5, UC10).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function saldo(req, res) {
  try {
    const bilancio = await getSaldo(req.user.id);
    return res.status(200).json({ bilancio });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/wallet/storico
 * Restituisce lo storico delle transazioni con paginazione e filtri (RF6, UC11).
 * Ordinate per data decrescente (più recenti prima).
 *
 * Query params:
 *   - tipo   {string}  'accredito' | 'sottrazione'
 *   - from   {string}  ISO date — filtra transazioni a partire da questa data
 *   - to     {string}  ISO date — filtra transazioni fino a questa data
 *   - page   {number}  pagina (default 1)
 *   - limit  {number}  risultati per pagina (default 20, max 100)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function storico(req, res) {
  try {
    const transazioni = await getStorico(req.user.id);
    const risultato = filtraEPagina(transazioni, req.query);
    return res.status(200).json(risultato);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { me, saldo, storico };
