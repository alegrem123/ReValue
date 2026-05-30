/**
 * Test di regressione – QR Controller edge cases
 *
 * Copre i 4 bug fix applicati a qrController.js:
 *
 *  BUG #1 – generaQR su prenotazione COMPLETATA → 409 (era 404)
 *  BUG #2 – generaQR su prenotazione ANNULLATA  → 409 (era 404)
 *  BUG #3 – validaQR con token scaduto (rimasto in DB prima del TTL job)
 *            → 400 "Codice QR scaduto" (era 400 ma messaggio generico)
 *  BUG #4 – validaQR con prenotazione ANNULLATA → 409 con messaggio
 *            specifico (era 400 "Prenotazione non più attiva")
 *
 * Riferimenti: OCL #13, OCL #14, RF17, RF27.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

const app = require('../../app');
const TokenQR = require('../../src/models/tokenQRModel');
const Prenotazione = require('../../src/models/prenotazioneModel');
const Annuncio = require('../../src/models/annuncioModel');

let mongoServer;

function payload(res) {
  return res.body?.data ?? res.body;
}

function message(res) {
  return res.body?.message ?? res.body?.error;
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function registra(email, nome) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ nome, cognome: 'Test', email, password: 'Password123!' });
  expect(res.statusCode).toBe(201);
  return payload(res).token;
}

async function creaAnnuncio(token) {
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const res = await request(app)
    .post('/api/v1/annunci')
    .set('Authorization', `Bearer ${token}`)
    .send({
      titolo: 'Lampada da terra',
      dataScadenza: futureDate.toISOString(),
      latitudine: 46.0,
      longitudine: 11.0,
      oggetto: {
        categoria: 'Arredamento',
        descrizione: 'Lampada funzionante',
        dimensioni: 'medio',
        materiale: 'metallo',
      },
    });
  expect(res.statusCode).toBe(201);
  const id = payload(res)._id ?? payload(res).annuncio?._id;
  if (id) return id;
  const doc = await Annuncio.findOne({ titolo: 'Lampada da terra' });
  return doc._id.toString();
}

async function prenota(token, annuncioId) {
  const res = await request(app)
    .post('/api/v1/prenotazioni')
    .set('Authorization', `Bearer ${token}`)
    .send({ annuncioId });
  expect(res.statusCode).toBe(201);
  return payload(res).prenotazione._id;
}

async function generaQRToken(tokenDonatore, prenotazioneId) {
  const res = await request(app)
    .post('/api/v1/qr/genera')
    .set('Authorization', `Bearer ${tokenDonatore}`)
    .send({ prenotazioneId });
  expect(res.statusCode).toBe(201);
  return payload(res).codice;
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('QR Edge Cases – test di regressione bug fix', () => {
  // Ogni test usa la propria coppia donatore/acquirente per isolamento.

  describe('QR gia usato - validaQR sullo stesso codice due volte', () => {
    let tokenD, tokenA, annId, prenId, qrCode;

    beforeAll(async () => {
      tokenD = await registra('d-used.qredge@test.com', 'DonatoreUsed');
      tokenA = await registra('a-used.qredge@test.com', 'AcquirenteUsed');
      annId  = await creaAnnuncio(tokenD);
      prenId = await prenota(tokenA, annId);
      qrCode = await generaQRToken(tokenD, prenId);

      const res = await request(app)
        .post('/api/v1/qr/valida')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ codice: qrCode });
      expect(res.statusCode).toBe(200);
    });

    test('ritorna 400 con messaggio "gia utilizzato"', async () => {
      const res = await request(app)
        .post('/api/v1/qr/valida')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ codice: qrCode });

      expect(res.statusCode).toBe(400);
      expect(message(res)).toMatch(/utilizzato/i);
    });
  });

  // ── BUG #1: generaQR su prenotazione COMPLETATA ──────────────────────────

  describe('BUG #1 – generaQR su prenotazione COMPLETATA', () => {
    let tokenD, tokenA, annId, prenId, qrCode;

    beforeAll(async () => {
      tokenD = await registra('d1.qredge@test.com', 'Donatore1');
      tokenA = await registra('a1.qredge@test.com', 'Acquirente1');
      annId  = await creaAnnuncio(tokenD);
      prenId = await prenota(tokenA, annId);
      qrCode = await generaQRToken(tokenD, prenId);

      // Completa lo scambio tramite validazione QR
      const res = await request(app)
        .post('/api/v1/qr/valida')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ codice: qrCode });
      expect(res.statusCode).toBe(200);
    });

    test('ritorna 409 con messaggio "completato" (non 404)', async () => {
      const res = await request(app)
        .post('/api/v1/qr/genera')
        .set('Authorization', `Bearer ${tokenD}`)
        .send({ prenotazioneId: prenId });

      expect(res.statusCode).toBe(409);
      expect(message(res)).toMatch(/completato/i);
    });
  });

  // ── BUG #2: generaQR su prenotazione ANNULLATA ───────────────────────────

  describe('BUG #2 – generaQR su prenotazione ANNULLATA', () => {
    let tokenD, tokenA, annId, prenId;

    beforeAll(async () => {
      tokenD = await registra('d2.qredge@test.com', 'Donatore2');
      tokenA = await registra('a2.qredge@test.com', 'Acquirente2');
      annId  = await creaAnnuncio(tokenD);
      prenId = await prenota(tokenA, annId);

      // L'acquirente annulla entro 15 minuti
      const res = await request(app)
        .delete(`/api/v1/prenotazioni/${prenId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.statusCode).toBe(200);
    });

    test('ritorna 409 con messaggio "annullata" (non 404)', async () => {
      const res = await request(app)
        .post('/api/v1/qr/genera')
        .set('Authorization', `Bearer ${tokenD}`)
        .send({ prenotazioneId: prenId });

      expect(res.statusCode).toBe(409);
      expect(message(res)).toMatch(/annullata/i);
    });
  });

  // ── BUG #3: validaQR con token scaduto (ancora in DB) ────────────────────

  describe('BUG #3 – validaQR con token scaduto prima del TTL job', () => {
    let tokenD, tokenA, annId, prenId;

    beforeAll(async () => {
      tokenD = await registra('d3.qredge@test.com', 'Donatore3');
      tokenA = await registra('a3.qredge@test.com', 'Acquirente3');
      annId  = await creaAnnuncio(tokenD);
      prenId = await prenota(tokenA, annId);
    });

    test('ritorna 400 "Codice QR scaduto" quando scadenza è nel passato ma il documento esiste ancora', async () => {
      // Inseriamo direttamente un TokenQR già scaduto (simula il periodo
      // tra la scadenza naturale e il passaggio del TTL cleanup job).
      const scadenzaPassata = new Date(Date.now() - 1000); // 1 secondo fa
      const tokenDoc = await TokenQR.create({
        prenotazione: prenId,
        codice: 'codice-scaduto-test-' + Date.now(),
        scadenza: scadenzaPassata,
        usato: false,
      });

      const res = await request(app)
        .post('/api/v1/qr/valida')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ codice: tokenDoc.codice });

      expect(res.statusCode).toBe(400);
      expect(message(res)).toMatch(/scaduto/i);

      // Cleanup
      await TokenQR.deleteOne({ _id: tokenDoc._id });
    });
  });

  // ── BUG #4: validaQR con prenotazione ANNULLATA – messaggio specifico ─────

  describe('BUG #4 – validaQR con prenotazione ANNULLATA', () => {
    let tokenD, tokenA, annId, prenId;

    beforeAll(async () => {
      tokenD = await registra('d4.qredge@test.com', 'Donatore4');
      tokenA = await registra('a4.qredge@test.com', 'Acquirente4');
      annId  = await creaAnnuncio(tokenD);
      prenId = await prenota(tokenA, annId);
    });

    test('ritorna 409 con messaggio "annullata" quando il token è valido ma la prenotazione è ANNULLATA', async () => {
      // Creiamo un token valido e poi annulliamo la prenotazione a DB
      // (simuliamo lo scenario: no-show, token ancora non rimosso).
      const tokenDoc = await TokenQR.create({
        prenotazione: prenId,
        codice: 'codice-annullato-test-' + Date.now(),
        scadenza: new Date(Date.now() + 60 * 60 * 1000), // scade tra 1h
        usato: false,
      });

      // Forziamo la prenotazione ad ANNULLATA direttamente nel DB
      await Prenotazione.findByIdAndUpdate(prenId, { stato: 'ANNULLATA' });

      const res = await request(app)
        .post('/api/v1/qr/valida')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ codice: tokenDoc.codice });

      expect(res.statusCode).toBe(409);
      expect(message(res)).toMatch(/annullata/i);

      // Cleanup
      await TokenQR.deleteOne({ _id: tokenDoc._id });
    });
  });
});
