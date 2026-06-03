/**
 * Test di integrazione — Chat: requireParticipant middleware
 *
 * RF13: il sistema deve impedire l'invio/lettura di messaggi a utenti
 *       non coinvolti nello scambio.
 * RF14: solo utenti autenticati possono inviare messaggi.
 *
 * Scenari testati:
 *   · Unauthenticated → 401
 *   · Utente estraneo (non partecipante) → 403
 *   · Donatore (partecipante) → può leggere messaggi (200)
 *   · Acquirente (partecipante) → può inviare messaggi (201)
 *   · Conversazione inesistente → 404
 *
 * Riferimenti D2: Gestore Messaggistica, interfaccia requireParticipant
 * Riferimenti RF: RF10, RF11, RF13, RF14
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

const app = require('../../app');
const Annuncio = require('../../src/models/annuncioModel');
const Conversazione = require('../../src/models/conversazioneModel');

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

async function creaAnnuncio(token) {
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const res = await request(app)
    .post('/api/v1/annunci')
    .set('Authorization', `Bearer ${token}`)
    .send({
      titolo: `Chat test annuncio ${Date.now()}`,
      dataScadenza: futureDate.toISOString(),
      latitudine: 46.0,
      longitudine: 11.0,
      oggetto: { categoria: 'Arredamento', descrizione: 'Test', dimensioni: 'piccolo', materiale: 'legno' },
    });
  expect(res.statusCode).toBe(201);
  const id = res.body._id ?? res.body.annuncio?._id;
  if (id) return id;
  const doc = await Annuncio.findOne({ titolo: /^Chat test annuncio/ }).sort({ createdAt: -1 });
  return doc._id.toString();
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('RF13/RF14 — requireParticipant: accesso chat solo per partecipanti', () => {
  let tokenDonatore;
  let tokenAcquirente;
  let tokenEstraneo;
  let conversazioneId;

  beforeAll(async () => {
    tokenDonatore   = await registra('donatore-chat@test.com', 'Donatore');
    tokenAcquirente = await registra('acquirente-chat@test.com', 'Acquirente');
    tokenEstraneo   = await registra('estraneo-chat@test.com', 'Estraneo');

    // Booking crea automaticamente la conversazione (prenotazioniController)
    const annId = await creaAnnuncio(tokenDonatore);
    const resPren = await request(app)
      .post('/api/v1/prenotazioni')
      .set('Authorization', `Bearer ${tokenAcquirente}`)
      .send({ annuncioId: annId });
    expect(resPren.statusCode).toBe(201);

    // Recupera conversazione dal DB (creata inline nella transazione)
    const conv = await Conversazione.findOne({}).sort({ _id: -1 });
    conversazioneId = conv._id.toString();
  });

  // ── Unauthenticated ────────────────────────────────────────────────────────

  test('GET messaggi senza token → 401 (RF14)', async () => {
    const res = await request(app)
      .get(`/api/v1/conversazioni/${conversazioneId}/messaggi`);
    expect(res.statusCode).toBe(401);
  });

  test('POST messaggio senza token → 401 (RF14)', async () => {
    const res = await request(app)
      .post(`/api/v1/conversazioni/${conversazioneId}/messaggi`)
      .send({ testo: 'Ciao' });
    expect(res.statusCode).toBe(401);
  });

  // ── Estraneo autenticato ───────────────────────────────────────────────────

  test('GET messaggi da utente estraneo → 403 (RF13)', async () => {
    const res = await request(app)
      .get(`/api/v1/conversazioni/${conversazioneId}/messaggi`)
      .set('Authorization', `Bearer ${tokenEstraneo}`);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/non autorizzato/i);
  });

  test('POST messaggio da utente estraneo → 403 (RF13)', async () => {
    const res = await request(app)
      .post(`/api/v1/conversazioni/${conversazioneId}/messaggi`)
      .set('Authorization', `Bearer ${tokenEstraneo}`)
      .send({ testo: 'Tentativo non autorizzato' });
    expect(res.statusCode).toBe(403);
  });

  // ── Partecipanti ───────────────────────────────────────────────────────────

  test('GET messaggi dal donatore (partecipante) → 200 (RF11)', async () => {
    const res = await request(app)
      .get(`/api/v1/conversazioni/${conversazioneId}/messaggi`)
      .set('Authorization', `Bearer ${tokenDonatore}`);
    expect(res.statusCode).toBe(200);
  });

  test('GET messaggi dall acquirente (partecipante) → 200 (RF11)', async () => {
    const res = await request(app)
      .get(`/api/v1/conversazioni/${conversazioneId}/messaggi`)
      .set('Authorization', `Bearer ${tokenAcquirente}`);
    expect(res.statusCode).toBe(200);
  });

  test('POST messaggio dall acquirente → 201, messaggio visibile in storico (RF10)', async () => {
    const testo = 'Quando posso venire a ritirare?';

    const resPost = await request(app)
      .post(`/api/v1/conversazioni/${conversazioneId}/messaggi`)
      .set('Authorization', `Bearer ${tokenAcquirente}`)
      .send({ testo });
    expect(resPost.statusCode).toBe(201);

    // Il messaggio deve essere nello storico
    const resGet = await request(app)
      .get(`/api/v1/conversazioni/${conversazioneId}/messaggi`)
      .set('Authorization', `Bearer ${tokenDonatore}`);
    expect(resGet.statusCode).toBe(200);

    const messaggi = resGet.body?.data?.messaggi ?? resGet.body?.messaggi ?? resGet.body;
    const trovato = Array.isArray(messaggi)
      ? messaggi.some((m) => m.testo === testo)
      : false;
    expect(trovato).toBe(true);
  });

  test('POST messaggio dal donatore → 201 (RF10)', async () => {
    const res = await request(app)
      .post(`/api/v1/conversazioni/${conversazioneId}/messaggi`)
      .set('Authorization', `Bearer ${tokenDonatore}`)
      .send({ testo: 'Passa pure domani mattina.' });
    expect(res.statusCode).toBe(201);
  });

  // ── Conversazione inesistente ──────────────────────────────────────────────

  test('GET messaggi conversazione inesistente (ObjectId valido) → 404', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/v1/conversazioni/${fakeId}/messaggi`)
      .set('Authorization', `Bearer ${tokenDonatore}`);
    expect(res.statusCode).toBe(404);
  });
});
