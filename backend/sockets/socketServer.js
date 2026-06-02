const { Server } = require('socket.io');
const vehicleStore = require('../services/vehicleStore');

let io;
const subscribedSockets = new Map();

// How often to push delta updates (ms)
const DELTA_INTERVAL = 1000;

const initializeSocketServer = (server) => {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingInterval: 10000,
    pingTimeout: 5000,
    // Raise the per-message limit so the initial snapshot of 10k vehicles fits
    maxHttpBufferSize: 50 * 1024 * 1024, // 50 MB
  });

  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // ── Send full snapshot immediately so the map loads all vehicles at once ──
    const snapshot = vehicleStore.getAllVehicles();
    socket.emit('vehicleSnapshot', snapshot);
    console.log(`[WebSocket] Sent snapshot of ${snapshot.length} vehicles to ${socket.id}`);

    // Register for recurring delta updates
    subscribedSockets.set(socket.id, { socket });

    socket.on('ping', (cb) => {
      if (typeof cb === 'function') cb({ timestamp: Date.now() });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[WebSocket] Client disconnected: ${socket.id} (${reason})`);
      subscribedSockets.delete(socket.id);
    });

    socket.on('error', (err) => {
      console.error(`[WebSocket] Socket ${socket.id} error:`, err.message);
    });
  });

  vehicleStore.vehicleEvents.on('batch_updated', (delta) => {
    if (subscribedSockets.size === 0 || delta.length === 0) return;

    for (const [socketId, { socket }] of subscribedSockets.entries()) {
      if (!socket || socket.disconnected) {
        subscribedSockets.delete(socketId);
        continue;
      }
      try {
        socket.emit('vehicleUpdates', delta);
      } catch (err) {
        console.error(`[WebSocket] Delta dispatch failed for ${socketId}:`, err.message);
      }
    }
  });

  return io;
};

module.exports = { initializeSocketServer };
