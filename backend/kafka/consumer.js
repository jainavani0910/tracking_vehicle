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
  connectionTimeout: 1500, // Fail within 1.5s
  requestTimeout: 3000,
  retry: {
    initialRetryTime: 100,
    retries: 0, // No retries — fail fast
  },
  logLevel: 1, // ERROR only
});

const consumer = kafka.consumer({ groupId: "vehicle-tracking-group" });
let _consumerConnected = false;

const connectConsumer = async () => {
  try {
    console.log(`[Kafka Consumer] Connecting to ${KAFKA_BROKER}...`);
    await consumer.connect();
    _consumerConnected = true;
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

    await consumer.run({
      eachBatchAutoResolve: true,
      eachBatch: async ({ batch }) => {
        if (!isRedisAvailable()) return;
        
        try {
          const pipeline = redisClient.multi();
          
          for (const message of batch.messages) {
            if (!message.value) continue;
            
            const vehicle = JSON.parse(message.value.toString());
            
            pipeline.geoAdd("vehicles", {
              longitude: Number(vehicle.longitude),
              latitude: Number(vehicle.latitude),
              member: vehicle.id,
            });

            pipeline.hSet(
              "vehicle_details",
              vehicle.id,
              JSON.stringify(vehicle),
            );

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
          
          await pipeline.exec();
        } catch (err) {
          console.error("[Consumer Batch Error]", err.message);
        }
      },
    });
  } catch (err) {
    console.warn(
      `[Kafka Consumer] ⚠️  Unavailable (${err.message.split("\n")[0]}). Vehicle data served from in-memory store.`,
    );
    _consumerConnected = false;
    throw err;
  }
};

const disconnectConsumer = async () => {
  if (!_consumerConnected) return;
  try {
    await consumer.disconnect();
    _consumerConnected = false;
  } catch (_) {}
};

module.exports = { connectConsumer, disconnectConsumer };
