const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const User = require('../../src/models/userModel');
const Wallet = require('../../src/models/walletModel');
const Annuncio = require('../../src/models/annuncioModel');
const Prenotazione = require('../../src/models/prenotazioneModel');
const TokenQR = require('../../src/models/tokenQRModel');
const Conversazione = require('../../src/models/conversazioneModel');
const Coupon = require('../../src/models/couponModel');
const { comparePassword } = require('../../src/utils/password');
const { seedDemoData, DEMO_USERS } = require('../../seeds/demo');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Wallet.deleteMany({}),
    Annuncio.deleteMany({}),
    Prenotazione.deleteMany({}),
    TokenQR.deleteMany({}),
    Conversazione.deleteMany({}),
    Coupon.deleteMany({}),
  ]);
});

describe('seed demo completo', () => {
  test('crea uno scenario idempotente per video demo end-to-end', async () => {
    await seedDemoData();
    await seedDemoData();

    const users = await User.find({ email: { $in: DEMO_USERS.map((user) => user.email) } });
    expect(users).toHaveLength(5);

    const donor = users.find((user) => user.email === 'demo.donatore@revalue.local');
    const buyer = users.find((user) => user.email === 'demo.acquirente@revalue.local');
    const admin = users.find((user) => user.email === 'demo.admin@revalue.local');

    await expect(comparePassword('Demo1234!', donor.passwordHash)).resolves.toBe(true);
    await expect(comparePassword('Demo1234!', buyer.passwordHash)).resolves.toBe(true);
    expect(admin.ruolo).toBe('admin');

    const wallets = await Wallet.find({ idUtente: { $in: users.map((user) => user._id) } });
    expect(wallets).toHaveLength(5);
    expect(wallets.find((wallet) => wallet.idUtente.equals(buyer._id)).bilancio).toBeGreaterThanOrEqual(80);
    expect(await Wallet.countDocuments()).toBe(5);

    const coupon = await Coupon.find({ partner: /\(demo\)$/ });
    expect(coupon).toHaveLength(6);
    expect(await Coupon.countDocuments()).toBe(6);
    expect(coupon.every((item) => item.immagine && item.immagine.startsWith('https://'))).toBe(true);
    expect(coupon.map((item) => item.partner)).toEqual(
      expect.arrayContaining([
        'Caffetteria Piazza Duomo (demo)',
        'Ciclofficina Trento (demo)',
        'MUSE Trento (demo)',
      ])
    );

    const annunci = await Annuncio.find({ titolo: /^Demo - / });
    expect(annunci).toHaveLength(10);
    expect(await Annuncio.countDocuments()).toBe(10);
    expect(annunci.map((annuncio) => annuncio.stato)).toEqual(
      expect.arrayContaining(['DISPONIBILE', 'PRENOTATO', 'RITIRATO'])
    );
    expect(annunci.every((annuncio) => annuncio.oggetto.foto.length >= 1)).toBe(true);
    expect(annunci.every((annuncio) => annuncio.oggetto.foto[0].startsWith('https://'))).toBe(true);
    expect(annunci.every((annuncio) => annuncio.indirizzo.provincia === 'Trento')).toBe(true);
    expect(annunci.every((annuncio) => annuncio.indirizzo.via && /\d+/.test(annuncio.indirizzo.via))).toBe(true);
    expect(new Set(annunci.map((annuncio) => annuncio.indirizzo.comune)).size).toBeGreaterThanOrEqual(8);
    expect(annunci.every((annuncio) => annuncio.latitudine >= 45.75 && annuncio.latitudine <= 46.55)).toBe(true);
    expect(annunci.every((annuncio) => annuncio.longitudine >= 10.45 && annuncio.longitudine <= 11.95)).toBe(true);

    const prenotazioneAttiva = await Prenotazione.findOne({ stato: 'ATTIVA' });
    expect(await Prenotazione.countDocuments()).toBe(4);
    expect(prenotazioneAttiva).toBeTruthy();
    expect(prenotazioneAttiva.acquirente.equals(buyer._id)).toBe(true);

    const activePrenotazioni = await Prenotazione.find({ stato: 'ATTIVA' });
    expect(activePrenotazioni).toHaveLength(3);

    const activeQrs = await TokenQR.find({ prenotazione: { $in: activePrenotazioni.map((p) => p._id) } });
    expect(activeQrs).toHaveLength(3);
    expect(activeQrs.every((qr) => qr.usato === false)).toBe(true);
    expect(activeQrs.every((qr) => qr.scadenza.getTime() > Date.now())).toBe(true);

    const conversazioni = await Conversazione.find({ prenotazione: { $in: activePrenotazioni.map((p) => p._id) } });
    expect(conversazioni).toHaveLength(3);
    expect(conversazioni.every((conv) => conv.messaggi.length >= 3)).toBe(true);
    expect(conversazioni.some((conv) => conv.messaggi.some((msg) => msg.letto === false))).toBe(true);
  });
});
