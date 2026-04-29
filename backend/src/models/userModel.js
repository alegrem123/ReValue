const mongoose = require('mongoose');

const { Schema } = mongoose;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new Schema(
  {
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
          return emailRegex.test(value);
        },
        message: 'email format is invalid',
      },
    },
    passwordHash: {
      type: String,
      required: [true, 'passwordHash is required'],
      minlength: [60, 'passwordHash must be at least 60 characters long'],
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
