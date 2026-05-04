const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../src/models/userModel');
const { hashPassword } = require('../../src/utils/password');
const { register, login } = require('../../src/controllers/authController');
const { verifyToken } = require('../../src/utils/jwt');

let mongoServer;

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
});

describe('JWT utility', () => {
  test('verifyToken fallisce per JWT scaduto', async () => {
    const token = jwt.sign(
      { id: 'test-id', ruolo: 'user' },
      process.env.JWT_SECRET,
      {
        expiresIn: '-1s',
      }
    );

    expect(() => verifyToken(token)).toThrow('Token expired');
  });
});
