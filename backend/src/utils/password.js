const crypto = require('crypto');

const SHA256_HEX_LENGTH = 64;

/**
 * Hashes a plaintext password using SHA-256 as specified by D2 OCL #2.
 *
 * @param {string} password - Plaintext password to hash.
 * @returns {Promise<string>} SHA-256 hex hash of the provided password.
 * @throws {Error} If the password is missing or empty.
 */
async function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password is required');
  }

  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Compares a plaintext password against a stored SHA-256 hex hash.
 * @param {string} password - Plaintext password to verify.
 * @param {string} passwordHash - Stored SHA-256 hex hash.
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

  if (passwordHash.length !== SHA256_HEX_LENGTH || !/^[a-f0-9]+$/i.test(passwordHash)) {
    return false;
  }

  const candidate = await hashPassword(password);
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(passwordHash));
}

module.exports = {
  hashPassword,
  comparePassword,
};
