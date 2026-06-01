const mongoose = require('mongoose');

const { Schema } = mongoose;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new Schema(
  {
    idUtente: {
      type: String,
      required: [true, 'idUtente is required'],
      unique: true,
      trim: true,
    },
    nome: {
      type: String,
      required: [true, 'nome is required'],
      trim: true,
    },
    cognome: {
      type: String,
      required: [true, 'cognome is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator(value) {
          // OCL #1: email deve rispettare un formato valido.
          return emailRegex.test(value);
        },
        message: 'email format is invalid',
      },
    },
    passwordHash: {
      type: String,
      required: [true, 'passwordHash is required'],
      minlength: [64, 'passwordHash must be at least 64 characters long'],
      maxlength: [64, 'passwordHash must be exactly 64 characters long'],
      validate: {
        validator(value) {
          return /^[a-f0-9]{64}$/i.test(value);
        },
        message: 'passwordHash must be a SHA-256 hexadecimal digest (OCL #2)',
      },
    },
    malusCount: {
      type: Number,
      default: 0,
      min: [0, 'malusCount cannot be negative'],
    },
    isSospeso: {
      type: Boolean,
      default: false,
    },
    bannato: {
      type: Boolean,
      default: false,
    },
    ruolo: {
      type: String,
      required: [true, 'ruolo is required'],
      trim: true,
      enum: {
        values: ['user', 'admin'],
        message: 'ruolo must be either user or admin',
      },
    },
    livelloAccesso: {
      type: Number,
      default: 0,
      min: [0, 'livelloAccesso cannot be negative'],
    },
    expoPushToken: {
      type: String,
      trim: true,
      default: '',
    },
    telefono: {
      type: String,
      trim: true,
      default: '',
    },
    citta: {
      type: String,
      trim: true,
      default: '',
    },
    descrizione: {
      type: String,
      trim: true,
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
