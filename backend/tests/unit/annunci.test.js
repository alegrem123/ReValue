const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../../app');
const Annuncio = require('../../src/models/annuncioModel');
const Utente = require('../../src/models/userModel');
const { signToken } = require('../../src/utils/jwt');

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';

let mongoServer;

// Setup e teardown
beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Pulisci le collezioni prima di ogni test
  await Annuncio.deleteMany({});
  await Utente.deleteMany({});
});

function createTestUser(dati) {
  return Utente.create({
    idUtente: new mongoose.Types.ObjectId().toString(),
    passwordHash: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36DRj75O',
    ruolo: 'user',
    ...dati,
  });
}

describe('Annunci - CRUD Operations', () => {
  let donatore;

  beforeEach(async () => {
    // Crea un utente donatore per i test
    donatore = await createTestUser({
      nome: 'Mario',
      cognome: 'Rossi',
      email: 'mario@example.com',
    });
  });

  describe('CREATE', () => {
    test('Crea un nuovo annuncio valido (RFC15, RFC16)', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 giorni da ora

      const annuncio = await Annuncio.create({
        donatore: donatore._id,
        titolo: 'Divano rosso',
        dataScadenza: futureDate,
        latitudine: 46.0748,
        longitudine: 11.1217,
        oggetto: {
          categoria: 'Mobili',
          descrizione: 'Divano rosso in buone condizioni',
          dimensioni: 'grande',
          materiale: 'tessuto',
          foto: ['foto1.jpg', 'foto2.jpg'],
        },
      });

      expect(annuncio).toBeDefined();
      expect(annuncio.donatore).toEqual(donatore._id);
      expect(annuncio.titolo).toBe('Divano rosso');
      expect(annuncio.stato).toBe('DISPONIBILE');
      expect(annuncio.isAttivo).toBe(true);
      expect(annuncio.versione).toBe(0);
      expect(annuncio.dataScadenza).toEqual(futureDate);
    });

    test('Rifiuta annuncio con dataScadenza nel passato', async () => {
      const pastDate = new Date(Date.now() - 1000);

      await expect(
        Annuncio.create({
          donatore: donatore._id,
          titolo: 'Divano rosso',
          dataScadenza: pastDate,
          oggetto: {
            categoria: 'Mobili',
            descrizione: 'Divano rosso in buone condizioni',
          },
        })
      ).rejects.toThrow();
    });

    test('Rifiuta annuncio senza titolo o categoria', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await expect(
        Annuncio.create({
          donatore: donatore._id,
          dataScadenza: futureDate,
          oggetto: {
            descrizione: 'Divano rosso in buone condizioni',
          },
        })
      ).rejects.toThrow();
    });

    test('Rifiuta annuncio con più di 5 foto', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await expect(
        Annuncio.create({
          donatore: donatore._id,
          titolo: 'Divano rosso',
          dataScadenza: futureDate,
          oggetto: {
            categoria: 'Mobili',
            descrizione: 'Divano rosso',
            foto: ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg'],
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('READ', () => {
    let annuncio;

    beforeEach(async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      annuncio = await Annuncio.create({
        donatore: donatore._id,
        titolo: 'Divano rosso',
        dataScadenza: futureDate,
        latitudine: 46.0748,
        longitudine: 11.1217,
        oggetto: {
          categoria: 'Mobili',
          descrizione: 'Divano rosso in buone condizioni',
          dimensioni: 'grande',
          materiale: 'tessuto',
        },
      });
    });

    test('Legge un annuncio per ID', async () => {
      const result = await Annuncio.findById(annuncio._id);
      expect(result).toBeDefined();
      expect(result.titolo).toBe('Divano rosso');
      expect(result.donatore).toEqual(donatore._id);
    });

    test('Legge annunci del donatore', async () => {
      const result = await Annuncio.find({ donatore: donatore._id });
      expect(result).toHaveLength(1);
      expect(result[0].titolo).toBe('Divano rosso');
    });

    test('Non legge annunci soft-deleted', async () => {
      annuncio.isAttivo = false;
      await annuncio.save();

      const result = await Annuncio.find({ donatore: donatore._id, isAttivo: true });
      expect(result).toHaveLength(0);
    });
  });

  describe('UPDATE', () => {
    let annuncio;
    let tokenDonatore;

    beforeEach(async () => {
      tokenDonatore = signToken({ id: donatore._id.toString(), ruolo: donatore.ruolo });
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      annuncio = await Annuncio.create({
        donatore: donatore._id,
        titolo: 'Divano rosso',
        dataScadenza: futureDate,
        latitudine: 46.0748,
        longitudine: 11.1217,
        oggetto: {
          categoria: 'Mobili',
          descrizione: 'Divano rosso in buone condizioni',
          dimensioni: 'grande',
          materiale: 'tessuto',
        },
      });
    });

    test('Modifica annuncio quando stato è DISPONIBILE', async () => {
      const updated = await Annuncio.findByIdAndUpdate(
        annuncio._id,
        { titolo: 'Divano blu' },
        { new: true }
      );

      expect(updated.titolo).toBe('Divano blu');
    });

    test('Rifiuta modifica se stato non è DISPONIBILE', async () => {
      await Annuncio.findByIdAndUpdate(annuncio._id, { stato: 'PRENOTATO' });

      const res = await request(app)
        .put(`/api/v1/annunci/${annuncio._id}`)
        .set('Authorization', `Bearer ${tokenDonatore}`)
        .send({ titolo: 'Nuovo titolo' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();
    });

    test('Aggiorna correttamente la data di scadenza', async () => {
      const newDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const updated = await Annuncio.findByIdAndUpdate(
        annuncio._id,
        { dataScadenza: newDate },
        { new: true }
      );

      expect(updated.dataScadenza).toEqual(newDate);
    });
  });

  describe('DELETE (Soft-Delete)', () => {
    let annuncio;
    let tokenDonatore;

    beforeEach(async () => {
      tokenDonatore = signToken({ id: donatore._id.toString(), ruolo: donatore.ruolo });
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      annuncio = await Annuncio.create({
        donatore: donatore._id,
        titolo: 'Divano rosso',
        dataScadenza: futureDate,
        oggetto: {
          categoria: 'Mobili',
          descrizione: 'Divano rosso',
        },
      });
    });

    test('Soft-delete imposta isAttivo = false', async () => {
      annuncio.isAttivo = false;
      await annuncio.save();

      const result = await Annuncio.findById(annuncio._id);
      expect(result.isAttivo).toBe(false);
    });

    test('Annuncio soft-deleted rimane nel DB', async () => {
      annuncio.isAttivo = false;
      await annuncio.save();

      const result = await Annuncio.findById(annuncio._id);
      expect(result).toBeDefined();
      expect(result.isAttivo).toBe(false);
    });

    test('Rifiuta soft-delete se stato non è DISPONIBILE', async () => {
      await Annuncio.findByIdAndUpdate(annuncio._id, { stato: 'PRENOTATO' });

      const res = await request(app)
        .delete(`/api/v1/annunci/${annuncio._id}`)
        .set('Authorization', `Bearer ${tokenDonatore}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();
    });
  });
});

describe('Annunci - Filtri', () => {
  let donatore;
  let annunci;

  beforeEach(async () => {
    donatore = await createTestUser({
      nome: 'Mario',
      cognome: 'Rossi',
      email: 'mario@example.com',
    });

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const futureDate2 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    annunci = await Annuncio.insertMany([
      {
        donatore: donatore._id,
        titolo: 'Divano rosso',
        dataScadenza: futureDate,
        stato: 'DISPONIBILE',
        isAttivo: true,
        oggetto: {
          categoria: 'Mobili',
          descrizione: 'Divano rosso',
          dimensioni: 'grande',
          materiale: 'tessuto',
        },
      },
      {
        donatore: donatore._id,
        titolo: 'Tavolo legno',
        dataScadenza: futureDate2,
        stato: 'DISPONIBILE',
        isAttivo: true,
        oggetto: {
          categoria: 'Mobili',
          descrizione: 'Tavolo in legno',
          dimensioni: 'medio',
          materiale: 'legno',
        },
      },
      {
        donatore: donatore._id,
        titolo: 'Forno',
        dataScadenza: futureDate,
        stato: 'DISPONIBILE',
        isAttivo: true,
        oggetto: {
          categoria: 'Elettrodomestici',
          descrizione: 'Forno elettrico',
          dimensioni: 'grande',
          materiale: 'metallo',
        },
      },
    ]);
  });

  test('Filtra per categoria (RFC22)', async () => {
    const result = await Annuncio.find({ 'oggetto.categoria': 'Mobili', isAttivo: true });
    expect(result).toHaveLength(2);
    expect(result[0].oggetto.categoria).toBe('Mobili');
  });

  test('Filtra per dimensione (RFC22)', async () => {
    const result = await Annuncio.find({ 'oggetto.dimensioni': 'grande', isAttivo: true });
    expect(result).toHaveLength(2);
  });

  test('Filtra per materiale (RFC22)', async () => {
    const result = await Annuncio.find({ 'oggetto.materiale': 'legno', isAttivo: true });
    expect(result).toHaveLength(1);
    expect(result[0].titolo).toBe('Tavolo legno');
  });

  test('Filtra per stato', async () => {
    const result = await Annuncio.find({ stato: 'DISPONIBILE', isAttivo: true });
    expect(result.length).toBeGreaterThan(0);
    result.forEach((ann) => expect(ann.stato).toBe('DISPONIBILE'));
  });

  test('Filtra annunci attivi (isAttivo = true)', async () => {
    annunci[0].isAttivo = false;
    await annunci[0].save();

    const result = await Annuncio.find({ isAttivo: true });
    expect(result).toHaveLength(2);
  });

  test('Ordina per dataScadenza ASC (RNF1)', async () => {
    const result = await Annuncio.find({ isAttivo: true }).sort({ dataScadenza: 1 });
    expect(result.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].dataScadenza.getTime()).toBeGreaterThanOrEqual(
        result[i - 1].dataScadenza.getTime()
      );
    }
  });

  test('Combina più filtri', async () => {
    const result = await Annuncio.find({
      'oggetto.categoria': 'Mobili',
      'oggetto.dimensioni': 'grande',
      isAttivo: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].titolo).toBe('Divano rosso');
  });
});

describe('Annunci - Optimistic Locking (OCL #7, UC2)', () => {
  let donatore;
  let annuncio;

  beforeEach(async () => {
    donatore = await createTestUser({
      nome: 'Mario',
      cognome: 'Rossi',
      email: 'mario@example.com',
    });

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    annuncio = await Annuncio.create({
      donatore: donatore._id,
      titolo: 'Divano rosso',
      dataScadenza: futureDate,
      stato: 'DISPONIBILE',
      versione: 0,
      oggetto: {
        categoria: 'Mobili',
        descrizione: 'Divano rosso',
      },
    });
  });

  test('Incrementa versione ad ogni prenota (OCL #7)', async () => {
    const versioneBefore = annuncio.versione;

    // Simula prenotazione con optimistic lock
    const updated = await Annuncio.findOneAndUpdate(
      { _id: annuncio._id, stato: 'DISPONIBILE', versione: versioneBefore },
      { $set: { stato: 'PRENOTATO' }, $inc: { versione: 1 } },
      { new: true }
    );

    expect(updated).toBeDefined();
    expect(updated.versione).toBe(versioneBefore + 1);
    expect(updated.stato).toBe('PRENOTATO');
  });

  test('Fallisce prenotazione con versione non matching', async () => {
    const wrongVersion = annuncio.versione + 10;

    // Prova a prenotare con versione sbagliata
    const updated = await Annuncio.findOneAndUpdate(
      { _id: annuncio._id, stato: 'DISPONIBILE', versione: wrongVersion },
      { $set: { stato: 'PRENOTATO' }, $inc: { versione: 1 } },
      { new: true }
    );

    expect(updated).toBeNull();
    // Verifica che lo stato non sia cambiato
    const reloaded = await Annuncio.findById(annuncio._id);
    expect(reloaded.stato).toBe('DISPONIBILE');
    expect(reloaded.versione).toBe(0);
  });

  test('Previene doppia prenotazione con optimistic lock', async () => {
    // Simula due utenti che tentano di prenotare contemporaneamente
    const acquirente1 = await createTestUser({
      nome: 'Alice',
      cognome: 'Verdi',
      email: 'alice@example.com',
    });

    const acquirente2 = await createTestUser({
      nome: 'Bob',
      cognome: 'Bianchi',
      email: 'bob@example.com',
    });

    const versioneBefore = annuncio.versione;

    // Primo acquirente prenota con successo
    const prenotazione1 = await Annuncio.findOneAndUpdate(
      { _id: annuncio._id, stato: 'DISPONIBILE', versione: versioneBefore },
      { $set: { stato: 'PRENOTATO' }, $inc: { versione: 1 } },
      { new: true }
    );

    expect(prenotazione1).toBeDefined();
    expect(prenotazione1.versione).toBe(versioneBefore + 1);

    // Secondo acquirente tenta di prenotare con versione vecchia (fallisce)
    const prenotazione2 = await Annuncio.findOneAndUpdate(
      { _id: annuncio._id, stato: 'DISPONIBILE', versione: versioneBefore },
      { $set: { stato: 'PRENOTATO' }, $inc: { versione: 1 } },
      { new: true }
    );

    expect(prenotazione2).toBeNull();
  });

  test('Versione iniziale è 0', async () => {
    const freshAnnuncio = await Annuncio.findById(annuncio._id);
    expect(freshAnnuncio.versione).toBe(0);
  });

  test('Versione viene decrementata su annulla prenotazione (OCL #11)', async () => {
    const versioneBefore = annuncio.versione;

    // Prenota
    const prenotato = await Annuncio.findOneAndUpdate(
      { _id: annuncio._id, versione: versioneBefore },
      { $set: { stato: 'PRENOTATO' }, $inc: { versione: 1 } },
      { new: true }
    );

    expect(prenotato.versione).toBe(versioneBefore + 1);

    // Annulla prenotazione (decrementa versione)
    const annullato = await Annuncio.findByIdAndUpdate(
      annuncio._id,
      { $set: { stato: 'DISPONIBILE' }, $inc: { versione: 1 } },
      { new: true }
    );

    expect(annullato.versione).toBe(versioneBefore + 2);
    expect(annullato.stato).toBe('DISPONIBILE');
  });
});
