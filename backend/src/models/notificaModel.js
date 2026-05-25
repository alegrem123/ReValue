const mongoose = require('mongoose');

const { Schema } = mongoose;

const tipiNotifica = ['messaggio', 'prenotazione', 'scambio', 'segnalazione', 'sistema'];

const notificaSchema = new Schema(
  {
    utente: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'utente is required'],
    },
    tipo: {
      type: String,
      required: [true, 'tipo is required'],
      enum: {
        values: tipiNotifica,
        message: 'tipo notifica non valido',
      },
    },
    testo: {
      type: String,
      required: [true, 'testo is required'],
      trim: true,
      minlength: [1, 'testo non puo essere vuoto'],
    },
    link: {
      type: String,
      trim: true,
      default: null,
    },
    letta: {
      type: Boolean,
      default: false,
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

// RF12/D2 1.2.6: recupero efficiente delle notifiche non lette per utente.
notificaSchema.index({ utente: 1, letta: 1 });
notificaSchema.index({ utente: 1, data: -1 });

module.exports = mongoose.models.Notifica || mongoose.model('Notifica', notificaSchema);
module.exports.tipiNotifica = tipiNotifica;
