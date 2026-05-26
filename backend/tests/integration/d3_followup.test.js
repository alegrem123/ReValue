const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

const app = require('../../app');
const Annuncio = require('../../src/models/annuncioModel');
const Segnalazione = require('../../src/models/segnalazioneModel');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

function payload(res) {
  return res.body?.data ?? res.body;
}

function message(res) {
  return res.body?.message ?? res.body?.error;
}

async function register(email, nome) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ nome, cognome: 'Test', email, password: 'Password123!' });
  expect(res.statusCode).toBe(201);
  expect(res.body.ok).toBe(true);
  return payload(res).token;
}

async function createAnnuncio(token, titolo = 'Oggetto followup') {
  const res = await request(app)
    .post('/api/annunci')
    .set('Authorization', `Bearer ${token}`)
    .send({
      titolo,
      dataScadenza: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      latitudine: 46,
      longitudine: 11,
      oggetto: {
        categoria: 'Mobili',
        descrizione: 'Oggetto per test D3',
        dimensioni: 'medio',
        materiale: 'legno',
      },
    });
  expect(res.statusCode).toBe(201);
  return payload(res)._id;
}

async function prenota(token, annuncioId) {
  const res = await request(app)
    .post('/api/prenotazioni')
    .set('Authorization', `Bearer ${token}`)
    .send({ annuncioId });
  expect(res.statusCode).toBe(201);
  return payload(res).prenotazione._id;
}

async function completaScambio(tokenDonatore, tokenAcquirente, prenotazioneId) {
  const qr = await request(app)
    .post('/api/qr/genera')
    .set('Authorization', `Bearer ${tokenDonatore}`)
    .send({ prenotazioneId });
  expect(qr.statusCode).toBe(201);

  const validazione = await request(app)
    .post('/api/qr/valida')
    .set('Authorization', `Bearer ${tokenAcquirente}`)
    .send({ codice: payload(qr).codice });
  expect(validazione.statusCode).toBe(200);
}

describe('D3 follow-up', () => {
  test('risposte API uniformi su successo ed errore', async () => {
    const ok = await request(app).get('/api/annunci?limit=1');
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toMatchObject({ ok: true });
    expect(ok.body.data).toBeDefined();

    const ko = await request(app).get('/api/wallet/saldo');
    expect(ko.statusCode).toBe(401);
    expect(ko.body).toMatchObject({
      ok: false,
      error: 'UNAUTHORIZED',
    });
    expect(ko.body.message).toMatch(/token/i);
  });

  test('recensione solo dopo scambio completato e visibile nel profilo pubblico', async () => {
    const tokenD = await register('d-review@test.com', 'DonatoreReview');
    const tokenA = await register('a-review@test.com', 'AcquirenteReview');
    const annuncioId = await createAnnuncio(tokenD, 'Recensione test');
    const prenotazioneId = await prenota(tokenA, annuncioId);

    const prima = await request(app)
      .post('/api/recensioni')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ prenotazioneId, positiva: true, testo: 'Troppo presto' });
    expect(prima.statusCode).toBe(409);
    expect(message(prima)).toMatch(/completato/i);

    await completaScambio(tokenD, tokenA, prenotazioneId);

    const recensione = await request(app)
      .post('/api/recensioni')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ prenotazioneId, positiva: true, testo: 'Tutto ok' });
    expect(recensione.statusCode).toBe(201);
    expect(payload(recensione).positiva).toBe(true);

    const annuncio = await Annuncio.findById(annuncioId);
    const profilo = await request(app).get(`/api/users/${annuncio.donatore}/profilo`);
    expect(profilo.statusCode).toBe(200);
    expect(payload(profilo).recensioni.positive).toBe(1);
  });

  test('segnalazione utente/annuncio con vincolo anti-autosegnalazione', async () => {
    const tokenD = await register('d-report@test.com', 'DonatoreReport');
    const tokenA = await register('a-report@test.com', 'AcquirenteReport');
    const annuncioId = await createAnnuncio(tokenD, 'Segnalazione test');
    const annuncio = await Annuncio.findById(annuncioId);

    const self = await request(app)
      .post('/api/segnalazioni')
      .set('Authorization', `Bearer ${tokenD}`)
      .send({ segnalatoId: annuncio.donatore, motivo: 'self report' });
    expect(self.statusCode).toBe(409);
    expect(message(self)).toMatch(/te stesso/i);

    const report = await request(app)
      .post('/api/segnalazioni')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ annuncioId, tipo: 'inappropriato', motivo: 'Foto non coerenti' });
    expect(report.statusCode).toBe(201);
    expect(payload(report).annuncio.toString()).toBe(annuncioId);

    await expect(Segnalazione.countDocuments()).resolves.toBe(1);
  });

  test('endpoint legacy /api/scambi espone header di deprecazione', async () => {
    const res = await request(app).get('/api/scambi/non-valid-id/qr');
    expect(res.headers.deprecation).toBe('true');
    expect(res.headers.sunset).toBeDefined();
  });
});
