const mongoose = require('mongoose');

const { Schema } = mongoose;

// UC7 — Premio riscattabile con crediti wallet
const couponSchema = new Schema(
  {
    titolo: {
      type: String,
      required: [true, 'titolo is required'],
      trim: true,
    },
    descrizione: {
      type: String,
      required: [true, 'descrizione is required'],
      trim: true,
    },
    partner: {
      type: String,
      required: [true, 'partner is required'],
      trim: true,
    },
    costoCrediti: {
      type: Number,
      required: [true, 'costoCrediti is required'],
      min: [1, 'costoCrediti must be at least 1'],
    },
    // OCL #17 — stock 0 = illimitato
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    attivo: {
      type: Boolean,
      default: true,
    },
    immagine: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Coupon', couponSchema);
