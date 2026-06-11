const { Server } = require("socket.io");
const vehicleStore = require("../services/vehicleStore");

let io;
const subscribedSockets = new Map();



const pendingUpdates = new Map();
const SOCKET_BATCH_INTERVAL = 100;

const initializeSocketServer = (server) => {
  io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingInterval: 10000,
    pingTimeout: 5000,
    // Raise the per-message limit so the initial snapshot of 10k vehicles fits
    maxHttpBufferSize: 50 * 1024 * 1024, // 50 MB
  });

  io.on("connection", (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // ── Send full snapshot immediately so the map loads all vehicles at once ──
    console.log(
      `[WebSocket] Waiting for viewport subscription from ${socket.id}`,
    );
    // Register for recurring delta updates
    subscribedSockets.set(socket.id, { socket });

    socket.on("subscribeToViewport", (bounds) => {
      try {
        console.log(`[Viewport] Request from ${socket.id}`);

        const vehicles = vehicleStore.getVehiclesInBounds(
          bounds.south,
          bounds.west,
          bounds.north,
          bounds.east,
        );

        console.log(`[Viewport] Sending ${vehicles.length} vehicles`);

        socket.emit("vehicleSnapshot", vehicles);
      } catch (err) {
        console.error("[Viewport Error]", err.message);
      }
    });

    socket.on("ping", (cb) => {
      if (typeof cb === "function") cb({ timestamp: Date.now() });
    });

    socket.on("disconnect", (reason) => {
      console.log(`[WebSocket] Client disconnected: ${socket.id} (${reason})`);
      subscribedSockets.delete(socket.id);
    });

    socket.on("error", (err) => {
      console.error(`[WebSocket] Socket ${socket.id} error:`, err.message);
    });
  });

  vehicleStore.vehicleEvents.on("batch_updated", (delta) => {
    if (!delta || delta.length === 0) return;

    delta.forEach((vehicle) => {
      pendingUpdates.set(vehicle.id, vehicle);
    });
  });

  setInterval(() => {
  if (
    subscribedSockets.size === 0 ||
    pendingUpdates.size === 0
  ) {
    return;
  }

  const updates = Array.from(
    pendingUpdates.values()
  );

  pendingUpdates.clear();

  for (const [socketId, { socket }] of subscribedSockets.entries()) {
    if (!socket || socket.disconnected) {
      subscribedSockets.delete(socketId);
      continue;
    }

    try {
      socket.emit(
        "vehicleUpdates",
        updates
      );
    } catch (err) {
      console.error(
        `[WebSocket] Batch dispatch failed for ${socketId}:`,
        err.message
      );
    }
  }
}, SOCKET_BATCH_INTERVAL);

  return io;
};

// ─── Redis-backed dispatch ─────────────────────────────────────────────────────

const dispatchFromRedis = async (socket, tiles) => {
  const allVehicles = new Map();

  for (const tileStr of tiles) {
    const [z, x, y] = tileStr.split("/").map(Number);
    if (isNaN(z) || isNaN(x) || isNaN(y)) continue;

    const nLat = tile2lat(y, z);
    const sLat = tile2lat(y + 1, z);
    const wLon = tile2lon(x, z);
    const eLon = tile2lon(x + 1, z);

    const width = haversineDistance(sLat, wLon, sLat, eLon) || 1;
    const height = haversineDistance(sLat, wLon, nLat, wLon) || 1;

    try {
      const vehicleIds = await redisClient.geoSearchWith(
        "vehicles",
        { longitude: (wLon + eLon) / 2, latitude: (sLat + nLat) / 2 },
        { width, height, unit: "km" },
        ["WITHCOORD"],
      );

      if (vehicleIds && vehicleIds.length > 0) {
        const details = await redisClient.hmGet(
          "vehicle_details",
          vehicleIds.map((v) => v.member),
        );
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
      const memVehicles = vehicleStore.getVehiclesInBounds(
        sLat,
        wLon,
        nLat,
        eLon,
      );
      memVehicles.forEach((v) => allVehicles.set(v.id, v));
    }
  }

  socket.emit("vehicleUpdates", Array.from(allVehicles.values()));
};

// ─── In-memory dispatch (no Redis) ────────────────────────────────────────────

const dispatchFromMemory = (socket, tiles) => {
  const allVehicles = new Map();

  for (const tileStr of tiles) {
    const [z, x, y] = tileStr.split("/").map(Number);
    if (isNaN(z) || isNaN(x) || isNaN(y)) continue;

    const nLat = tile2lat(y, z);
    const sLat = tile2lat(y + 1, z);
    const wLon = tile2lon(x, z);
    const eLon = tile2lon(x + 1, z);

    const vehicles = vehicleStore.getVehiclesInBounds(sLat, wLon, nLat, eLon);
    vehicles.forEach((v) => allVehicles.set(v.id, v));
  }

  socket.emit("vehicleUpdates", Array.from(allVehicles.values()));
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
