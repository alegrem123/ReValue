/**
 * Test di integrazione – QR Controller edge cases
 *
 * Copertura completa degli scenari critici legati alla validazione
 * e generazione del QR Code, in conformità con i vincoli OCL del D2.
 *
 *  SCENARIO 1 – QR già usato (validaQR doppia)               → 409
 *  SCENARIO 2 – QR scaduto (token in DB ma scadenza passata)  → 410
 *  SCENARIO 3 – Token non trovato (codice inesistente)        → 404
 *  SCENARIO 4 – Prenotazione non ATTIVA (ANNULLATA)           → 409
 *  SCENARIO 5 – Prenotazione non ATTIVA (COMPLETATA)          → 409
 *  SCENARIO 6 – generaQR su prenotazione COMPLETATA           → 409
 *  SCENARIO 7 – generaQR su prenotazione ANNULLATA            → 409
 *  SCENARIO 8 – OCL #17: wallet saldo ≥ 0 dopo scambio       → verifica
 *
 * Riferimenti OCL: #13 (postcondizione generaQR), #14 (pre/post validaQR),
 *                  #15 (QR corrisponde alla prenotazione — enforced by findTokenByCodice),
 *                  #17 (saldo wallet non negativo).
 * Riferimenti RF:  RF17, RF27.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

const app = require('../../app');
const TokenQR = require('../../src/models/tokenQRModel');
const Prenotazione = require('../../src/models/prenotazioneModel');
const Annuncio = require('../../src/models/annuncioModel');
const Wallet = require('../../src/models/walletModel');

let mongoServer;

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Registra un utente e restituisce il JWT. */
async function registra(email, nome) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ nome, cognome: 'Test', email, password: 'Password123!' });
  expect(res.statusCode).toBe(201);
  return res.body.token;
}

/** Crea un annuncio con scadenza a 7gg e restituisce l'id. */
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
  const id = res.body._id ?? res.body.annuncio?._id;
  if (id) return id;
  const doc = await Annuncio.findOne({ titolo: 'Lampada da terra' });
  return doc._id.toString();
}

/** Prenota un annuncio e restituisce l'id della prenotazione. */
async function prenota(token, annuncioId) {
  const res = await request(app)
    .post('/api/v1/prenotazioni')
    .set('Authorization', `Bearer ${token}`)
    .send({ annuncioId });
  expect(res.statusCode).toBe(201);
  return res.body.prenotazione._id;
}

/** Genera un QR per la prenotazione e restituisce il codice. */
async function generaQRToken(tokenDonatore, prenotazioneId) {
  const res = await request(app)
    .post('/api/v1/qr/genera')
    .set('Authorization', `Bearer ${tokenDonatore}`)
    .send({ prenotazioneId });
  expect(res.statusCode).toBe(201);
  return res.body.codice;
}

/** Helper per ottenere l'userId dal JWT (decodifica il payload). */
function getUserIdFromToken(jwt) {
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
  return payload.id;
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('QR Edge Cases – copertura OCL #13, #14, #15', () => {
  // Ogni describe usa la propria coppia donatore/acquirente per isolamento.

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: QR già usato → 409 (OCL #14: token usato = conflitto di stato)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('SCENARIO 1 – validaQR con QR già usato → 409', () => {
    let tokenD, tokenA, annId, prenId, qrCode;

    beforeAll(async () => {
      tokenD = await registra('d-used.qredge@test.com', 'DonatoreUsed');
      tokenA = await registra('a-used.qredge@test.com', 'AcquirenteUsed');
      annId  = await creaAnnuncio(tokenD);
      prenId = await prenota(tokenA, annId);
      qrCode = await generaQRToken(tokenD, prenId);

      // Prima scansione → successo
      const res = await request(app)
        .post('/api/v1/qr/valida')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ codice: qrCode });
      expect(res.statusCode).toBe(200);
    });

    test('ritorna 409 con messaggio "già utilizzato"', async () => {
      const res = await request(app)
        .post('/api/v1/qr/valida')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ codice: qrCode });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toMatch(/utilizzato/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: QR scaduto → 410 (OCL #14: token.scadenza < now → Gone)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('SCENARIO 2 – validaQR con token scaduto → 410', () => {
    let tokenD, tokenA, annId, prenId;

    beforeAll(async () => {
      tokenD = await registra('d-exp.qredge@test.com', 'DonatoreExp');
      tokenA = await registra('a-exp.qredge@test.com', 'AcquirenteExp');
      annId  = await creaAnnuncio(tokenD);
      prenId = await prenota(tokenA, annId);
    });

    test('ritorna 410 "Codice QR scaduto" quando scadenza è nel passato ma il documento esiste ancora', async () => {
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

      expect(res.statusCode).toBe(410);
      expect(res.body.error).toMatch(/scaduto/i);

      // Cleanup
      await TokenQR.deleteOne({ _id: tokenDoc._id });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: Token non trovato → 404 (codice inesistente)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('SCENARIO 3 – validaQR con codice inesistente → 404', () => {
    let tokenA;

    beforeAll(async () => {
      tokenA = await registra('a-notfound.qredge@test.com', 'AcquirenteNotFound');
    });

    test('ritorna 404 quando il codice QR non esiste nel database', async () => {
      const res = await request(app)
        .post('/api/v1/qr/valida')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ codice: 'codice-completamente-inventato-abc123' });

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toMatch(/non valido|non esistente|scaduto/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: validaQR con prenotazione ANNULLATA → 409
  //             (OCL #14: pre: prenotazione.stato = ATTIVA)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('SCENARIO 4 – validaQR con prenotazione ANNULLATA → 409', () => {
    let tokenD, tokenA, annId, prenId;

    beforeAll(async () => {
      tokenD = await registra('d-ann.qredge@test.com', 'DonatoreAnn');
      tokenA = await registra('a-ann.qredge@test.com', 'AcquirenteAnn');
      annId  = await creaAnnuncio(tokenD);
      prenId = await prenota(tokenA, annId);
    });

    test('ritorna 409 con messaggio "annullata" quando il token è valido ma la prenotazione è ANNULLATA', async () => {
      // Creiamo un token valido e poi forziamo la prenotazione ad ANNULLATA
      // (simula lo scenario: no-show, token ancora non rimosso).
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
      expect(res.body.error).toMatch(/annullata/i);

      // Cleanup
      await TokenQR.deleteOne({ _id: tokenDoc._id });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 5: validaQR con prenotazione COMPLETATA → 409
  //             (OCL #14: pre: prenotazione.stato = ATTIVA)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('SCENARIO 5 – validaQR con prenotazione COMPLETATA → 409', () => {
    let tokenD, tokenA, annId, prenId;

    beforeAll(async () => {
      tokenD = await registra('d-comp.qredge@test.com', 'DonatoreComp');
      tokenA = await registra('a-comp.qredge@test.com', 'AcquirenteComp');
      annId  = await creaAnnuncio(tokenD);
      prenId = await prenota(tokenA, annId);
    });

    test('ritorna 409 con messaggio "completato" quando la prenotazione è già COMPLETATA', async () => {
      // Creiamo un token valido e poi forziamo la prenotazione a COMPLETATA
      const tokenDoc = await TokenQR.create({
        prenotazione: prenId,
        codice: 'codice-completata-test-' + Date.now(),
        scadenza: new Date(Date.now() + 60 * 60 * 1000),
        usato: false,
      });

      // Forziamo la prenotazione a COMPLETATA direttamente nel DB
      await Prenotazione.findByIdAndUpdate(prenId, { stato: 'COMPLETATA' });

      const res = await request(app)
        .post('/api/v1/qr/valida')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ codice: tokenDoc.codice });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toMatch(/completato|utilizzato/i);

      // Cleanup
      await TokenQR.deleteOne({ _id: tokenDoc._id });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 6: generaQR su prenotazione COMPLETATA → 409
  //             (OCL #13: pre: prenotazione.stato = ATTIVA per generazione)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('SCENARIO 6 – generaQR su prenotazione COMPLETATA → 409', () => {
    let tokenD, tokenA, annId, prenId, qrCode;

    beforeAll(async () => {
      tokenD = await registra('d-gencomp.qredge@test.com', 'DonatoreGenComp');
      tokenA = await registra('a-gencomp.qredge@test.com', 'AcquirenteGenComp');
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
      expect(res.body.error).toMatch(/completato/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 7: generaQR su prenotazione ANNULLATA → 409
  //             (OCL #13: pre: prenotazione.stato = ATTIVA per generazione)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('SCENARIO 7 – generaQR su prenotazione ANNULLATA → 409', () => {
    let tokenD, tokenA, annId, prenId;

    beforeAll(async () => {
      tokenD = await registra('d-genann.qredge@test.com', 'DonatoreGenAnn');
      tokenA = await registra('a-genann.qredge@test.com', 'AcquirenteGenAnn');
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
      expect(res.body.error).toMatch(/annullata/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 8: OCL #17 – Wallet saldo ≥ 0 dopo scambio validato
  //             Verifica che i crediti vengano accreditati correttamente
  //             e che il bilancio non diventi mai negativo.
  // ═══════════════════════════════════════════════════════════════════════════

  describe('SCENARIO 8 – OCL #17: saldo wallet ≥ 0 dopo scambio con QR', () => {
    let tokenD, tokenA, annId, prenId, qrCode;

    beforeAll(async () => {
      tokenD = await registra('d-wallet.qredge@test.com', 'DonatoreWallet');
      tokenA = await registra('a-wallet.qredge@test.com', 'AcquirenteWallet');
      annId  = await creaAnnuncio(tokenD);
      prenId = await prenota(tokenA, annId);
      qrCode = await generaQRToken(tokenD, prenId);
    });

    test('dopo scambio validato il wallet di entrambi gli utenti ha saldo ≥ 0', async () => {
      // Valida QR → scambio completato → accredito crediti
      const res = await request(app)
        .post('/api/v1/qr/valida')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ codice: qrCode });
      expect(res.statusCode).toBe(200);
      expect(res.body.creditiAssegnati).toBeGreaterThan(0);

      // Verifica Wallet Donatore (OCL #17: bilancio ≥ 0)
      const donatoreId = getUserIdFromToken(tokenD);
      const walletDonatore = await Wallet.findOne({ idUtente: donatoreId });
      expect(walletDonatore).not.toBeNull();
      expect(walletDonatore.bilancio).toBeGreaterThanOrEqual(0);
      expect(walletDonatore.bilancio).toBe(res.body.creditiAssegnati);

      // Verifica Wallet Acquirente (OCL #17: bilancio ≥ 0)
      const acquirenteId = getUserIdFromToken(tokenA);
      const walletAcquirente = await Wallet.findOne({ idUtente: acquirenteId });
      expect(walletAcquirente).not.toBeNull();
      expect(walletAcquirente.bilancio).toBeGreaterThanOrEqual(0);
      expect(walletAcquirente.bilancio).toBe(res.body.creditiAssegnati);
    });

    test('il saldo non può diventare negativo (invariante OCL #17)', async () => {
      // Verifica che il modello Wallet rifiuti un bilancio negativo
      const donatoreId = getUserIdFromToken(tokenD);
      const wallet = await Wallet.findOne({ idUtente: donatoreId });

      // Tentativo di forzare bilancio negativo → validation error
      wallet.bilancio = -1;
      await expect(wallet.save()).rejects.toThrow(/negativo/i);
    });
  });
});
