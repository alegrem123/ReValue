const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Messaggio è embedded in Conversazione (composizione 1→0..*).
 * Questo file esporta lo schema standalone per riuso e test.
 * Il modello Mongoose non viene registrato separatamente.
 */
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
  },
  { _id: true }
);

module.exports = messaggioSchema;
