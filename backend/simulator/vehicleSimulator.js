const { sendVehicleBatch } = require('../kafka/producer');
const vehicleStore = require('../services/vehicleStore');

const vehicles = new Map();
const NUM_VEHICLES = 10000;
const UPDATE_INTERVAL = 1000; // ms

// World bounds — Redis GEOADD requires lat in [-85.05, 85.05]
const WORLD = {
  latMin: -85.0,
  latMax: 85.0,
  lonMin: -180.0,
  lonMax: 180.0,
};

const DRIVERS = [
  'James Carter', 'Maria Gonzalez', 'Michael Johnson', 'Emily Davis', 'Robert Wilson',
  'Lucas Müller', 'Sophie Dubois', 'Marco Rossi', 'Anna Kowalski', 'Carlos García',
  'Rajesh Kumar', 'Yuki Tanaka', 'Wei Zhang', 'Priya Singh', 'Ji-ho Kim',
  'João Silva', 'Isabella Fernández', 'Mateus Oliveira', 'Valentina López', 'Diego Ramírez',
  'Amara Diallo', 'Chidi Okonkwo', 'Fatima Benali', 'Kwame Asante', 'Zanele Dlamini',
  'Omar Al-Rashid', 'Layla Hassan', 'Khalid Al-Farsi', 'Nour Ibrahim', 'Tariq Mansoor',
  'Liam Murphy', 'Olivia Thompson', 'Noah Williams', 'Ava Robinson', 'Ethan Clarke',
  'Siti Rahayu', 'Arjun Mehta', 'Thuy Nguyen', 'Budi Santoso', 'Aiko Yamamoto',
];

const VEHICLE_TYPES = [
  'Express Delivery', 'Logistics Hauler', 'Cargo Van', 'Eco-Courier', 'Urban Transit',
  'Refrigerated Truck', 'Tanker', 'Flatbed', 'Mini Van', 'Bike Courier',
];

const rnd = (min, max) => Math.random() * (max - min) + min;

// Clamp a value between min and max
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

// Wrap longitude to stay within [-180, 180]
const wrapLon = (lon) => {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
};

// ─── Initialization ───────────────────────────────────────────────────────────

const initializeVehicles = () => {
  for (let idx = 0; idx < NUM_VEHICLES; idx++) {
    const vehicleId = `vehicle-${String(idx).padStart(5, '0')}`;
    const type = VEHICLE_TYPES[idx % VEHICLE_TYPES.length];

    const statusRoll = Math.random();
    const initialStatus = statusRoll > 0.85 ? (Math.random() > 0.5 ? 'idle' : 'stopped') : 'active';
    const initialSpeed = initialStatus === 'active' ? rnd(15, 80) : 0;

    vehicles.set(vehicleId, {
      id: vehicleId,
      name: `${type} #${String(idx + 1).padStart(5, '0')}`,
      latitude: rnd(WORLD.latMin, WORLD.latMax),
      longitude: rnd(WORLD.lonMin, WORLD.lonMax),
      speed: initialSpeed,
      heading: rnd(0, 360),
      status: initialStatus,
      battery: Math.floor(rnd(50, 100)),
      fuel: Math.floor(rnd(40, 100)),
      driver: DRIVERS[idx % DRIVERS.length],
      timestamp: new Date().toISOString(),
    });
  }

  console.log(`[Simulator] ✅ Initialized ${vehicles.size} vehicles randomly distributed across the world.`);
};

// ─── Per-tick Update ──────────────────────────────────────────────────────────

const updateVehiclePosition = (vehicle) => {
  let changed = false;

  // Occasional status change (2% chance per tick)
  if (Math.random() > 0.98) {
    const r = Math.random();
    const oldStatus = vehicle.status;
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
    if (oldStatus !== vehicle.status) changed = true;
  }

  if (vehicle.status === 'active') {
    changed = true;
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

    // Clamp latitude to Redis-safe bounds (bounce off poles)
    if (vehicle.latitude > WORLD.latMax || vehicle.latitude < WORLD.latMin) {
      vehicle.heading = 180 - vehicle.heading;
      vehicle.latitude = clamp(vehicle.latitude, WORLD.latMin + 0.01, WORLD.latMax - 0.01);
    }

    // Wrap longitude around the date-line instead of bouncing
    vehicle.longitude = wrapLon(vehicle.longitude);

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
    changed = true;
  }

  if (changed) {
    vehicle.timestamp = new Date().toISOString();
  }

  return changed;
};

// ─── Main Loop ────────────────────────────────────────────────────────────────

const startSimulation = () => {
  initializeVehicles();

  setInterval(() => {
    const batch = [];

    vehicles.forEach((vehicle) => {
      if (updateVehiclePosition(vehicle)) {
        batch.push({ ...vehicle });
      }
    });

    // ① Always update in-memory store — works with or without Kafka/Redis
    vehicleStore.updateBatch(batch);

    // ② Fire-and-forget to Kafka (silently ignored if broker unavailable)
    sendVehicleBatch(batch);

  }, UPDATE_INTERVAL);

  console.log(`[Simulator] 🚀 Simulation running — ${NUM_VEHICLES} vehicles across the world updating every ${UPDATE_INTERVAL}ms`);
};

module.exports = { startSimulation };
