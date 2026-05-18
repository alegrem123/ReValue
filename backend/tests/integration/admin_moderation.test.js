const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

const app = require('../../app');
const User = require('../../src/models/userModel');
const Wallet = require('../../src/models/walletModel');
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

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Wallet.deleteMany({}),
  ]);
});

async function createAdminAndLogin() {
  const password = 'AdminPass123!';
  const admin = await User.create({
    idUtente: new mongoose.Types.ObjectId().toString(),
    nome: 'Admin',
    cognome: 'Root',
    email: 'admin@test.com',
    passwordHash: await hashPassword(password),
    ruolo: 'admin',
  });

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: admin.email, password });

  return { admin, token: loginRes.body.token, loginRes };
}

describe('Moderation and authentication integration', () => {
  test('utente valido con JWT accede a una route protetta, ma viene bloccato dopo sospensione', async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        nome: 'Mario',
        cognome: 'Rossi',
        email: 'moderation-user@test.com',
        password: 'password123',
      });

    expect(registerRes.statusCode).toBe(201);
    const token = registerRes.body.token;

    const firstAccess = await request(app)
      .get('/api/v1/wallet/saldo')
      .set('Authorization', `Bearer ${token}`);

    expect(firstAccess.statusCode).toBe(200);

    await User.findOneAndUpdate(
      { email: 'moderation-user@test.com' },
      { $set: { isSospeso: true } }
    );

    const secondAccess = await request(app)
      .get('/api/v1/wallet/saldo')
      .set('Authorization', `Bearer ${token}`);

    expect(secondAccess.statusCode).toBe(403);
    expect(secondAccess.body).toEqual(
      expect.objectContaining({ error: 'Account sospeso' })
    );
  });

  test('admin può riabilitare un account sospeso non bannato', async () => {
    const { token, loginRes } = await createAdminAndLogin();
    expect(loginRes.statusCode).toBe(200);

    const user = await User.create({
      idUtente: new mongoose.Types.ObjectId().toString(),
      nome: 'Utente',
      cognome: 'Sospeso',
      email: 'sospeso@test.com',
      passwordHash: await hashPassword('password123'),
      ruolo: 'user',
      isSospeso: true,
      bannato: false,
    });

    const res = await request(app)
      .post(`/api/v1/admin/utenti/${user._id}/riabilita`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ message: `Utente ${user.email} riabilitato` })
    );

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.isSospeso).toBe(false);
    expect(updatedUser.bannato).toBe(false);
  });

  test('admin non può riabilitare un account bannato', async () => {
    const { token, loginRes } = await createAdminAndLogin();
    expect(loginRes.statusCode).toBe(200);

    const user = await User.create({
      idUtente: new mongoose.Types.ObjectId().toString(),
      nome: 'Utente',
      cognome: 'Bannato',
      email: 'bannato@test.com',
      passwordHash: await hashPassword('password123'),
      ruolo: 'user',
      isSospeso: true,
      bannato: true,
    });

    const res = await request(app)
      .post(`/api/v1/admin/utenti/${user._id}/riabilita`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(
      expect.objectContaining({ error: 'Account bannato non riabilitabile' })
    );

    const unchangedUser = await User.findById(user._id);
    expect(unchangedUser.isSospeso).toBe(true);
    expect(unchangedUser.bannato).toBe(true);
  });
});
