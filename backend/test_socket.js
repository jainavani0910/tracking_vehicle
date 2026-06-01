const io = require('socket.io-client');
const socket = io('http://localhost:3000', {
  transports: ['websocket'],
});
socket.on('connect', () => {
  console.log('Connected');
  socket.emit('subscribeToViewport', {
    sw: [77.0, 28.0],
    ne: [77.5, 29.0]
  });
});
socket.on('vehicleUpdates', (vehicles) => {
  console.log(`Received ${vehicles.length} vehicles`);
  if(vehicles.length > 0) process.exit(0);
});
setTimeout(() => {
  console.log("Timeout");
  process.exit(1);
}, 3000);
