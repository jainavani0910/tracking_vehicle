const express = require('express');
const vehicleStore = require('../services/vehicleStore');
const { getVehicleHistory: getTimescaleHistory } = require('../db/timescaleClient');

const router = express.Router();

// ─── GET /api/vehicles (get all vehicles) ──────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const allVehicles = vehicleStore.getAllVehicles();
    return res.json(allVehicles);
  } catch (error) {
    console.error('[API] Failed to fetch all vehicles:', error);
    return res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// ─── GET /api/vehicles/within?sw_lat=&sw_lng=&ne_lat=&ne_lng= ─────────────────
router.get('/within', (req, res) => {
  const { sw_lng, sw_lat, ne_lng, ne_lat } = req.query;

  if (!sw_lng || !sw_lat || !ne_lng || !ne_lat) {
    return res.status(400).json({ error: 'Missing bounding box parameters' });
  }

  const swLng = parseFloat(sw_lng);
  const swLat = parseFloat(sw_lat);
  const neLng = parseFloat(ne_lng);
  const neLat = parseFloat(ne_lat);

  try {
    const vehicles = vehicleStore.getVehiclesInBounds(swLat, swLng, neLat, neLng);
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
router.get('/:id/history', (req, res) => {
  try {
    return res.json(vehicleStore.getVehicleHistory(req.params.id));
  } catch (error) {
    console.error(`Failed to fetch history for ${req.params.id}:`, error);
    return res.json([]);
  }
});

// ─── GET /api/vehicles/:id/full_history ────────────────────────────────────────
router.get('/:id/full_history', async (req, res) => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours, 10) : 24 * 7; // Default 7 days
    const history = await getTimescaleHistory(req.params.id, hours);
    return res.json(history);
  } catch (error) {
    console.error(`Failed to fetch full history for ${req.params.id}:`, error);
    return res.json([]);
  }
});

// ─── GET /api/vehicles/:id ────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const memVehicle = vehicleStore.getVehicle(req.params.id);
    if (memVehicle) return res.json(memVehicle);
    return res.status(404).json({ error: 'Vehicle not found' });
  } catch (error) {
    console.error(`Failed to fetch vehicle ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

module.exports = router;
