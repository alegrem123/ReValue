const jwt = require('jsonwebtoken');

const TOKEN_EXPIRATION = '7d';

/**
 * Reads the JWT secret from the environment and fails fast if it is missing.
 * @returns {string} Secret key used to sign and verify JWTs.
 * @throws {Error} If JWT_SECRET is not defined.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  return secret;
}

/**
 * Signs a JWT payload with the configured secret and a 7-day expiration.
 * @param {object} payload - Plain object to embed in the JWT.
 * @returns {string} Signed JWT token.
 */
function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_EXPIRATION });
}

/**
 * Verifies a JWT token and returns its decoded payload.
 * @param {string} token - JWT token to verify.
 * @returns {object} Decoded JWT payload.
 * @throws {Error} If the token is missing, expired, malformed, or invalid.
 */
function verifyToken(token) {
  if (!token) {
    throw new Error('Token is required');
  }

  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }

    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }

    throw new Error('Token verification failed');
  }
}

module.exports = {
  signToken,
  verifyToken,
};
