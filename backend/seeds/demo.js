require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');

const User = require('../src/models/userModel');
const Wallet = require('../src/models/walletModel');
const Annuncio = require('../src/models/annuncioModel');
const Prenotazione = require('../src/models/prenotazioneModel');
const TokenQR = require('../src/models/tokenQRModel');
const Conversazione = require('../src/models/conversazioneModel');
const Coupon = require('../src/models/couponModel');
const { hashPassword } = require('../src/utils/password');

const DEMO_PASSWORD = 'Demo1234!';

const DEMO_USERS = [
  {
    idUtente: 'demo-donatore',
    nome: 'Giulia',
    cognome: 'Donati',
    email: 'demo.donatore@revalue.local',
    ruolo: 'user',
    citta: 'Trento',
    telefono: '+39 0461 000101',
    descrizione: 'Studentessa a Trento, pubblica oggetti ancora utilizzabili prima del trasloco.',
  },
  {
    idUtente: 'demo-donatore-rovereto',
    nome: 'Luca',
    cognome: 'Bianchi',
    email: 'demo.donatore.rovereto@revalue.local',
    ruolo: 'user',
    citta: 'Rovereto',
    telefono: '+39 0464 000404',
    descrizione: 'Famiglia di Rovereto che usa RE-VALUE per liberare spazio in cantina.',
  },
  {
    idUtente: 'demo-donatore-pergine',
    nome: 'Sara',
    cognome: 'Martinelli',
    email: 'demo.donatore.pergine@revalue.local',
    ruolo: 'user',
    citta: 'Pergine Valsugana',
    telefono: '+39 0461 000505',
    descrizione: 'Donatrice demo con annunci distribuiti fra Valsugana e Alto Garda.',
  },
  {
    idUtente: 'demo-acquirente',
    nome: 'Marco',
    cognome: 'Rossi',
    email: 'demo.acquirente@revalue.local',
    ruolo: 'user',
    citta: 'Trento',
    telefono: '+39 0461 000202',
    descrizione: 'Nuovo residente, cerca arredi e piccoli elettrodomestici da recuperare in zona.',
  },
  {
    idUtente: 'demo-admin',
    nome: 'Admin',
    cognome: 'RE-VALUE',
    email: 'demo.admin@revalue.local',
    ruolo: 'admin',
    citta: 'Trento',
    telefono: '+39 0461 000303',
    descrizione: 'Account demo per mostrare dashboard, moderazione e gestione coupon.',
  },
];

const DEMO_COUPONS = [
  {
    titolo: 'Caffe in centro storico',
    descrizione: 'Un espresso o cappuccino omaggio per chi completa uno scambio RE-VALUE. Coupon simulato per la demo.',
    partner: 'Caffetteria Piazza Duomo (demo)',
    costoCrediti: 10,
    stock: 50,
    attivo: true,
    immagine: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80',
  },
  {
    titolo: 'Sconto riparazione bici',
    descrizione: 'Sconto di 5 euro su manutenzione o piccole riparazioni bici. Partner simulato per la demo.',
    partner: 'Ciclofficina Trento (demo)',
    costoCrediti: 20,
    stock: 25,
    attivo: true,
    immagine: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=80',
  },
  {
    titolo: 'Ingresso cultura ridotto',
    descrizione: 'Riduzione simbolica per una visita culturale a Trento. Coupon simulato, non valido presso enti reali.',
    partner: 'MUSE Trento (demo)',
    costoCrediti: 30,
    stock: 15,
    attivo: true,
    immagine: 'https://images.unsplash.com/photo-1564399579883-451a5d44ec08?auto=format&fit=crop&w=900&q=80',
  },
  {
    titolo: 'Buono spesa locale',
    descrizione: 'Buono demo da 5 euro su prodotti alimentari locali, pensato per mostrare il marketplace premi.',
    partner: 'Cooperativa Trentina (demo)',
    costoCrediti: 40,
    stock: 20,
    attivo: true,
    immagine: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
  },
  {
    titolo: 'Sconto mercatino usato',
    descrizione: 'Sconto demo del 10% su piccoli oggetti di seconda mano e accessori per la casa.',
    partner: 'Mercatino Trento Nord (demo)',
    costoCrediti: 25,
    stock: 30,
    attivo: true,
    immagine: 'https://images.unsplash.com/photo-1481437156560-3205f6a55735?auto=format&fit=crop&w=900&q=80',
  },
  {
    titolo: 'Aperitivo analcolico',
    descrizione: 'Consumazione analcolica demo per valorizzare i partner di quartiere nella presentazione.',
    partner: 'Bar San Martino (demo)',
    costoCrediti: 15,
    stock: 40,
    attivo: true,
    immagine: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=900&q=80',
  },
];

const DEMO_PHOTOS = {
  lampada: [
    'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80',
  ],
  scrivania: [
    'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=900&q=80',
  ],
  microonde: [
    'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&w=900&q=80',
  ],
  sedia: [
    'https://images.unsplash.com/photo-1519947486511-46149fa0a254?auto=format&fit=crop&w=900&q=80',
  ],
  libreria: [
    'https://images.unsplash.com/photo-1594620302200-9a762244a156?auto=format&fit=crop&w=900&q=80',
  ],
  tavolino: [
    'https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=900&q=80',
  ],
  bollitore: [
    'https://images.unsplash.com/photo-1594213114663-d94db9b17125?auto=format&fit=crop&w=900&q=80',
  ],
  bici: [
    'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=80',
  ],
  armadio: [
    'https://images.unsplash.com/photo-1558997519-83ea9252edf8?auto=format&fit=crop&w=900&q=80',
  ],
  monitor: [
    'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80',
  ],
};

const DEMO_LOCATIONS = {
  trentoCentro: {
    comune: 'Trento',
    via: 'Via Verdi 12',
    latitudine: 46.0679,
    longitudine: 11.1214,
  },
  rovereto: {
    comune: 'Rovereto',
    via: 'Corso Bettini 31',
    latitudine: 45.8916,
    longitudine: 11.0402,
  },
  pergine: {
    comune: 'Pergine Valsugana',
    via: 'Via Pennella 4',
    latitudine: 46.0643,
    longitudine: 11.2396,
  },
  riva: {
    comune: 'Riva del Garda',
    via: 'Viale Rovereto 44',
    latitudine: 45.8848,
    longitudine: 10.842,
  },
  arco: {
    comune: 'Arco',
    via: 'Via Roma 6',
    latitudine: 45.9177,
    longitudine: 10.8867,
  },
  levico: {
    comune: 'Levico Terme',
    via: 'Viale Roma 20',
    latitudine: 46.012,
    longitudine: 11.3047,
  },
  mezzolombardo: {
    comune: 'Mezzolombardo',
    via: 'Via De Varda 18',
    latitudine: 46.2146,
    longitudine: 11.0966,
  },
  cles: {
    comune: 'Cles',
    via: 'Piazza Granda 7',
    latitudine: 46.3657,
    longitudine: 11.0348,
  },
  borgo: {
    comune: 'Borgo Valsugana',
    via: 'Corso Ausugum 53',
    latitudine: 46.0529,
    longitudine: 11.4562,
  },
  mori: {
    comune: 'Mori',
    via: 'Via Teatro 2',
    latitudine: 45.8517,
    longitudine: 10.9803,
  },
};

const DEMO_ANNOUNCEMENTS = [
  {
    key: 'lampada',
    donor: 'demo.donatore@revalue.local',
    titolo: 'Demo - Lampada da scrivania',
    stato: 'DISPONIBILE',
    daysToDeadline: 7,
    location: DEMO_LOCATIONS.trentoCentro,
    oggetto: {
      categoria: 'Arredamento',
      descrizione: 'Lampada LED funzionante, ideale per camera studio o scrivania.',
      dimensioni: 'piccolo',
      materiale: 'metallo',
      foto: DEMO_PHOTOS.lampada,
    },
  },
  {
    key: 'scrivania',
    donor: 'demo.donatore@revalue.local',
    titolo: 'Demo - Scrivania compatta',
    stato: 'PRENOTATO',
    daysToDeadline: 5,
    location: DEMO_LOCATIONS.rovereto,
    oggetto: {
      categoria: 'Arredamento',
      descrizione: 'Scrivania bianca compatta, smontabile e pronta per il ritiro.',
      dimensioni: 'medio',
      materiale: 'legno',
      foto: DEMO_PHOTOS.scrivania,
    },
  },
  {
    key: 'microonde',
    donor: 'demo.donatore@revalue.local',
    titolo: 'Demo - Microonde funzionante',
    stato: 'RITIRATO',
    daysToDeadline: 3,
    location: DEMO_LOCATIONS.pergine,
    oggetto: {
      categoria: 'Elettrodomestici',
      descrizione: 'Microonde testato, consegnato tramite QR durante la demo.',
      dimensioni: 'medio',
      materiale: 'metallo',
      foto: DEMO_PHOTOS.microonde,
    },
  },
  {
    key: 'sedia',
    donor: 'demo.donatore@revalue.local',
    titolo: 'Demo - Sedia pieghevole',
    stato: 'DISPONIBILE',
    daysToDeadline: 10,
    location: DEMO_LOCATIONS.riva,
    oggetto: {
      categoria: 'Arredamento',
      descrizione: 'Sedia pieghevole leggera, utile per studenti fuori sede.',
      dimensioni: 'piccolo',
      materiale: 'plastica',
      foto: DEMO_PHOTOS.sedia,
    },
  },
  {
    key: 'libreria',
    donor: 'demo.donatore.rovereto@revalue.local',
    titolo: 'Demo - Libreria stretta',
    stato: 'DISPONIBILE',
    daysToDeadline: 8,
    location: DEMO_LOCATIONS.arco,
    oggetto: {
      categoria: 'Arredamento',
      descrizione: 'Libreria alta e stretta, adatta a corridoio o stanza studenti.',
      dimensioni: 'grande',
      materiale: 'legno',
      foto: DEMO_PHOTOS.libreria,
    },
  },
  {
    key: 'tavolino',
    donor: 'demo.donatore.rovereto@revalue.local',
    titolo: 'Demo - Tavolino da salotto',
    stato: 'PRENOTATO',
    daysToDeadline: 4,
    location: DEMO_LOCATIONS.levico,
    oggetto: {
      categoria: 'Arredamento',
      descrizione: 'Tavolino basso in buone condizioni, ritirabile nel weekend.',
      dimensioni: 'medio',
      materiale: 'legno',
      foto: DEMO_PHOTOS.tavolino,
    },
  },
  {
    key: 'bollitore',
    donor: 'demo.donatore.rovereto@revalue.local',
    titolo: 'Demo - Bollitore elettrico',
    stato: 'DISPONIBILE',
    daysToDeadline: 6,
    location: DEMO_LOCATIONS.mezzolombardo,
    oggetto: {
      categoria: 'Elettrodomestici',
      descrizione: 'Bollitore elettrico da cucina, pulito e funzionante.',
      dimensioni: 'piccolo',
      materiale: 'metallo',
      foto: DEMO_PHOTOS.bollitore,
    },
  },
  {
    key: 'bici',
    donor: 'demo.donatore.pergine@revalue.local',
    titolo: 'Demo - Bicicletta da sistemare',
    stato: 'PRENOTATO',
    daysToDeadline: 9,
    location: DEMO_LOCATIONS.cles,
    oggetto: {
      categoria: 'Sport',
      descrizione: 'Bici cittadina usata, freni da regolare ma telaio integro.',
      dimensioni: 'grande',
      materiale: 'metallo',
      foto: DEMO_PHOTOS.bici,
    },
  },
  {
    key: 'armadio',
    donor: 'demo.donatore.pergine@revalue.local',
    titolo: 'Demo - Armadietto ingresso',
    stato: 'DISPONIBILE',
    daysToDeadline: 12,
    location: DEMO_LOCATIONS.borgo,
    oggetto: {
      categoria: 'Arredamento',
      descrizione: 'Armadietto basso con due ante, utile per ingresso o ripostiglio.',
      dimensioni: 'medio',
      materiale: 'legno',
      foto: DEMO_PHOTOS.armadio,
    },
  },
  {
    key: 'monitor',
    donor: 'demo.donatore.pergine@revalue.local',
    titolo: 'Demo - Monitor 24 pollici',
    stato: 'DISPONIBILE',
    daysToDeadline: 11,
    location: DEMO_LOCATIONS.mori,
    oggetto: {
      categoria: 'Elettronica',
      descrizione: 'Monitor esterno funzionante, senza cavo HDMI incluso.',
      dimensioni: 'medio',
      materiale: 'plastica',
      foto: DEMO_PHOTOS.monitor,
    },
  },
];

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function provinciaTrentoAddress(location) {
  return {
    paese: 'Italia',
    regione: 'Trentino-Alto Adige',
    provincia: 'Trento',
    comune: location.comune,
    via: location.via,
    latitudineComune: location.latitudine,
    longitudineComune: location.longitudine,
  };
}

function annuncioPayload(donorId, overrides) {
  const { location, ...payload } = overrides;
  return {
    donatore: donorId,
    isAttivo: true,
    latitudine: location.latitudine,
    longitudine: location.longitudine,
    indirizzo: provinciaTrentoAddress(location),
    ...payload,
  };
}

async function createDemoUsers() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await User.deleteMany({ email: { $in: DEMO_USERS.map((user) => user.email) } });

  const users = await User.insertMany(
    DEMO_USERS.map((user) => ({
      ...user,
      passwordHash,
      livelloAccesso: user.ruolo === 'admin' ? 10 : 0,
      malusCount: 0,
      isSospeso: false,
      bannato: false,
    }))
  );

  return {
    donor: users.find((user) => user.email === 'demo.donatore@revalue.local'),
    roveretoDonor: users.find((user) => user.email === 'demo.donatore.rovereto@revalue.local'),
    pergineDonor: users.find((user) => user.email === 'demo.donatore.pergine@revalue.local'),
    buyer: users.find((user) => user.email === 'demo.acquirente@revalue.local'),
    admin: users.find((user) => user.email === 'demo.admin@revalue.local'),
  };
}

async function clearDemoScenario(userIds) {
  const demoAnnunci = await Annuncio.find({
    $or: [
      { titolo: /^Demo - / },
      { donatore: { $in: userIds } },
    ],
  }).select('_id');
  const annuncioIds = demoAnnunci.map((annuncio) => annuncio._id);

  const demoPrenotazioni = await Prenotazione.find({
    $or: [
      { annuncio: { $in: annuncioIds } },
      { acquirente: { $in: userIds } },
      { donatore: { $in: userIds } },
    ],
  }).select('_id');
  const prenotazioneIds = demoPrenotazioni.map((prenotazione) => prenotazione._id);

  await Promise.all([
    TokenQR.deleteMany({ prenotazione: { $in: prenotazioneIds } }),
    Conversazione.deleteMany({
      $or: [
        { prenotazione: { $in: prenotazioneIds } },
        { partecipanti: { $in: userIds } },
      ],
    }),
    Prenotazione.deleteMany({ _id: { $in: prenotazioneIds } }),
    Annuncio.deleteMany({ _id: { $in: annuncioIds } }),
    Wallet.deleteMany({ idUtente: { $in: userIds } }),
    Coupon.deleteMany({ partner: /\(demo\)$/ }),
  ]);
}

async function createWallet(userId, bilancio, motivo) {
  const transazioni = bilancio > 0
    ? [{ tipo: 'accredito', ammontare: bilancio, motivo, data: new Date() }]
    : [];
  return Wallet.create({ idUtente: userId, bilancio, transazioni });
}

async function seedDemoData() {
  const existingDemoUsers = await User.find({
    email: { $in: DEMO_USERS.map((user) => user.email) },
  }).select('_id');
  await clearDemoScenario(existingDemoUsers.map((user) => user._id));

  const users = await createDemoUsers();
  const userList = Object.values(users);
  const userIds = userList.map((user) => user._id);
  const usersByEmail = new Map(userList.map((user) => [user.email, user]));

  await Promise.all(userList.map((user) => {
    if (user.email === 'demo.acquirente@revalue.local') {
      return createWallet(user._id, 160, 'Demo: saldo iniziale per riscattare coupon');
    }
    if (user.ruolo === 'admin') {
      return createWallet(user._id, 0, 'Demo: wallet amministratore');
    }
    return createWallet(user._id, 50, 'Demo: crediti da scambio completato');
  }));

  const annunci = await Annuncio.insertMany(
    DEMO_ANNOUNCEMENTS.map((item) => annuncioPayload(usersByEmail.get(item.donor)._id, {
      titolo: item.titolo,
      stato: item.stato,
      dataScadenza: daysFromNow(item.daysToDeadline),
      versione: item.stato === 'DISPONIBILE' ? 0 : 1,
      location: item.location,
      oggetto: item.oggetto,
    }))
  );
  const annunciByKey = new Map(annunci.map((annuncio, index) => [DEMO_ANNOUNCEMENTS[index].key, annuncio]));
  const announcementConfigByKey = new Map(DEMO_ANNOUNCEMENTS.map((item) => [item.key, item]));

  const prenotazioni = await Prenotazione.insertMany([
    ...['scrivania', 'tavolino', 'bici'].map((key, index) => {
      const annuncio = annunciByKey.get(key);
      const config = announcementConfigByKey.get(key);
      return {
        annuncio: annuncio._id,
        acquirente: users.buyer._id,
        donatore: usersByEmail.get(config.donor)._id,
        stato: 'ATTIVA',
        dataPrenotazione: new Date(Date.now() - (index + 1) * 35 * 60 * 1000),
        creditiDonatore: 50,
        creditiAcquirente: 50,
      };
    }),
    {
      annuncio: annunciByKey.get('microonde')._id,
      acquirente: users.buyer._id,
      donatore: users.donor._id,
      stato: 'COMPLETATA',
      dataPrenotazione: daysFromNow(-1),
      dataCompletamento: new Date(),
      creditiDonatore: 50,
      creditiAcquirente: 50,
    },
  ]);
  const activePrenotazioni = prenotazioni.filter((prenotazione) => prenotazione.stato === 'ATTIVA');

  await TokenQR.insertMany(activePrenotazioni.map((prenotazione, index) => ({
    prenotazione: prenotazione._id,
    codice: `DEMO-QR-${String(index + 1).padStart(2, '0')}-${prenotazione._id.toString().slice(-8).toUpperCase()}`,
    scadenza: daysFromNow(2 + index),
    usato: false,
  })));

  await Conversazione.insertMany(activePrenotazioni.map((prenotazione, index) => {
    const donor = userList.find((user) => user._id.equals(prenotazione.donatore));
    const pickupWindows = ['domani dopo le 17', 'sabato mattina', 'giovedi verso le 18'];
    return {
      prenotazione: prenotazione._id,
      partecipanti: [prenotazione.donatore, users.buyer._id],
      messaggi: [
        {
          mittente: users.buyer._id,
          testo: `Ciao ${donor.nome}, confermo che sono interessato al ritiro. Per te va bene ${pickupWindows[index]}?`,
          letto: true,
          timestamp: new Date(Date.now() - (90 - index * 10) * 60 * 1000),
        },
        {
          mittente: prenotazione.donatore,
          testo: 'Va bene. Ti mando qui le indicazioni precise e al ritiro ti mostro il QR.',
          letto: true,
          timestamp: new Date(Date.now() - (72 - index * 10) * 60 * 1000),
        },
        {
          mittente: users.buyer._id,
          testo: 'Perfetto, arrivo con una borsa capiente. Grazie!',
          letto: index !== 0,
          timestamp: new Date(Date.now() - (45 - index * 10) * 60 * 1000),
        },
      ],
    };
  }));

  const coupon = await Coupon.insertMany(DEMO_COUPONS);

  return {
    users,
    annunci,
    prenotazioni,
    coupon,
  };
}

async function runCli() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI mancante. Configura backend/.env prima di eseguire il seed demo.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const result = await seedDemoData();
  await mongoose.disconnect();

  console.log('Scenario demo RE-VALUE pronto.');
  console.log(`Utenti: ${Object.values(result.users).map((user) => user.email).join(', ')}`);
  console.log(`Password demo: ${DEMO_PASSWORD}`);
  console.log(`Annunci demo: ${result.annunci.length}`);
  console.log(`Coupon demo: ${result.coupon.length}`);
}

if (require.main === module) {
  runCli().catch(async (err) => {
    console.error(err);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = {
  DEMO_PASSWORD,
  DEMO_USERS,
  DEMO_COUPONS,
  DEMO_ANNOUNCEMENTS,
  DEMO_LOCATIONS,
  DEMO_PHOTOS,
  seedDemoData,
};
