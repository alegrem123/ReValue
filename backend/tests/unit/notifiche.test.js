const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const Notifica = require('../../src/models/notificaModel');
const User = require('../../src/models/userModel');
const {
  creaNotifica,
  getNotifiche,
  contaNonLette,
  marcaLetta,
  marcaTutteLette,
  sendExpoPushIfConfigured,
} = require('../../src/services/notificheService');

let mongoServer;
let userId;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Notifica.deleteMany({});
  await User.deleteMany({});
  delete process.env.EXPO_PUSH_ENABLED;
  delete global.fetch;
  userId = new mongoose.Types.ObjectId();
});

describe('notificaModel', () => {
  test('crea notifica con valori default coerenti con RF12', async () => {
    const notifica = await creaNotifica(userId, 'messaggio', 'Nuovo messaggio', '/chat/1');

    expect(notifica.utente.toString()).toBe(userId.toString());
    expect(notifica.tipo).toBe('messaggio');
    expect(notifica.testo).toBe('Nuovo messaggio');
    expect(notifica.link).toBe('/chat/1');
    expect(notifica.letta).toBe(false);
    expect(notifica.data).toBeInstanceOf(Date);
  });

  test('rifiuta tipo notifica non previsto', async () => {
    await expect(creaNotifica(userId, 'coupon', 'Test')).rejects.toThrow();
  });

  test('rifiuta testo vuoto dopo trim', async () => {
    await expect(creaNotifica(userId, 'sistema', '   ')).rejects.toThrow();
  });
});

describe('notificheService', () => {
  test('getNotifiche restituisce notifiche paginate ordinate dalla piu recente', async () => {
    const prima = await creaNotifica(userId, 'messaggio', 'Prima');
    const seconda = await creaNotifica(userId, 'prenotazione', 'Seconda');

    prima.data = new Date('2026-05-19T08:00:00Z');
    seconda.data = new Date('2026-05-19T09:00:00Z');
    await prima.save();
    await seconda.save();

    const result = await getNotifiche(userId, 1, { limit: 1 });

    expect(result.notifiche).toHaveLength(1);
    expect(result.notifiche[0].testo).toBe('Seconda');
    expect(result.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      pages: 2,
    });
  });

  test('getNotifiche filtra per stato letta', async () => {
    await creaNotifica(userId, 'messaggio', 'Da leggere');
    const letta = await creaNotifica(userId, 'sistema', 'Letta');
    letta.letta = true;
    await letta.save();

    const result = await getNotifiche(userId, 1, { letta: false });

    expect(result.notifiche).toHaveLength(1);
    expect(result.notifiche[0].testo).toBe('Da leggere');
    expect(result.pagination.total).toBe(1);
  });

  test('contaNonLette conta solo notifiche non lette dello stesso utente', async () => {
    const altroUtente = new mongoose.Types.ObjectId();
    await creaNotifica(userId, 'messaggio', 'Non letta 1');
    await creaNotifica(userId, 'scambio', 'Non letta 2');
    await creaNotifica(altroUtente, 'messaggio', 'Altro utente');
    const letta = await creaNotifica(userId, 'sistema', 'Gia letta');
    letta.letta = true;
    await letta.save();

    await expect(contaNonLette(userId)).resolves.toBe(2);
  });

  test('marcaLetta marca solo una notifica appartenente all utente', async () => {
    const notifica = await creaNotifica(userId, 'messaggio', 'Da leggere');

    const result = await marcaLetta(userId, notifica._id);

    expect(result.letta).toBe(true);
    const fresh = await Notifica.findById(notifica._id);
    expect(fresh.letta).toBe(true);
  });

  test('marcaLetta fallisce se la notifica non appartiene all utente', async () => {
    const altroUtente = new mongoose.Types.ObjectId();
    const notifica = await creaNotifica(altroUtente, 'messaggio', 'Altra');

    await expect(marcaLetta(userId, notifica._id)).rejects.toThrow('Notifica non trovata');
  });

  test('marcaTutteLette aggiorna tutte e solo le notifiche non lette dell utente', async () => {
    const altroUtente = new mongoose.Types.ObjectId();
    await creaNotifica(userId, 'messaggio', 'Uno');
    await creaNotifica(userId, 'scambio', 'Due');
    await creaNotifica(altroUtente, 'messaggio', 'Altro');

    await expect(marcaTutteLette(userId)).resolves.toBe(2);
    expect(await Notifica.countDocuments({ utente: userId, letta: false })).toBe(0);
    expect(await Notifica.countDocuments({ utente: altroUtente, letta: false })).toBe(1);
  });

  test('sendExpoPushIfConfigured non invia se EXPO_PUSH_ENABLED non e true', async () => {
    global.fetch = jest.fn();

    await expect(sendExpoPushIfConfigured(userId, 'Test')).resolves.toBe(false);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('sendExpoPushIfConfigured non propaga errori Expo quando abilitato', async () => {
    process.env.EXPO_PUSH_ENABLED = 'true';
    global.fetch = jest.fn().mockRejectedValue(new Error('Expo down'));
    await User.create({
      _id: userId,
      idUtente: 'push-test-user',
      nome: 'Push',
      cognome: 'Test',
      email: 'push-test@example.com',
      passwordHash: 'a'.repeat(64),
      ruolo: 'user',
      expoPushToken: 'ExpoPushToken[abcdefghijklmnopqrstuv]',
    });

    await expect(sendExpoPushIfConfigured(userId, 'Test')).resolves.toBe(false);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
