const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

const app = require('../../app');
const Annuncio = require('../../src/models/annuncioModel');
const User = require('../../src/models/userModel');
const Wallet = require('../../src/models/walletModel');

let mongoServer;

function payload(res) {
  return res.body?.data ?? res.body;
}

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
    Annuncio.deleteMany({}),
    User.deleteMany({}),
    Wallet.deleteMany({}),
  ]);
});

describe('Frontend-backend catalog flow: crea -> pubblica -> catalogo', () => {
  test('crea annuncio con foto/base64 e posizione, lo vede nel catalogo, lo modifica e lo elimina', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({
        nome: 'Alessandro',
        cognome: 'Gremes',
        email: 'catalog-flow@test.com',
        password: 'password123',
    });

    expect(register.statusCode).toBe(201);
    const token = payload(register).token;
    expect(token).toBeDefined();

    const dataScadenza = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const create = await request(app)
      .post('/api/annunci')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titolo: 'Scrivania da studio',
        dataScadenza,
        latitudine: 46.0667,
        longitudine: 11.1211,
        oggetto: {
          categoria: 'Mobili',
          descrizione: 'Scrivania in legno con due cassetti',
          dimensioni: 'medio',
          materiale: 'legno',
          foto: ['data:image/png;base64,aW1hZ2UtZmludGE='],
        },
      });

    expect(create.statusCode).toBe(201);
    expect(payload(create).titolo).toBe('Scrivania da studio');
    expect(payload(create).oggetto.foto).toHaveLength(1);
    const annuncioId = payload(create)._id;

    const publicCatalog = await request(app).get('/api/annunci?categoria=Mobili&limit=20');
    expect(publicCatalog.statusCode).toBe(200);
    expect(payload(publicCatalog).data).toHaveLength(1);
    expect(payload(publicCatalog).data[0]._id).toBe(annuncioId);
    expect(payload(publicCatalog).data[0].latitudine).toBeUndefined();
    expect(payload(publicCatalog).data[0].longitudine).toBeUndefined();

    const privateCatalog = await request(app)
      .get('/api/annunci?categoria=Mobili&limit=20')
      .set('Authorization', `Bearer ${token}`);
    expect(privateCatalog.statusCode).toBe(200);
    expect(payload(privateCatalog).data[0].latitudine).toBe(46.0667);
    expect(payload(privateCatalog).data[0].longitudine).toBe(11.1211);

    const detail = await request(app)
      .get(`/api/annunci/${annuncioId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.statusCode).toBe(200);
    expect(payload(detail).oggetto.descrizione).toContain('Scrivania');

    const updatedDeadline = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const update = await request(app)
      .put(`/api/annunci/${annuncioId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        titolo: 'Scrivania da studio aggiornata',
        dataScadenza: updatedDeadline,
        latitudine: 46.07,
        longitudine: 11.13,
        oggetto: {
          categoria: 'Mobili',
          descrizione: 'Scrivania aggiornata',
          dimensioni: 'grande',
          materiale: 'legno',
          foto: ['data:image/png;base64,aW1hZ2UtYWdnaW9ybmF0YQ=='],
        },
      });

    expect(update.statusCode).toBe(200);
    expect(payload(update).titolo).toBe('Scrivania da studio aggiornata');
    expect(payload(update).oggetto.dimensioni).toBe('grande');

    const mine = await request(app)
      .get('/api/annunci/me')
      .set('Authorization', `Bearer ${token}`);
    expect(mine.statusCode).toBe(200);
    expect(payload(mine)).toHaveLength(1);
    expect(payload(mine)[0]._id).toBe(annuncioId);

    const remove = await request(app)
      .delete(`/api/annunci/${annuncioId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(remove.statusCode).toBe(200);

    const afterDelete = await request(app).get('/api/annunci?categoria=Mobili&limit=20');
    expect(afterDelete.statusCode).toBe(200);
    expect(payload(afterDelete).data).toHaveLength(0);
  });
});
