const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

const app = require('../../app');
const User = require('../../src/models/userModel');
const Wallet = require('../../src/models/walletModel');

let mongoServer;
let tokenUser;
let tokenAdmin;
let userId;

const PROTECTED_ROUTES = [
  { method: 'get',    path: '/api/v1/users/me' },
  { method: 'get',    path: '/api/v1/prenotazioni/me' },
  { method: 'post',   path: '/api/v1/annunci' },
  { method: 'get',    path: '/api/v1/wallet/me' },
  { method: 'get',    path: '/api/v1/notifiche/me' },
  { method: 'post',   path: '/api/v1/recensioni' },
  { method: 'post',   path: '/api/v1/segnalazioni' },
];

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri());

  const resUser = await request(app).post('/api/v1/auth/register').send({
    nome: 'Sec',
    cognome: 'Test',
    email: 'sec-user@test.com',
    password: 'password123',
    telefono: '+39 333 0000001',
  });
  tokenUser = resUser.body.token;
  userId = resUser.body.user?._id || resUser.body.user?.id;

  const resAdmin = await request(app).post('/api/v1/auth/register').send({
    nome: 'Admin',
    cognome: 'Sec',
    email: 'sec-admin@test.com',
    password: 'password123',
    telefono: '+39 333 0000002',
  });
  await User.findOneAndUpdate({ email: 'sec-admin@test.com' }, { ruolo: 'admin' });
  const resAdminLogin = await request(app).post('/api/v1/auth/login').send({
    email: 'sec-admin@test.com',
    password: 'password123',
  });
  tokenAdmin = resAdminLogin.body.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Autenticazione — rifiuto richieste non autorizzate', () => {
  test.each(PROTECTED_ROUTES)(
    'GET/POST $path → 401 senza token',
    async ({ method, path }) => {
      const res = await request(app)[method](path).send({});
      expect(res.status).toBe(401);
    }
  );

  test('token malformato → 401', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });

  test('token con firma errata → 401', async () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2IiwiaWF0IjoxNjAwMDAwMDAwfQ.INVALIDSIGNATURE';
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${fakeToken}`);
    expect(res.status).toBe(401);
  });

  test('Authorization header senza Bearer → 401', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', tokenUser);
    expect(res.status).toBe(401);
  });
});

describe('Autorizzazione — controllo ruoli', () => {
  test('utente normale non accede a route admin → 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/utenti')
      .set('Authorization', `Bearer ${tokenUser}`);
    expect(res.status).toBe(403);
  });

  test('utente normale non accede a segnalazioni admin → 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/segnalazioni')
      .set('Authorization', `Bearer ${tokenUser}`);
    expect(res.status).toBe(403);
  });

  test('admin non può creare annunci (onlyRegularUser) → 403', async () => {
    const res = await request(app)
      .post('/api/v1/annunci')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        titolo: 'Test',
        dataScadenza: new Date(Date.now() + 86400000).toISOString(),
        oggetto: { categoria: 'libri', descrizione: 'desc', materiale: 'carta' },
      });
    expect(res.status).toBe(403);
  });

  test('admin non può prenotare (onlyRegularUser) → 403', async () => {
    const res = await request(app)
      .post('/api/v1/prenotazioni')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ annuncioId: new mongoose.Types.ObjectId().toString() });
    expect(res.status).toBe(403);
  });
});

describe('OCL #19 — auto-segnalazione vietata', () => {
  test('utente non può segnalare se stesso → 400/409', async () => {
    const meRes = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${tokenUser}`);
    const myId = meRes.body.user?._id || meRes.body._id || meRes.body.user?.id;

    const res = await request(app)
      .post('/api/v1/segnalazioni')
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({ segnalato: myId, tipo: 'comportamento', motivo: 'test auto-report' });
    expect([400, 409]).toContain(res.status);
  });
});

describe('Utente sospeso — accesso bloccato', () => {
  let tokenSospeso;

  beforeAll(async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      nome: 'Sosp',
      cognome: 'Eso',
      email: 'sospeso@test.com',
      password: 'password123',
      telefono: '+39 333 0000003',
    });
    // Get token BEFORE suspending — login blocks suspended accounts
    tokenSospeso = regRes.body.token;
    await User.findOneAndUpdate({ email: 'sospeso@test.com' }, { isSospeso: true });
  });

  test('utente sospeso non può pubblicare annunci → 403', async () => {
    const res = await request(app)
      .post('/api/v1/annunci')
      .set('Authorization', `Bearer ${tokenSospeso}`)
      .send({
        titolo: 'Test',
        dataScadenza: new Date(Date.now() + 86400000).toISOString(),
        oggetto: { categoria: 'libri', descrizione: 'desc', materiale: 'carta' },
      });
    expect(res.status).toBe(403);
  });

  test('utente sospeso non può prenotare → 403', async () => {
    const res = await request(app)
      .post('/api/v1/prenotazioni')
      .set('Authorization', `Bearer ${tokenSospeso}`)
      .send({ annuncioId: new mongoose.Types.ObjectId().toString() });
    expect(res.status).toBe(403);
  });

  test('utente sospeso non può inviare segnalazioni → 403', async () => {
    const res = await request(app)
      .post('/api/v1/segnalazioni')
      .set('Authorization', `Bearer ${tokenSospeso}`)
      .send({ segnalato: new mongoose.Types.ObjectId().toString(), tipo: 'comportamento', motivo: 'test' });
    expect(res.status).toBe(403);
  });
});
