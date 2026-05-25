const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

const app = require('../../app');
const User = require('../../src/models/userModel');
const Wallet = require('../../src/models/walletModel');
const Notifica = require('../../src/models/notificaModel');
const { creaNotifica } = require('../../src/services/notificheService');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Wallet.deleteMany({}),
    Notifica.deleteMany({}),
  ]);
});

async function registerUser(email) {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({
      nome: 'Utente',
      cognome: 'Notifiche',
      email,
      password: 'password123',
    });

  expect(response.statusCode).toBe(201);
  const user = await User.findOne({ email });
  return { token: response.body.token, user };
}

describe('Notifiche RF12 endpoints', () => {
  test('GET /api/v1/notifiche/me richiede autenticazione', async () => {
    const response = await request(app).get('/api/v1/notifiche/me');

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual(expect.objectContaining({ error: 'Token mancante' }));
  });

  test('GET /api/v1/notifiche/me restituisce notifiche paginated e filtrabili per letta', async () => {
    const { token, user } = await registerUser('notifiche-list@test.com');
    const altra = await registerUser('notifiche-other@test.com');

    const prima = await creaNotifica(user._id, 'messaggio', 'Prima notifica', '/chat/1');
    prima.data = new Date('2026-05-20T07:00:00Z');
    await prima.save();
    const letta = await creaNotifica(user._id, 'sistema', 'Notifica letta');
    letta.letta = true;
    letta.data = new Date('2026-05-20T08:00:00Z');
    await letta.save();
    const recente = await creaNotifica(user._id, 'prenotazione', 'Notifica recente');
    recente.data = new Date('2026-05-20T09:00:00Z');
    await recente.save();
    await creaNotifica(altra.user._id, 'messaggio', 'Notifica altro utente');

    const response = await request(app)
      .get('/api/v1/notifiche/me?letta=false&page=1&limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.notifiche).toHaveLength(2);
    expect(response.body.data.notifiche[0].testo).toBe('Notifica recente');
    expect(response.body.data.notifiche.map((n) => n.testo)).not.toContain('Notifica letta');
    expect(response.body.data.notifiche.map((n) => n.testo)).not.toContain('Notifica altro utente');
    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      pages: 1,
    });
    expect(response.body.data.nonLette).toBe(2);
  });

  test('PATCH /api/v1/notifiche/:id/letta marca solo notifiche proprie', async () => {
    const { token, user } = await registerUser('notifiche-owner@test.com');
    const altra = await registerUser('notifiche-not-owner@test.com');
    const propria = await creaNotifica(user._id, 'messaggio', 'Da leggere');
    const altrui = await creaNotifica(altra.user._id, 'messaggio', 'Altrui');

    const forbidden = await request(app)
      .patch(`/api/v1/notifiche/${altrui._id}/letta`)
      .set('Authorization', `Bearer ${token}`);

    expect(forbidden.statusCode).toBe(404);

    const response = await request(app)
      .patch(`/api/v1/notifiche/${propria._id}/letta`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.letta).toBe(true);

    const freshAltrui = await Notifica.findById(altrui._id);
    expect(freshAltrui.letta).toBe(false);
  });

  test('PATCH /api/v1/notifiche/me/leggi-tutte marca tutte e solo le proprie notifiche', async () => {
    const { token, user } = await registerUser('notifiche-all@test.com');
    const altra = await registerUser('notifiche-all-other@test.com');
    await creaNotifica(user._id, 'messaggio', 'Uno');
    await creaNotifica(user._id, 'scambio', 'Due');
    await creaNotifica(altra.user._id, 'messaggio', 'Altra');

    const response = await request(app)
      .patch('/api/v1/notifiche/me/leggi-tutte')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: { aggiornate: 2 },
    });

    expect(await Notifica.countDocuments({ utente: user._id, letta: false })).toBe(0);
    expect(await Notifica.countDocuments({ utente: altra.user._id, letta: false })).toBe(1);
  });
});
