const Conversazione = require('../models/conversazioneModel');
const notificheService = require('../services/notificheService');

/**
 * GET /api/v1/conversazioni/me
 * Lista conversazioni dell'utente autenticato.
 * Per ogni conversazione: ultimo messaggio + count messaggi non letti (RF12).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getConversazioniMe(req, res) {
  try {
    const conversazioni = await Conversazione.find({
      partecipanti: req.user.id,
    })
      .populate('partecipanti', 'nome cognome')
      .populate('prenotazione', 'stato dataPrenotazione')
      .lean();

    const result = conversazioni.map((conv) => {
      const messaggi = conv.messaggi || [];

      const ultimoMessaggio = messaggi.length > 0
        ? messaggi[messaggi.length - 1]
        : null;

      // Non letti: mittente !== me E letto=false
      const nonLetti = messaggi.filter(
        (m) => m.mittente.toString() !== req.user.id && !m.letto
      ).length;

      return {
        _id:             conv._id,
        prenotazione:    conv.prenotazione,
        partecipanti:    conv.partecipanti,
        createdAt:       conv.createdAt,
        ultimoMessaggio: ultimoMessaggio
          ? {
              testo:     ultimoMessaggio.testo,
              mittente:  ultimoMessaggio.mittente,
              timestamp: ultimoMessaggio.timestamp,
            }
          : null,
        nonLetti,
      };
    });

    // Ordina per timestamp ultimo messaggio (più recente prima)
    result.sort((a, b) => {
      const tA = a.ultimoMessaggio?.timestamp ?? a.createdAt;
      const tB = b.ultimoMessaggio?.timestamp ?? b.createdAt;
      return new Date(tB) - new Date(tA);
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Errore interno del server' });
  }
}

/**
 * GET /api/v1/conversazioni/:id/messaggi
 * Storico messaggi paginato. Solo partecipanti (RF11, RF13).
 * requireParticipant middleware attacca req.conversazione.
 *
 * Query params:
 *   page  (default 1)
 *   limit (default 20)
 *   q     (opzionale) — ricerca testo: $regex su campo testo, $options: 'i'
 */
async function getMessaggi(req, res) {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const q     = req.query.q;

    let messaggi = req.conversazione.messaggi;

    // Ricerca testo: $regex su campo testo con $options: 'i'
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex   = new RegExp(escaped, 'i'); // equivalente a $regex con $options: 'i'
      messaggi = messaggi.filter((m) => regex.test(m.testo));
    }

    const total = messaggi.length;

    // Messaggi più recenti prima: invertiamo, paginiamo, ri-invertiamo
    const reversed = [...messaggi].reverse();
    const slice    = reversed.slice((page - 1) * limit, page * limit).reverse();

    return res.status(200).json({
      ok: true,
      data: {
        messaggi: slice,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Errore interno del server' });
  }
}

/**
 * POST /api/v1/conversazioni/:id/messaggi
 * Invia un messaggio testuale (con immagine opzionale base64, max 1 MB).
 * Solo autenticato + partecipante (RF10, RF14).
 * requireParticipant attacca req.conversazione.
 *
 * Body: { testo: string, immagine?: string (base64) }
 */
async function inviaMessaggio(req, res) {
  try {
    const { testo, immagine } = req.body;

    if (!testo || typeof testo !== 'string' || testo.trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'testo è obbligatorio' });
    }

    // Validazione immagine base64: max 1 MB (1 048 576 byte ≈ 1 398 101 char base64)
    const MAX_BASE64_LENGTH = Math.ceil((1024 * 1024 * 4) / 3); // ~1.33 MB in base64
    if (immagine != null) {
      if (typeof immagine !== 'string') {
        return res.status(400).json({ ok: false, error: 'immagine deve essere una stringa base64' });
      }
      if (immagine.length > MAX_BASE64_LENGTH) {
        return res.status(400).json({ ok: false, error: 'immagine supera il limite di 1 MB' });
      }
    }

    const nuovoMessaggio = {
      mittente:  req.user.id,
      testo:     testo.trim(),
      timestamp: new Date(),
      letto:     false,
      immagine:  immagine || null,
    };

    req.conversazione.messaggi.push(nuovoMessaggio);
    await req.conversazione.save();

    const salvato = req.conversazione.messaggi[req.conversazione.messaggi.length - 1];

    // RF12 — Notifica nuovo messaggio all'altro partecipante
    const destinatario = req.conversazione.partecipanti.find(
      (p) => p.toString() !== req.user.id
    );
    if (destinatario) {
      await notificheService.creaNotifica({
        destinatario: destinatario.toString(),
        tipo: 'messaggio',
        testo: `Nuovo messaggio da ${req.user.nome || 'utente'}`,
        link: `/conversazioni/${req.conversazione._id}`,
      });
    }

    return res.status(201).json({ ok: true, data: salvato });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Errore interno del server' });
  }
}

/**
 * GET /api/v1/conversazioni/:id/messaggi/recenti?since=<timestamp>
 * Polling ottimizzato: restituisce solo messaggi con timestamp > since (RNF7).
 * Riduce il payload da O(n) a O(Δt).
 * Solo partecipanti (RF13). requireParticipant attacca req.conversazione.
 *
 * Query params:
 *   since (obbligatorio) — ISO-8601 o epoch ms, cursore temporale
 *   page  (default 1)
 *   limit (default 50, max 100)
 */
async function getMessaggiRecenti(req, res) {
  try {
    const { since } = req.query;

    if (!since) {
      return res.status(400).json({
        ok: false,
        error: 'query param "since" è obbligatorio (ISO-8601 o epoch ms)',
      });
    }

    const sinceDate = new Date(isNaN(since) ? since : Number(since));
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({
        ok: false,
        error: '"since" non è un timestamp valido',
      });
    }

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));

    // Filtra solo messaggi con timestamp strettamente maggiore di since
    const nuovi = (req.conversazione.messaggi || []).filter(
      (m) => new Date(m.timestamp) > sinceDate
    );

    const total = nuovi.length;

    // Ordine cronologico: dal più vecchio al più recente (append-friendly per il client)
    const slice = nuovi.slice((page - 1) * limit, page * limit);

    // Typing: controlla se l'altro partecipante sta scrivendo (entro 3s)
    const TYPING_TTL = 3000;
    const now = Date.now();
    let typingUser = null;
    if (req.conversazione.typing) {
      for (const [uid, ts] of req.conversazione.typing.entries()) {
        if (uid !== req.user.id && (now - new Date(ts).getTime()) < TYPING_TTL) {
          typingUser = uid;
        }
      }
    }

    return res.status(200).json({
      ok: true,
      data: {
        messaggi: slice,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 0,
        },
        typing: typingUser !== null,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Errore interno del server' });
  }
}

/**
 * GET /api/v1/conversazioni/me/non-letti
 * Count totale messaggi non letti su tutte le conversazioni dell'utente (RF12).
 * Usato per badge navbar.
 */
async function getNonLettiCount(req, res) {
  try {
    const conversazioni = await Conversazione.find({
      partecipanti: req.user.id,
    }).lean();

    const totale = conversazioni.reduce((acc, conv) => {
      const nonLetti = (conv.messaggi || []).filter(
        (m) => m.mittente.toString() !== req.user.id && !m.letto
      ).length;
      return acc + nonLetti;
    }, 0);

    return res.status(200).json({ ok: true, data: { nonLetti: totale } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Errore interno del server' });
  }
}

/**
 * POST /api/v1/conversazioni/:id/typing
 * Segnala che l'utente corrente sta scrivendo.
 * Aggiorna il campo typing[userId] con il timestamp corrente.
 * requireParticipant attacca req.conversazione.
 */
async function setTyping(req, res) {
  try {
    req.conversazione.typing.set(req.user.id, new Date());
    await req.conversazione.save();
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Errore interno del server' });
  }
}

module.exports = { getConversazioniMe, getMessaggi, getMessaggiRecenti, inviaMessaggio, getNonLettiCount, setTyping };
