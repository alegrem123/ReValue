const mongoose = require('mongoose');

const { Schema } = mongoose;

const MAX_STORICO_TRANSAZIONI = 1000;

const transazioneSchema = new Schema(
  {
    tipo: {
      type: String,
      required: true,
      enum: ['accredito', 'sottrazione'],
    },
    ammontare: {
      type: Number,
      required: true,
      min: [1, 'ammontare deve essere > 0'],
    },
    motivo: {
      type: String,
      required: true,
      trim: true,
    },
    riferimento: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    data: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const walletSchema = new Schema(
  {
    idUtente: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      ref: 'User',
    },
    bilancio: {
      type: Number,
      default: 0,
      min: [0, 'bilancio non può essere negativo'],
    },
    transazioni: {
      type: [transazioneSchema],
      default: [],
      validate: {
        validator: (v) => v.length <= MAX_STORICO_TRANSAZIONI,
        message: `storico wallet limitato a ${MAX_STORICO_TRANSAZIONI} transazioni`,
      },
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    versionKey: false,
  }
);

const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);
Wallet.MAX_STORICO_TRANSAZIONI = MAX_STORICO_TRANSAZIONI;

module.exports = Wallet;
