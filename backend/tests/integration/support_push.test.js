const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-key-for-support-push-tests';

const app = require('../../app');
const User = require('../../src/models/userModel');
const TicketSupporto = require('../../src/models/ticketSupportoModel');

let mongoServer;
let token;
let userId;
const userEmail = 'support-user@test.com';

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri());

  const res = await request(app).post('/api/v1/auth/register').send({
    nome: 'Support',
    cognome: 'User',
    email: userEmail,
    password: 'Password123!',
  });

  token = res.body.token;
  const user = await User.findOne({ email: userEmail }).lean();
  userId = user._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await TicketSupporto.deleteMany({});
  await User.findByIdAndUpdate(userId, { expoPushToken: '' });
});

describe('Supporto endpoints', () => {
  test('POST /api/v1/supporto/ticket crea un ticket autenticato', async () => {
    const res = await request(app)
      .post('/api/v1/supporto/ticket')
      .set('Authorization', `Bearer ${token}`)
      .send({ testo: 'Ho bisogno di assistenza su una prenotazione.' });

    expect(res.statusCode).toBe(201);
    expect(res.body.ticket).toEqual(
      expect.objectContaining({
        utente: userId,
        testo: 'Ho bisogno di assistenza su una prenotazione.',
        stato: 'APERTO',
      })
    );
    expect(res.body.ticket.rispostaEntro).toBeDefined();
  });

  test('POST /api/v1/supporto/ticket rifiuta testo vuoto', async () => {
    const res = await request(app)
      .post('/api/v1/supporto/ticket')
      .set('Authorization', `Bearer ${token}`)
      .send({ testo: '   ' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('testo è obbligatorio');
  });

  test('GET /api/v1/supporto/ticket/me lista solo i ticket dell utente', async () => {
    await TicketSupporto.create({
      utente: userId,
      testo: 'Ticket personale',
      rispostaEntro: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await TicketSupporto.create({
      utente: new mongoose.Types.ObjectId(),
      testo: 'Ticket altro utente',
      rispostaEntro: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .get('/api/v1/supporto/ticket/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.ticket).toHaveLength(1);
    expect(res.body.ticket[0].testo).toBe('Ticket personale');
  });
});

describe('Push token endpoint', () => {
  test('PATCH /api/v1/users/me/push-token salva token Expo valido', async () => {
    const expoPushToken = 'ExpoPushToken[abcdefghijklmnopqrstuv]';

    const res = await request(app)
      .patch('/api/v1/users/me/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ expoPushToken });

    expect(res.statusCode).toBe(200);
    const user = await User.findById(userId).lean();
    expect(user.expoPushToken).toBe(expoPushToken);
  });

  test('PATCH /api/v1/users/me/push-token rifiuta token non Expo', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ expoPushToken: 'not-a-valid-token' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('expoPushToken non valido');
  });
});
