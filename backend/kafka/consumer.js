const { Kafka } = require('kafkajs');
const redisClient = require('../redis/redisClient');
const { isRedisAvailable } = require('../redis/redisClient');
const vehicleStore = require('../services/vehicleStore');
require('dotenv').config();

const KAFKA_BROKER = process.env.KAFKA_BROKERS || 'localhost:9092';
const TOPIC_NAME = 'vehicle-updates';

const kafka = new Kafka({
  clientId: 'vehicle-tracking-consumer',
  brokers: KAFKA_BROKER.split(','),
  connectionTimeout: 1500,  // Fail within 1.5s
  requestTimeout: 3000,
  retry: {
    initialRetryTime: 100,
    retries: 0,             // No retries — fail fast
  },
  logLevel: 1, // ERROR only
});

const consumer = kafka.consumer({ groupId: 'vehicle-tracking-group' });
let _consumerConnected = false;

const connectConsumer = async () => {
  try {
    console.log(`[Kafka Consumer] Connecting to ${KAFKA_BROKER}...`);
    await consumer.connect();
    _consumerConnected = true;
    console.log('[Kafka Consumer] ✅ Connected.');

    // Clear stale Redis keys
    if (isRedisAvailable()) {
      try {
        await redisClient.del('vehicles');
        await redisClient.del('vehicle_details');
      } catch (_) {}
    }

    await consumer.subscribe({ topic: TOPIC_NAME, fromBeginning: false });
    console.log(`[Kafka Consumer] Subscribed to "${TOPIC_NAME}"`);

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          if (!message.value) return;
          const vehicle = JSON.parse(message.value.toString());

          // Always update in-memory
          vehicleStore.updateVehicle(vehicle);

          // Update Redis if available
          if (isRedisAvailable()) {
            try {
              await redisClient.geoAdd('vehicles', {
                longitude: vehicle.longitude,
                latitude: vehicle.latitude,
                member: vehicle.id,
              });
              await redisClient.hSet('vehicle_details', vehicle.id, JSON.stringify(vehicle));
              const histKey = `vehicle_history:${vehicle.id}`;
              await redisClient.lPush(histKey, JSON.stringify({
                latitude: vehicle.latitude,
                longitude: vehicle.longitude,
                speed: vehicle.speed,
                heading: vehicle.heading,
                timestamp: vehicle.timestamp || new Date().toISOString(),
              }));
              await redisClient.lTrim(histKey, 0, 19);
            } catch (_) {}
          }
        } catch (err) {
          console.error('[Kafka Consumer] Message error:', err.message);
        }
      },
    });
  } catch (err) {
    console.warn(`[Kafka Consumer] ⚠️  Unavailable (${err.message.split('\n')[0]}). Vehicle data served from in-memory store.`);
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
