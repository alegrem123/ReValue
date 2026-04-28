const mongoose = require('mongoose');

const { Schema } = mongoose;

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
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    versionKey: false,
  }
);

module.exports = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);
