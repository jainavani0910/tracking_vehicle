const redis = require('redis');
require('dotenv').config();

let _isConnected = false;

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        console.warn('[Redis] Max reconnect attempts reached. Running without Redis (in-memory fallback active).');
        return false; // Stop retrying
      }
      return Math.min(retries * 500, 3000);
    },
  },
});

redisClient.on('error', (err) => {
  // Only log first occurrence to avoid spam
  if (_isConnected || !redisClient._errorLogged) {
    console.warn(`[Redis] Connection error: ${err.message}`);
    redisClient._errorLogged = true;
  }
  _isConnected = false;
});

redisClient.on('connect', () => {
  console.log('[Redis] ✅ Connected successfully.');
  _isConnected = true;
  redisClient._errorLogged = false;
});

redisClient.on('reconnecting', () => {
  console.log('[Redis] Attempting to reconnect...');
});

redisClient.on('end', () => {
  _isConnected = false;
});

// Attempt connection — do NOT crash if Redis is unavailable
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.warn(`[Redis] Could not connect: ${err.message}. System will use in-memory fallback.`);
    _isConnected = false;
  }
})();

/**
 * Returns true if the Redis client is currently connected and usable.
 */
const isRedisAvailable = () => _isConnected && redisClient.isOpen;

module.exports = redisClient;
module.exports.isRedisAvailable = isRedisAvailable;
