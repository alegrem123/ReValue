const crypto = require('crypto');

const SHA256_HEX_LENGTH = 64;
const SALT_BYTES = 16;

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isLegacySha256Hash(value) {
  return typeof value === 'string' &&
    value.length === SHA256_HEX_LENGTH &&
    /^[a-f0-9]{64}$/i.test(value);
}

function parseSaltedHash(value) {
  if (typeof value !== 'string') return null;
  const [salt, hash] = value.split(':');
  if (!salt || !hash) return null;
  if (!/^[a-f0-9]{32}$/i.test(salt) || !/^[a-f0-9]{64}$/i.test(hash)) return null;
  return { salt, hash };
}

/**
 * Hashes a plaintext password using salted SHA-256 as specified by D2 OCL #2.
 *
 * @param {string} password - Plaintext password to hash.
 * @returns {Promise<string>} salt:SHA-256 hex hash of the provided password.
 * @throws {Error} If the password is missing or empty.
 */
async function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password is required');
  }

  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  return `${salt}:${sha256Hex(`${salt}:${password}`)}`;
}

/**
 * Compares a plaintext password against a stored salted or legacy SHA-256 hash.
 * @param {string} password - Plaintext password to verify.
 * @param {string} passwordHash - Stored password hash.
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

  if (isLegacySha256Hash(passwordHash)) {
    const candidate = sha256Hex(password);
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(passwordHash));
  }

  const parsed = parseSaltedHash(passwordHash);
  if (!parsed) return false;

  const candidate = sha256Hex(`${parsed.salt}:${password}`);
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(parsed.hash));
}

module.exports = {
  hashPassword,
  comparePassword,
  isLegacySha256Hash,
};
