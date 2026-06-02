const mongoose = require('mongoose');

const { Schema } = mongoose;

// UC7 — Riscatto coupon con codice univoco UUID v4
const riscattoSchema = new Schema(
  {
    utente: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    coupon: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
    },
    codiceUnivoco: {
      type: String,
      required: true,
      unique: true,
      match: [
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        'codiceUnivoco must be a valid UUID v4',
      ],
    },
    usato: {
      type: Boolean,
      default: false,
    },
    dataRiscatto: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

riscattoSchema.index({ utente: 1 });

module.exports = mongoose.model('Riscatto', riscattoSchema);
