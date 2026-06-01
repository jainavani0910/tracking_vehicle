const { Server } = require('socket.io');
const redisClient = require('../redis/redisClient');
const { isRedisAvailable } = require('../redis/redisClient');
const vehicleStore = require('../services/vehicleStore');

let io;
const subscribedSockets = new Map();
const BATCH_INTERVAL = 1000; // ms

const initializeSocketServer = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    socket.on('subscribeToViewport', (data) => {
      try {
        if (!data) return;
        subscribedSockets.set(socket.id, { socket, ...data, lastPing: Date.now() });
      } catch (err) {
        console.error(`[WebSocket] subscribeToViewport error from ${socket.id}:`, err.message);
      }
    });

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

  startBatching();
  return io;
};

// ─── Main dispatch loop ────────────────────────────────────────────────────────

const startBatching = () => {
  setInterval(async () => {
    for (const [socketId, subscription] of subscribedSockets.entries()) {
      const { socket, tiles } = subscription;

      if (!socket || socket.disconnected) {
        subscribedSockets.delete(socketId);
        continue;
      }

      if (!tiles || !Array.isArray(tiles) || tiles.length === 0) continue;

      try {
        if (isRedisAvailable()) {
          await dispatchFromRedis(socket, tiles);
        } else {
          dispatchFromMemory(socket, tiles);
        }
      } catch (err) {
        // If Redis throws mid-flight, fall back to memory for this tick
        try {
          dispatchFromMemory(socket, tiles);
        } catch (memErr) {
          console.error(`[WebSocket] Dispatch failed for ${socketId}:`, memErr.message);
        }
      }
    }
  }, BATCH_INTERVAL);
};

// ─── Redis-backed dispatch ─────────────────────────────────────────────────────

const dispatchFromRedis = async (socket, tiles) => {
  const allVehicles = new Map();

  for (const tileStr of tiles) {
    const [z, x, y] = tileStr.split('/').map(Number);
    if (isNaN(z) || isNaN(x) || isNaN(y)) continue;

    const nLat = tile2lat(y, z);
    const sLat = tile2lat(y + 1, z);
    const wLon = tile2lon(x, z);
    const eLon = tile2lon(x + 1, z);

    const width = haversineDistance(sLat, wLon, sLat, eLon) || 1;
    const height = haversineDistance(sLat, wLon, nLat, wLon) || 1;

    try {
      const vehicleIds = await redisClient.geoSearchWith(
        'vehicles',
        { longitude: (wLon + eLon) / 2, latitude: (sLat + nLat) / 2 },
        { width, height, unit: 'km' },
        ['WITHCOORD']
      );

      if (vehicleIds && vehicleIds.length > 0) {
        const details = await redisClient.hmGet('vehicle_details', vehicleIds.map((v) => v.member));
        details.forEach((detail, i) => {
          if (!detail) return;
          const parsed = JSON.parse(detail);
          const coord = vehicleIds[i].coordinates;
          allVehicles.set(parsed.id, {
            ...parsed,
            longitude: parseFloat(coord.longitude),
            latitude: parseFloat(coord.latitude),
          });
        });
      }
    } catch (err) {
      // Tile-level fallback: merge from memory for this tile
      const memVehicles = vehicleStore.getVehiclesInBounds(sLat, wLon, nLat, eLon);
      memVehicles.forEach((v) => allVehicles.set(v.id, v));
    }
  }

  socket.emit('vehicleUpdates', Array.from(allVehicles.values()));
};

// ─── In-memory dispatch (no Redis) ────────────────────────────────────────────

const dispatchFromMemory = (socket, tiles) => {
  const allVehicles = new Map();

  for (const tileStr of tiles) {
    const [z, x, y] = tileStr.split('/').map(Number);
    if (isNaN(z) || isNaN(x) || isNaN(y)) continue;

    const nLat = tile2lat(y, z);
    const sLat = tile2lat(y + 1, z);
    const wLon = tile2lon(x, z);
    const eLon = tile2lon(x + 1, z);

    const vehicles = vehicleStore.getVehiclesInBounds(sLat, wLon, nLat, eLon);
    vehicles.forEach((v) => allVehicles.set(v.id, v));
  }

  socket.emit('vehicleUpdates', Array.from(allVehicles.values()));
};

// ─── Geo helpers ───────────────────────────────────────────────────────────────

function tile2lat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function tile2lon(x, z) {
  return (x / Math.pow(2, z)) * 360 - 180;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { initializeSocketServer };
