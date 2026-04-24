const Redis = require('ioredis');
const logger = require('./logger');

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis connection error', err));

/**
 * Key Format: zito:otp:{type}:{userId}
 */
const setOtp = async (userId, type, otp, expiryMins) => {
  const key = `zito:otp:${type}:${userId}`;
  await redis.setex(key, expiryMins * 60, JSON.stringify({
    otp,
    attempts: 0,
    createdAt: new Date()
  }));
};

const getOtp = async (userId, type) => {
  const key = `zito:otp:${type}:${userId}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};

const delOtp = async (userId, type) => {
  const key = `zito:otp:${type}:${userId}`;
  await redis.del(key);
};

module.exports = {
  redis,
  setOtp,
  getOtp,
  delOtp
};