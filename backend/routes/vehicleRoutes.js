const express = require('express');
const redisClient = require('../redis/redisClient.js');
const { isRedisAvailable } = require('../redis/redisClient.js');
const { isProducerConnected } = require('../kafka/producer');
const vehicleStore = require('../services/vehicleStore');

const router = express.Router();

// ─── GET /api/vehicles (get all vehicles) ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    if (isRedisAvailable()) {
      const vehicles =
        await redisClient.hGetAll('vehicle_details');

      const result = Object.values(vehicles).map((v) =>
        JSON.parse(v)
      );

      console.log(
        `[API] Returning ${result.length} vehicles from Redis`
      );

      return res.json(result);
    }

    const allVehicles = vehicleStore.getAllVehicles();

    console.log(
      `[API] Returning ${allVehicles.length} vehicles from Memory`
    );

    return res.json(allVehicles);
  } catch (error) {
    console.error(
      '[API] Failed to fetch all vehicles:',
      error
    );

    return res.status(500).json({
      error: 'Failed to fetch vehicles',
    });
  }
});

// ─── GET /api/vehicles/within?sw_lat=&sw_lng=&ne_lat=&ne_lng= ─────────────────
router.get('/within', async (req, res) => {
  const { sw_lng, sw_lat, ne_lng, ne_lat } = req.query;

  if (!sw_lng || !sw_lat || !ne_lng || !ne_lat) {
    return res.status(400).json({ error: 'Missing bounding box parameters' });
  }

  const swLng = parseFloat(sw_lng);
  const swLat = parseFloat(sw_lat);
  const neLng = parseFloat(ne_lng);
  const neLat = parseFloat(ne_lat);

  console.log(`[API] Fetching vehicles within bounds: sw(${swLat},${swLng}), ne(${neLat},${neLng})`);

  try {
    // Always use in-memory store as primary source
    const vehicles = vehicleStore.getVehiclesInBounds(swLat, swLng, neLat, neLng);
    console.log(`[API] Found ${vehicles.length} vehicles in bounds`);
    return res.json(vehicles);
  } catch (error) {
    console.error('Failed to fetch vehicles within bounding box:', error);
    return res.json([]);
  }
});

// ─── GET /api/vehicles/stats ───────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  res.json(vehicleStore.getStats());
});

// ─── GET /api/vehicles/:id/history ────────────────────────────────────────────
router.get('/:id/history', async (req, res) => {
  try {
    if (isRedisAvailable() && isProducerConnected()) {
      const history = await redisClient.lRange(`vehicle_history:${req.params.id}`, 0, -1);
      return res.json(history.map((item) => JSON.parse(item)));
    }
    return res.json(vehicleStore.getVehicleHistory(req.params.id));
  } catch (error) {
    console.error(`Failed to fetch history for ${req.params.id}:`, error);
    return res.json(vehicleStore.getVehicleHistory(req.params.id));
  }
});

router.get("/redis-test", async (req, res) => {
  try {
    const all = await redisClient.hGetAll("vehicle_details");

    res.json({
      count: Object.keys(all).length,
      sampleKeys: Object.keys(all).slice(0, 5),
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// ─── GET /api/vehicles/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    if (isRedisAvailable() && isProducerConnected()) {
      const vehicle = await redisClient.hGet('vehicle_details', req.params.id);
      if (vehicle) return res.json(JSON.parse(vehicle));
    }
    const memVehicle = vehicleStore.getVehicle(req.params.id);
    if (memVehicle) return res.json(memVehicle);
    return res.status(404).json({ error: 'Vehicle not found' });
  } catch (error) {
    console.error(`Failed to fetch vehicle ${req.params.id}:`, error);
    const memVehicle = vehicleStore.getVehicle(req.params.id);
    if (memVehicle) return res.json(memVehicle);
    return res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});




module.exports = router;
