require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Coupon = require('../src/models/couponModel');

const coupons = [
  {
    titolo: 'Caffè gratis',
    descrizione: 'Un caffè espresso omaggio presso qualsiasi punto vendita.',
    partner: 'Costa Coffee',
    costoCrediti: 5,
    stock: 100,
    attivo: true,
  },
  {
    titolo: '10% di sconto',
    descrizione: 'Sconto del 10% su qualsiasi acquisto in negozio.',
    partner: 'Decathlon',
    costoCrediti: 10,
    stock: 50,
    attivo: true,
  },
  {
    titolo: 'Gelato gratis',
    descrizione: 'Un gelato a scelta fino a 3 gusti.',
    partner: 'Grom',
    costoCrediti: 5,
    stock: 80,
    attivo: true,
  },
  {
    titolo: '15% di sconto libri',
    descrizione: 'Sconto del 15% su tutti i libri.',
    partner: 'Feltrinelli',
    costoCrediti: 10,
    stock: 30,
    attivo: true,
  },
  {
    titolo: 'Ingresso museo gratuito',
    descrizione: 'Un ingresso gratuito al museo civico.',
    partner: 'Comune di Trento',
    costoCrediti: 20,
    stock: 20,
    attivo: true,
  },
  {
    titolo: '20% di sconto abbigliamento',
    descrizione: 'Sconto del 20% su tutta la collezione.',
    partner: 'Zara',
    costoCrediti: 20,
    stock: 40,
    attivo: true,
  },
  {
    titolo: 'Pizza margherita gratis',
    descrizione: 'Una pizza margherita omaggio con ordine minimo 10€.',
    partner: 'Rosso Pomodoro',
    costoCrediti: 10,
    stock: 60,
    attivo: true,
  },
  {
    titolo: 'Abbonamento mensile palestra',
    descrizione: 'Un mese di accesso illimitato alla palestra.',
    partner: 'Virgin Active',
    costoCrediti: 50,
    stock: 10,
    attivo: true,
  },
  {
    titolo: 'Buono spesa 5€',
    descrizione: 'Buono spesa da 5€ valido su qualsiasi acquisto.',
    partner: 'Esselunga',
    costoCrediti: 20,
    stock: 0,
    attivo: true,
  },
  {
    titolo: 'Corso online gratuito',
    descrizione: 'Accesso gratuito a un corso a scelta sulla piattaforma.',
    partner: 'Udemy',
    costoCrediti: 50,
    stock: 0,
    attivo: true,
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  await Coupon.deleteMany({});
  const inserted = await Coupon.insertMany(coupons);
  console.log(`Inseriti ${inserted.length} coupon.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
