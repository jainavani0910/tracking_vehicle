const { Pool } = require("pg");
require("dotenv").config();

// Use the local url for dev if not provided
const POSTGRES_URL = process.env.POSTGRES_URL || "postgres://postgres:avani_0909@localhost:5432/vehicle_db";

const pool = new Pool({
  connectionString: POSTGRES_URL,
  max: 20, // max connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err, client) => {
  console.error("[TimescaleDB] Unexpected error on idle client", err);
});

let isConnected = false;

const connectTimescale = async () => {
  try {
    const client = await pool.connect();
    client.release();
    isConnected = true;
    console.log("[TimescaleDB] ✅ Connected.");
  } catch (err) {
    console.error("[TimescaleDB] ⚠️ Connection Error:", err.message);
    isConnected = false;
  }
};

const getPool = () => pool;

const isTimescaleAvailable = () => isConnected;

/**
 * Inserts a batch of vehicle location updates into TimescaleDB
 * @param {Array} vehicles 
 */
const insertVehicleLocationsBatch = async (vehicles) => {
  if (!isTimescaleAvailable() || vehicles.length === 0) return;

  const CHUNK_SIZE = 1000; // max 6000 parameters (well below 65535 limit)
  for (let i = 0; i < vehicles.length; i += CHUNK_SIZE) {
    const chunk = vehicles.slice(i, i + CHUNK_SIZE);

    try {
      const values = [];
      let queryArgs = [];

      let paramIndex = 1;
      chunk.forEach((v) => {
        values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
        const ts = v.timestamp ? new Date(v.timestamp).toISOString() : new Date().toISOString();
        queryArgs.push(ts, v.id, Number(v.latitude), Number(v.longitude), Number(v.speed || 0), Number(v.heading || 0));
      });

      const query = `
        INSERT INTO vehicle_locations (time, vehicle_id, latitude, longitude, speed, heading)
        VALUES ${values.join(", ")}
      `;

      await pool.query(query, queryArgs);
    } catch (err) {
      console.error("[TimescaleDB] Batch insert error:", err.message);
    }
  }
};

/**
 * Get historical locations for a vehicle
 * @param {string} vehicleId 
 * @param {number} hours Limit to past X hours
 */
const getVehicleHistory = async (vehicleId, hours = 24) => {
  if (!isTimescaleAvailable()) return [];

  try {
    const res = await pool.query(
      `SELECT time, latitude, longitude, speed, heading 
       FROM vehicle_locations 
       WHERE vehicle_id = $1 
         AND time >= NOW() - INTERVAL '${hours} hours'
       ORDER BY time ASC`,
      [vehicleId]
    );
    return res.rows;
  } catch (err) {
    console.error("[TimescaleDB] Error fetching history:", err.message);
    return [];
  }
};

module.exports = {
  connectTimescale,
  getPool,
  isTimescaleAvailable,
  insertVehicleLocationsBatch,
  getVehicleHistory
};