const io = require('socket.io-client');

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('✅ Connected to Socket.IO server');

  socket.emit('subscribeToViewport', {
    tiles: [
      '6/44/26',
      '6/45/26',
      '6/44/27',
      '6/45/27',
    ],
  });

  console.log('📡 Viewport subscription sent');
});

socket.on('vehicleUpdates', (vehicles) => {
  console.log(`🚗 Received ${vehicles.length} vehicles`);

  if (vehicles.length > 0) {
    console.log('✅ Socket pipeline working!');
    process.exit(0);
  }
});

socket.on('connect_error', (err) => {
  console.error('❌ Connection Error:', err.message);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
});

setTimeout(() => {
  console.log('⏰ Timeout: No vehicle updates received');
  process.exit(1);
}, 5000);