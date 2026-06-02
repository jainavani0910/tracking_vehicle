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

  startDeltaLoop();
  return io;
};

// ─── Delta broadcast loop ──────────────────────────────────────────────────────
// Every second, broadcast ALL vehicle positions as delta updates.
// The frontend merges these into its existing snapshot — it never replaces the
// whole list, so the total count stays at 10,000 regardless of zoom level.

const startDeltaLoop = () => {
  setInterval(() => {
    if (subscribedSockets.size === 0) return;

    const allVehicles = vehicleStore.getAllVehicles();

    for (const [socketId, { socket }] of subscribedSockets.entries()) {
      if (!socket || socket.disconnected) {
        subscribedSockets.delete(socketId);
        continue;
      }
      try {
        // Emit as 'vehicleUpdates' — frontend merges by id, keeping total at 10k
        socket.emit('vehicleUpdates', allVehicles);
      } catch (err) {
        console.error(`[WebSocket] Delta dispatch failed for ${socketId}:`, err.message);
      }
    }
  }, DELTA_INTERVAL);
};

module.exports = { initializeSocketServer };
