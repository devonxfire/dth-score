const io = require('socket.io-client');
const fetch = global.fetch || require('node-fetch');

(async function(){
  const backend = process.env.BACKEND || 'http://localhost:5050';
  const compId = process.env.COMP_ID || 169;
  const playerName = process.env.PLAYER_NAME || "Dev 'Tugger' Martindale";
  const socket = io(backend, { transports: ['websocket', 'polling'], reconnectionAttempts: 3, timeout: 5000 });

  let done = false;
  const timer = setTimeout(() => {
    if (!done) {
      console.error('Timeout waiting for socket event');
      process.exit(2);
    }
  }, 8000);

  socket.on('connect', async () => {
    console.log('socket connected', socket.id);
    socket.emit('join', { competitionId: Number(compId) });

    // Listen for both medal-player-updated and scores-updated
    const onEvent = (evtName) => (msg) => {
      if (msg && Number(msg.competitionId) === Number(compId)) {
        console.log(`EVENT ${evtName} received:`);
        console.log(JSON.stringify(msg, null, 2));
        done = true;
        clearTimeout(timer);
        socket.disconnect();
        process.exit(0);
      }
    };

    socket.on('medal-player-updated', onEvent('medal-player-updated'));
    socket.on('scores-updated', onEvent('scores-updated'));

    // Issue PATCH to update a score for the player; this should trigger server emit
    try {
      const url = `${backend}/api/competitions/${compId}/groups/0/player/${encodeURIComponent(playerName)}`;
      const body = { scores: ["4","3","2","5","","","","","","","","","","","","","",""] };
      console.log('PATCHing', url, 'body', body);
      const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const txt = await res.text();
      console.log('PATCH response status', res.status, 'body', txt);
    } catch (err) {
      console.error('PATCH failed', err);
      process.exit(3);
    }
  });

  socket.on('connect_error', (err) => {
    console.error('connect_error', err && err.message);
  });

  socket.on('disconnect', () => {
    if (!done) {
      console.log('socket disconnected');
      process.exit(1);
    }
  });
})();
