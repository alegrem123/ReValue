const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

const app = require('../../app');
const Annuncio = require('../../src/models/annuncioModel');
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
  await Promise.all([
    Annuncio.deleteMany({}),
    User.deleteMany({}),
    Wallet.deleteMany({}),
  ]);
});

describe('Frontend-backend catalog flow: crea -> pubblica -> catalogo', () => {
  test('crea annuncio con foto/base64 e posizione, lo vede nel catalogo, lo modifica e lo elimina', async () => {
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({
        nome: 'Alessandro',
        cognome: 'Gremes',
        email: 'catalog-flow@test.com',
        password: 'password123',
      });

    expect(register.statusCode).toBe(201);
    const token = register.body.token;
    expect(token).toBeDefined();

    const registerViewer = await request(app)
      .post('/api/v1/auth/register')
      .send({
        nome: 'Giulia',
        cognome: 'Viewer',
        email: 'catalog-viewer@test.com',
        password: 'password123',
      });
    expect(registerViewer.statusCode).toBe(201);
    const viewerToken = registerViewer.body.token;

    const dataScadenza = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const create = await request(app)
      .post('/api/v1/annunci')
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
    expect(create.body.titolo).toBe('Scrivania da studio');
    expect(create.body.oggetto.foto).toHaveLength(1);
    const annuncioId = create.body._id;

    const publicCatalog = await request(app).get('/api/v1/annunci?categoria=Mobili&limit=20');
    expect(publicCatalog.statusCode).toBe(200);
    expect(publicCatalog.body.data).toHaveLength(1);
    expect(publicCatalog.body.data[0]._id).toBe(annuncioId);
    expect(publicCatalog.body.data[0].latitudine).toBeUndefined();
    expect(publicCatalog.body.data[0].longitudine).toBeUndefined();

    const privateCatalog = await request(app)
      .get('/api/v1/annunci?categoria=Mobili&limit=20')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(privateCatalog.statusCode).toBe(200);
    expect(privateCatalog.body.data[0].latitudine).toBeUndefined();
    expect(privateCatalog.body.data[0].longitudine).toBeUndefined();

    const detail = await request(app)
      .get(`/api/v1/annunci/${annuncioId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.body.latitudine).toBeUndefined();
    expect(detail.body.longitudine).toBeUndefined();
    expect(detail.body.oggetto.descrizione).toContain('Scrivania');

    const updatedDeadline = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const update = await request(app)
      .put(`/api/v1/annunci/${annuncioId}`)
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
    expect(update.body.titolo).toBe('Scrivania da studio aggiornata');
    expect(update.body.oggetto.dimensioni).toBe('grande');

    const mine = await request(app)
      .get('/api/v1/annunci/me')
      .set('Authorization', `Bearer ${token}`);
    expect(mine.statusCode).toBe(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0]._id).toBe(annuncioId);

    const booking = await request(app)
      .post('/api/v1/prenotazioni')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ annuncioId });
    expect(booking.statusCode).toBe(201);
    const prenotazioneId = booking.body.prenotazione._id;
    expect(booking.body.indirizzo).toEqual({
      latitudine: 46.07,
      longitudine: 11.13,
    });

    const detailAfterBooking = await request(app)
      .get(`/api/v1/annunci/${annuncioId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(detailAfterBooking.statusCode).toBe(200);
    expect(detailAfterBooking.body.latitudine).toBe(46.07);
    expect(detailAfterBooking.body.longitudine).toBe(11.13);

    const cancel = await request(app)
      .delete(`/api/v1/prenotazioni/${prenotazioneId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(cancel.statusCode).toBe(200);

    const remove = await request(app)
      .delete(`/api/v1/annunci/${annuncioId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(remove.statusCode).toBe(200);

    const afterDelete = await request(app).get('/api/v1/annunci?categoria=Mobili&limit=20');
    expect(afterDelete.statusCode).toBe(200);
    expect(afterDelete.body.data).toHaveLength(0);
  });
});
