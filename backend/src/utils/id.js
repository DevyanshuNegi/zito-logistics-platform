const { randomUUID } = require('crypto');

const generateUuidReference = (prefix = 'ZT') => {
  const normalizedPrefix = String(prefix || 'ZT').trim().toUpperCase();
  return `${normalizedPrefix}-${randomUUID().toUpperCase()}`;
};

module.exports = {
  generateUuidReference,
};
