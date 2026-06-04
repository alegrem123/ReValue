const TicketSupporto = require('../models/ticketSupportoModel');

function addBusinessHours(start, hours) {
  const result = new Date(start);
  let remaining = hours;

  while (remaining > 0) {
    result.setHours(result.getHours() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return result;
}

async function creaTicket(req, res, next) {
  try {
    const { testo } = req.body || {};
    if (!testo || typeof testo !== 'string' || testo.trim().length === 0) {
      return res.status(400).json({ error: 'testo è obbligatorio' });
    }

    const ticket = await TicketSupporto.create({
      utente: req.user.id,
      testo: testo.trim(),
      rispostaEntro: addBusinessHours(new Date(), 24),
    });

    return res.status(201).json({ ticket });
  } catch (err) {
    return next(err);
  }
}

async function getMieiTicket(req, res, next) {
  try {
    const ticket = await TicketSupporto.find({ utente: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ ticket });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  addBusinessHours,
  creaTicket,
  getMieiTicket,
};
