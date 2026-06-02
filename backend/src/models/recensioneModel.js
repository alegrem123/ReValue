const mongoose = require('mongoose');

const { Schema } = mongoose;

const recensioneSchema = new Schema(
  {
    recensore: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'recensore is required'],
    },
    recensito: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'recensito is required'],
    },
    prenotazione: {
      type: Schema.Types.ObjectId,
      ref: 'Prenotazione',
      required: [true, 'prenotazione is required'],
    },
    positiva: {
      type: Boolean,
      required: [true, 'positiva is required'],
    },
    testo: {
      type: String,
      trim: true,
      maxlength: [1000, 'testo must be at most 1000 characters'],
      default: '',
    },
    data: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

// OCL #21: recensione solo su scambio completato — enforced nel service
// un recensore può lasciare una sola recensione per prenotazione
recensioneSchema.index(
  { recensore: 1, prenotazione: 1 },
  { unique: true }
);
recensioneSchema.index({ recensito: 1 });

module.exports =
  mongoose.models.Recensione || mongoose.model('Recensione', recensioneSchema);
