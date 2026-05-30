const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

const app = require('../../app');
const Annuncio = require('../../src/models/annuncioModel');
const Segnalazione = require('../../src/models/segnalazioneModel');
const User = require('../../src/models/userModel');
const { signToken } = require('../../src/utils/jwt');
const { hashPassword } = require('../../src/utils/password');

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
    .post('/api/v1/auth/register')
    .send({ nome, cognome: 'Test', email, password: 'Password123!' });
  expect(res.statusCode).toBe(201);
  expect(res.body.ok).toBe(true);
  return payload(res).token;
}

async function createAdminToken() {
  const admin = await User.create({
    idUtente: new mongoose.Types.ObjectId().toString(),
    nome: 'Admin',
    cognome: 'Dashboard',
    email: `admin-${Date.now()}@test.com`,
    passwordHash: await hashPassword('Password123!'),
    ruolo: 'admin',
  });
  return signToken({ id: admin._id, ruolo: 'admin', nome: admin.nome });
}

async function createAnnuncio(token, titolo = 'Oggetto followup') {
  const res = await request(app)
    .post('/api/v1/annunci')
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
    .post('/api/v1/prenotazioni')
    .set('Authorization', `Bearer ${token}`)
    .send({ annuncioId });
  expect(res.statusCode).toBe(201);
  return payload(res).prenotazione._id;
}

async function completaScambio(tokenDonatore, tokenAcquirente, prenotazioneId) {
  const qr = await request(app)
    .post('/api/v1/qr/genera')
    .set('Authorization', `Bearer ${tokenDonatore}`)
    .send({ prenotazioneId });
  expect(qr.statusCode).toBe(201);

  const validazione = await request(app)
    .post('/api/v1/qr/valida')
    .set('Authorization', `Bearer ${tokenAcquirente}`)
    .send({ codice: payload(qr).codice });
  expect(validazione.statusCode).toBe(200);
}

describe('D3 follow-up', () => {
  test('risposte API uniformi su successo ed errore', async () => {
    const ok = await request(app).get('/api/v1/annunci?limit=1');
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toMatchObject({ ok: true });
    expect(ok.body.data).toBeDefined();

    const ko = await request(app).get('/api/v1/wallet/saldo');
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
      .post('/api/v1/recensioni')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ prenotazioneId, positiva: true, testo: 'Troppo presto' });
    expect(prima.statusCode).toBe(409);
    expect(message(prima)).toMatch(/completato/i);

    await completaScambio(tokenD, tokenA, prenotazioneId);

    const recensione = await request(app)
      .post('/api/v1/recensioni')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ prenotazioneId, positiva: true, testo: 'Tutto ok' });
    expect(recensione.statusCode).toBe(201);
    expect(payload(recensione).positiva).toBe(true);

    const annuncio = await Annuncio.findById(annuncioId);
    const profilo = await request(app).get(`/api/v1/users/${annuncio.donatore}/profilo`);
    expect(profilo.statusCode).toBe(200);
    expect(payload(profilo).recensioni.positive).toBe(1);
  });

  test('segnalazione utente/annuncio con vincolo anti-autosegnalazione', async () => {
    const tokenD = await register('d-report@test.com', 'DonatoreReport');
    const tokenA = await register('a-report@test.com', 'AcquirenteReport');
    const annuncioId = await createAnnuncio(tokenD, 'Segnalazione test');
    const annuncio = await Annuncio.findById(annuncioId);

    const self = await request(app)
      .post('/api/v1/segnalazioni')
      .set('Authorization', `Bearer ${tokenD}`)
      .send({ segnalatoId: annuncio.donatore, motivo: 'self report' });
    expect(self.statusCode).toBe(409);
    expect(message(self)).toMatch(/te stesso/i);

    const report = await request(app)
      .post('/api/v1/segnalazioni')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ annuncioId, tipo: 'inappropriato', motivo: 'Foto non coerenti' });
    expect(report.statusCode).toBe(201);
    expect(payload(report).annuncio.toString()).toBe(annuncioId);

    await expect(Segnalazione.countDocuments()).resolves.toBe(1);
  });

  test('endpoint legacy /api/v1/scambi espone header di deprecazione', async () => {
    const res = await request(app).get('/api/v1/scambi/non-valid-id/qr');
    expect(res.statusCode).toBe(410);
    expect(res.headers.deprecation).toBe('true');
    expect(res.headers.sunset).toBeDefined();
  });

  test('admin dashboard: statistiche e lista utenti su /api/v1', async () => {
    const adminToken = await createAdminToken();
    await register('admin-list-user@test.com', 'Lista');

    const stats = await request(app)
      .get('/api/v1/admin/statistiche')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(stats.statusCode).toBe(200);
    expect(payload(stats)).toEqual(expect.objectContaining({
      scambiMensili: expect.any(Number),
      totaleUtenti: expect.any(Number),
      totaleCrediti: expect.any(Number),
      storicoMensile: expect.any(Array),
    }));

    const users = await request(app)
      .get('/api/v1/admin/users?search=admin-list-user')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(users.statusCode).toBe(200);
    expect(payload(users).users).toHaveLength(1);
    expect(payload(users).users[0]).toMatchObject({
      email: 'admin-list-user@test.com',
      ruolo: 'user',
    });
  });

  test('admin dashboard E2E: sospendi e riabilita utente', async () => {
    const adminToken = await createAdminToken();
    await register('admin-e2e-user@test.com', 'AdminE2E');

    const utente = await User.findOne({ email: 'admin-e2e-user@test.com' });
    expect(utente).toBeDefined();
    expect(utente.isSospeso).toBe(false);

    const stats = await request(app)
      .get('/api/v1/admin/statistiche')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(stats.statusCode).toBe(200);
    expect(payload(stats).totaleUtenti).toBeGreaterThanOrEqual(1);

    const sospendi = await request(app)
      .post(`/api/v1/admin/utenti/${utente._id}/sospendi`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sospendi.statusCode).toBe(200);

    const sospeso = await User.findById(utente._id).lean();
    expect(sospeso.isSospeso).toBe(true);

    const riabilita = await request(app)
      .post(`/api/v1/admin/utenti/${utente._id}/riabilita`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(riabilita.statusCode).toBe(200);

    const riabilitato = await User.findById(utente._id).lean();
    expect(riabilitato.isSospeso).toBe(false);

    const users = await request(app)
      .get('/api/v1/admin/users?search=admin-e2e-user')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(users.statusCode).toBe(200);
    expect(payload(users).users[0]).toMatchObject({
      email: 'admin-e2e-user@test.com',
      isSospeso: false,
    });
  });

  test('admin dashboard: gestione annunci e segnalazioni', async () => {
    const adminToken = await createAdminToken();
    const tokenD = await register('admin-annuncio-d@test.com', 'DonatoreAdmin');
    const tokenA = await register('admin-annuncio-a@test.com', 'SegnalanteAdmin');
    const annuncioId = await createAnnuncio(tokenD, 'Annuncio admin');

    const annunci = await request(app)
      .get('/api/v1/admin/annunci?stato=DISPONIBILE')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(annunci.statusCode).toBe(200);
    expect(payload(annunci).annunci.some((item) => item._id === annuncioId)).toBe(true);

    const forza = await request(app)
      .patch(`/api/v1/admin/annunci/${annuncioId}/forza`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stato: 'SCADUTO' });
    expect(forza.statusCode).toBe(200);
    expect(payload(forza).annuncio.stato).toBe('SCADUTO');

    const report = await request(app)
      .post('/api/v1/segnalazioni')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ annuncioId, tipo: 'altro', motivo: 'Contenuto non corretto' });
    expect(report.statusCode).toBe(201);

    const reports = await request(app)
      .get('/api/v1/admin/segnalazioni')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(reports.statusCode).toBe(200);
    const listedReport = payload(reports).find((item) => item._id === payload(report)._id);
    expect(listedReport).toMatchObject({
      motivo: 'Contenuto non corretto',
      segnalante: { email: 'admin-annuncio-a@test.com' },
      segnalato: { email: 'admin-annuncio-d@test.com' },
    });

    const malus = await request(app)
      .post(`/api/v1/admin/segnalazioni/${payload(report)._id}/malus`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(malus.statusCode).toBe(200);
    expect(payload(malus).utente.malusCount).toBe(1);
    expect(payload(malus).segnalazione.malusApplicato).toBe(true);

    const duplicateMalus = await request(app)
      .post(`/api/v1/admin/segnalazioni/${payload(report)._id}/malus`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(duplicateMalus.statusCode).toBe(409);

    const remove = await request(app)
      .delete(`/api/v1/admin/annunci/${annuncioId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(remove.statusCode).toBe(200);

    const removedAnnuncio = await Annuncio.findById(annuncioId);
    expect(removedAnnuncio.isAttivo).toBe(false);

    const forceRemoved = await request(app)
      .patch(`/api/v1/admin/annunci/${annuncioId}/forza`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stato: 'DISPONIBILE' });
    expect(forceRemoved.statusCode).toBe(200);
    expect(payload(forceRemoved).annuncio.stato).toBe('DISPONIBILE');
    expect(payload(forceRemoved).annuncio.isAttivo).toBe(false);
  });
});
