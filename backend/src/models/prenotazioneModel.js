const mongoose = require('mongoose');

const { Schema } = mongoose;

// StatoPrenotazione (D2 §2.3.3)
const STATI_PRENOTAZIONE = ['ATTIVA', 'ANNULLATA', 'COMPLETATA'];

const prenotazioneSchema = new Schema(
  {
    annuncio: {
      type: Schema.Types.ObjectId,
      ref: 'Annuncio',
      required: [true, 'annuncio is required'],
    },
    acquirente: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'acquirente is required'],
    },
    donatore: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'donatore is required'],
    },
    stato: {
      type: String,
      enum: STATI_PRENOTAZIONE,
      default: 'ATTIVA',
    },
    dataCompletamento: {
      type: Date,
      default: null,
    },
    dataPrenotazione: {
      type: Date,
      default: Date.now,
    },
    creditiDonatore: {
      type: Number,
      default: null,
    },
    creditiAcquirente: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// OCL #9: al massimo una prenotazione ATTIVA per annuncio
// enforced a livello di service con query atomica su Annuncio.versione
// indice parziale per query rapida su prenotazioni attive
prenotazioneSchema.index(
  { annuncio: 1 },
  {
    unique: true,
    partialFilterExpression: { stato: 'ATTIVA' },
    name: 'unique_active_booking_per_annuncio',
  }
);
prenotazioneSchema.index({ acquirente: 1 });
prenotazioneSchema.index({ donatore: 1 });

module.exports =
  mongoose.models.Prenotazione || mongoose.model('Prenotazione', prenotazioneSchema);
