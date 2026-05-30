const mongoose = require('mongoose');

const { Schema } = mongoose;

const TIPI_SEGNALAZIONE = ['descrizione', 'inappropriato', 'altro'];

const segnalazioneSchema = new Schema(
  {
    segnalante: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'segnalante is required'],
    },
    segnalato: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'segnalato is required'],
    },
    annuncio: {
      type: Schema.Types.ObjectId,
      ref: 'Annuncio',
      default: null, // opzionale — D2 §2.3.5: associazione 0..*→0..1
    },
    tipo: {
      type: String,
      enum: TIPI_SEGNALAZIONE,
      required: [true, 'tipo is required'],
    },
    motivo: {
      type: String,
      required: [true, 'motivo is required'], // OCL #18: motivo obbligatorio
      trim: true,
      minlength: [1, 'motivo non può essere vuoto'],
    },
    data: {
      type: Date,
      default: Date.now,
    },
    malusApplicato: {
      type: Boolean,
      default: false,
    },
  },
  {
    versionKey: false,
  }
);

// OCL #19: segnalante !== segnalato
segnalazioneSchema.pre('validate', function validateDifferentUsers(next) {
  if (this.segnalante && this.segnalato && this.segnalante.toString() === this.segnalato.toString()) {
    this.invalidate('segnalato', 'segnalante e segnalato devono essere diversi');
  }
  next();
});
segnalazioneSchema.index({ segnalato: 1 });
segnalazioneSchema.index({ annuncio: 1 });

module.exports =
  mongoose.models.Segnalazione || mongoose.model('Segnalazione', segnalazioneSchema);
