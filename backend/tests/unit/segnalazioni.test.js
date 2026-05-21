const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../../app');
const User = require('../../src/models/userModel');
const Segnalazione = require('../../src/models/segnalazioneModel');
const { signToken } = require('../../src/utils/jwt');
const { hashPassword } = require('../../src/utils/password');

let mongoServer;
let segnalante;
let segnalato;
let tokenSegnalante;

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
  await Segnalazione.deleteMany({});

  const pw = await hashPassword('Password123!');
  segnalante = await User.create({
    nome: 'Segnalante',
    cognome: 'User',
    email: 'segnalante@test.com',
    passwordHash: pw,
    ruolo: 'user',
    idUtente: new mongoose.Types.ObjectId().toString(),
  });
  segnalato = await User.create({
    nome: 'Segnalato',
    cognome: 'User',
    email: 'segnalato@test.com',
    passwordHash: pw,
    ruolo: 'user',
    idUtente: new mongoose.Types.ObjectId().toString(),
  });

  tokenSegnalante = signToken({ id: segnalante._id.toString(), ruolo: 'user' });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/segnalazioni', () => {
  test('segnalazione valida → 201', async () => {
    const res = await request(app)
      .post('/api/v1/segnalazioni')
      .set('Authorization', `Bearer ${tokenSegnalante}`)
      .send({ segnalato: segnalato._id.toString(), tipo: 'inappropriato', motivo: 'Comportamento scorretto' });

    expect(res.statusCode).toBe(201);
    expect(res.body.segnalazione).toBeDefined();
  });

  test('segnalazione a se stessi → 409 (OCL #19)', async () => {
    const res = await request(app)
      .post('/api/v1/segnalazioni')
      .set('Authorization', `Bearer ${tokenSegnalante}`)
      .send({ segnalato: segnalante._id.toString(), tipo: 'altro', motivo: 'Test' });

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toMatch(/OCL #19/i);
  });

  test('segnalazione con motivo vuoto → 400 (OCL #18)', async () => {
    const res = await request(app)
      .post('/api/v1/segnalazioni')
      .set('Authorization', `Bearer ${tokenSegnalante}`)
      .send({ segnalato: segnalato._id.toString(), tipo: 'altro', motivo: '' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/OCL #18/i);
  });

  test('segnalazione senza motivo → 400 (OCL #18)', async () => {
    const res = await request(app)
      .post('/api/v1/segnalazioni')
      .set('Authorization', `Bearer ${tokenSegnalante}`)
      .send({ segnalato: segnalato._id.toString(), tipo: 'altro' });

    expect(res.statusCode).toBe(400);
  });
});
