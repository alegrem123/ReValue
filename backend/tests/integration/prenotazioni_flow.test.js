/**
 * Test di integrazione — Flussi prenotazione avanzati
 *
 * RF19 — segnalaMancatoRitiro (no-show donatore):
 *   POST /api/v1/prenotazioni/:id/no-show
 *   · Solo il donatore può segnalare
 *   · Prenotazione → ANNULLATA, annuncio → DISPONIBILE
 *   · Malus acquirente incrementato di 1
 *
 * RF20 — disdiciPrenotazione (disdetta donatore):
 *   POST /api/v1/prenotazioni/:id/disdici
 *   · Solo il donatore può disdire
 *   · Solo entro 3 giorni dalla scadenza annuncio (DISDETTA_TTL)
 *   · Fuori finestra → 409
 *   · Acquirente non può disdire → 403
 *   · Prenotazione → ANNULLATA, annuncio → DISPONIBILE
 *
 * Riferimenti D2 OCL: #4 (donatore ≠ acquirente), #11 (post-annullamento)
 * Riferimenti RF: RF19, RF20
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

const app = require('../../app');
const Annuncio = require('../../src/models/annuncioModel');
const Prenotazione = require('../../src/models/prenotazioneModel');
const User = require('../../src/models/userModel');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function registra(email, nome) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ nome, cognome: 'Test', email, password: 'Password123!' });
  expect(res.statusCode).toBe(201);
  return res.body.token;
}

async function creaAnnuncio(token, giorniAllaScadenza = 7) {
  const futureDate = new Date(Date.now() + giorniAllaScadenza * 24 * 60 * 60 * 1000);
  const res = await request(app)
    .post('/api/v1/annunci')
    .set('Authorization', `Bearer ${token}`)
    .send({
      titolo: `Annuncio test ${Date.now()}`,
      dataScadenza: futureDate.toISOString(),
      latitudine: 46.0,
      longitudine: 11.0,
      oggetto: { categoria: 'Mobili', descrizione: 'Test', dimensioni: 'piccolo', materiale: 'legno' },
    });
  expect(res.statusCode).toBe(201);
  const id = res.body._id ?? res.body.annuncio?._id;
  if (id) return id;
  const doc = await Annuncio.findOne({ titolo: /^Annuncio test/ }).sort({ createdAt: -1 });
  return doc._id.toString();
}

async function prenota(token, annuncioId) {
  const res = await request(app)
    .post('/api/v1/prenotazioni')
    .set('Authorization', `Bearer ${token}`)
    .send({ annuncioId });
  expect(res.statusCode).toBe(201);
  return res.body.prenotazione._id;
}

function getUserIdFromToken(jwt) {
  return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString()).id;
}

// ── RF19: segnalaMancatoRitiro ────────────────────────────────────────────────

describe('RF19 — POST /api/v1/prenotazioni/:id/no-show (segnala mancato ritiro)', () => {
  let tokenDonatore;
  let tokenAcquirente;
  let tokenEstraneo;
  let annuncioId;
  let prenotazioneId;

  beforeAll(async () => {
    tokenDonatore  = await registra('donatore-noshow@test.com', 'Donatore');
    tokenAcquirente = await registra('acquirente-noshow@test.com', 'Acquirente');
    tokenEstraneo  = await registra('estraneo-noshow@test.com', 'Estraneo');
    annuncioId     = await creaAnnuncio(tokenDonatore);
    prenotazioneId = await prenota(tokenAcquirente, annuncioId);
  });

  test('acquirente non può segnalare no-show → 403', async () => {
    const res = await request(app)
      .post(`/api/v1/prenotazioni/${prenotazioneId}/no-show`)
      .set('Authorization', `Bearer ${tokenAcquirente}`);
    expect(res.statusCode).toBe(403);
  });

  test('utente estraneo non può segnalare no-show → 403', async () => {
    const res = await request(app)
      .post(`/api/v1/prenotazioni/${prenotazioneId}/no-show`)
      .set('Authorization', `Bearer ${tokenEstraneo}`);
    expect(res.statusCode).toBe(403);
  });

  test('donatore segnala no-show → 200, prenotazione ANNULLATA, annuncio DISPONIBILE, malus +1', async () => {
    const acquirenteId = getUserIdFromToken(tokenAcquirente);

    // Recupera malus acquirente prima
    const userPre = await User.findById(acquirenteId);
    const malusPre = userPre.malusCount;

    const res = await request(app)
      .post(`/api/v1/prenotazioni/${prenotazioneId}/no-show`)
      .set('Authorization', `Bearer ${tokenDonatore}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/mancato ritiro/i);

    // Prenotazione → ANNULLATA
    const prenotazione = await Prenotazione.findById(prenotazioneId);
    expect(prenotazione.stato).toBe('ANNULLATA');

    // Annuncio → DISPONIBILE
    const annuncio = await Annuncio.findById(annuncioId);
    expect(annuncio.stato).toBe('DISPONIBILE');

    // Malus acquirente +1
    const userPost = await User.findById(acquirenteId);
    expect(userPost.malusCount).toBe(malusPre + 1);
  });

  test('no-show su prenotazione già ANNULLATA → 404', async () => {
    const res = await request(app)
      .post(`/api/v1/prenotazioni/${prenotazioneId}/no-show`)
      .set('Authorization', `Bearer ${tokenDonatore}`);
    expect(res.statusCode).toBe(404);
  });
});

// ── RF20: disdiciPrenotazione ─────────────────────────────────────────────────

describe('RF20 — POST /api/v1/prenotazioni/:id/disdici (disdetta donatore entro 3gg)', () => {
  let tokenDonatore;
  let tokenAcquirente;

  beforeAll(async () => {
    tokenDonatore   = await registra('donatore-disdici@test.com', 'Donatore');
    tokenAcquirente = await registra('acquirente-disdici@test.com', 'Acquirente');
  });

  describe('annuncio con scadenza fuori finestra (10gg) → 409', () => {
    let prenotazioneId;

    beforeAll(async () => {
      const annId = await creaAnnuncio(tokenDonatore, 10);
      prenotazioneId = await prenota(tokenAcquirente, annId);
    });

    test('donatore tenta disdetta fuori finestra → 409', async () => {
      const res = await request(app)
        .post(`/api/v1/prenotazioni/${prenotazioneId}/disdici`)
        .set('Authorization', `Bearer ${tokenDonatore}`);
      expect(res.statusCode).toBe(409);
      expect(res.body.error).toMatch(/3 giorni/i);
    });
  });

  describe('acquirente tenta disdetta → 403', () => {
    let prenotazioneId;

    beforeAll(async () => {
      const annId = await creaAnnuncio(tokenDonatore, 2);
      prenotazioneId = await prenota(tokenAcquirente, annId);
    });

    test('acquirente non è il donatore → 403', async () => {
      const res = await request(app)
        .post(`/api/v1/prenotazioni/${prenotazioneId}/disdici`)
        .set('Authorization', `Bearer ${tokenAcquirente}`);
      expect(res.statusCode).toBe(403);
    });
  });

  describe('annuncio con scadenza entro finestra (2gg) → 200', () => {
    let annuncioId;
    let prenotazioneId;

    beforeAll(async () => {
      annuncioId     = await creaAnnuncio(tokenDonatore, 2);
      prenotazioneId = await prenota(tokenAcquirente, annuncioId);
    });

    test('donatore disdice entro finestra → 200, prenotazione ANNULLATA, annuncio DISPONIBILE', async () => {
      const res = await request(app)
        .post(`/api/v1/prenotazioni/${prenotazioneId}/disdici`)
        .set('Authorization', `Bearer ${tokenDonatore}`);

      expect(res.statusCode).toBe(200);

      // Prenotazione → ANNULLATA
      const prenotazione = await Prenotazione.findById(prenotazioneId);
      expect(prenotazione.stato).toBe('ANNULLATA');

      // Annuncio → DISPONIBILE
      const annuncio = await Annuncio.findById(annuncioId);
      expect(annuncio.stato).toBe('DISPONIBILE');
    });

    test('disdetta su prenotazione già ANNULLATA → 404', async () => {
      const res = await request(app)
        .post(`/api/v1/prenotazioni/${prenotazioneId}/disdici`)
        .set('Authorization', `Bearer ${tokenDonatore}`);
      expect(res.statusCode).toBe(404);
    });
  });
});
