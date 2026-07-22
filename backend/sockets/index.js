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
    socket.on('subscribe:route', (routeId) => socket.join(`route:${routeId}`));
    socket.on('subscribe:admin', () => {
      if (socket.user.role === 'admin') socket.join('admin');
    });
    socket.on('driver:location', (position) => {
      const now = Date.now();
      if (now - lastLocationAt < 750) return; // preserve 1–4s GPS updates; drop floods
      lastLocationAt = now;
      recordLocation(io, { ...position, user: socket.user, capturedAt: position.capturedAt })
        .catch((err) => console.error('Socket location update failed:', err));
    });
  });
}

module.exports = initSockets;
