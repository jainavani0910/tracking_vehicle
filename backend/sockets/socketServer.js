const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const redisClient = require("../redis/redisClient");
const vehicleStore = require("../services/vehicleStore");

let io;
const subscribedSockets = new Map();
const pendingUpdates = new Map();
const SOCKET_BATCH_INTERVAL = 100;

// Helper to query Redis for vehicles in a bounding box
const getVehiclesInBoundsFromRedis = async (bounds) => {
  const { south, west, north, east } = bounds;
  const centerLat = (south + north) / 2;
  
  // Handle longitude wrap-around for center
  let centerLng = (west + east) / 2;
  if (west > east) {
    centerLng = (west + east + 360) / 2;
    if (centerLng > 180) centerLng -= 360;
  }

  const width = haversineDistance(south, west, south, east) || 1;
  const height = haversineDistance(south, west, north, west) || 1;

  // Search in Redis using GEOSEARCH
  const vehicleIds = await redisClient.geoSearch(
    "vehicles",
    { longitude: centerLng, latitude: centerLat },
    { width, height, unit: "km" }
  );

  if (!vehicleIds || vehicleIds.length === 0) {
    return [];
  }

  // Get details from Redis hash "vehicle_details"
  const details = await redisClient.hmGet("vehicle_details", vehicleIds);
  const result = [];
  details.forEach((detail) => {
    if (detail) {
      try {
        result.push(JSON.parse(detail));
      } catch (_) {}
    }
  });

  return result;
};

const initializeSocketServer = (server) => {
  io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingInterval: 10000,
    pingTimeout: 5000,
    // Raise the per-message limit so the initial snapshot of 10k vehicles fits
    maxHttpBufferSize: 50 * 1024 * 1024, // 50 MB
  });

  // Attach Redis adapter for horizontal scaling if Redis is connected
  const setupRedisAdapter = async () => {
    try {
      const pubClient = redisClient;
      const subClient = redisClient.duplicate();
      await subClient.connect();
      io.adapter(createAdapter(pubClient, subClient));
      console.log("[Socket.IO] ✅ Redis adapter successfully integrated for horizontal scaling.");
    } catch (err) {
      console.warn("[Socket.IO] ⚠️ Failed to initialize Redis adapter, falling back to in-memory adapter:", err.message);
    }
  };

  if (redisClient.isReady) {
    setupRedisAdapter();
  } else {
    redisClient.on("ready", () => {
      setupRedisAdapter();
    });
  }

  io.on("connection", (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    console.log(
      `[WebSocket] Waiting for viewport subscription from ${socket.id}`,
    );
    // Register for tracking connected sockets
    subscribedSockets.set(socket.id, { socket });

    socket.on("subscribeToViewport", async (bounds) => {
      try {
        console.log(`[Viewport] Request from ${socket.id}`);
        let vehicles = [];

        if (redisClient.isOpen && redisClient.isReady) {
          try {
            vehicles = await getVehiclesInBoundsFromRedis(bounds);
            console.log(`[Viewport] Sending ${vehicles.length} vehicles from Redis`);
          } catch (err) {
            console.warn("[Viewport] Redis query failed, falling back to memory:", err.message);
            vehicles = vehicleStore.getVehiclesInBounds(
              bounds.south,
              bounds.west,
              bounds.north,
              bounds.east,
            );
          }
        } else {
          vehicles = vehicleStore.getVehiclesInBounds(
            bounds.south,
            bounds.west,
            bounds.north,
            bounds.east,
          );
          console.log(`[Viewport] Sending ${vehicles.length} vehicles from memory fallback`);
        }

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
    if (pendingUpdates.size === 0) {
      return;
    }

    const updates = Array.from(pendingUpdates.values());
    pendingUpdates.clear();

    // Broadcast globally to all clients via the Redis adapter
    try {
      io.emit("vehicleUpdates", updates);
    } catch (err) {
      console.error(`[WebSocket] Global broadcast failed:`, err.message);
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
