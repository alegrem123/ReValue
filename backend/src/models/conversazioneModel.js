const mongoose = require('mongoose');

const { Schema } = mongoose;

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
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    versionKey: false,
  }
);

// RNF9: messaggi persistiti e recuperabili — garantito da embedding
// RF13: solo partecipanti possono inviare — enforced nel service
conversazioneSchema.index({ prenotazione: 1 });

module.exports =
  mongoose.models.Conversazione || mongoose.model('Conversazione', conversazioneSchema);
