const mongoose = require('mongoose');

const { Schema } = mongoose;

// StatoAnnuncio (D2 §2.3.1)
const STATI_ANNUNCIO = ['DISPONIBILE', 'PRENOTATO', 'RITIRATO', 'SCADUTO'];

// Oggetto embedded (D2 §2.3.2) — non esiste senza l'annuncio che lo contiene
const oggettoSchema = new Schema(
  {
    categoria: {
      type: String,
      required: [true, 'categoria is required'],
      trim: true,
    },
    descrizione: {
      type: String,
      required: [true, 'descrizione is required'],
      trim: true,
    },
    dimensioni: {
      type: String,
      trim: true,
    },
    materiale: {
      type: String,
      trim: true,
    },
    foto: {
      type: [String],
      default: [],
      validate: {
        validator: (v) => v.length <= 5,
        message: 'massimo 5 foto per annuncio (RF15)',
      },
    },
  },
  { _id: false }
);

const annuncioSchema = new Schema(
  {
    donatore: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'donatore is required'],
    },
    titolo: {
      type: String,
      required: [true, 'titolo is required'],
      trim: true,
    },
    stato: {
      type: String,
      enum: STATI_ANNUNCIO,
      default: 'DISPONIBILE',
    },
    dataScadenza: {
      type: Date,
      required: [true, 'dataScadenza is required'],
      validate: {
        validator(value) {
          return value > new Date();
        },
        message: 'dataScadenza deve essere nel futuro (OCL #5)',
      },
    },
    // OCL #7 / UC2: incrementato ad ogni prenota() per optimistic lock
    versione: {
      type: Number,
      default: 0,
    },
    isAttivo: {
      type: Boolean,
      default: true,
    },
    latitudine: {
      type: Number,
    },
    longitudine: {
      type: Number,
    },
    oggetto: {
      type: oggettoSchema,
      required: [true, 'oggetto is required'],
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    versionKey: false,
  }
);

// Indici: filtraggio per stato+isAttivo (catalogo) e scadenza (soft-delete automatico)
annuncioSchema.index({ stato: 1, isAttivo: 1 });
annuncioSchema.index({ dataScadenza: 1 });
annuncioSchema.index({ donatore: 1 });

module.exports = mongoose.models.Annuncio || mongoose.model('Annuncio', annuncioSchema);
