const { Kafka } = require("kafkajs");
const redisClient = require("../redis/redisClient");
const { isRedisAvailable } = require("../redis/redisClient");
const vehicleStore = require("../services/vehicleStore");
require("dotenv").config();

const KAFKA_BROKER = process.env.KAFKA_BROKERS || "localhost:9092";
const TOPIC_NAME = "vehicle-updates";

const kafka = new Kafka({
  clientId: "vehicle-tracking-consumer",
  brokers: KAFKA_BROKER.split(","),
  connectionTimeout: 15000,
  requestTimeout: 60000,
  retry: {
    initialRetryTime: 1000,
    retries: 5,
    maxRetryTime: 30000,
    factor: 2,
  },
  logLevel: 1, // ERROR only
});

const consumer = kafka.consumer({
  groupId: "vehicle-tracking-group",
  sessionTimeout: 60000,
  heartbeatInterval: 5000,
  allowAutoTopicCreation: false,
  maxWaitTimeInMs: 500,
  minBytes: 1,
  maxBytes: 10 * 1024 * 1024, // 10MB per fetch
});
let _consumerConnected = false;
let _restartTimer = null;
let _restartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 20;
const BASE_RESTART_DELAY_MS = 3000;

const _runConsumer = async () => {
  try {
    console.log(`[Kafka Consumer] Connecting to ${KAFKA_BROKER}...`);
    await consumer.connect();
    _consumerConnected = true;
    _restartAttempts = 0; // reset on successful connect
    console.log("[Kafka Consumer] ✅ Connected.");

    // Clear stale Redis keys
    if (isRedisAvailable()) {
      try {
        await redisClient.del("vehicles");
        await redisClient.del("vehicle_details");
      } catch (_) {}
    }

    await consumer.subscribe({ topic: TOPIC_NAME, fromBeginning: false });
    console.log(`[Kafka Consumer] Subscribed to "${TOPIC_NAME}"`);

    // Handle consumer crashes with auto-restart
    consumer.on(consumer.events.CRASH, async ({ payload }) => {
      const errMsg = payload.error?.message || 'Unknown error';
      _consumerConnected = false;

      if (_restartAttempts >= MAX_RESTART_ATTEMPTS) {
        console.warn(`[Kafka Consumer] ⚠️  Max restart attempts reached. Giving up — using in-memory store.`);
        return;
      }

      // Exponential backoff: 3s, 6s, 12s, ... capped at 60s
      const delay = Math.min(BASE_RESTART_DELAY_MS * Math.pow(2, _restartAttempts), 60000);
      _restartAttempts++;
      console.warn(`[Kafka Consumer] ⚠️  Crash (${errMsg.split('\n')[0]}). Restarting in ${delay}ms (attempt ${_restartAttempts}/${MAX_RESTART_ATTEMPTS})...`);

      clearTimeout(_restartTimer);
      _restartTimer = setTimeout(async () => {
        try {
          await consumer.disconnect();
        } catch (_) {}
        _consumerConnected = false;
        _runConsumer().catch(() => {}); // restart silently
      }, delay);
    });

    await consumer.run({
      eachBatchAutoResolve: true,
      eachBatch: async ({ batch, heartbeat, isRunning, isStale }) => {
        if (!isRedisAvailable() || !isRunning() || isStale()) return;

        try {
          const CHUNK_SIZE = 500;
          for (let i = 0; i < batch.messages.length; i += CHUNK_SIZE) {
            const chunk = batch.messages.slice(i, i + CHUNK_SIZE);
            const pipeline = redisClient.multi();

            const geoAddArgs = [];
            const hSetArgs = [];

            for (const message of chunk) {
              if (!message.value) continue;

              const vehicle = JSON.parse(message.value.toString());

              geoAddArgs.push({
                longitude: Number(vehicle.longitude),
                latitude: Number(vehicle.latitude),
                member: vehicle.id,
              });

              hSetArgs.push(vehicle.id, JSON.stringify(vehicle));

              const histKey = `vehicle_history:${vehicle.id}`;

              pipeline.lPush(
                histKey,
                JSON.stringify({
                  latitude: vehicle.latitude,
                  longitude: vehicle.longitude,
                  speed: vehicle.speed,
                  heading: vehicle.heading,
                  timestamp: vehicle.timestamp || new Date().toISOString(),
                }),
              );

              pipeline.lTrim(histKey, 0, 19);
            }

            if (geoAddArgs.length > 0) pipeline.geoAdd("vehicles", geoAddArgs);
            if (hSetArgs.length > 0) pipeline.hSet("vehicle_details", hSetArgs);

            await pipeline.exec();

            // Yield to the event loop so network I/O can happen
            await new Promise(resolve => setImmediate(resolve));
            await heartbeat();
          }
        } catch (err) {
          if (err.name === 'KafkaJSProtocolError' || err.message.includes('rebalancing') || err.message.includes('rejoin')) {
            throw err;
          }
          console.error("[Consumer Batch Error]", err);
        }
      },
    });
  } catch (err) {
    _consumerConnected = false;
    console.warn(
      `[Kafka Consumer] ⚠️  Unavailable (${err.message.split("\n")[0]}). Vehicle data served from in-memory store.`,
    );
    throw err;
  }
};

const connectConsumer = async () => {
  return _runConsumer();
};

const disconnectConsumer = async () => {
  if (!_consumerConnected) return;
  try {
    await consumer.disconnect();
    _consumerConnected = false;
  } catch (_) {}
};

module.exports = { connectConsumer, disconnectConsumer };
