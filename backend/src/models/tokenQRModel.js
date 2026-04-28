const mongoose = require('mongoose');

const { Schema } = mongoose;

const tokenQRSchema = new Schema(
  {
    prenotazione: {
      type: Schema.Types.ObjectId,
      ref: 'Prenotazione',
      required: [true, 'prenotazione is required'],
      unique: true, // composizione 1→0..1: un solo token per prenotazione
    },
    codice: {
      type: String,
      required: [true, 'codice is required'],
      unique: true,
    },
    scadenza: {
      type: Date,
      required: [true, 'scadenza is required'],
      // OCL #14: scadenza > DateTime.now() — validata a livello di service
    },
    usato: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// TTL index: MongoDB rimuove automaticamente il documento alla scadenza
tokenQRSchema.index({ scadenza: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.TokenQR || mongoose.model('TokenQR', tokenQRSchema);
