const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

const app = require('../../app');
const User = require('../../src/models/userModel');
const Wallet = require('../../src/models/walletModel');
const Annuncio = require('../../src/models/annuncioModel');
const Segnalazione = require('../../src/models/segnalazioneModel');
const { hashPassword } = require('../../src/utils/password');

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
    Annuncio.deleteMany({}),
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

  test('admin dashboard espone liste utenti e annunci', async () => {
    const { token } = await createAdminAndLogin();
    const user = await User.create({
      idUtente: new mongoose.Types.ObjectId().toString(),
      nome: 'Mario',
      cognome: 'Dashboard',
      email: 'dashboard@test.com',
      passwordHash: await hashPassword('password123'),
      ruolo: 'user',
    });

    await Annuncio.create({
      donatore: user._id,
      titolo: 'Lampada vintage',
      dataScadenza: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      oggetto: {
        categoria: 'casa',
        descrizione: 'Lampada funzionante',
        dimensioni: 'piccolo',
        materiale: 'metallo',
      },
    });

    const utentiRes = await request(app)
      .get('/api/v1/admin/utenti?q=dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(utentiRes.statusCode).toBe(200);
    expect(utentiRes.body.utenti).toHaveLength(1);
    expect(utentiRes.body.utenti[0].email).toBe('dashboard@test.com');

    const annunciRes = await request(app)
      .get('/api/v1/admin/annunci?q=lampada')
      .set('Authorization', `Bearer ${token}`);
    expect(annunciRes.statusCode).toBe(200);
    expect(annunciRes.body.annunci).toHaveLength(1);
    expect(annunciRes.body.annunci[0].titolo).toBe('Lampada vintage');
  });

  test('admin applica malus da segnalazione e la marca risolta', async () => {
    const { token } = await createAdminAndLogin();
    const segnalante = await User.create({
      idUtente: new mongoose.Types.ObjectId().toString(),
      nome: 'Utente',
      cognome: 'Segnalante',
      email: 'segnalante@test.com',
      passwordHash: await hashPassword('password123'),
      ruolo: 'user',
    });
    const segnalato = await User.create({
      idUtente: new mongoose.Types.ObjectId().toString(),
      nome: 'Utente',
      cognome: 'Segnalato',
      email: 'segnalato@test.com',
      passwordHash: await hashPassword('password123'),
      ruolo: 'user',
    });
    const segnalazione = await Segnalazione.create({
      segnalante: segnalante._id,
      segnalato: segnalato._id,
      tipo: 'altro',
      motivo: 'Comportamento non conforme',
    });

    const res = await request(app)
      .post(`/api/v1/admin/segnalazioni/${segnalazione._id}/malus`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Malus applicato e segnalazione risolta');

    const [updatedUser, updatedReport] = await Promise.all([
      User.findById(segnalato._id),
      Segnalazione.findById(segnalazione._id),
    ]);
    expect(updatedUser.malusCount).toBe(1);
    expect(updatedReport.stato).toBe('RISOLTA');
  });
});
