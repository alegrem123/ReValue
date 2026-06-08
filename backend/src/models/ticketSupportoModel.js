const mongoose = require('mongoose');

const { Schema } = mongoose;

const ticketSupportoSchema = new Schema(
  {
    utente: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'utente is required'],
    },
    testo: {
      type: String,
      required: [true, 'testo is required'],
      trim: true,
      minlength: [1, 'testo non può essere vuoto'],
    },
    stato: {
      type: String,
      enum: ['APERTO', 'RISPOSTO', 'CHIUSO'],
      default: 'APERTO',
    },
    rispostaEntro: {
      type: Date,
      required: [true, 'rispostaEntro is required'],
    },
    risposta: {
      type: String,
      trim: true,
      default: '',
    },
    dataRisposta: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: false,
  }
);

ticketSupportoSchema.index({ utente: 1, createdAt: -1 });
ticketSupportoSchema.index({ stato: 1, rispostaEntro: 1 });

module.exports =
  mongoose.models.TicketSupporto || mongoose.model('TicketSupporto', ticketSupportoSchema);
