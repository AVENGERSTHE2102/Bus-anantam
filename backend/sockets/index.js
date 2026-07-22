const jwt = require('jsonwebtoken');
const { parseCookies } = require('../utils/cookies');
const { recordLocation } = require('../services/liveTracking');

function initSockets(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || parseCookies(socket.handshake.headers.cookie).token;
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    let lastLocationAt = 0;
    console.log(`[socket] connected user=${socket.user.id} role=${socket.user.role} id=${socket.id}`);
    socket.on('disconnect', (reason) => console.log(`[socket] disconnected id=${socket.id} reason=${reason}`));
    socket.on('subscribe:route', (routeId) => socket.join(`route:${routeId}`));
    socket.on('subscribe:admin', () => {
      if (socket.user.role === 'admin') socket.join('admin');
    });
    socket.on('driver:location', (position) => {
      const now = Date.now();
      if (now - lastLocationAt < 750) {
        console.log(`[gps] dropped throttled socket ping trip=${position?.tripId || '-'}`);
        return;
      }
      lastLocationAt = now;
      recordLocation(io, { ...position, user: socket.user, capturedAt: position.capturedAt })
        .then((trip) => console.log(`[gps] socket ${trip ? 'accepted' : 'rejected'} trip=${position?.tripId || '-'}`))
        .catch((err) => console.error('Socket location update failed:', err));
    });
  });
}

module.exports = initSockets;
