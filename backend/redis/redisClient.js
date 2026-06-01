const redis = require("redis");
require("dotenv").config();

let _isConnected = false;

const redisUrl =
  process.env.REDIS_URL ||
  `redis://${process.env.REDIS_HOST || "localhost"}:${
    process.env.REDIS_PORT || 6379
  }`;

const redisClient = redis.createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        console.warn(
          "[Redis] Max reconnect attempts reached. Running without Redis (in-memory fallback active)."
        );
        return false;
      }

      const delay = Math.min(retries * 500, 3000);
      console.log(`[Redis] Reconnecting in ${delay}ms...`);
      return delay;
    },
  },
});

redisClient.on("connect", () => {
  console.log("[Redis] Connecting...");
});

redisClient.on("ready", () => {
  console.log("[Redis] ✅ Connected successfully.");
  _isConnected = true;
});

redisClient.on("reconnecting", () => {
  console.log("[Redis] Attempting to reconnect...");
});

redisClient.on("error", (err) => {
  console.error("[Redis] Error:", err);
  _isConnected = false;
});

redisClient.on("end", () => {
  console.warn("[Redis] Connection closed.");
  _isConnected = false;
});

(async () => {
  try {
    console.log(`[Redis] Connecting to ${redisUrl}`);

    await redisClient.connect();

    const pong = await redisClient.ping();
    console.log("[Redis] Ping Response:", pong);

    _isConnected = true;
  } catch (err) {
    console.error(
      `[Redis] Could not connect: ${err?.message || err}. System will use in-memory fallback.`
    );
    _isConnected = false;
  }
})();

const isRedisAvailable = () =>
  _isConnected && redisClient.isOpen && redisClient.isReady;

module.exports = redisClient;
module.exports.isRedisAvailable = isRedisAvailable;