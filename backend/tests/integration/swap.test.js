const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Imposta JWT_SECRET per i test nel caso non sia presente nel .env
process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

const app = require('../../app');
const Annuncio = require('../../src/models/annuncioModel');
const Prenotazione = require('../../src/models/prenotazioneModel');

let mongoServer;

function payload(res) {
  return res.body?.data ?? res.body;
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Integration Flow E2E: register -> annuncio -> prenota -> QR -> completata', () => {
  let tokenDonatore;
  let tokenAcquirente;
  let annuncioId;
  let prenotazioneId;
  let qrCode;

  test('1. Register Donatore e Acquirente', async () => {
    // Registra il Donatore
    const resDonatore = await request(app)
      .post('/api/v1/auth/register')
      .send({
        nome: 'Mario',
        cognome: 'Rossi',
        email: 'donatore@test.com',
        password: 'password123'
    });
    expect(resDonatore.statusCode).toBe(201);
    tokenDonatore = payload(resDonatore).token;

    // Registra l'Acquirente
    const resAcquirente = await request(app)
      .post('/api/v1/auth/register')
      .send({
        nome: 'Luigi',
        cognome: 'Verdi',
        email: 'acquirente@test.com',
        password: 'password123'
    });
    expect(resAcquirente.statusCode).toBe(201);
    tokenAcquirente = payload(resAcquirente).token;
  });

  test('2. Donatore crea un annuncio', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 giorni
    const resAnnuncio = await request(app)
      .post('/api/v1/annunci')
      .set('Authorization', `Bearer ${tokenDonatore}`)
      .send({
        titolo: 'Sedia di legno',
        dataScadenza: futureDate.toISOString(),
        latitudine: 46.0,
        longitudine: 11.0,
        oggetto: {
          categoria: 'Mobili',
          descrizione: 'Una bella sedia',
          dimensioni: 'piccolo',
          materiale: 'legno'
        }
      });
      
    expect(resAnnuncio.statusCode).toBe(201);
    // Supponendo che il controller ritorni l'annuncio creato
    annuncioId = payload(resAnnuncio)._id || payload(resAnnuncio).annuncio?._id;

    // Fallback: se la response è strutturata diversamente, leggiamolo dal DB
    if (!annuncioId) {
      const annuncioDb = await Annuncio.findOne({ titolo: 'Sedia di legno' });
      annuncioId = annuncioDb._id.toString();
    }
    expect(annuncioId).toBeDefined();
  });

  test('3. Acquirente prenota l\'annuncio', async () => {
    const resPrenota = await request(app)
      .post('/api/v1/prenotazioni')
      .set('Authorization', `Bearer ${tokenAcquirente}`)
      .send({
        annuncioId: annuncioId
      });
      
    expect(resPrenota.statusCode).toBe(201);
    expect(payload(resPrenota).prenotazione).toBeDefined();
    prenotazioneId = payload(resPrenota).prenotazione._id;
  });

  test('4. Donatore genera il QR Code', async () => {
    const resQR = await request(app)
      .post('/api/v1/qr/genera')
      .set('Authorization', `Bearer ${tokenDonatore}`)
      .send({
        prenotazioneId: prenotazioneId
      });
      
    expect(resQR.statusCode).toBe(201);
    expect(payload(resQR).codice).toBeDefined();
    qrCode = payload(resQR).codice;
  });

  test('5. Acquirente valida il QR Code (Scambio Completato)', async () => {
    const resValida = await request(app)
      .post('/api/v1/qr/valida')
      .set('Authorization', `Bearer ${tokenAcquirente}`)
      .send({
        codice: qrCode
      });
      
    expect(resValida.statusCode).toBe(200);
    expect(payload(resValida).message).toBe('Scambio validato con successo');

    // Verifica su DB che lo stato sia aggiornato
    const prenotaDb = await Prenotazione.findById(prenotazioneId);
    expect(prenotaDb.stato).toBe('COMPLETATA');

    const annuncioDb = await Annuncio.findById(annuncioId);
    expect(annuncioDb.stato).toBe('RITIRATO');
  });

  test('6. Verifica accreditamento punti nel Wallet per entrambi', async () => {
    const resWalletD = await request(app)
      .get('/api/v1/wallet/me')
      .set('Authorization', `Bearer ${tokenDonatore}`);
    
    expect(resWalletD.statusCode).toBe(200);
    expect(payload(resWalletD).bilancio).toBe(50); // Valore di base assegnato in qrController.js
    
    const resWalletA = await request(app)
      .get('/api/v1/wallet/me')
      .set('Authorization', `Bearer ${tokenAcquirente}`);
      
    expect(resWalletA.statusCode).toBe(200);
    expect(payload(resWalletA).bilancio).toBe(50);
  });
});
