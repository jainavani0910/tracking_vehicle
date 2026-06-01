const { sendVehicleBatch } = require('../kafka/producer');
const vehicleStore = require('../services/vehicleStore');

const vehicles = new Map();
const NUM_VEHICLES = 10000;
const UPDATE_INTERVAL = 1000; // ms

const DRIVERS = [
  'Rajesh Kumar', 'Amit Sharma', 'Priya Singh', 'Sanjay Gupta', 'Vikram Rathore',
  'Ananya Iyer', 'Rahul Patel', 'Sneha Reddy', 'Manish Verma', 'Karan Johar',
  'Sunita Rao', 'Arjun Kapoor', 'Pooja Hegde', 'Rohan Mehta', 'Deepa Nair',
  'Suresh Nair', 'Kavita Sharma', 'Arun Mishra', 'Nisha Patel', 'Dinesh Verma',
  'Pradeep Singh', 'Rekha Gupta', 'Manoj Tiwari', 'Geeta Pandey', 'Ravi Shankar',
];

const VEHICLE_TYPES = [
  'Express Delivery', 'Logistics Hauler', 'Cargo Van', 'Eco-Courier', 'Urban Transit',
  'Refrigerated Truck', 'Tanker', 'Flatbed', 'Mini Van', 'Bike Courier',
];

/**
 * 10 major Indian cities with vehicle counts totalling 10,000.
 * Bounds are realistic lat/lon ranges for each metro area.
 */
const INDIA_CITIES = [
  { name: 'Delhi NCR', latMin: 28.40, latMax: 28.90, lonMin: 76.80, lonMax: 77.50, count: 2000 },
  { name: 'Mumbai', latMin: 18.85, latMax: 19.30, lonMin: 72.75, lonMax: 73.10, count: 2000 },
  { name: 'Bangalore', latMin: 12.83, latMax: 13.20, lonMin: 77.45, lonMax: 77.80, count: 1500 },
  { name: 'Hyderabad', latMin: 17.25, latMax: 17.60, lonMin: 78.35, lonMax: 78.70, count: 1000 },
  { name: 'Chennai', latMin: 12.92, latMax: 13.22, lonMin: 80.12, lonMax: 80.42, count: 1000 },
  { name: 'Kolkata', latMin: 22.42, latMax: 22.72, lonMin: 88.25, lonMax: 88.55, count: 1000 },
  { name: 'Pune', latMin: 18.42, latMax: 18.70, lonMin: 73.75, lonMax: 74.05, count: 500 },
  { name: 'Ahmedabad', latMin: 22.95, latMax: 23.20, lonMin: 72.52, lonMax: 72.80, count: 500 },
  { name: 'Jaipur', latMin: 26.82, latMax: 27.10, lonMin: 75.65, lonMax: 75.92, count: 250 },
  { name: 'Lucknow', latMin: 26.73, latMax: 27.00, lonMin: 80.85, lonMax: 81.12, count: 250 },
];
// Sum: 2000+2000+1500+1000+1000+1000+500+500+250+250 = 10,000

const rnd = (min, max) => Math.random() * (max - min) + min;

// ─── Initialization ───────────────────────────────────────────────────────────

// Helper function to shuffle array (Fisher-Yates)
const shuffleArray = (arr) => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const initializeVehicles = () => {
  // Create a pool of cities with proper distribution
  const cityPool = [];
  for (const city of INDIA_CITIES) {
    for (let i = 0; i < city.count; i++) {
      cityPool.push(city);
    }
  }

  // Shuffle the city pool to randomize city assignments
  const shuffledCities = shuffleArray(cityPool);

  // Create vehicles with randomized city assignments
  for (let idx = 0; idx < NUM_VEHICLES; idx++) {
    const vehicleId = `vehicle-${String(idx).padStart(5, '0')}`;
    const type = VEHICLE_TYPES[idx % VEHICLE_TYPES.length];
    const city = shuffledCities[idx];

    const statusRoll = Math.random();
    const initialStatus = statusRoll > 0.85 ? (Math.random() > 0.5 ? 'idle' : 'stopped') : 'active';
    const initialSpeed = initialStatus === 'active' ? rnd(15, 80) : 0;

    vehicles.set(vehicleId, {
      id: vehicleId,
      name: `${type} #${String(idx + 1).padStart(5, '0')}`,
      city: city.name,
      latitude: rnd(city.latMin, city.latMax),
      longitude: rnd(city.lonMin, city.lonMax),
      // Internal bounds for boundary bouncing — stripped before emitting
      _bounds: city,
      speed: initialSpeed,
      heading: rnd(0, 360),
      status: initialStatus,
      battery: Math.floor(rnd(50, 100)),
      fuel: Math.floor(rnd(40, 100)),
      driver: DRIVERS[idx % DRIVERS.length],
      timestamp: new Date().toISOString(),
    });
  }

  console.log(`[Simulator] ✅ Initialized ${vehicles.size} vehicles randomly distributed across ${INDIA_CITIES.length} Indian cities.`);
  const cityStats = {};
  vehicles.forEach((v) => {
    cityStats[v.city] = (cityStats[v.city] || 0) + 1;
  });
  Object.entries(cityStats).forEach(([city, count]) => {
    console.log(`  › ${city}: ${count} vehicles`);
  });
};

// ─── Per-tick Update ──────────────────────────────────────────────────────────

const updateVehiclePosition = (vehicle) => {
  // Occasional status change (2% chance per tick)
  if (Math.random() > 0.98) {
    const r = Math.random();
    if (r > 0.6) {
      vehicle.status = 'active';
      vehicle.speed = rnd(15, 80);
    } else if (r > 0.3) {
      vehicle.status = 'idle';
      vehicle.speed = 0;
    } else {
      vehicle.status = 'stopped';
      vehicle.speed = 0;
    }
  }

  if (vehicle.status === 'active') {
    // Speed fluctuation
    vehicle.speed += rnd(-5, 5);
    vehicle.speed = Math.max(10, Math.min(110, vehicle.speed));

    const speedMps = (vehicle.speed * 1000) / 3600;
    const distanceM = speedMps * (UPDATE_INTERVAL / 1000);
    const angleRad = (vehicle.heading * Math.PI) / 180;

    const deltaLat = (distanceM * Math.cos(angleRad)) / 111111;
    const deltaLon =
      (distanceM * Math.sin(angleRad)) /
      (111111 * Math.cos(vehicle.latitude * (Math.PI / 180)));

    vehicle.latitude += deltaLat;
    vehicle.longitude += deltaLon;

    // Bounce within city bounds
    const b = vehicle._bounds;
    if (vehicle.latitude > b.latMax || vehicle.latitude < b.latMin) {
      vehicle.heading = 180 - vehicle.heading;
      vehicle.latitude = Math.max(b.latMin + 0.001, Math.min(b.latMax - 0.001, vehicle.latitude));
    }
    if (vehicle.longitude > b.lonMax || vehicle.longitude < b.lonMin) {
      vehicle.heading = 360 - vehicle.heading;
      vehicle.longitude = Math.max(b.lonMin + 0.001, Math.min(b.lonMax - 0.001, vehicle.longitude));
    }

    // Minor heading drift
    if (Math.random() > 0.9) {
      vehicle.heading += rnd(-15, 15);
      vehicle.heading = ((vehicle.heading % 360) + 360) % 360;
    }
  }

  // Battery & fuel depletion (low probability to keep values sane)
  if (vehicle.status !== 'stopped' && Math.random() > 0.97) {
    vehicle.fuel = Math.max(0, vehicle.fuel - 1);
    vehicle.battery = Math.max(0, vehicle.battery - 1);
    // Auto-refuel mock
    if (vehicle.fuel <= 5) vehicle.fuel = 100;
    if (vehicle.battery <= 5) vehicle.battery = 100;
  }

  vehicle.timestamp = new Date().toISOString();
};

// ─── Main Loop ────────────────────────────────────────────────────────────────

const startSimulation = () => {
  initializeVehicles();

  setInterval(() => {
    const batch = [];

    vehicles.forEach((vehicle) => {
      updateVehiclePosition(vehicle);
      // Strip internal _bounds before publishing
      const { _bounds, ...vehicleData } = vehicle;
      batch.push(vehicleData);
    });

    // ① Always update in-memory store — works with or without Kafka/Redis
    vehicleStore.updateBatch(batch);

    // ② Fire-and-forget to Kafka (silently ignored if broker unavailable)
    sendVehicleBatch(batch);

  }, UPDATE_INTERVAL);

  console.log(`[Simulator] 🚀 Simulation running — ${NUM_VEHICLES} vehicles across India updating every ${UPDATE_INTERVAL}ms`);
};

module.exports = { startSimulation };
