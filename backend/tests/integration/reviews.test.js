const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

// Imposta JWT_SECRET per i test nel caso non sia presente nel .env
process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

const app = require('../../app');
const Annuncio = require('../../src/models/annuncioModel');
const Prenotazione = require('../../src/models/prenotazioneModel');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Integration Recensioni: OCL #21 — recensione solo su scambio completato', () => {
  let tokenDonatore;
  let tokenAcquirente;
  let tokenEstraneo;
  let annuncioId;
  let prenotazioneId;
  let qrCode;

  // ---------- Setup: swap completo (come in swap.test.js fino a COMPLETATA) ----------

  test('1. Register Donatore, Acquirente e Utente estraneo', async () => {
    const resDonatore = await request(app)
      .post('/api/v1/auth/register')
      .send({
        nome: 'Anna',
        cognome: 'Bianchi',
        email: 'donatore-rec@test.com',
        password: 'password123',
      });
    expect(resDonatore.statusCode).toBe(201);
    tokenDonatore = resDonatore.body.token;

    const resAcquirente = await request(app)
      .post('/api/v1/auth/register')
      .send({
        nome: 'Marco',
        cognome: 'Neri',
        email: 'acquirente-rec@test.com',
        password: 'password123',
      });
    expect(resAcquirente.statusCode).toBe(201);
    tokenAcquirente = resAcquirente.body.token;

    // Utente estraneo: non partecipa allo scambio
    const resEstraneo = await request(app)
      .post('/api/v1/auth/register')
      .send({
        nome: 'Luca',
        cognome: 'Gialli',
        email: 'estraneo-rec@test.com',
        password: 'password123',
      });
    expect(resEstraneo.statusCode).toBe(201);
    tokenEstraneo = resEstraneo.body.token;
  });

  test('2. Donatore crea un annuncio', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 giorni
    const resAnnuncio = await request(app)
      .post('/api/v1/annunci')
      .set('Authorization', `Bearer ${tokenDonatore}`)
      .send({
        titolo: 'Tavolo da cucina',
        dataScadenza: futureDate.toISOString(),
        latitudine: 46.0,
        longitudine: 11.0,
        oggetto: {
          categoria: 'Mobili',
          descrizione: 'Tavolo in buone condizioni',
          dimensioni: 'grande',
          materiale: 'legno',
        },
      });

    expect(resAnnuncio.statusCode).toBe(201);
    annuncioId = resAnnuncio.body._id || resAnnuncio.body.annuncio?._id;

    if (!annuncioId) {
      const annuncioDb = await Annuncio.findOne({ titolo: 'Tavolo da cucina' });
      annuncioId = annuncioDb._id.toString();
    }
    expect(annuncioId).toBeDefined();
  });

  test('3. Acquirente prenota l\'annuncio', async () => {
    const resPrenota = await request(app)
      .post('/api/v1/prenotazioni')
      .set('Authorization', `Bearer ${tokenAcquirente}`)
      .send({ annuncioId });

    expect(resPrenota.statusCode).toBe(201);
    expect(resPrenota.body.prenotazione).toBeDefined();
    prenotazioneId = resPrenota.body.prenotazione._id;
  });

  // ---------- Caso 5: Recensione su prenotazione NON COMPLETATA → 409 (OCL #21) ----------

  test('5. Recensione su prenotazione non COMPLETATA → 409 (OCL #21)', async () => {
    // La prenotazione è ATTIVA, non ancora COMPLETATA
    const prenotaDb = await Prenotazione.findById(prenotazioneId);
    expect(prenotaDb.stato).toBe('ATTIVA');

    const res = await request(app)
      .post('/api/v1/recensioni')
      .set('Authorization', `Bearer ${tokenAcquirente}`)
      .send({
        prenotazioneId,
        positiva: true,
        testo: 'Tentativo prematuro',
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('Puoi recensire solo uno scambio completato');
  });

  // ---------- Completamento swap via QR ----------

  test('4a. Donatore genera il QR Code', async () => {
    const resQR = await request(app)
      .post('/api/v1/qr/genera')
      .set('Authorization', `Bearer ${tokenDonatore}`)
      .send({ prenotazioneId });

    expect(resQR.statusCode).toBe(201);
    expect(resQR.body.codice).toBeDefined();
    qrCode = resQR.body.codice;
  });

  test('4b. Acquirente valida il QR Code → Scambio COMPLETATA', async () => {
    const resValida = await request(app)
      .post('/api/v1/qr/valida')
      .set('Authorization', `Bearer ${tokenAcquirente}`)
      .send({ codice: qrCode });

    expect(resValida.statusCode).toBe(200);
    expect(resValida.body.message).toBe('Scambio validato con successo');

    // Verifica su DB
    const prenotaDb = await Prenotazione.findById(prenotazioneId);
    expect(prenotaDb.stato).toBe('COMPLETATA');

    const annuncioDb = await Annuncio.findById(annuncioId);
    expect(annuncioDb.stato).toBe('RITIRATO');
  });

  // ---------- Caso 2: Recensione positiva di Acquirente verso Donatore → 201 ----------

  test('6. Recensione positiva di Acquirente verso Donatore → 201', async () => {
    const res = await request(app)
      .post('/api/v1/recensioni')
      .set('Authorization', `Bearer ${tokenAcquirente}`)
      .send({
        prenotazioneId,
        positiva: true,
        testo: 'Donatore puntuale e gentile',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.positiva).toBe(true);
    expect(res.body.testo).toBe('Donatore puntuale e gentile');
    expect(res.body.prenotazione).toBe(prenotazioneId);
  });

  // ---------- Caso 3: Seconda recensione stesso utente/prenotazione → 409 (OCL #21) ----------

  test('7. Seconda recensione stesso utente/prenotazione → 409 (OCL #21)', async () => {
    const res = await request(app)
      .post('/api/v1/recensioni')
      .set('Authorization', `Bearer ${tokenAcquirente}`)
      .send({
        prenotazioneId,
        positiva: false,
        testo: 'Tentativo duplicato',
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('Hai già lasciato una recensione per questo scambio');
  });

  // ---------- Caso 4: Recensione da utente non partecipante → 403 ----------

  test('8. Recensione da utente non partecipante → 403', async () => {
    const res = await request(app)
      .post('/api/v1/recensioni')
      .set('Authorization', `Bearer ${tokenEstraneo}`)
      .send({
        prenotazioneId,
        positiva: true,
        testo: 'Non dovrei poter recensire',
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Solo i partecipanti dello scambio possono recensire');
  });
});
