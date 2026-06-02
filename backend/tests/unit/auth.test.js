const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const express = require('express');
const request = require('supertest');
const User = require('../../src/models/userModel');
const { hashPassword } = require('../../src/utils/password');

jest.mock('../../src/services/emailService', () => ({
  sendWelcome: jest.fn(() => Promise.resolve({ skipped: true })),
  sendBookingConfirmation: jest.fn(() => Promise.resolve({ skipped: true })),
  sendSwapCompleted: jest.fn(() => Promise.resolve({ skipped: true })),
}));

const emailService = require('../../src/services/emailService');
const { register, login } = require('../../src/controllers/authController');
const { authLimiter } = require('../../src/middleware/rateLimitMiddleware');
const { verifyToken, signToken } = require('../../src/utils/jwt');

let mongoServer;

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
  jest.clearAllMocks();
});

function createMockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('Auth flow', () => {
  test('register ok restituisce token e utente', async () => {
    const req = {
      body: {
        nome: 'Mario',
        cognome: 'Rossi',
        email: 'mario.rossi@example.com',
        password: 'Password123!',
      },
    };
    const res = createMockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledTimes(1);
    const response = res.json.mock.calls[0][0];
    expect(response.token).toBeDefined();
    expect(response.user).toMatchObject({
      nome: 'Mario',
      cognome: 'Rossi',
      email: 'mario.rossi@example.com',
    });
    expect(response.user.passwordHash).toBeUndefined();
    expect(emailService.sendWelcome).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Mario',
        email: 'mario.rossi@example.com',
      })
    );
  });

  test('register fail se email già esiste', async () => {
    const existingUser = new User({
      idUtente: new mongoose.Types.ObjectId().toString(),
      nome: 'Anna',
      cognome: 'Verdi',
      email: 'anna.verdi@example.com',
      passwordHash: await hashPassword('Password123!'),
      ruolo: 'user',
    });
    await existingUser.save();

    const req = {
      body: {
        nome: 'Anna',
        cognome: 'Verdi',
        email: 'anna.verdi@example.com',
        password: 'Password123!',
      },
    };
    const res = createMockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Email già registrata' })
    );
  });

  test('login ok con credenziali corrette', async () => {
    const password = 'Password123!';
    const user = new User({
      idUtente: new mongoose.Types.ObjectId().toString(),
      nome: 'Luca',
      cognome: 'Bianchi',
      email: 'luca.bianchi@example.com',
      passwordHash: await hashPassword(password),
      ruolo: 'user',
    });
    await user.save();

    const req = {
      body: {
        email: 'luca.bianchi@example.com',
        password,
      },
    };
    const res = createMockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.token).toBeDefined();
    expect(response.user).toMatchObject({ nome: 'Luca', cognome: 'Bianchi' });
  });

  test('login fail con password errata', async () => {
    const password = 'Password123!';
    const user = new User({
      idUtente: new mongoose.Types.ObjectId().toString(),
      nome: 'Giorgio',
      cognome: 'Neri',
      email: 'giorgio.neri@example.com',
      passwordHash: await hashPassword(password),
      ruolo: 'user',
    });
    await user.save();

    const req = {
      body: {
        email: 'giorgio.neri@example.com',
        password: 'WrongPassword!',
      },
    };
    const res = createMockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Credenziali non valide' })
    );
  });

  test('login fail per utente bannato', async () => {
    const password = 'Password123!';
    const user = new User({
      idUtente: new mongoose.Types.ObjectId().toString(),
      nome: 'Paolo',
      cognome: 'Blu',
      email: 'paolo.blu@example.com',
      passwordHash: await hashPassword(password),
      ruolo: 'user',
      bannato: true,
      isSospeso: true,
    });
    await user.save();

    const req = {
      body: {
        email: 'paolo.blu@example.com',
        password,
      },
    };
    const res = createMockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Account bannato' })
    );
  });
});

describe('Auth rate limiter', () => {
  test('limita il sesto tentativo sullo stesso identificatore anche in NODE_ENV=test', async () => {
    const app = express();
    app.use(express.json());
    app.post('/api/v1/auth/login', authLimiter, (req, res) => res.status(200).json({ ok: true }));

    const email = 'limited@example.com';
    await authLimiter.resetKey(`POST:/api/v1/auth/login:${email}`);

    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post('/api/v1/auth/login').send({ email });
      expect(res.statusCode).toBe(200);
    }

    const limited = await request(app).post('/api/v1/auth/login').send({ email });
    expect(limited.statusCode).toBe(429);
    expect(limited.body.error).toMatch(/troppi tentativi/i);
  });
});

describe('JWT utility', () => {
  test('verifyToken fallisce per JWT scaduto', async () => {
    const token = signToken({ id: 'test-id', ruolo: 'user' }, { expiresIn: '-1s' });

    expect(() => verifyToken(token)).toThrow('Token expired');
  });
});
