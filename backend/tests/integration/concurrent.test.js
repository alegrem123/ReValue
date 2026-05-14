/**
 * Test di concorrenza – Test di integrazione
 *
 * Scenario: 2 utenti tentano di prenotare lo stesso annuncio
 * contemporaneamente; il meccanismo di Optimistic Lock (OCL #9, OCL #7,
 * RF24, UC2 §5) deve garantire che uno solo riesca (HTTP 201) e l'altro
 * riceva HTTP 409 "Oggetto appena prenotato da un altro utente".
 *
 * Riferimenti D2:
 *  - Constraint 7  (postcondizione prenota: versione++)
 *  - Constraint 9  (unicaPrenotazioneAttiva)
 *  - Annuncio.prenota() usa findOneAndUpdate con filtro { versione }
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// JWT_SECRET necessario per firmare i token nei test
process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';

const app = require('../../app');
const Annuncio = require('../../src/models/annuncioModel');
const Prenotazione = require('../../src/models/prenotazioneModel');

let mongoServer;

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

/**
 * Registra un utente e restituisce il JWT token.
 * @param {string} email
 * @param {string} nome
 * @returns {Promise<string>} JWT token
 */
async function registraUtente(email, nome) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ nome, cognome: 'Test', email, password: 'Password123!' });

  expect(res.statusCode).toBe(201);
  return res.body.token;
}

// ── Suite principale ─────────────────────────────────────────────────────────

describe('Concorrenza: doppia prenotazione sullo stesso annuncio', () => {
  let tokenDonatore;
  let tokenAcquirente1;
  let tokenAcquirente2;
  let annuncioId;

  // ── Setup: tre utenti + un annuncio disponibile ──────────────────────────

  beforeAll(async () => {
    tokenDonatore   = await registraUtente('donatore.conc@test.com',    'Donatore');
    tokenAcquirente1 = await registraUtente('acquirente1.conc@test.com', 'Acquirente1');
    tokenAcquirente2 = await registraUtente('acquirente2.conc@test.com', 'Acquirente2');

    // Il donatore crea un annuncio con scadenza nel futuro
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const res = await request(app)
      .post('/api/annunci')
      .set('Authorization', `Bearer ${tokenDonatore}`)
      .send({
        titolo: 'Tavolo vintage',
        dataScadenza: futureDate.toISOString(),
        latitudine: 46.0,
        longitudine: 11.0,
        oggetto: {
          categoria: 'Mobili',
          descrizione: 'Tavolo in legno di recupero',
          dimensioni: 'grande',
          materiale: 'legno',
        },
      });

    expect(res.statusCode).toBe(201);
    annuncioId = res.body._id ?? res.body.annuncio?._id;

    // Fallback: recupera dal DB se la risposta non include _id direttamente
    if (!annuncioId) {
      const doc = await Annuncio.findOne({ titolo: 'Tavolo vintage' });
      annuncioId = doc._id.toString();
    }
    expect(annuncioId).toBeDefined();
  });

  // ── Test core: prenotazione concorrente ──────────────────────────────────

  test(
    'OCL #9 – solo uno dei due acquirenti concorrenti riesce a prenotare (201), l\'altro riceve 409',
    async () => {
      // Lancia le due richieste in parallelo, senza attendere l'una prima
      // dell'altra, simulando la concorrenza reale.
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/prenotazioni')
          .set('Authorization', `Bearer ${tokenAcquirente1}`)
          .send({ annuncioId }),

        request(app)
          .post('/api/prenotazioni')
          .set('Authorization', `Bearer ${tokenAcquirente2}`)
          .send({ annuncioId }),
      ]);

      const statuses = [res1.statusCode, res2.statusCode].sort();

      // ── Assertion 1: esattamente un 201 e un 409 ────────────────────────
      expect(statuses).toEqual([201, 409]);

      // ── Assertion 2: la risposta di errore contiene il messaggio corretto
      const resErrore = res1.statusCode === 409 ? res1 : res2;
      expect(resErrore.body.error).toMatch(/prenotato/i);

      // ── Assertion 3: nel DB esiste una sola prenotazione ATTIVA per l'annuncio
      const prenotazioniAttive = await Prenotazione.find({
        annuncio: annuncioId,
        stato: 'ATTIVA',
      });
      expect(prenotazioniAttive).toHaveLength(1);

      // ── Assertion 4: l'annuncio è nello stato PRENOTATO
      const annuncio = await Annuncio.findById(annuncioId);
      expect(annuncio.stato).toBe('PRENOTATO');

      // ── Assertion 5 (OCL #7): la versione è stata incrementata esattamente 1 volta
      // (versione iniziale = 0, dopo una prenotazione andata a buon fine = 1)
      expect(annuncio.versione).toBe(1);
    }
  );

  // ── Test stress: 10 utenti prenotano lo stesso annuncio ─────────────────

  test(
    'Stress test: 10 utenti tentano di prenotare un nuovo annuncio contemporaneamente, solo 1 successo',
    async () => {
      // 1. Il donatore crea un NUOVO annuncio
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const resAnnuncio = await request(app)
        .post('/api/annunci')
        .set('Authorization', `Bearer ${tokenDonatore}`)
        .send({
          titolo: 'Divano usato',
          dataScadenza: futureDate.toISOString(),
          latitudine: 46.0,
          longitudine: 11.0,
          oggetto: {
            categoria: 'Mobili',
            descrizione: 'Divano a 3 posti',
            dimensioni: 'grande',
            materiale: 'tessuto',
          },
        });

      expect(resAnnuncio.statusCode).toBe(201);
      let nuovoAnnuncioId = resAnnuncio.body._id ?? resAnnuncio.body.annuncio?._id;
      if (!nuovoAnnuncioId) {
        const doc = await Annuncio.findOne({ titolo: 'Divano usato' });
        nuovoAnnuncioId = doc._id.toString();
      }

      // 2. Creiamo 10 utenti acquirenti
      const tokens = [];
      for (let i = 0; i < 10; i++) {
        const token = await registraUtente(`acquirente_stress_${i}@test.com`, `AcquirenteStress${i}`);
        tokens.push(token);
      }

      // 3. Lanciamo le 10 richieste in parallelo
      const requests = tokens.map(token => 
        request(app)
          .post('/api/prenotazioni')
          .set('Authorization', `Bearer ${token}`)
          .send({ annuncioId: nuovoAnnuncioId })
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map(r => r.statusCode);

      // 4. Verifichiamo che esattamente 1 abbia avuto successo (201) e 9 abbiano fallito (409)
      const successi = statuses.filter(s => s === 201).length;
      const fallimenti = statuses.filter(s => s === 409).length;

      expect(successi).toBe(1);
      expect(fallimenti).toBe(9);

      // 5. Verifica nel DB che esista una sola prenotazione ATTIVA
      const prenotazioniAttive = await Prenotazione.find({
        annuncio: nuovoAnnuncioId,
        stato: 'ATTIVA',
      });
      expect(prenotazioniAttive).toHaveLength(1);

      // 6. Verifica stato e versione dell'annuncio
      const annuncio = await Annuncio.findById(nuovoAnnuncioId);
      expect(annuncio.stato).toBe('PRENOTATO');
      expect(annuncio.versione).toBe(1);
    }
  );

  // ── Guardrail aggiuntivo: un terzo tentativo di prenotazione deve fallire ─

  test(
    'Dopo la prenotazione, qualsiasi ulteriore tentativo riceve 409 "Oggetto non più disponibile"',
    async () => {
      // Registra un terzo acquirente per isolare il test dal precedente
      const tokenTerzo = await registraUtente('acquirente3.conc@test.com', 'Acquirente3');

      const res = await request(app)
        .post('/api/prenotazioni')
        .set('Authorization', `Bearer ${tokenTerzo}`)
        .send({ annuncioId });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toMatch(/disponibile|prenotato/i);
    }
  );
});
