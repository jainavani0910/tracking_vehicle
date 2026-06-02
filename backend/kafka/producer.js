const { Kafka } = require('kafkajs');
require('dotenv').config();

const KAFKA_BROKER = process.env.KAFKA_BROKERS || 'localhost:9092';
const TOPIC_NAME = 'vehicle-updates';

const kafka = new Kafka({
  clientId: 'vehicle-tracking-producer',
  brokers: KAFKA_BROKER.split(','),
  connectionTimeout: 1500,  // Fail within 1.5s if broker unreachable
  requestTimeout: 3000,
  retry: {
    initialRetryTime: 100,
    retries: 0,             // No retries — fail fast, in-memory handles it
  },
  logLevel: 1, // ERROR only
});

const producer = kafka.producer();
let _producerConnected = false;

const isProducerConnected = () => _producerConnected;

const connectProducer = async () => {
  try {
    console.log(`[Kafka Producer] Connecting to ${KAFKA_BROKER}...`);
    await producer.connect();
    _producerConnected = true;
    console.log('[Kafka Producer] ✅ Connected.');

    // Create topic if needed
    const admin = kafka.admin();
    try {
      await admin.connect();
      const topics = await admin.listTopics();
      if (!topics.includes(TOPIC_NAME)) {
        await admin.createTopics({
          topics: [{ topic: TOPIC_NAME, numPartitions: 3, replicationFactor: 1 }],
        });
        console.log(`[Kafka Admin] Topic "${TOPIC_NAME}" created.`);
      }
    } catch (_) {
    } finally {
      try { await admin.disconnect(); } catch (_) {}
    }
  } catch (err) {
    console.warn(`[Kafka Producer] ⚠️  Unavailable (${err.message.split('\n')[0]}). In-memory mode active.`);
    _producerConnected = false;
    throw err;
  }
};

const disconnectProducer = async () => {
  if (!_producerConnected) return;
  try {
    await producer.disconnect();
    _producerConnected = false;
  } catch (_) {}
};

const sendVehicleUpdate = async (vehicle) => {
  if (!_producerConnected) return;
  try {
    await producer.send({
      topic: TOPIC_NAME,
      messages: [{ key: String(vehicle.id || 'unknown'), value: JSON.stringify(vehicle) }],
    });
  } catch (_) {}
};

const sendVehicleBatch = async (vehicles) => {
  if (!_producerConnected || !vehicles || vehicles.length === 0) return;
  
  const CHUNK_SIZE = 1000;
  try {
    for (let i = 0; i < vehicles.length; i += CHUNK_SIZE) {
      const chunk = vehicles.slice(i, i + CHUNK_SIZE);
      await producer.send({
        topic: TOPIC_NAME,
        messages: chunk.map((v) => ({
          key: String(v.id || 'unknown'),
          value: JSON.stringify(v),
        })),
      });
    }
  } catch (err) {
    // silently fail or log it
  }
};

module.exports = { connectProducer, disconnectProducer, sendVehicleUpdate, sendVehicleBatch, isProducerConnected };
