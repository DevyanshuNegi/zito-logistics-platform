const jwt = require('jsonwebtoken');

const DEFAULT_JWT_SECRET = 'vglogistics_access_secret_key_2026_make_this_very_long_and_random';
const DEFAULT_JWT_EXPIRES_IN = '30d';

const getJwtSecret = () => process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const getJwtExpiresIn = () => process.env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN;

const signJwt = (payload, options = {}) => jwt.sign(payload, getJwtSecret(), {
  expiresIn: getJwtExpiresIn(),
  ...options,
});

const verifyJwt = (token) => jwt.verify(token, getJwtSecret());

module.exports = {
  DEFAULT_JWT_EXPIRES_IN,
  DEFAULT_JWT_SECRET,
  getJwtExpiresIn,
  getJwtSecret,
  signJwt,
  verifyJwt,
};
