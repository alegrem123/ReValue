const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
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
  mongoServer = await MongoMemoryServer.create();
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
});
