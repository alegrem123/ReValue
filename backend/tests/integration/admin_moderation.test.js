const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

const app = require('../../app');
const User = require('../../src/models/userModel');
const Wallet = require('../../src/models/walletModel');
const Segnalazione = require('../../src/models/segnalazioneModel');
const { hashPassword } = require('../../src/utils/password');
const { applicaMalus } = require('../../src/services/userService');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
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
    Segnalazione.deleteMany({}),
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

  test('admin dashboard legge statistiche, sospende e riabilita un utente', async () => {
    const { token, loginRes } = await createAdminAndLogin();
    expect(loginRes.statusCode).toBe(200);

    const user = await User.create({
      idUtente: new mongoose.Types.ObjectId().toString(),
      nome: 'Utente',
      cognome: 'Dashboard',
      email: 'dashboard-flow@test.com',
      passwordHash: await hashPassword('password123'),
      ruolo: 'user',
      isSospeso: false,
      bannato: false,
    });

    const stats = await request(app)
      .get('/api/v1/admin/statistiche')
      .set('Authorization', `Bearer ${token}`);
    expect(stats.statusCode).toBe(200);
    expect(stats.body.totaleUtenti).toBeGreaterThanOrEqual(1);

    const users = await request(app)
      .get('/api/v1/admin/users?search=dashboard-flow')
      .set('Authorization', `Bearer ${token}`);
    expect(users.statusCode).toBe(200);
    expect(users.body.users).toHaveLength(1);
    expect(users.body.users[0]).toMatchObject({
      email: 'dashboard-flow@test.com',
      isSospeso: false,
    });

    const sospendi = await request(app)
      .post(`/api/v1/admin/utenti/${user._id}/sospendi`)
      .set('Authorization', `Bearer ${token}`);
    expect(sospendi.statusCode).toBe(200);

    const sospeso = await User.findById(user._id);
    expect(sospeso.isSospeso).toBe(true);
    expect(sospeso.malusCount).toBe(1);

    const riabilita = await request(app)
      .post(`/api/v1/admin/utenti/${user._id}/riabilita`)
      .set('Authorization', `Bearer ${token}`);
    expect(riabilita.statusCode).toBe(200);

    const riabilitato = await User.findById(user._id);
    expect(riabilitato.isSospeso).toBe(false);
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

  test('OCL #20: al terzo malus utente viene auto-sospeso', async () => {
    const user = await User.create({
      idUtente: new mongoose.Types.ObjectId().toString(),
      nome: 'Utente',
      cognome: 'Malus',
      email: 'malus-threshold@test.com',
      passwordHash: await hashPassword('password123'),
      ruolo: 'user',
      malusCount: 2,
      isSospeso: false,
    });

    const updated = await applicaMalus(user._id);

    expect(updated.malusCount).toBe(3);
    expect(updated.isSospeso).toBe(true);
  });

  test('admin malus distingue segnalazione inesistente da già risolta', async () => {
    const { token, loginRes } = await createAdminAndLogin();
    expect(loginRes.statusCode).toBe(200);

    const segnalante = await User.create({
      idUtente: new mongoose.Types.ObjectId().toString(),
      nome: 'Utente',
      cognome: 'Segnalante',
      email: 'segnalante-admin@test.com',
      passwordHash: await hashPassword('password123'),
      ruolo: 'user',
    });
    const segnalato = await User.create({
      idUtente: new mongoose.Types.ObjectId().toString(),
      nome: 'Utente',
      cognome: 'Segnalato',
      email: 'segnalato-admin@test.com',
      passwordHash: await hashPassword('password123'),
      ruolo: 'user',
    });
    const segnalazione = await Segnalazione.create({
      segnalante: segnalante._id,
      segnalato: segnalato._id,
      tipo: 'altro',
      motivo: 'Comportamento scorretto',
      stato: 'RISOLTA',
    });

    const inesistente = await request(app)
      .post(`/api/v1/admin/segnalazioni/${new mongoose.Types.ObjectId()}/malus`)
      .set('Authorization', `Bearer ${token}`);
    expect(inesistente.statusCode).toBe(404);
    expect(inesistente.body.error).toBe('Segnalazione non trovata');

    const giaRisolta = await request(app)
      .post(`/api/v1/admin/segnalazioni/${segnalazione._id}/malus`)
      .set('Authorization', `Bearer ${token}`);
    expect(giaRisolta.statusCode).toBe(409);
    expect(giaRisolta.body.error).toBe('Segnalazione già risolta');
  });
});
