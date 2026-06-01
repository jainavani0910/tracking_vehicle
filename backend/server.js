const express = require('express');
const http = require('http');
const cors = require('cors');
require('dotenv').config();

const { initializeSocketServer } = require('./sockets/socketServer');
const { connectProducer, disconnectProducer } = require('./kafka/producer');
const { connectConsumer, disconnectConsumer } = require('./kafka/consumer');
const { startSimulation } = require('./simulator/vehicleSimulator');
const redisClient = require('./redis/redisClient');
const { isRedisAvailable } = require('./redis/redisClient');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
const server = http.createServer(app);

// Initialize Socket.IO
initializeSocketServer(server);

const vehicleRoutes = require('./routes/vehicleRoutes');
app.use('/api/vehicles', vehicleRoutes);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

app.get('/', (req, res) => {
  res.send('Real-time Vehicle Tracking Backend — AutoTrack AI');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    redis: isRedisAvailable() ? 'connected' : 'unavailable (in-memory fallback)',
    timestamp: new Date().toISOString(),
  });
});

const startServer = () => {
  // ① Start simulation immediately — in-memory store always works
  startSimulation();

  // ② Listen on port immediately — no waiting for Kafka/Redis
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Server] Port ${PORT} already in use. Run: lsof -ti:${PORT} | xargs kill -9`);
    } else {
      console.error('[Server] Server error:', err.message);
    }
    process.exit(1);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] ✅ Running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] 📡 Accessible at http://${HOST}:${PORT}`);
    console.log(`[Server] Mode: ${isRedisAvailable() ? 'Redis + Kafka' : 'In-memory fallback (Kafka/Redis optional)'}`);
  });

  // ③ Attempt Kafka connections in background (non-blocking)
  connectProducer().catch(() => {
    console.warn('[Server] ⚠️  Kafka producer unavailable — using in-memory data path.');
  });
  connectConsumer().catch(() => {
    console.warn('[Server] ⚠️  Kafka consumer unavailable — Redis will not be populated.');
  });
};

startServer();

const gracefulShutdown = async () => {
  console.log('[Server] Shutting down gracefully...');

  server.close(async () => {
    try { await disconnectProducer(); } catch (_) {}
    try { await disconnectConsumer(); } catch (_) {}

    // Only quit Redis if it's actually connected
    if (isRedisAvailable()) {
      try { await redisClient.quit(); } catch (_) {}
    }

    console.log('[Server] Shutdown complete.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);