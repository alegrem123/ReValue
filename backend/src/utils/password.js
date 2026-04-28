const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcrypt with 10 salt rounds.
 * Bcrypt hashes are typically 60 characters long, which fits columns sized
 * for at least 64 characters.
 *
 * @param {string} password - Plaintext password to hash.
 * @returns {Promise<string>} Bcrypt hash of the provided password.
 * @throws {Error} If the password is missing or empty.
 */
async function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password is required');
  }

  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plaintext password against a bcrypt hash.
 * @param {string} password - Plaintext password to verify.
 * @param {string} passwordHash - Stored bcrypt hash.
 * @returns {Promise<boolean>} True when the password matches the hash.
 * @throws {Error} If password or passwordHash is missing.
 */
async function comparePassword(password, passwordHash) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password is required');
  }

  if (typeof passwordHash !== 'string' || passwordHash.length === 0) {
    throw new Error('Password hash is required');
  }

  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  hashPassword,
  comparePassword,
};
