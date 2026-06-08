const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../../app');
const User = require('../../src/models/userModel');
const Wallet = require('../../src/models/walletModel');
const Coupon = require('../../src/models/couponModel');
const Riscatto = require('../../src/models/riscattoModel');
const { creaWallet, addPunti } = require('../../src/services/walletService');
const { signToken } = require('../../src/utils/jwt');
const { hashPassword } = require('../../src/utils/password');

let mongoServer;
let userId;
let token;
let couponId;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-jwt-secret';
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Wallet.deleteMany({});
  await Coupon.deleteMany({});
  await Riscatto.deleteMany({});

  const user = await User.create({
    nome: 'Test',
    cognome: 'User',
    email: 'test@test.com',
    passwordHash: await hashPassword('Password123!'),
    ruolo: 'user',
    idUtente: new mongoose.Types.ObjectId().toString(),
  });
  userId = user._id;
  token = signToken({ id: userId.toString(), ruolo: 'user' });

  await creaWallet(userId);

  const coupon = await Coupon.create({
    titolo: 'Caffè gratis',
    descrizione: 'Un caffè omaggio',
    partner: 'Costa',
    costoCrediti: 10,
    stock: 5,
    attivo: true,
  });
  couponId = coupon._id;
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/premi/:id/riscatta', () => {
  test('riscatto con saldo sufficiente → 201, codiceUnivoco presente (OCL #17)', async () => {
    await addPunti(userId, 20, 'test');

    const res = await request(app)
      .post(`/api/v1/premi/${couponId}/riscatta`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(201);
    expect(res.body.codiceUnivoco).toBeDefined();
    expect(typeof res.body.codiceUnivoco).toBe('string');
    expect(res.body.codiceUnivoco.length).toBeGreaterThan(0);
  });

  test('riscatto con saldo insufficiente → 409 (OCL #17)', async () => {
    // wallet vuoto — saldo 0, coupon costa 10

    const res = await request(app)
      .post(`/api/v1/premi/${couponId}/riscatta`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toMatch(/saldo insufficiente/i);
  });

  test('riscatto coupon inesistente → 404', async () => {
    await addPunti(userId, 50, 'test');
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(`/api/v1/premi/${fakeId}/riscatta`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(404);
  });

  test('riscatto coupon non attivo → 409', async () => {
    await addPunti(userId, 50, 'test');
    await Coupon.findByIdAndUpdate(couponId, { attivo: false });

    const res = await request(app)
      .post(`/api/v1/premi/${couponId}/riscatta`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(409);
  });

  test('riscatto decrementa stock correttamente', async () => {
    await addPunti(userId, 50, 'test');

    const res = await request(app)
      .post(`/api/v1/premi/${couponId}/riscatta`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(201);
    const couponAggiornato = await Coupon.findById(couponId);
    expect(couponAggiornato.stock).toBe(4);
  });

  test('riscatto coupon con stock 0 → 201 senza decrementare stock illimitato', async () => {
    await addPunti(userId, 50, 'test');
    await Coupon.findByIdAndUpdate(couponId, { stock: 0 });

    const res = await request(app)
      .post(`/api/v1/premi/${couponId}/riscatta`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(201);
    expect(res.body.codiceUnivoco).toBeDefined();

    const couponAggiornato = await Coupon.findById(couponId);
    expect(couponAggiornato.stock).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/v1/premi', () => {
  test('lista coupon attivi → 200 con array', async () => {
    const res = await request(app)
      .get('/api/v1/premi')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.coupon)).toBe(true);
    expect(res.body.coupon.length).toBe(1);
    expect(res.body.totale).toBe(1);
  });

  test('filtro ?costoMax esclude coupon più costosi', async () => {
    await Coupon.create({
      titolo: 'Costoso',
      descrizione: 'Desc',
      partner: 'Partner',
      costoCrediti: 50,
      attivo: true,
    });

    const res = await request(app)
      .get('/api/v1/premi?costoMax=15')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.coupon.every((c) => c.costoCrediti <= 15)).toBe(true);
  });

  test('coupon non attivi non compaiono nella lista', async () => {
    await Coupon.findByIdAndUpdate(couponId, { attivo: false });

    const res = await request(app)
      .get('/api/v1/premi')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.coupon.length).toBe(0);
  });

  test('ordine costoCrediti ASC', async () => {
    await Coupon.create({
      titolo: 'Economico',
      descrizione: 'Desc',
      partner: 'Partner',
      costoCrediti: 2,
      attivo: true,
    });

    const res = await request(app)
      .get('/api/v1/premi')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    const costi = res.body.coupon.map((c) => c.costoCrediti);
    expect(costi).toEqual([...costi].sort((a, b) => a - b));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/v1/premi/miei', () => {
  test('lista vuota se nessun riscatto → 200', async () => {
    const res = await request(app)
      .get('/api/v1/premi/miei')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.riscatti).toHaveLength(0);
    expect(res.body.totale).toBe(0);
  });

  test('mostra riscatti dopo riscatto → coupon popolato', async () => {
    await addPunti(userId, 50, 'test');
    await request(app)
      .post(`/api/v1/premi/${couponId}/riscatta`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/api/v1/premi/miei')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.riscatti).toHaveLength(1);
    expect(res.body.riscatti[0].coupon).toBeDefined();
    expect(res.body.riscatti[0].coupon.titolo).toBe('Caffè gratis');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/v1/premi/riscatti/:id/usato', () => {
  test('owner marca riscatto come usato → 200', async () => {
    await addPunti(userId, 50, 'test');
    const riscattoRes = await request(app)
      .post(`/api/v1/premi/${couponId}/riscatta`)
      .set('Authorization', `Bearer ${token}`);

    const riscattoId = riscattoRes.body.riscatto._id;

    const res = await request(app)
      .patch(`/api/v1/premi/riscatti/${riscattoId}/usato`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.riscatto.usato).toBe(true);
  });

  test('non-owner non può marcare usato → 403', async () => {
    await addPunti(userId, 50, 'test');
    const riscattoRes = await request(app)
      .post(`/api/v1/premi/${couponId}/riscatta`)
      .set('Authorization', `Bearer ${token}`);

    const riscattoId = riscattoRes.body.riscatto._id;

    const altroUser = await User.create({
      nome: 'Altro',
      cognome: 'User',
      email: 'altro@test.com',
      passwordHash: await hashPassword('Password123!'),
      ruolo: 'user',
      idUtente: new mongoose.Types.ObjectId().toString(),
    });
    const altroToken = signToken({ id: altroUser._id.toString(), ruolo: 'user' });

    const res = await request(app)
      .patch(`/api/v1/premi/riscatti/${riscattoId}/usato`)
      .set('Authorization', `Bearer ${altroToken}`);

    expect(res.statusCode).toBe(403);
  });

  test('riscatto già usato → 409', async () => {
    await addPunti(userId, 50, 'test');
    const riscattoRes = await request(app)
      .post(`/api/v1/premi/${couponId}/riscatta`)
      .set('Authorization', `Bearer ${token}`);

    const riscattoId = riscattoRes.body.riscatto._id;

    await request(app)
      .patch(`/api/v1/premi/riscatti/${riscattoId}/usato`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .patch(`/api/v1/premi/riscatti/${riscattoId}/usato`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(409);
  });
});
