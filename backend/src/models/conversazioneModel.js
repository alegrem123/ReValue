const mongoose = require('mongoose');

const { Schema } = mongoose;

const MAX_IMMAGINE_BASE64_LENGTH = Math.ceil((1024 * 1024 * 4) / 3);
const MAX_MESSAGGI_CON_IMMAGINE = 20;
const MAX_IMMAGINI_BASE64_TOTAL_LENGTH = MAX_IMMAGINE_BASE64_LENGTH * 5;
const MAX_MESSAGGI_CONVERSAZIONE = 1000;

const messaggioSchema = new Schema(
  {
    mittente: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'mittente is required'],
    },
    testo: {
      type: String,
      required: [true, 'testo is required'],
      trim: true,
      minlength: [1, 'testo non può essere vuoto'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    letto: {
      type: Boolean,
      default: false,
    },
    immagine: {
      type: String,
      default: null,
      maxlength: [MAX_IMMAGINE_BASE64_LENGTH, 'immagine supera il limite di 1 MB'],
    },
  },
  { _id: true }
);

const conversazioneSchema = new Schema(
  {
    prenotazione: {
      type: Schema.Types.ObjectId,
      ref: 'Prenotazione',
      required: [true, 'prenotazione is required'],
      unique: true, // composizione 1→0..1: una chat per prenotazione
    },
    partecipanti: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      validate: {
        validator: (v) => v.length === 2,
        message: 'una conversazione ha esattamente 2 partecipanti',
      },
    },
    messaggi: {
      type: [messaggioSchema],
      default: [],
      validate: [
        {
          validator: (v) => v.length <= MAX_MESSAGGI_CONVERSAZIONE,
          message: `conversazione limitata a ${MAX_MESSAGGI_CONVERSAZIONE} messaggi`,
        },
        {
          validator: (v) => v.filter((m) => m.immagine).length <= MAX_MESSAGGI_CON_IMMAGINE,
          message: `conversazione limitata a ${MAX_MESSAGGI_CON_IMMAGINE} immagini`,
        },
        {
          validator: (v) => v.reduce((sum, m) => sum + (m.immagine ? m.immagine.length : 0), 0) <= MAX_IMMAGINI_BASE64_TOTAL_LENGTH,
          message: 'dimensione totale immagini conversazione superata',
        },
      ],
    },
    // Mappa userId → timestamp ultimo evento "sta scrivendo" (transiente, TTL ~3s)
    typing: {
      type: Map,
      of: Date,
      default: {},
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    versionKey: false,
  }
);

// RNF9: messaggi persistiti e recuperabili — garantito da embedding
// RF13: solo partecipanti possono inviare — enforced nel service

conversazioneSchema.index({ partecipanti: 1 });

const Conversazione =
  mongoose.models.Conversazione || mongoose.model('Conversazione', conversazioneSchema);

Conversazione.MAX_IMMAGINE_BASE64_LENGTH = MAX_IMMAGINE_BASE64_LENGTH;
Conversazione.MAX_MESSAGGI_CON_IMMAGINE = MAX_MESSAGGI_CON_IMMAGINE;
Conversazione.MAX_IMMAGINI_BASE64_TOTAL_LENGTH = MAX_IMMAGINI_BASE64_TOTAL_LENGTH;
Conversazione.MAX_MESSAGGI_CONVERSAZIONE = MAX_MESSAGGI_CONVERSAZIONE;

module.exports = Conversazione;
