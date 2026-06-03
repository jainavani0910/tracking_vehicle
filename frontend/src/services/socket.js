import io from 'socket.io-client';
import { useVehicleStore } from '../store/useVehicleStore';
import { logger } from '../utils/logger';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export let socket = null;
let pingIntervalId = null;
let throughputIntervalId = null;

export const initializeSocket = () => {
  if (socket) return socket;

  logger.info(`Initializing Socket.IO connection to ${SOCKET_URL}...`);

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 20, // Keep trying!
    timeout: 10000,
  });

  const store = useVehicleStore.getState();

  socket.on('connect', () => {
    console.log('CONNECTED TO SOCKET SERVER');
    logger.info(`Socket connected successfully (ID: ${socket.id})`);
    store.setIsConnected(true);

    // Measure latency periodically
    if (pingIntervalId) clearInterval(pingIntervalId);
    pingIntervalId = setInterval(() => {
      const start = Date.now();
      socket.emit('ping', () => {
        const latency = Date.now() - start;
        useVehicleStore.getState().setLatency(latency);
      });
    }, 4000);

    // Track/Report updates throughput
    if (throughputIntervalId) clearInterval(throughputIntervalId);
    throughputIntervalId = setInterval(() => {
      const count = useVehicleStore.getState().updatesCount;
      if (count > 0) {
        logger.info(`Real-time performance: Processed ${count} updates/sec`);
      }
      useVehicleStore.getState().resetUpdatesCount();
    }, 1000);
  });

  // Full snapshot on connect — replace entire vehicle list with all 10k vehicles
  socket.on('vehicleSnapshot', (vehicles) => {
    logger.info(`Received full snapshot: ${vehicles.length} vehicles`);
    store.replaceVehicles(vehicles);
  });

  // Delta updates every second — merge updated positions into existing list
  socket.on('vehicleUpdates', (vehicles) => {
    store.setVehicles(vehicles);
  });

  socket.on('disconnect', (reason) => {
    logger.warn(`Socket disconnected. Reason: ${reason}`);
    store.setIsConnected(false);
    store.setLatency(0);
    if (pingIntervalId) clearInterval(pingIntervalId);
    if (throughputIntervalId) clearInterval(throughputIntervalId);
  });

  socket.on('connect_error', (error) => {
    logger.error('Socket connection error:', error.message);
    store.setIsConnected(false);
    store.setLatency(0);
  });

  socket.on('reconnect_attempt', (attempt) => {
    logger.info(`Attempting socket reconnection (attempt #${attempt})...`);
  });

  socket.on('reconnect_failed', () => {
    logger.error('Socket reconnection failed permanently after max attempts.');
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    logger.info('Disconnecting Socket.IO client manually...');
    if (pingIntervalId) clearInterval(pingIntervalId);
    if (throughputIntervalId) clearInterval(throughputIntervalId);
    socket.disconnect();
    socket = null;
  }
};

export const subscribeToViewport = (bounds) => {
  if (socket && socket.connected) {
    socket.emit('subscribeToViewport', bounds);
  }
};
