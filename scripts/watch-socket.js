const io = require('socket.io-client');
const backend = 'http://localhost:5050';
const compId = 169;
const socket = io(backend, { transports: ['websocket', 'polling'] });

socket.on('connect', () => {
  console.log('socket connected', socket.id);
  socket.emit('join', { competitionId: compId });
});

socket.on('medal-player-updated', (msg) => {
  console.log('medal-player-updated event received:');
  console.log(JSON.stringify(msg, null, 2));
});

socket.on('scores-updated', (msg) => {
  console.log('scores-updated event received:');
  console.log(JSON.stringify(msg, null, 2));
});

socket.on('team-user-updated', (msg) => {
  console.log('team-user-updated event received:');
  console.log(JSON.stringify(msg, null, 2));
});

socket.on('fines-updated', (msg) => {
  console.log('fines-updated event received:');
  console.log(JSON.stringify(msg, null, 2));
});

socket.on('disconnect', () => console.log('socket disconnected'));

socket.on('connect_error', (err) => console.error('connect_error', err && err.message));
