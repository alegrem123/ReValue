const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Wallet = require('../../src/models/walletModel');
const {
  creaWallet,
  addPunti,
  sottraiPunti,
  getSaldo,
  getStorico,
} = require('../../src/services/walletService');

let mongoServer;
let userId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Wallet.deleteMany({});
  userId = new mongoose.Types.ObjectId();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('creaWallet', () => {
  test('crea wallet con bilancio iniziale 0', async () => {
    const w = await creaWallet(userId);
    expect(w.bilancio).toBe(0);
    expect(w.idUtente.toString()).toBe(userId.toString());
  });

  test('crea wallet con array transazioni vuoto', async () => {
    const w = await creaWallet(userId);
    expect(w.transazioni).toHaveLength(0);
  });

  test('non permette due wallet per stesso utente', async () => {
    await creaWallet(userId);
    await expect(creaWallet(userId)).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('addPunti — OCL #16 (ammontare > 0)', () => {
  beforeEach(async () => {
    await creaWallet(userId);
  });

  test('accredita correttamente e aggiorna bilancio', async () => {
    const w = await addPunti(userId, 50, 'scambio completato');
    expect(w.bilancio).toBe(50);
  });

  test('aggiunge transazione tipo accredito con motivo', async () => {
    await addPunti(userId, 30, 'primo scambio');
    const w = await Wallet.findOne({ idUtente: userId });
    expect(w.transazioni).toHaveLength(1);
    expect(w.transazioni[0].tipo).toBe('accredito');
    expect(w.transazioni[0].ammontare).toBe(30);
    expect(w.transazioni[0].motivo).toBe('primo scambio');
  });

  test('accumula più accrediti correttamente', async () => {
    await addPunti(userId, 10, 'primo');
    await addPunti(userId, 20, 'secondo');
    const w = await addPunti(userId, 5, 'terzo');
    expect(w.bilancio).toBe(35);
    const fresh = await Wallet.findOne({ idUtente: userId });
    expect(fresh.transazioni).toHaveLength(3);
  });

  test('OCL #16: throw se ammontare è 0', async () => {
    await expect(addPunti(userId, 0, 'test')).rejects.toThrow('ammontare deve essere > 0');
  });

  test('OCL #16: throw se ammontare è negativo', async () => {
    await expect(addPunti(userId, -10, 'test')).rejects.toThrow('ammontare deve essere > 0');
  });

  test('OCL #16: throw se ammontare è null', async () => {
    await expect(addPunti(userId, null, 'test')).rejects.toThrow('ammontare deve essere > 0');
  });

  test('throw se wallet non trovato', async () => {
    const sconosciuto = new mongoose.Types.ObjectId();
    await expect(addPunti(sconosciuto, 10, 'test')).rejects.toThrow('Wallet non trovato');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('sottraiPunti — OCL #17 (ammontare > 0, bilancio >= ammontare)', () => {
  beforeEach(async () => {
    await creaWallet(userId);
    await addPunti(userId, 100, 'setup test');
  });

  test('sottrae correttamente e aggiorna bilancio', async () => {
    const w = await sottraiPunti(userId, 40, 'riscatto coupon');
    expect(w.bilancio).toBe(60);
  });

  test('aggiunge transazione tipo sottrazione con motivo', async () => {
    await sottraiPunti(userId, 25, 'riscatto premio');
    const w = await Wallet.findOne({ idUtente: userId });
    const ultima = w.transazioni[w.transazioni.length - 1];
    expect(ultima.tipo).toBe('sottrazione');
    expect(ultima.ammontare).toBe(25);
    expect(ultima.motivo).toBe('riscatto premio');
  });

  test('OCL #17: sottrae esattamente tutto il bilancio disponibile', async () => {
    const w = await sottraiPunti(userId, 100, 'svuota wallet');
    expect(w.bilancio).toBe(0);
  });

  test('OCL #15+17: throw se saldo insufficiente — non va in negativo', async () => {
    await expect(
      sottraiPunti(userId, 101, 'troppo')
    ).rejects.toThrow('Saldo insufficiente o wallet non trovato');
  });

  test('OCL #17: throw se ammontare è 0', async () => {
    await expect(sottraiPunti(userId, 0, 'test')).rejects.toThrow('ammontare deve essere > 0');
  });

  test('OCL #17: throw se ammontare è negativo', async () => {
    await expect(sottraiPunti(userId, -5, 'test')).rejects.toThrow('ammontare deve essere > 0');
  });

  test('OCL #17: throw se ammontare è null', async () => {
    await expect(sottraiPunti(userId, null, 'test')).rejects.toThrow('ammontare deve essere > 0');
  });

  test('throw se wallet non trovato', async () => {
    const sconosciuto = new mongoose.Types.ObjectId();
    await expect(sottraiPunti(sconosciuto, 10, 'test')).rejects.toThrow(
      'Saldo insufficiente o wallet non trovato'
    );
  });

  test('bilancio non diventa mai negativo dopo operazioni multiple', async () => {
    await sottraiPunti(userId, 60, 'prima');
    // bilancio ora = 40
    await expect(sottraiPunti(userId, 41, 'seconda')).rejects.toThrow();
    const w = await Wallet.findOne({ idUtente: userId });
    expect(w.bilancio).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getSaldo', () => {
  test('restituisce bilancio iniziale 0', async () => {
    await creaWallet(userId);
    const saldo = await getSaldo(userId);
    expect(saldo).toBe(0);
  });

  test('restituisce bilancio aggiornato dopo addPunti', async () => {
    await creaWallet(userId);
    await addPunti(userId, 75, 'test');
    const saldo = await getSaldo(userId);
    expect(saldo).toBe(75);
  });

  test('restituisce bilancio aggiornato dopo sottraiPunti', async () => {
    await creaWallet(userId);
    await addPunti(userId, 100, 'setup');
    await sottraiPunti(userId, 30, 'uso');
    const saldo = await getSaldo(userId);
    expect(saldo).toBe(70);
  });

  test('throw se wallet non trovato', async () => {
    const sconosciuto = new mongoose.Types.ObjectId();
    await expect(getSaldo(sconosciuto)).rejects.toThrow('Wallet non trovato');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getStorico', () => {
  test('restituisce array vuoto per wallet nuovo', async () => {
    await creaWallet(userId);
    const storico = await getStorico(userId);
    expect(storico).toHaveLength(0);
  });

  test('restituisce tutte le transazioni nella sequenza corretta', async () => {
    await creaWallet(userId);
    await addPunti(userId, 50, 'accredito 1');
    await addPunti(userId, 20, 'accredito 2');
    await sottraiPunti(userId, 10, 'uso 1');

    const storico = await getStorico(userId);
    expect(storico).toHaveLength(3);
    expect(storico[0].tipo).toBe('accredito');
    expect(storico[1].tipo).toBe('accredito');
    expect(storico[2].tipo).toBe('sottrazione');
  });

  test('ogni transazione ha i campi tipo, ammontare, motivo, data', async () => {
    await creaWallet(userId);
    await addPunti(userId, 15, 'verifica campi');

    const storico = await getStorico(userId);
    const tx = storico[0];
    expect(tx.tipo).toBeDefined();
    expect(tx.ammontare).toBeDefined();
    expect(tx.motivo).toBeDefined();
    expect(tx.data).toBeDefined();
  });

  test('throw se wallet non trovato', async () => {
    const sconosciuto = new mongoose.Types.ObjectId();
    await expect(getStorico(sconosciuto)).rejects.toThrow('Wallet non trovato');
  });
});
