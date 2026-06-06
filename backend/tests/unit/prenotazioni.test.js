const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';

const app = require('../../app');
const Annuncio = require('../../src/models/annuncioModel');
const Prenotazione = require('../../src/models/prenotazioneModel');
const User = require('../../src/models/userModel');
const Wallet = require('../../src/models/walletModel');

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
    passwordHash: 'a109e36947ad56de1dca1cc49f0ef8ac9ad9a7b1aa0df41fb3c4cb73c1ff01ea',
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

  test('salva e restituisce i crediti calcolati al momento della prenotazione', async () => {
    const donorRegister = await request(app)
      .post('/api/v1/auth/register')
      .send({
        nome: 'Dina',
        cognome: 'Donor',
        email: 'crediti-donor@test.com',
        password: 'password123',
      });
    const buyerRegister = await request(app)
      .post('/api/v1/auth/register')
      .send({
        nome: 'Bruno',
        cognome: 'Buyer',
        email: 'crediti-buyer@test.com',
        password: 'password123',
      });

    expect(donorRegister.statusCode).toBe(201);
    expect(buyerRegister.statusCode).toBe(201);

    const create = await request(app)
      .post('/api/v1/annunci')
      .set('Authorization', `Bearer ${donorRegister.body.token}`)
      .send({
        titolo: 'Monitor funzionante',
        dataScadenza: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        oggetto: {
          categoria: 'Elettronica',
          descrizione: 'Monitor in buono stato',
        },
      });

    expect(create.statusCode).toBe(201);

    const booking = await request(app)
      .post('/api/v1/prenotazioni')
      .set('Authorization', `Bearer ${buyerRegister.body.token}`)
      .send({ annuncioId: create.body._id });

    expect(booking.statusCode).toBe(201);
    expect(booking.body.creditiAssegnati).toEqual({
      donatore: expect.any(Number),
      acquirente: expect.any(Number),
    });
    expect(booking.body.creditiAssegnati.donatore).toBeGreaterThan(20);
    expect(booking.body.creditiAssegnati.acquirente).toBeGreaterThan(10);

    const saved = await Prenotazione.findById(booking.body.prenotazione._id);
    expect(saved.creditiDonatore).toBe(booking.body.creditiAssegnati.donatore);
    expect(saved.creditiAcquirente).toBe(booking.body.creditiAssegnati.acquirente);
  });
});
