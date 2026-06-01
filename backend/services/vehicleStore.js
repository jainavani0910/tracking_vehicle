/**
 * In-memory vehicle store.
 * Acts as the primary real-time cache — always updated by the simulator.
 * Used as fallback when Redis is unavailable, or as a direct data source
 * when Kafka/Redis infrastructure is not running.
 */

const vehicleMap = new Map();
const historyMap = new Map();
const MAX_HISTORY = 20;

// --- Write Operations ---

const updateVehicle = (vehicle) => {
  vehicleMap.set(vehicle.id, vehicle);
  _appendHistory(vehicle);
};

const updateBatch = (vehicles) => {
  vehicles.forEach((v) => {
    vehicleMap.set(v.id, v);
    _appendHistory(v);
  });
};

const _appendHistory = (vehicle) => {
  if (!historyMap.has(vehicle.id)) {
    historyMap.set(vehicle.id, []);
  }
  const history = historyMap.get(vehicle.id);
  history.unshift({
    latitude: vehicle.latitude,
    longitude: vehicle.longitude,
    speed: vehicle.speed,
    heading: vehicle.heading,
    timestamp: vehicle.timestamp || new Date().toISOString(),
  });
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY;
  }
};

// --- Read Operations ---

const getVehiclesInBounds = (swLat, swLng, neLat, neLng) => {
  const result = [];
  for (const vehicle of vehicleMap.values()) {
    if (
      vehicle.longitude >= swLng &&
      vehicle.longitude <= neLng &&
      vehicle.latitude >= swLat &&
      vehicle.latitude <= neLat
    ) {
      result.push(vehicle);
    }
  }
  return result;
};

const getAllVehicles = () => Array.from(vehicleMap.values());

const getVehicle = (vehicleId) => vehicleMap.get(vehicleId) || null;

const getVehicleHistory = (vehicleId) => historyMap.get(vehicleId) || [];

const getStats = () => ({
  totalVehicles: vehicleMap.size,
  activeVehicles: Array.from(vehicleMap.values()).filter((v) => v.status === 'active').length,
  idleVehicles: Array.from(vehicleMap.values()).filter((v) => v.status === 'idle').length,
  stoppedVehicles: Array.from(vehicleMap.values()).filter((v) => v.status === 'stopped').length,
});

module.exports = {
  updateVehicle,
  updateBatch,
  getVehiclesInBounds,
  getAllVehicles,
  getVehicle,
  getVehicleHistory,
  getStats,
};
