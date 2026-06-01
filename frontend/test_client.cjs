const io = require('socket.io-client');
const socket = io('http://127.0.0.1:3000', { transports: ['websocket'] });
socket.on('connect', () => { console.log('Connected:', socket.id); socket.emit('subscribeToViewport', { sw: [77.1, 28.5], ne: [77.3, 28.7] }); });
socket.on('vehicleUpdates', (data) => console.log('Received updates:', data.length));
socket.on('disconnect', (reason) => console.log('Disconnected:', reason));
socket.on('connect_error', (err) => console.log('Error:', err.message));
