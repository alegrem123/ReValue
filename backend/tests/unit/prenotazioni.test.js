const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';

const app = require('../../app');
const Annuncio = require('../../src/models/annuncioModel');
const Prenotazione = require('../../src/models/prenotazioneModel');
const User = require('../../src/models/userModel');
const Wallet = require('../../src/models/walletModel');

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
  await Prenotazione.deleteMany({});
  await Annuncio.deleteMany({});
  await User.deleteMany({});
  await Wallet.deleteMany({});
});

async function createUser(email) {
  return User.create({
    idUtente: new mongoose.Types.ObjectId().toString(),
    nome: 'Test',
    cognome: 'User',
    email,
    passwordHash: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36DRj75O',
    ruolo: 'user',
  });
}

describe('Prenotazioni - modello', () => {
  test('salva e popola il donatore della prenotazione', async () => {
    const donatore = await createUser('donatore@example.com');
    const acquirente = await createUser('acquirente@example.com');
    const annuncio = await Annuncio.create({
      donatore: donatore._id,
      titolo: 'Scrivania',
      dataScadenza: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      oggetto: {
        categoria: 'Mobili',
        descrizione: 'Scrivania in buone condizioni',
      },
    });

    const prenotazione = await Prenotazione.create({
      annuncio: annuncio._id,
      acquirente: acquirente._id,
      donatore: donatore._id,
    });

    expect(prenotazione.donatore).toEqual(donatore._id);

    const populated = await Prenotazione.findById(prenotazione._id).populate(
      'donatore',
      'nome cognome email'
    );

    expect(populated.donatore.email).toBe('donatore@example.com');
  });

  test('rifiuta una prenotazione senza donatore', async () => {
    const acquirente = await createUser('acquirente@example.com');
    const donatore = await createUser('donatore@example.com');
    const annuncio = await Annuncio.create({
      donatore: donatore._id,
      titolo: 'Sedia',
      dataScadenza: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      oggetto: {
        categoria: 'Mobili',
        descrizione: 'Sedia in legno',
      },
    });

    await expect(
      Prenotazione.create({
        annuncio: annuncio._id,
        acquirente: acquirente._id,
      })
    ).rejects.toThrow();
  });
});

describe('Prenotazioni - vincoli controller', () => {
  test('TC17 / OCL #4: il donatore non può prenotare il proprio annuncio', async () => {
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({
        nome: 'Alessandro',
        cognome: 'Gremes',
        email: 'tc17-donatore@test.com',
        password: 'password123',
      });

    expect(register.statusCode).toBe(201);
    const token = register.body.token;

    const create = await request(app)
      .post('/api/v1/annunci')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titolo: 'Libreria piccola',
        dataScadenza: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        oggetto: {
          categoria: 'Mobili',
          descrizione: 'Libreria in buono stato',
        },
      });

    expect(create.statusCode).toBe(201);

    const selfBooking = await request(app)
      .post('/api/v1/prenotazioni')
      .set('Authorization', `Bearer ${token}`)
      .send({ annuncioId: create.body._id });

    expect(selfBooking.statusCode).toBe(409);
    expect(selfBooking.body).toEqual(
      expect.objectContaining({
        error: 'Non puoi prenotare il tuo stesso annuncio',
      })
    );
  });
});
